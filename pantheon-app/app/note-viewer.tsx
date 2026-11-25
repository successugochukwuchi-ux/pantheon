import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { BirdIcon, CalculatorIcon, MicIcon, StopIcon, SendIcon } from '../components/Icons';
import { NoteRenderer } from '../components/NoteRenderer';
import { HermesMessageContent } from '../components/HermesMessageContent';
import { MathText } from '../components/MathText';
import { KeyboardSafeModalView, useKeyboardHeight } from '../components/KeyboardSafeWrapper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { getBackendUrls } from '../lib/backendConfig';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { getDatabase, isCourseDownloadedLocal, getLocalNotes, getLocalCourse } from '../lib/db';
import {
  speakText,
  stopSpeech,
  pauseSpeech,
  resumeSpeech,
  addSpeechStopListener,
  extractSpeakableNoteText,
  prefetchNoteAudio,
} from '../lib/ttsService';
import {
  getCachedNoteById,
  getCachedNoteByIdAsync,
  setCachedNoteById,
  getCachedCourseById,
  getCachedCourseNotesSync,
  setCachedCourseNotes,
  sortNotesAlphabetically,
} from '../lib/noteCache';
import {
  ChatMessage,
  AIConfig,
  chatWithHermesMobileStream,
  transcribeHermesAudio,
  sanitizeHermesError,
} from '../lib/hermesService';
import * as Speech from 'expo-speech';
import { WebView } from 'react-native-webview';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order?: number;
  date?: string;
  progress?: number;
  summary?: string;
}

// ── Toolbar overlay ───────────────────────────────────────────────────────────
function Toolbar({ visible, onClose, s, C }: { visible: boolean; onClose: () => void; s: any; C: any }) {
  if (!visible) return null;
  const actions = ['Highlight', 'Bookmark', 'Add Note', 'Share'];
  return (
    <View style={[s.toolbarOverlay, { backgroundColor: C.surface, borderColor: C.border }]}>
      {actions.map((a) => (
        <TouchableOpacity key={a} style={s.toolbarItem} onPress={onClose} activeOpacity={0.7}>
          <Text style={[s.toolbarItemText, { color: C.ink }]}>{a}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NoteViewerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const { noteId, courseId } = useLocalSearchParams<{ noteId: string; courseId: string }>();
  const { isKeyboardVisible } = useKeyboardHeight();
  const [hermesOpen, setHermesOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [hermesMsg, setHermesMsg] = useState('');
  const [hermesChat, setHermesChat] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am Hermes. Ask me anything about this note.' }
  ]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [hermesLoading, setHermesLoading] = useState(false);
  const hermesScrollRef = useRef<ScrollView>(null);
  const hermesAbortRef = useRef<AbortController | null>(null);
  const streamThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStreamTextRef = useRef<string>('');

  // Auto-scroll Hermes chat to follow the latest message
  useEffect(() => {
    if (hermesOpen) {
      const timer = setTimeout(() => {
        hermesScrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [hermesChat.length, hermesLoading, hermesOpen]);

  useEffect(() => {
    return () => {
      hermesAbortRef.current?.abort();
      if (streamThrottleTimerRef.current) clearTimeout(streamThrottleTimerRef.current);
    };
  }, []);

  // Text-To-Speech states
  const [speechIsPreparing, setSpeechIsPreparing] = useState(false);
  const [speechPrepProgress, setSpeechPrepProgress] = useState(0);
  const [speechIsPlaying, setSpeechIsPlaying] = useState(false);
  const [speechIsPaused, setSpeechIsPaused] = useState(false);

  // Calculator states
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcAngleMode, setCalcAngleMode] = useState<'DEG' | 'RAD'>('DEG');

  const [focusedBlock, setFocusedBlock] = useState<{ type: 'math' | 'diagram'; content: string } | null>(null);
  const [mathViewMode, setMathViewMode] = useState<'scroll' | 'fit'>('scroll');
  const [toolbarVisible, setToolbarVisible] = useState(false);

  const initialCachedNote = useMemo(() => {
    const syncNote = getCachedNoteById(noteId);
    if (syncNote && syncNote.content) {
      return syncNote as Note;
    }
    try {
      const ldb = getDatabase();
      if (ldb && ldb.getFirstSync && noteId) {
        const res = ldb.getFirstSync('SELECT * FROM notes WHERE id = ?', [noteId]) as any;
        if (res && res.content) {
          return {
            id: res.id,
            courseId: res.courseId,
            title: res.title,
            content: res.content,
            order: res.order,
          } as Note;
        }
      }
    } catch {}
    return null;
  }, [noteId]);

  const [note, setNote] = useState<Note | null>(initialCachedNote);
  const [courseCode, setCourseCode] = useState(() => {
    const cid = courseId || initialCachedNote?.courseId;
    const cachedCourse = getCachedCourseById(cid);
    return cachedCourse?.code || '';
  });
  const { isOffline } = useAuth();

  const swipeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focusedBlock?.type === 'math') {
      setMathViewMode('scroll');
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(swipeAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(swipeAnim, {
            toValue: 0,
            duration: 1100,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [focusedBlock]);

  useEffect(() => {
    const cid = courseId || note?.courseId;
    if (!cid) return;
    const cachedC = getCachedCourseById(cid);
    if (cachedC && cachedC.code) {
      setCourseCode(cachedC.code);
      return;
    }
    const localC = getLocalCourse(cid);
    if (localC && localC.code) {
      setCourseCode(localC.code);
    } else if (!isOffline) {
      getDoc(doc(db, 'courses', cid)).then(snap => {
        if (snap.exists()) {
          setCourseCode(snap.data().code || '');
        }
      }).catch(err => console.log('Error fetching course details in note-viewer:', err));
    }
  }, [courseId, note?.courseId, isOffline]);

  const [loading, setLoading] = useState(!initialCachedNote);
  const [error, setError] = useState<string | null>(null);
  const [prevNote, setPrevNote] = useState<Note | null>(null);
  const [nextNote, setNextNote] = useState<Note | null>(null);
  const [noteIndex, setNoteIndex] = useState<number>(-1);

  // Animations - immediate if cached so note appears with zero delay
  const opacity = useRef(new Animated.Value(initialCachedNote ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(initialCachedNote ? 0 : 12)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Track completion
  const lastTrackedId = useRef<string | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const isCompleted = useRef(false);

  const handleProgressScroll = (percentage: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    if (clamped !== scrollPct) {
      setScrollPct(clamped);
      Animated.spring(progressAnim, {
        toValue: clamped,
        useNativeDriver: false,
        tension: 40,
        friction: 7
      }).start();
    }
  };

  const handleNoteNavigate = (action: 'prev' | 'next') => {
    stopSpeech().catch(() => {});
    setSpeechIsPreparing(false);
    setSpeechIsPlaying(false);
    setSpeechIsPaused(false);
    if (action === 'prev' && prevNote) {
      router.push({
        pathname: '/note-viewer',
        params: { courseId, noteId: prevNote.id },
      });
    } else if (action === 'next' && nextNote) {
      router.push({
        pathname: '/note-viewer',
        params: { courseId, noteId: nextNote.id },
      });
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset?.y || 0;
    const maximumOffset = (contentSize?.height || 0) - (layoutMeasurement?.height || 0);
    
    if (maximumOffset <= 0) return;
    
    const percentage = Math.max(0, Math.min(100, Math.round((currentOffset / maximumOffset) * 100)));
    handleProgressScroll(percentage);
  };

  const saveProgress = async (pct: number) => {
    if (!profile || !noteId) return;
    try {
      const isDone = pct >= 95;
      await setDoc(doc(db, 'progress', `${profile.uid}_${noteId}`), {
        uid: profile.uid,
        targetId: noteId,
        type: 'note',
        percentage: isDone ? 100 : pct,
        completed: isDone,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (isDone && !isCompleted.current) {
        isCompleted.current = true;
      }
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  };

  useEffect(() => {
    if (scrollPct > 0 && scrollPct % 10 === 0) { // Save every 10%
      saveProgress(scrollPct);
    }
    if (scrollPct >= 95 && !isCompleted.current) {
      saveProgress(100);
    }
  }, [scrollPct]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'hermes'), (snapshot) => {
      if (snapshot.exists()) {
        setAiConfig(snapshot.data() as AIConfig);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchNoteData() {
      if (!noteId) {
        if (isMounted) {
          setLoading(false);
          setError('No note selected');
        }
        return;
      }

      setError(null);

      // 1. Check in-memory and SQLite synchronous cache first for 0ms render
      let currentNote: Note | null = getCachedNoteById(noteId) as Note | null;
      if (!currentNote || !currentNote.content) {
        try {
          const ldb = getDatabase();
          if (ldb && ldb.getFirstSync) {
            const res = ldb.getFirstSync('SELECT * FROM notes WHERE id = ?', [noteId]) as any;
            if (res && res.content) {
              currentNote = {
                id: res.id,
                courseId: res.courseId,
                title: res.title,
                content: res.content,
                order: res.order,
              };
            }
          }
        } catch {}
      }

      // 2. Check AsyncStorage cache before showing loading spinner
      if (!currentNote || !currentNote.content) {
        const asyncCached = await getCachedNoteByIdAsync(noteId);
        if (asyncCached && asyncCached.content) {
          currentNote = asyncCached as Note;
        }
      }

      if (currentNote && currentNote.content) {
        if (isMounted) {
          setNote(currentNote);
          setLoading(false);
        }
      } else {
        if (isMounted) setLoading(true);
      }

      try {
        // 3. Fetch fresh note from Firestore if not already loaded or to refresh in background
        if (!currentNote || !currentNote.content) {
          const noteDoc = await getDoc(doc(db, 'notes', noteId));
          if (noteDoc.exists()) {
            currentNote = { id: noteId, ...noteDoc.data() } as Note;
            setCachedNoteById(currentNote);
          }
        } else if (!isOffline) {
          // Background refresh without blocking UI
          getDoc(doc(db, 'notes', noteId)).then(noteDoc => {
            if (noteDoc.exists() && isMounted) {
              const fresh = { id: noteId, ...noteDoc.data() } as Note;
              setCachedNoteById(fresh);
              if (fresh.content !== currentNote?.content || fresh.title !== currentNote?.title) {
                setNote(prev => prev ? { ...prev, ...fresh } : fresh);
              }
            }
          }).catch(() => {});
        }

        if (!currentNote) {
          if (isMounted) {
            setError(`Topic not found: ${noteId}`);
            setLoading(false);
          }
          return;
        }

        // Immediately render note content without waiting for adjacent notes or progress!
        if (isMounted) {
          setNote(currentNote);
          setLoading(false);
        }

        // 4. Resolve adjacent notes in the background (using cache first)
        const targetCourseId = currentNote.courseId || courseId;
        (async () => {
          try {
            let allNotesInCourse: Note[] = (getCachedCourseNotesSync(targetCourseId) as Note[]) || [];
            if (allNotesInCourse.length === 0) {
              if (isCourseDownloadedLocal(targetCourseId)) {
                allNotesInCourse = getLocalNotes(targetCourseId).map(n => ({
                  id: n.id,
                  courseId: n.courseId,
                  title: n.title,
                  content: n.content,
                  order: n.order,
                } as Note));
              } else {
                const q = query(
                  collection(db, 'notes'),
                  where('courseId', '==', targetCourseId)
                );
                const notesSnap = await getDocs(q);
                allNotesInCourse = notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
              }
              allNotesInCourse = sortNotesAlphabetically(allNotesInCourse);
              setCachedCourseNotes(targetCourseId, allNotesInCourse);
            } else {
              allNotesInCourse = sortNotesAlphabetically(allNotesInCourse);
            }

            if (!isMounted) return;
            const idx = allNotesInCourse.findIndex(n => n.id === noteId);
            setNoteIndex(idx);
            setPrevNote(idx > 0 ? allNotesInCourse[idx - 1] : null);
            setNextNote(idx >= 0 && idx < allNotesInCourse.length - 1 ? allNotesInCourse[idx + 1] : null);

            // 5. Update Progress asynchronously in background
            if (profile?.uid && lastTrackedId.current !== noteId) {
              lastTrackedId.current = noteId;
              const noteProgressRef = doc(db, 'progress', `${profile.uid}_${noteId}`);
              const progSnap = await getDoc(noteProgressRef);
              if (!isMounted) return;

              let initialProgress = 0;
              if (progSnap.exists()) {
                const data = progSnap.data();
                initialProgress = data.percentage || 0;
                if (data.completed) isCompleted.current = true;
              }
              setScrollPct(initialProgress);
              progressAnim.setValue(initialProgress);
            }
          } catch (navErr) {
            console.warn('NoteViewer background metadata error:', navErr);
          }
        })();
      } catch (e) {
        console.error('NoteViewer: Main fetch error', e);
        handleFirestoreError(e, OperationType.GET, 'notes');
        if (isMounted && !currentNote) {
          setError('Failed to load note content');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchNoteData();

    return () => {
      isMounted = false;
    };
  }, [noteId]);

  useEffect(() => {
    if (!loading && note) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(progressAnim, {
          toValue: scrollPct || 0,
          duration: 450,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [loading, note]);

  const handleCalcAppend = (val: string) => {
    setCalcExpr(prev => prev + val);
    setCalcError(null);
  };

  const handleCalcBackspace = () => {
    setCalcExpr(prev => prev.slice(0, -1));
  };

  const handleCalcClear = () => {
    setCalcExpr('');
    setCalcResult(null);
    setCalcError(null);
  };

  const formatExprForDisplay = (raw: string): string => {
    return raw
      .replace(/log10\(/g, 'log₁₀(')
      .replace(/log\(/g, 'ln(')
      .replace(/sqrt\(/g, '√(')
      .replace(/pi/g, 'π')
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/exp\(/g, 'exp(');
  };

  const evaluateExpressionMobile = (expr: string): number => {
    const mode = calcAngleMode;
    const _sin = (val: number) => {
      return mode === 'DEG' ? Math.sin(val * Math.PI / 180) : Math.sin(val);
    };
    const _cos = (val: number) => {
      return mode === 'DEG' ? Math.cos(val * Math.PI / 180) : Math.cos(val);
    };
    const _tan = (val: number) => {
      return mode === 'DEG' ? Math.tan(val * Math.PI / 180) : Math.tan(val);
    };

    let sanitized = expr
      .replace(/\bsin\(/g, '_sin(')
      .replace(/\bcos\(/g, '_cos(')
      .replace(/\btan\(/g, '_tan(')
      .replace(/\blog10\(/g, 'Math.log10(')
      .replace(/\blog\(/g, 'Math.log(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\bexp\(/g, 'Math.exp(')
      .replace(/\bpi\b/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\^/g, '**');

    // Basic sanity check to prevent arbitrary execution code
    if (/[^0-9.+\-*/%()eMathPI_sincostanlog10sqrtpx,\s]/i.test(sanitized)) {
      throw new Error('Invalid expression');
    }

    try {
      const result = new Function('_sin', '_cos', '_tan', `return (${sanitized});`)(_sin, _cos, _tan);
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Result is not a number');
      }
      return result;
    } catch {
      throw new Error('Math error');
    }
  };

  const handleCalcEvaluate = () => {
    if (!calcExpr) return;
    try {
      const res = evaluateExpressionMobile(calcExpr);
      const formatted = Number(res.toFixed(10)).toString();
      setCalcResult(formatted);
      setCalcError(null);
    } catch (err: any) {
      setCalcError(err.message || 'Error');
      setCalcResult(null);
    }
  };

  // Stop any running TTS or voice recording when leaving the note screen or changing noteId
  useEffect(() => {
    if (pathname && !pathname.includes('note-viewer')) {
      stopSpeech().catch(() => {});
      setSpeechIsPreparing(false);
      setSpeechIsPlaying(false);
      setSpeechIsPaused(false);
      setSpeechPrepProgress(0);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      setIsRecordingVoice(false);
      setIsTranscribingVoice(false);
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      stopSpeech().catch(() => {});
      setSpeechIsPreparing(false);
      setSpeechIsPlaying(false);
      setSpeechIsPaused(false);
      setSpeechPrepProgress(0);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      setIsRecordingVoice(false);
      setIsTranscribingVoice(false);
    };
  }, [noteId]);

  useEffect(() => {
    const unsubStop = addSpeechStopListener(() => {
      setSpeechIsPreparing(false);
      setSpeechIsPlaying(false);
      setSpeechIsPaused(false);
    });
    return () => {
      unsubStop();
      stopSpeech().catch(() => {});
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  // Pre-compute clean speakable text and background-prefetch the first 2 small chunks from Render
  const speakableNoteText = useMemo(() => {
    if (!note) return '';
    return extractSpeakableNoteText(note.content, note.title, note.summary);
  }, [note?.content, note?.title, note?.summary]);

  useEffect(() => {
    if (!speakableNoteText || isOffline) return;
    prefetchNoteAudio(speakableNoteText);
  }, [speakableNoteText, isOffline]);

  const handleToggleSpeakNote = async () => {
    try {
      if (speechIsPlaying) {
        if (speechIsPaused) {
          await resumeSpeech();
          setSpeechIsPaused(false);
        } else {
          await pauseSpeech();
          setSpeechIsPaused(true);
        }
        return;
      }

      if (speechIsPreparing) {
        await stopSpeech();
        setSpeechIsPreparing(false);
        setSpeechIsPlaying(false);
        setSpeechIsPaused(false);
        setSpeechPrepProgress(0);
        return;
      }

      const cleanText = speakableNoteText || `${note?.title || 'Lecture Note'}.`;

      setSpeechIsPreparing(true);
      setSpeechPrepProgress(0);
      setSpeechIsPlaying(false);
      setSpeechIsPaused(false);

      await speakText(cleanText, {
        onPreparing: (progress) => {
          setSpeechIsPreparing(true);
          setSpeechPrepProgress(progress);
        },
        onStart: () => {
          setSpeechIsPreparing(false);
          setSpeechIsPlaying(true);
          setSpeechIsPaused(false);
        },
        onDone: () => {
          setSpeechIsPreparing(false);
          setSpeechIsPlaying(false);
          setSpeechIsPaused(false);
          setSpeechPrepProgress(100);
        },
        onError: (err) => {
          console.warn("TTS Playback Error:", err);
          setSpeechIsPreparing(false);
          setSpeechIsPlaying(false);
          setSpeechIsPaused(false);
        }
      });
    } catch (e) {
      console.error("Speech Synthesis failed:", e);
    }
  };

  const handleStopSpeaking = async () => {
    try {
      await stopSpeech();
      setSpeechIsPreparing(false);
      setSpeechIsPlaying(false);
      setSpeechIsPaused(false);
      setSpeechPrepProgress(0);
    } catch (e) {
      console.log(e);
    }
  };

  const handleCloseHermes = async () => {
    hermesAbortRef.current?.abort();
    if (streamThrottleTimerRef.current) {
      clearTimeout(streamThrottleTimerRef.current);
      streamThrottleTimerRef.current = null;
    }
    setHermesLoading(false);
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      setIsRecordingVoice(false);
      setIsTranscribingVoice(false);
    } catch {}
    setHermesOpen(false);
  };

  const toggleVoiceRecording = async () => {
    if (speechIsPlaying || speechIsPreparing) {
      try {
        await stopSpeech();
        setSpeechIsPlaying(false);
        setSpeechIsPreparing(false);
        setSpeechIsPaused(false);
      } catch {}
    }

    if (isRecordingVoice) {
      // Stop recording and transcribe into the input box
      setIsRecordingVoice(false);
      setIsTranscribingVoice(true);
      try {
        if (!recordingRef.current) {
          setIsTranscribingVoice(false);
          return;
        }
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        }).catch(() => {});

        if (!uri) {
          setIsTranscribingVoice(false);
          return;
        }

        const transcribedText = await transcribeHermesAudio(uri, aiConfig);
        setIsTranscribingVoice(false);

        if (transcribedText) {
          setHermesMsg(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcribedText}` : transcribedText;
          });
        } else {
          Alert.alert(
            'Could Not Catch That',
            'Hermes could not hear clear speech. Please speak clearly into the microphone and try again.'
          );
        }
      } catch (err) {
        console.error('Audio transcription error:', err);
        setIsTranscribingVoice(false);
      }
    } else {
      // Start recording
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Microphone Permission', 'Microphone access is required to speak to Hermes.');
          return;
        }

        if (recordingRef.current) {
          try {
            await recordingRef.current.stopAndUnloadAsync();
          } catch {}
          recordingRef.current = null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await newRecording.startAsync();

        recordingRef.current = newRecording;
        setIsRecordingVoice(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        setIsRecordingVoice(false);
      }
    }
  };

  const handleStopHermes = () => {
    hermesAbortRef.current?.abort();
    hermesAbortRef.current = null;
    if (streamThrottleTimerRef.current) {
      clearTimeout(streamThrottleTimerRef.current);
      streamThrottleTimerRef.current = null;
    }
    setHermesLoading(false);
  };

  const handleSendHermes = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : hermesMsg).trim();
    if (!textToSend || hermesLoading) return;

    if (aiConfig && aiConfig.isActive === false) {
      setHermesChat(prev => [...prev, { role: 'assistant', content: 'Hermes AI chatbot is currently inactive. Please enable it in the admin panel.' }]);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    const extendedChat = [...hermesChat, userMessage];
    setHermesChat([...extendedChat, { role: 'assistant', content: '' }]);
    setHermesMsg('');
    setHermesLoading(true);
    latestStreamTextRef.current = '';

    const controller = new AbortController();
    hermesAbortRef.current = controller;

    const commitStreamUpdate = (textVal: string) => {
      setHermesChat(prev => {
        if (prev.length === 0) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: textVal };
        return copy;
      });
    };

    try {
      const botResponse = await chatWithHermesMobileStream(
        extendedChat,
        note?.content || '',
        (_chunk, fullText) => {
          latestStreamTextRef.current = fullText;
          if (!streamThrottleTimerRef.current) {
            streamThrottleTimerRef.current = setTimeout(() => {
              streamThrottleTimerRef.current = null;
              commitStreamUpdate(latestStreamTextRef.current);
            }, 45);
          }
        },
        aiConfig || undefined,
        false,
        controller.signal
      );
      if (streamThrottleTimerRef.current) {
        clearTimeout(streamThrottleTimerRef.current);
        streamThrottleTimerRef.current = null;
      }
      commitStreamUpdate(botResponse || latestStreamTextRef.current);
    } catch (err: any) {
      if (streamThrottleTimerRef.current) {
        clearTimeout(streamThrottleTimerRef.current);
        streamThrottleTimerRef.current = null;
      }
      if (err?.name === 'AbortError') {
        if (!latestStreamTextRef.current) {
          setHermesChat(prev => prev.filter((m, idx) => !(idx === prev.length - 1 && m.role === 'assistant' && !m.content)));
        } else {
          commitStreamUpdate(latestStreamTextRef.current);
        }
      } else {
        console.error('Hermes AI Chat Error:', err);
        const sanitizedErrorMsg = sanitizeHermesError(err?.message || '');
        commitStreamUpdate(latestStreamTextRef.current ? `${latestStreamTextRef.current}\n\n${sanitizedErrorMsg}` : sanitizedErrorMsg);
      }
    } finally {
      hermesAbortRef.current = null;
      setHermesLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.activeText} />
        <Text style={{ marginTop: 12, fontFamily: F.medium, color: C.inkLight }}>Opening note...</Text>
      </SafeAreaView>
    );
  }

  if (error || !note) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: F.medium, color: C.ink, textAlign: 'center', padding: 20 }}>
          {error || (loading ? 'Opening note...' : 'Note not found.')}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.activeText, fontFamily: F.bold }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent && noteIndex > 0) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        {/* Simple Header */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.iconBtn}>
            <View style={[s.backArrow, { backgroundColor: C.ink }]} />
            <View style={[s.backArrowHead, { borderColor: C.ink }]} />
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]} numberOfLines={1}>
            Academic Trial Limit
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Academic Trial Limit
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 325 }}>
            Standard accounts only have access to the oldest study guide/lecture note of each course. Activate your account using an activation pin to unlock all notes, past questions, and full study materials.
          </Text>

          <TouchableOpacity
            style={{ width: '100%', height: 56, backgroundColor: C.ink, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => router.replace('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ width: '100%', height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO TOPICS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Hermes Floating Interface */}
      <Modal visible={hermesOpen} transparent animationType="slide" onRequestClose={handleCloseHermes}>
        <KeyboardSafeModalView style={s.hermesOverlay}>
           <View style={[s.hermesContent, { backgroundColor: C.bg, height: isKeyboardVisible ? '92%' : '70%' }]}>
              <View style={[s.hermesHeader, { backgroundColor: C.surfaceDark, justifyContent: 'space-between' }]}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                   <BirdIcon color="#fff" />
                   <Text style={s.hermesTitle}>HERMES AI</Text>
                 </View>
                 <TouchableOpacity onPress={handleCloseHermes}>
                   <Text style={{ color: '#fff', fontFamily: F.bold }}>Close</Text>
                 </TouchableOpacity>
              </View>

              {isRecordingVoice && (
                <View style={{ backgroundColor: '#ef444415', borderBottomWidth: 1, borderBottomColor: '#ef444430', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#dc2626', fontFamily: F.bold, fontSize: 11 }}>
                    🎙️ Listening... Tap stop when finished speaking
                  </Text>
                  <TouchableOpacity
                    onPress={toggleVoiceRecording}
                    style={{ backgroundColor: '#dc262620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}
                  >
                    <Text style={{ color: '#dc2626', fontFamily: F.bold, fontSize: 10 }}>Transcribe ↵</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isTranscribingVoice && (
                <View style={{ backgroundColor: '#3b82f615', borderBottomWidth: 1, borderBottomColor: '#3b82f630', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={{ color: '#2563eb', fontFamily: F.medium, fontSize: 11 }}>
                    Transcribing your speech...
                  </Text>
                </View>
              )}

              <ScrollView
                ref={hermesScrollRef}
                style={s.hermesChatScroll}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => {
                  hermesScrollRef.current?.scrollToEnd({ animated: false });
                }}
                onLayout={() => {
                  hermesScrollRef.current?.scrollToEnd({ animated: false });
                }}
              >
                {hermesChat.map((m, i) => {
                  if (m.role === 'assistant' && !m.content && hermesLoading) {
                    return (
                      <View
                        key={i}
                        style={[s.hermesBubble, s.hermesBot, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, alignSelf: 'flex-start' }]}
                      >
                        <ActivityIndicator size="small" color={C.activeText} />
                        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.inkMid }}>Hermes is thinking...</Text>
                      </View>
                    );
                  }
                  return (
                    <View 
                      key={i} 
                      style={[
                        s.hermesBubble, 
                        m.role === 'user' 
                          ? [s.hermesUser, { backgroundColor: C.surfaceDark, alignSelf: 'flex-end', maxWidth: '85%' }] 
                          : [s.hermesBot, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '92%', width: 'auto', padding: 0 }] 
                      ]}
                    >
                      {m.role === 'user' ? (
                        <MathText
                          text={m.content}
                          style={[s.hermesText, { color: '#FFFFFF' }]}
                          mathColor="#FFFFFF"
                        >
                          {m.content}
                        </MathText>
                      ) : (
                        <HermesMessageContent content={m.content} C={C} />
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={[s.hermesInputRow, { borderTopColor: C.border, alignItems: 'center', paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 16) }]}>
                <TextInput 
                  style={[s.hermesInput, { backgroundColor: C.surface, color: C.ink, flex: 1 }]} 
                  placeholder={isRecordingVoice ? "Listening... Speak now" : "Ask Hermes or tap mic to speak..."} 
                  value={hermesMsg}
                  onChangeText={setHermesMsg}
                  placeholderTextColor={C.inkLight}
                  onSubmitEditing={() => {
                    if (hermesMsg.trim() && !hermesLoading) handleSendHermes();
                  }}
                />
                <TouchableOpacity 
                  style={[
                    s.hermesSend,
                    {
                      backgroundColor: (hermesLoading || isRecordingVoice) ? '#ef4444' : C.ink,
                    },
                  ]}
                  onPress={() => {
                    if (hermesLoading) {
                      handleStopHermes();
                    } else if (isRecordingVoice) {
                      toggleVoiceRecording();
                    } else if (hermesMsg.trim()) {
                      handleSendHermes();
                    } else {
                      toggleVoiceRecording();
                    }
                  }}
                  disabled={isTranscribingVoice}
                  activeOpacity={0.8}
                >
                  {isTranscribingVoice ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : hermesLoading || isRecordingVoice ? (
                    <StopIcon color="#ffffff" />
                  ) : hermesMsg.trim() ? (
                    <SendIcon color={C.bg} />
                  ) : (
                    <MicIcon color={C.bg} />
                  )}
                </TouchableOpacity>
              </View>
           </View>
        </KeyboardSafeModalView>
      </Modal>

      {/* Scientific Calculator Floating Interface */}
      <Modal visible={calcOpen} transparent animationType="slide">
         <View style={s.calcOverlay}>
            <View style={[s.calcContent, { backgroundColor: C.bg }]}>
               <View style={[s.calcHeader, { backgroundColor: C.surfaceDark }]}>
                  <CalculatorIcon color="#fff" />
                  <Text style={s.calcTitle}>SCIENTIFIC CALCULATOR</Text>
                  <TouchableOpacity onPress={() => setCalcOpen(false)}>
                    <Text style={{ color: '#fff', fontFamily: F.bold }}>Close</Text>
                  </TouchableOpacity>
               </View>
               <View style={{ padding: 16, flex: 1, justifyContent: 'space-between' }}>
                  {/* Expression Input & Output Display */}
                  <View style={[s.calcDisplay, { borderColor: C.border, backgroundColor: C.surface, position: 'relative' }]}>
                     <View style={{ position: 'absolute', top: 8, left: 12 }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.inkLight }}>{calcAngleMode}</Text>
                     </View>
                     <Text style={[s.calcExprText, { color: C.inkLight }]} numberOfLines={1}>
                       {formatExprForDisplay(calcExpr) || ' '}
                     </Text>
                     <Text style={[s.calcResultText, { color: calcError ? '#ef4444' : C.ink }]}>
                       {calcError ? calcError : (calcResult !== null ? `= ${calcResult}` : '0')}
                     </Text>
                  </View>

                  {/* Actions Row (AC, Del, DEG/RAD toggle) */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                     <TouchableOpacity 
                        style={[s.calcRowBtn, { backgroundColor: '#ef4444' }]} 
                        onPress={handleCalcClear}
                     >
                        <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 13 }}>AC</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[s.calcRowBtn, { backgroundColor: C.border }]} 
                        onPress={handleCalcBackspace}
                     >
                        <Text style={{ color: C.ink, fontFamily: F.bold, fontSize: 13 }}>⌫</Text>
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={[s.calcRowBtn, { backgroundColor: C.surfaceDark, borderWidth: 1, borderColor: C.border }]} 
                        onPress={() => setCalcAngleMode(prev => prev === 'DEG' ? 'RAD' : 'DEG')}
                     >
                        <Text style={{ color: '#ffffff', fontFamily: F.bold, fontSize: 13 }}>{calcAngleMode}</Text>
                     </TouchableOpacity>
                  </View>

                  {/* 4-column Grid */}
                  <View style={s.calcGrid}>
                     {/* Row 1 */}
                     <View style={s.calcRow}>
                        {['sin(', 'cos(', 'tan(', 'log10('].map((op, i) => {
                           const label = ['sin', 'cos', 'tan', 'log'][i];
                           return (
                              <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                                 <Text style={[s.calcGridTextScientific, { color: C.inkLight }]}>{label}</Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>
                     {/* Row 2 */}
                     <View style={s.calcRow}>
                        {['log(', 'sqrt(', '^', 'pi'].map((op, i) => {
                           const label = ['ln', '√', '^', 'π'][i];
                           return (
                              <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                                 <Text style={[s.calcGridTextScientific, { color: C.inkLight }]}>{label}</Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>
                     {/* Row 3 */}
                     <View style={s.calcRow}>
                        {['e', '(', ')', 'exp('].map((op, i) => {
                           const label = ['e', '(', ')', 'EXP'][i];
                           return (
                              <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                                 <Text style={[s.calcGridTextScientific, { color: C.inkLight }]}>{label}</Text>
                              </TouchableOpacity>
                           );
                        })}
                     </View>
                     {/* Row 4 */}
                     <View style={s.calcRow}>
                        {['7', '8', '9', '/'].map((op) => (
                           <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                              <Text style={[s.calcGridText, { color: C.ink }]}>{op}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                     {/* Row 5 */}
                     <View style={s.calcRow}>
                        {['4', '5', '6', '*'].map((op) => (
                           <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                              <Text style={[s.calcGridText, { color: C.ink }]}>{op}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                     {/* Row 6 */}
                     <View style={s.calcRow}>
                        {['1', '2', '3', '-'].map((op) => (
                           <TouchableOpacity key={op} style={[s.calcGridBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleCalcAppend(op)}>
                              <Text style={[s.calcGridText, { color: C.ink }]}>{op}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                     {/* Row 7 */}
                     <View style={s.calcRow}>
                        {['0', '.', '+', '='].map((op) => (
                           <TouchableOpacity 
                              key={op} 
                              style={[s.calcGridBtn, op === '=' ? { backgroundColor: C.ink } : { backgroundColor: C.surface, borderColor: C.border }]} 
                              onPress={op === '=' ? handleCalcEvaluate : () => handleCalcAppend(op)}
                           >
                              <Text style={[s.calcGridText, op === '=' ? { color: C.bg, fontFamily: F.bold } : { color: C.ink }]}>{op}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  </View>
               </View>
            </View>
         </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => {
            stopSpeech().catch(() => {});
            setSpeechIsPreparing(false);
            setSpeechIsPlaying(false);
            setSpeechIsPaused(false);
            router.push({ pathname: '/notes-topics', params: { courseId: note.courseId } });
          }}
          activeOpacity={0.7}
          style={s.iconBtn}
        >
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginHorizontal: 10 }]} numberOfLines={1} ellipsizeMode="tail">
          {note?.title || 'COLEARN'}
        </Text>
        <TouchableOpacity
          onPress={() => setHermesOpen(true)}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: C.border + '60',
            borderWidth: 1,
            borderColor: C.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BirdIcon color={C.ink} />
        </TouchableOpacity>
      </View>

      {/* Progress bar - Sleek fixed bar at top */}
      <View style={[s.progressContainer, { backgroundColor: C.border }]}>
        <Animated.View
          style={[
            s.progressFill,
            {
              backgroundColor: C.activeText,
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Audio Reader Widget (Text-To-Speech) */}
      <View style={{
        backgroundColor: C.surface,
        borderColor: C.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 6,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: speechIsPlaying && !speechIsPaused ? C.activeText + '15' : C.border,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10
            }}>
              <Text style={{ fontSize: 15, color: speechIsPlaying && !speechIsPaused ? C.activeText : C.ink }}>🔊</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.ink }}>Audio Study Assistant</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.inkLight, marginTop: 1 }} numberOfLines={1}>
                {speechIsPreparing
                  ? `Preparing voiceover (${speechPrepProgress}%)...`
                  : speechIsPlaying
                  ? (speechIsPaused ? 'Playback paused' : 'Reading study guide...')
                  : 'Listen to this complete note'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={handleToggleSpeakNote}
              activeOpacity={0.85}
              style={{
                backgroundColor: speechIsPreparing ? C.activeText + '20' : (speechIsPlaying && !speechIsPaused ? C.border : C.ink),
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Text style={{ fontSize: 10, color: speechIsPreparing ? C.activeText : (speechIsPlaying && !speechIsPaused ? C.ink : C.bg) }}>
                {speechIsPreparing ? '⏳' : (speechIsPlaying ? (speechIsPaused ? '▶' : '❚❚') : '▶')}
              </Text>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: speechIsPreparing ? C.activeText : (speechIsPlaying && !speechIsPaused ? C.ink : C.bg) }}>
                {speechIsPreparing ? `Preparing ${speechPrepProgress}%` : (speechIsPlaying ? (speechIsPaused ? 'Resume' : 'Pause') : 'Listen')}
              </Text>
            </TouchableOpacity>

            {(speechIsPlaying || speechIsPreparing) && (
              <TouchableOpacity
                onPress={handleStopSpeaking}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#ef444415',
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#ef444430'
                }}
              >
                <Text style={{ fontFamily: F.bold, fontSize: 11, color: '#ef4444' }}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Note content rendered with independently scrollable NoteRenderer */}
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
        <NoteRenderer
          content={note.content}
          scrollEnabled={true}
          onScrollPercentage={handleProgressScroll}
          onNavigate={handleNoteNavigate}
          headerMeta={{
            courseCode: courseCode ? courseCode.toUpperCase() : (courseId?.toUpperCase() || 'COURSE'),
            title: note.title,
            date: note.date || 'LATEST UPDATE',
          }}
          summary={note.summary}
          nav={{
            hasPrev: !!prevNote,
            hasNext: !!nextNote,
          }}
          onFocusBlock={(type, content) => setFocusedBlock({ type, content })}
        />
      </Animated.View>

      {/* Floating Buttons */}
      <View style={{ position: 'absolute', bottom: 32, right: 20, alignItems: 'center' }}>
        {!isUnactivatedStudent && (
          <TouchableOpacity 
            style={[s.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: C.ink, marginBottom: 16 }]} 
            onPress={() => setHermesOpen(true)}
            activeOpacity={0.8}
          >
            <BirdIcon color={C.bg} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[s.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: C.ink }]} 
          onPress={() => setCalcOpen(true)}
          activeOpacity={0.8}
        >
          <CalculatorIcon color={C.bg} />
        </TouchableOpacity>
      </View>

      {/* Tap-to-Focus Zoom Modal for Formulas and Diagrams */}
      {focusedBlock && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setFocusedBlock(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 450, backgroundColor: C.bg, borderRadius: 24, padding: 24, overflow: 'hidden' }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 16, textAlign: 'center' }}>
                {focusedBlock.type === 'math' ? 'Detailed Math Formula' : 'Diagram Zoom'}
              </Text>
              
              {focusedBlock.type === 'math' ? (
                <View style={{ width: '100%', gap: 14 }}>
                  {/* Formula Display Box */}
                  <View style={{ width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
                    <NoteRenderer 
                      key={mathViewMode}
                      content={JSON.stringify([{ id: 'focus_math', type: 'math', content: focusedBlock.content }])} 
                      bgOverride={C.surface}
                      paddingOverride="18px 14px"
                      scrollableMath={mathViewMode === 'scroll'}
                    />
                  </View>

                  {/* Horizontal Scroll Guide & Controls in the Empty Space */}
                  <View style={{ 
                    backgroundColor: C.surface, 
                    borderRadius: 16, 
                    borderWidth: 1, 
                    borderColor: C.border, 
                    padding: 14,
                    alignItems: 'center' 
                  }}>
                    {/* Animated Swipe Cue */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 12 }}>
                      <Animated.View style={{ transform: [{ translateX: swipeAnim.interpolate({ inputRange: [0, 1], outputRange: [4, -6] }) }] }}>
                        <Text style={{ fontSize: 16, color: C.inkLight }}>◀</Text>
                      </Animated.View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ fontSize: 12, fontFamily: F.bold, color: C.ink, letterSpacing: 0.6 }}>
                          🖐️  SWIPE HORIZONTALLY
                        </Text>
                      </View>

                      <Animated.View style={{ transform: [{ translateX: swipeAnim.interpolate({ inputRange: [0, 1], outputRange: [-4, 6] }) }] }}>
                        <Text style={{ fontSize: 16, color: C.inkLight }}>▶</Text>
                      </Animated.View>
                    </View>

                    <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink, textAlign: 'center', marginBottom: 3 }}>
                      Scroll equation left & right
                    </Text>
                    <Text style={{ fontFamily: F.regular, fontSize: 11.5, color: C.inkMid, textAlign: 'center', lineHeight: 16, paddingHorizontal: 6 }}>
                      This formula extends beyond the container. Drag horizontally across the formula box above to reveal all hidden terms.
                    </Text>

                    {/* Interactive Display Mode Selector */}
                    <View style={{ flexDirection: 'row', marginTop: 12, backgroundColor: C.bg, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: C.border, width: '100%' }}>
                      <TouchableOpacity
                        onPress={() => setMathViewMode('scroll')}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 7,
                          backgroundColor: mathViewMode === 'scroll' ? C.ink : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontFamily: F.bold, fontSize: 12, color: mathViewMode === 'scroll' ? C.bg : C.inkMid }}>
                          ↔ Full Size (Scroll)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setMathViewMode('fit')}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          borderRadius: 7,
                          backgroundColor: mathViewMode === 'fit' ? C.ink : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontFamily: F.bold, fontSize: 12, color: mathViewMode === 'fit' ? C.bg : C.inkMid }}>
                          🔍 Fit to Screen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={{ width: '100%', height: 350, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                  <WebView
                    originWhitelist={['*']}
                    source={{ html: `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
                          <style>
                            html, body {
                              margin: 0;
                              padding: 0;
                              width: 100%;
                              height: 100%;
                              background-color: #000;
                              display: flex;
                              justify-content: center;
                              align-items: center;
                              overflow: auto;
                              -webkit-overflow-scrolling: touch;
                            }
                            img {
                              max-width: 100%;
                              max-height: 100%;
                              object-fit: contain;
                            }
                          </style>
                        </head>
                        <body>
                          <img src="${focusedBlock.content}" />
                        </body>
                      </html>
                    ` }}
                    style={{ flex: 1, backgroundColor: '#000' }}
                    scrollEnabled={true}
                    scalesPageToFit={true}
                    pinchGestureEnabled={true}
                    minimumZoomScale={1.0}
                    maximumZoomScale={5.0}
                  />
                </View>
              )}
              
              <TouchableOpacity 
                onPress={() => setFocusedBlock(null)}
                style={{ marginTop: 24, backgroundColor: C.ink, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.bg }}>CLOSE VIEW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Toolbar visible={toolbarVisible} onClose={() => setToolbarVisible(false)} s={s} C={C} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { 
    padding: 20, 
    // Generous bottom padding to ensure FAB never cuts off anything!
    paddingBottom: 160,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 850 : undefined,
    alignSelf: 'center',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 16, letterSpacing: 2 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, borderRadius: 1 },
  backArrowHead: {
    position: 'absolute', left: 8, width: 9, height: 9,
    borderLeftWidth: 2, borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  dot: { width: 4, height: 4, borderRadius: 2 },

  // Progress
  progressContainer: {
    height: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },

  // Article
  coursePill: {
    alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16,
  },
  coursePillText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1 },
  articleTitle: {
    fontFamily: F.display, fontSize: 32,
    lineHeight: 38, marginBottom: 16,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  calIcon: { width: 18, height: 18 },
  calTop: { height: 4, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  calGrid: {
    flex: 1, borderWidth: 1, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  calDot: { width: 2, height: 2, borderRadius: 1 },
  dateText: { fontFamily: F.medium, fontSize: 11, letterSpacing: 1 },

  // Summary
  summaryWrap: {
    borderTopWidth: 1,
    paddingTop: 20, marginBottom: 28,
  },
  summaryLabel: {
    fontFamily: F.bold, fontSize: 10,
    letterSpacing: 2, marginBottom: 12,
  },
  summaryBar: { width: 32, height: 3, borderRadius: 2, marginBottom: 14 },
  summaryText: {
    fontFamily: F.display, fontSize: 16,
    lineHeight: 26, fontStyle: 'italic',
  },

  // Nav
  navRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  navBtn: {
    flex: 1, borderWidth: 1.5,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  navBtnPrimary: {
    flex: 1,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontFamily: F.bold, fontSize: 13 },
  navBtnPrimaryText: { fontFamily: F.bold, fontSize: 13 },
  navBtnTextDisabled: { },

  // FAB
  fab: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 20 },

  // Toolbar
  toolbarOverlay: {
    position: 'absolute', bottom: 164, right: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    minWidth: 160,
  },
  toolbarItem: { paddingVertical: 13, paddingHorizontal: 18 },
  toolbarItemText: { fontFamily: F.medium, fontSize: 14 },

  // Hermes Styles
  hermesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  hermesContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', overflow: 'hidden' },
  hermesHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hermesTitle: { fontFamily: F.bold, fontSize: 18, color: '#fff' },
  hermesChatScroll: { flex: 1 },
  hermesBubble: { padding: 14, borderRadius: 18, marginBottom: 12, maxWidth: '85%' },
  hermesUser: { alignSelf: 'flex-end', backgroundColor: '#333' },
  hermesBot: { alignSelf: 'flex-start' },
  hermesText: { fontFamily: F.body, fontSize: 15, lineHeight: 22 },
  hermesInputRow: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, alignItems: 'center', gap: 12 },
  hermesInput: { flex: 1, height: 48, borderRadius: 24, paddingHorizontal: 20, fontFamily: F.body, fontSize: 15 },
  hermesSend: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  // Calculator Styles
  calcOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  calcContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', overflow: 'hidden' },
  calcHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calcTitle: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
  calcDisplay: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, alignItems: 'flex-end', justifyContent: 'center', height: 100 },
  calcExprText: { fontSize: 16, fontFamily: F.medium, marginBottom: 6 },
  calcResultText: { fontSize: 26, fontFamily: F.bold },
  calcRowBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  calcGrid: { flex: 4, gap: 6 },
  calcRow: { flexDirection: 'row', gap: 6, flex: 1 },
  calcGridBtn: { flex: 1, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  calcGridText: { fontSize: 18, fontFamily: F.bold },
  calcGridTextScientific: { fontSize: 13, fontFamily: F.medium },
});
