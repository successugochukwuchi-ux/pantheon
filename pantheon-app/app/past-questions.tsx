import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { Audio } from 'expo-av';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { HermesMessageContent, extractReadableQuestionText } from '../components/HermesMessageContent';
import { MathText } from '../components/MathText';
import { BottomNav } from '../components/BottomNav';
import { BirdIcon, MicIcon, StopIcon, SendIcon } from '../components/Icons';
import { F, THEMES } from '../components/Theme';
import {
  getDownloadedCoursesLocal,
  getLocalQuestionSheets,
  getLocalQuestions,
} from '../lib/db';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import { sortCoursesAlphabetically } from '../lib/noteCache';
import {
  ChatMessage,
  AIConfig,
  chatWithHermesMobile,
  transcribeHermesAudio,
  sanitizeHermesError,
} from '../lib/hermesService';

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
  department?: string;
  isDownloaded?: boolean;
}

interface QuestionSheet {
  id: string;
  courseId: string;
  year: string;
  semester: string;
  academicLevel: string;
}

interface Question {
  id: string;
  courseId: string;
  q: string;
  opts: string[];
  answer: number;
  sheetId: string;
  explanation?: string;
}

export default function PastQuestionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, systemConfig } = useAuth();
  const { colors: C } = useTheme();

  const s = useMemo(() => createStyles(C), [C]);

  // States
  const [courses, setCourses] = useState<Course[]>([]);
  const [sheets, setSheets] = useState<QuestionSheet[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<QuestionSheet | null>(null);

  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  // Active Exam state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});

  // Hermes AI states for Past Questions
  const [hermesOpen, setHermesOpen] = useState(false);
  const [hermesMsg, setHermesMsg] = useState('');
  const [hermesChat, setHermesChat] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hi! I am Hermes. I can explain any past question step-by-step, clarify why an option is right or wrong, or teach the underlying concept.',
    },
  ]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [hermesLoading, setHermesLoading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const hermesScrollRef = useRef<ScrollView>(null);

  // Auto-scroll Hermes chat to follow the latest message
  useEffect(() => {
    if (hermesOpen) {
      const timer = setTimeout(() => {
        hermesScrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [hermesChat, hermesLoading, hermesOpen]);

  // Anim state
  const questionAnim = useRef(new Animated.Value(0)).current;

  // Listen to Hermes config in Firestore
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, 'system', 'hermes'),
      snapshot => {
        if (snapshot.exists()) {
          setAiConfig(snapshot.data() as AIConfig);
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Cleanup voice recording when navigating away or unmounting
  useEffect(() => {
    if (pathname && !pathname.includes('past-questions')) {
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
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const profileUid = profile?.uid || 'anon';
  const profileDept = profile?.department || '';
  const profileLevel = String(profile?.level || '');
  const activeSemester =
    !systemConfig?.currentSemester || systemConfig.currentSemester === 'none'
      ? '1st'
      : systemConfig.currentSemester;

  // 1. Load Courses (supports both Online and Offline, sorted alphabetically)
  useEffect(() => {
    let isMounted = true;
    async function loadCourses() {
      if (courses.length === 0) setLoading(true);
      try {
        const isSameSemester = (courseSem: string, activeSem: string) => {
          const normCourse = (courseSem || '').toLowerCase().trim();
          const normActive = (activeSem || '1st').toLowerCase().trim();
          if (normCourse === normActive) return true;
          if (normActive === '1st' && (normCourse === 'first' || normCourse === '1st')) return true;
          if (normActive === '2nd' && (normCourse === 'second' || normCourse === '2nd')) return true;
          return false;
        };

        if (db) {
          const snap = await getDocs(collection(db, 'courses'));
          let fbCourses = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Course))
            .filter(fc => isSameSemester(fc.semester || '', activeSemester));

          const localDownloaded = getDownloadedCoursesLocal().filter(lc =>
            isSameSemester(lc.semester || '', activeSemester)
          );
          const downloadedIds = new Set(localDownloaded.map(c => c.id));

          localDownloaded.forEach(lc => {
            if (!fbCourses.some(fc => fc.id === lc.id)) {
              fbCourses.push({
                id: lc.id,
                code: lc.code || '',
                title: lc.title || '',
                semester: lc.semester || 'first',
                level: lc.level || '100',
                department: lc.department || '',
              });
            }
          });

          const enrichedBeforeFilter = fbCourses.map(c => ({
            ...c,
            isDownloaded: downloadedIds.has(c.id),
          }));

          const filtered = await getFilteredCoursesForStudent(enrichedBeforeFilter, profile, true);

          const enriched = sortCoursesAlphabetically(
            filtered.map(c => ({
              ...c,
              isDownloaded: downloadedIds.has(c.id),
            }))
          );

          if (isMounted) {
            setCourses(enriched);
            setIsOfflineMode(false);
          }
        } else {
          throw new Error('Firebase disabled or unreachable');
        }
      } catch (err) {
        console.log('PastQuestions screen: Loading offline course data', err);
        if (!isMounted) return;
        setIsOfflineMode(true);
        const isSameSemester = (courseSem: string, activeSem: string) => {
          const normCourse = (courseSem || '').toLowerCase().trim();
          const normActive = (activeSem || '1st').toLowerCase().trim();
          if (normCourse === normActive) return true;
          if (normActive === '1st' && (normCourse === 'first' || normCourse === '1st')) return true;
          if (normActive === '2nd' && (normCourse === 'second' || normCourse === '2nd')) return true;
          return false;
        };
        const localCourses = sortCoursesAlphabetically(
          getDownloadedCoursesLocal()
            .filter(lc => isSameSemester(lc.semester || '', activeSemester))
            .map(
              c =>
                ({
                  ...c,
                  isDownloaded: true,
                } as Course)
            )
        );
        setCourses(localCourses);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCourses();
    return () => {
      isMounted = false;
    };
  }, [profileUid, profileDept, profileLevel, activeSemester]);

  // 2. Load Sheets whenever a course is selected
  useEffect(() => {
    if (!selectedCourseId) {
      setSheets([]);
      return;
    }

    async function loadSheets() {
      setLoading(true);
      try {
        if (!isOfflineMode && db) {
          const qSheets = query(
            collection(db, 'questionSheets'),
            where('courseId', '==', selectedCourseId),
            where('isAvailable', '==', true)
          );
          const snap = await getDocs(qSheets);
          let fbSheets = snap.docs.map(d => ({ id: d.id, ...d.data() } as QuestionSheet));

          if (fbSheets.length === 0) {
            const offlineSheets = getLocalQuestionSheets(selectedCourseId);
            if (offlineSheets.length > 0) {
              fbSheets = offlineSheets;
            }
          }

          fbSheets.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
          setSheets(fbSheets);
        } else {
          const offlineSheets = getLocalQuestionSheets(selectedCourseId);
          offlineSheets.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
          setSheets(offlineSheets);
        }
      } catch (err) {
        const offlineSheets = getLocalQuestionSheets(selectedCourseId);
        offlineSheets.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
        setSheets(offlineSheets);
      } finally {
        setLoading(false);
      }
    }
    loadSheets();
  }, [selectedCourseId, isOfflineMode]);

  // 3. Start past question exam year
  const handleStartExam = async (sheet: QuestionSheet) => {
    setLoading(true);
    try {
      if (!isOfflineMode && db) {
        const qQuestions = query(collection(db, 'questions'), where('sheetId', '==', sheet.id));
        const snap = await getDocs(qQuestions);
        const fbQuestions = snap.docs.map(d => {
          const data = d.data();
          let optsArray: string[] = [];
          let correctIdx = 0;
          if (data.correctAnswer && data.incorrectAnswers) {
            optsArray = [data.correctAnswer, ...data.incorrectAnswers].sort();
            correctIdx = optsArray.indexOf(data.correctAnswer);
          } else {
            optsArray = data.opts || data.options || [];
            correctIdx = data.answer ?? 0;
          }

          return {
            id: d.id,
            courseId: data.courseId,
            q: data.q || data.text || data.question || '',
            opts: optsArray,
            answer: correctIdx,
            sheetId: data.sheetId,
            explanation: data.explanation || '',
          } as Question;
        });

        let finalFbQuestions = fbQuestions;
        if (finalFbQuestions.length === 0) {
          const offlineQs = getLocalQuestions(sheet.courseId).filter(q => q.sheetId === sheet.id);
          const finalQs = offlineQs.length > 0 ? offlineQs : getLocalQuestions(sheet.courseId);
          if (finalQs.length > 0) {
            finalFbQuestions = finalQs;
          } else {
            Alert.alert('Empty', 'No questions uploaded for this exam year yet.');
            setLoading(false);
            return;
          }
        }

        setQuestions(finalFbQuestions);
        setSelectedSheet(sheet);
        setExamStarted(true);
        setCurrentIndex(0);
        setUserAnswers({});
        setShowFeedback({});
      } else {
        const offlineQs = getLocalQuestions(sheet.courseId).filter(q => q.sheetId === sheet.id);
        const finalQs = offlineQs.length > 0 ? offlineQs : getLocalQuestions(sheet.courseId);

        if (finalQs.length === 0) {
          Alert.alert(
            'Offline Limit',
            'No offline questions saved for this year. Open Note Grabber to sync this course offline.'
          );
          setLoading(false);
          return;
        }

        setQuestions(finalQs);
        setSelectedSheet(sheet);
        setExamStarted(true);
        setCurrentIndex(0);
        setUserAnswers({});
        setShowFeedback({});
      }
    } catch (err: any) {
      Alert.alert(
        'Load Failure',
        err.message || 'Could not load questions. Try syncing course offline first.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (showFeedback[currentIndex]) return;
    setUserAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
  };

  useEffect(() => {
    if (examStarted) {
      questionAnim.setValue(0);
      Animated.timing(questionAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [currentIndex, examStarted]);

  const handleExitExam = () => {
    Alert.alert('Exit Practice', 'Are you sure you want to stop this past questions review?', [
      { text: 'Keep Studying', style: 'cancel' },
      {
        text: 'Exit Review',
        onPress: () => {
          setHermesOpen(false);
          setExamStarted(false);
        },
      },
    ]);
  };

  const currentCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  const currentQ = questions[currentIndex];

  // Build rich context for Hermes in Past Questions viewer
  const pastQuestionContext = useMemo(() => {
    const courseLabel = currentCourse
      ? `${currentCourse.code} (${currentCourse.title})`
      : 'University Course';
    const yearLabel = selectedSheet?.year ? `${selectedSheet.year} Past Questions` : 'Past Questions';

    if (!currentQ) {
      return `Course: ${courseLabel} - ${yearLabel}.`;
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const cleanQuestion = extractReadableQuestionText(currentQ.q || '');
    const optionsFormatted = (currentQ.opts || [])
      .map((opt, idx) => `${letters[idx] || idx + 1}. ${extractReadableQuestionText(opt)}`)
      .join('\n');
    const correctLetter = letters[currentQ.answer] || String(currentQ.answer + 1);
    const correctOptionText = extractReadableQuestionText(currentQ.opts?.[currentQ.answer] || '');
    const studentSelectedIdx = userAnswers[currentIndex];
    const studentSelectedText =
      studentSelectedIdx !== undefined
        ? `${letters[studentSelectedIdx] || studentSelectedIdx + 1}. ${extractReadableQuestionText(
            currentQ.opts?.[studentSelectedIdx] || ''
          )}`
        : 'Not answered yet';
    const cleanExplanation = currentQ.explanation
      ? extractReadableQuestionText(currentQ.explanation)
      : '';

    return [
      `Course: ${courseLabel} (${yearLabel})`,
      `Currently Viewing Question ${currentIndex + 1} of ${questions.length}:`,
      `Question: ${cleanQuestion}`,
      `Options:\n${optionsFormatted}`,
      `Correct Answer: ${correctLetter}. ${correctOptionText}`,
      `Student's Selected Answer: ${studentSelectedText}`,
      cleanExplanation ? `Official Explanation: ${cleanExplanation}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [currentCourse, selectedSheet, currentQ, currentIndex, questions.length, userAnswers]);

  const handleCloseHermes = async () => {
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
    if (isRecordingVoice) {
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
        console.error('PastQuestions Hermes STT error:', err);
        setIsTranscribingVoice(false);
      }
    } else {
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

  const handleSendHermes = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : hermesMsg).trim();
    if (!textToSend || hermesLoading) return;

    if (aiConfig && aiConfig.isActive === false) {
      setHermesChat(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Hermes AI chatbot is currently inactive. Please enable it in the admin panel.',
        },
      ]);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    const extendedChat = [...hermesChat, userMessage];
    setHermesChat(extendedChat);
    if (overrideText === undefined) {
      setHermesMsg('');
    }
    setHermesLoading(true);

    try {
      const botResponse = await chatWithHermesMobile(
        extendedChat,
        pastQuestionContext,
        aiConfig || undefined
      );
      setHermesChat(prev => [...prev, { role: 'assistant', content: botResponse }]);
    } catch (err: any) {
      const sanitizedErrorMsg = sanitizeHermesError(err.message);
      setHermesChat(prev => [...prev, { role: 'assistant', content: sanitizedErrorMsg }]);
    } finally {
      setHermesLoading(false);
    }
  };

  const handleAskHermesAboutCurrentQuestion = () => {
    if (!currentQ) {
      setHermesOpen(true);
      return;
    }
    const promptText = `Please explain Question ${currentIndex + 1} step-by-step and clarify why the correct option is right.`;
    setHermesOpen(true);
    handleSendHermes(promptText);
  };

  const isUnactivatedStudent =
    (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.backBtn}>
            <Text style={[s.backBtnText, { color: C.ink }]}>◀ Back</Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            PAST QUESTIONS
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#FEF3C7',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 40 }}>📚</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Past Questions Locked
          </Text>
          <Text
            style={{
              fontFamily: F.medium,
              fontSize: 15,
              color: C.inkMid,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 32,
              maxWidth: 320,
            }}
          >
            Past Questions and official exam papers are premium features reserved for activated accounts. Activate your student profile using an activation pin to unlock full access to years of exam resources!
          </Text>

          <TouchableOpacity
            style={{
              width: '100%',
              height: 56,
              backgroundColor: C.ink,
              borderRadius: 14,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              width: '100%',
              height: 56,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Rendering A: Loading Spinner
  if (loading && !examStarted && !selectedCourseId && courses.length === 0) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.centerSection}>
          <ActivityIndicator size="large" color={C.ink} />
          <Text style={s.loadingText}>Loading Past Questions...</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  // Rendering B: Practice CBT Exam Sheet Mode with Hermes AI Assistant
  if (examStarted && currentQ) {
    const isAnswered = showFeedback[currentIndex];
    const selectedAnswerIndex = userAnswers[currentIndex];
    const correctAnswerIndex = currentQ.answer;
    const isAnswerCorrect = selectedAnswerIndex === correctAnswerIndex;

    return (
      <SafeAreaView style={s.root} edges={['top']}>
        {/* Hermes Floating Modal for Past Questions */}
        <Modal visible={hermesOpen} transparent animationType="slide" onRequestClose={handleCloseHermes}>
          <View style={s.hermesOverlay}>
            <View style={[s.hermesContent, { backgroundColor: C.bg }]}>
              <View style={[s.hermesHeader, { backgroundColor: C.surfaceDark, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BirdIcon color="#fff" />
                  <View>
                    <Text style={s.hermesTitle}>HERMES AI TUTOR</Text>
                    <Text style={{ color: '#9ca3af', fontFamily: F.medium, fontSize: 10 }}>
                      {currentCourse?.code || 'Exam'} • Question {currentIndex + 1} of {questions.length}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleCloseHermes}>
                  <Text style={{ color: '#fff', fontFamily: F.bold }}>Close</Text>
                </TouchableOpacity>
              </View>

              {isRecordingVoice && (
                <View
                  style={{
                    backgroundColor: '#ef444415',
                    borderBottomWidth: 1,
                    borderBottomColor: '#ef444430',
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: '#dc2626', fontFamily: F.bold, fontSize: 11 }}>
                    🎙️ Listening... Tap stop when finished speaking
                  </Text>
                  <TouchableOpacity
                    onPress={toggleVoiceRecording}
                    style={{
                      backgroundColor: '#dc262620',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: '#dc2626', fontFamily: F.bold, fontSize: 10 }}>Transcribe ↵</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isTranscribingVoice && (
                <View
                  style={{
                    backgroundColor: '#3b82f615',
                    borderBottomWidth: 1,
                    borderBottomColor: '#3b82f630',
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
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
                onContentSizeChange={() => {
                  hermesScrollRef.current?.scrollToEnd({ animated: true });
                }}
                onLayout={() => {
                  hermesScrollRef.current?.scrollToEnd({ animated: false });
                }}
              >
                {hermesChat.map((m, i) => (
                  <View
                    key={i}
                    style={[
                      s.hermesBubble,
                      m.role === 'user'
                        ? [
                            s.hermesUser,
                            { backgroundColor: C.surfaceDark, alignSelf: 'flex-end', maxWidth: '85%' },
                          ]
                        : [
                            s.hermesBot,
                            {
                              backgroundColor: C.surface,
                              borderColor: C.border,
                              borderWidth: 1,
                              alignSelf: 'flex-start',
                              maxWidth: '92%',
                              width: 'auto',
                              padding: 0,
                            },
                          ],
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
                ))}
                {hermesLoading && (
                  <View
                    style={[
                      s.hermesBubble,
                      s.hermesBot,
                      {
                        backgroundColor: C.surface,
                        alignItems: 'center',
                        padding: 10,
                        alignSelf: 'flex-start',
                      },
                    ]}
                  >
                    <ActivityIndicator size="small" color={C.activeText} />
                  </View>
                )}
              </ScrollView>

              <View style={[s.hermesInputRow, { borderTopColor: C.border, alignItems: 'center' }]}>
                <TextInput
                  style={[s.hermesInput, { backgroundColor: C.surface, color: C.ink, flex: 1 }]}
                  placeholder={
                    isRecordingVoice
                      ? 'Listening... Speak now'
                      : 'Ask Hermes about this question or tap mic...'
                  }
                  value={hermesMsg}
                  onChangeText={setHermesMsg}
                  placeholderTextColor={C.inkLight}
                  onSubmitEditing={() => {
                    if (hermesMsg.trim()) handleSendHermes();
                  }}
                />
                <TouchableOpacity
                  style={[
                    s.hermesSend,
                    {
                      backgroundColor: isRecordingVoice ? '#ef4444' : C.ink,
                    },
                  ]}
                  onPress={() => {
                    if (isRecordingVoice) {
                      toggleVoiceRecording();
                    } else if (hermesMsg.trim()) {
                      handleSendHermes();
                    } else {
                      toggleVoiceRecording();
                    }
                  }}
                  disabled={hermesLoading || isTranscribingVoice}
                  activeOpacity={0.8}
                >
                  {hermesLoading || isTranscribingVoice ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : isRecordingVoice ? (
                    <StopIcon color="#ffffff" />
                  ) : hermesMsg.trim() ? (
                    <SendIcon color={C.bg} />
                  ) : (
                    <MicIcon color={C.bg} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleExitExam} activeOpacity={0.7} style={s.backBtn}>
            <Text style={[s.backBtnText, { color: C.ink }]}>✕ Exit</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.examHeaderTitle}>
              {currentCourse?.code} ({selectedSheet?.year})
            </Text>
            <Text style={s.examProgressIndicator}>
              Question {currentIndex + 1} of {questions.length}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setHermesOpen(true)}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: C.ink,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <BirdIcon color={C.bg} />
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.bg }}>Hermes</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={s.progressWrapper}>
          <View style={[s.progressTrack, { backgroundColor: C.tabBg }]}>
            <View
              style={[
                s.progressFill,
                {
                  backgroundColor: C.activeText,
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Question Selector Pills for quick jump and skip */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: C.surface,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
          >
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const answered = userAnswers[idx] !== undefined;
              const isCorrect = userAnswers[idx] === q.answer;

              let bg = C.bgAlt;
              let border = C.border;
              let textC = C.inkMid;

              if (answered) {
                if (isCorrect) {
                  bg = '#E6F4EA';
                  border = '#137333';
                  textC = '#137333';
                } else {
                  bg = '#FCE8E6';
                  border = '#C5221F';
                  textC = '#C5221F';
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setCurrentIndex(idx)}
                  activeOpacity={0.7}
                  style={{
                    height: 28,
                    minWidth: 28,
                    paddingHorizontal: 6,
                    borderRadius: 6,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: bg,
                    borderWidth: isCurrent ? 2 : 1,
                    borderColor: isCurrent ? C.ink : border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: isCurrent ? F.bold : F.medium,
                      fontSize: 11,
                      color: isCurrent ? C.ink : textC,
                    }}
                  >
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContentExam} showsVerticalScrollIndicator={false}>
          {/* Question Slide Card */}
          <Animated.View style={[s.examCard, { opacity: questionAnim }]}>
            {/* Tag Badge */}
            <View style={[s.questionInfoBadgeRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={[s.infoBadge, { backgroundColor: C.activeBg }]}>
                  <Text style={[s.infoBadgeText, { color: C.activeText }]}>PAST QUESTION</Text>
                </View>
                {isAnswered && (
                  <View style={[s.infoBadge, { backgroundColor: isAnswerCorrect ? '#E6F4EA' : '#FCE8E6' }]}>
                    <Text style={[s.infoBadgeText, { color: isAnswerCorrect ? '#137333' : '#C5221F' }]}>
                      {isAnswerCorrect ? '✓ Correct' : '✕ Incorrect'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <QuestionRenderer
              question={currentQ.q}
              options={currentQ.opts}
              selectedOptionIndex={selectedAnswerIndex}
              correctOptionIndex={correctAnswerIndex}
              isAnswered={isAnswered}
              explanation={currentQ.explanation}
              onSelectOption={i => handleAnswerSelect(i)}
            />
          </Animated.View>

          {/* Nav controller foot-row */}
          <View style={s.navButtonsRow}>
            <TouchableOpacity
              style={[s.navPageBtn, currentIndex === 0 && s.navPageBtnDisabled, { borderColor: C.border }]}
              onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.navPageBtnText,
                  { color: C.ink },
                  currentIndex === 0 && { color: C.navInactive },
                ]}
              >
                ◀ Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.navPageBtn, { borderColor: C.border }]}
              onPress={() => {
                if (currentIndex === questions.length - 1) {
                  setExamStarted(false);
                } else {
                  setCurrentIndex(prev => prev + 1);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.navPageBtnText,
                  { color: C.ink, fontFamily: !isAnswered ? F.bold : F.medium },
                ]}
              >
                {currentIndex === questions.length - 1
                  ? !isAnswered
                    ? 'Skip & Finish'
                    : 'Finish review'
                  : !isAnswered
                  ? 'Skip Question ⏭'
                  : 'Next Question ▶'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Rendering C & D: Selection view listing
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        {selectedCourseId ? (
          <TouchableOpacity onPress={() => setSelectedCourseId(null)} style={s.backBtn}>
            <Text style={[s.backBtnText, { color: C.ink }]}>◀ Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
        <Text style={[s.headerTitle, { color: C.ink }]}>
          {selectedCourseId ? `${currentCourse?.code} Exam Years` : 'Past Questions'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Network offline mode banner */}
      {isOfflineMode && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineBannerText}>⚠ Offline study mode: Showing local downloaded materials</Text>
        </View>
      )}

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {!selectedCourseId ? (
          <View>
            <Text style={[s.subtitle, { color: C.inkMid }]}>
              Select a course to view official past examination papers.
            </Text>

            {loading ? (
              <View style={s.loadingWrapper}>
                <ActivityIndicator size="large" color={C.ink} />
                <Text style={[s.loadingText, { color: C.inkMid }]}>Searching database...</Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={[s.emptyContainer, { borderColor: C.border, backgroundColor: C.surface }]}>
                <Text style={[s.emptyMainTitle, { color: C.ink }]}>No Materials Found</Text>
                <Text style={[s.emptySub, { color: C.inkMid }]}>
                  Please tap note grabber to fetch files or change your semester setting in the dashboard.
                </Text>
              </View>
            ) : (
              <View style={s.coursesContainer}>
                {courses.map(course => (
                  <TouchableOpacity
                    key={course.id}
                    style={[s.courseCard, { backgroundColor: C.surface, borderColor: C.border }]}
                    onPress={() => setSelectedCourseId(course.id)}
                    activeOpacity={0.8}
                  >
                    <View style={s.cardLeader}>
                      <Text style={[s.courseCode, { color: C.ink }]}>{course.code}</Text>
                      {course.isDownloaded && (
                        <View style={[s.badgeOffline, { backgroundColor: C.activeBg }]}>
                          <Text style={[s.badgeOfflineText, { color: C.activeText }]}>Saved</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.courseTitle, { color: C.inkMid }]}>{course.title}</Text>

                    <View style={s.cardFooterMeta}>
                      <Text style={[s.footerMetaText, { color: C.inkLight }]}>
                        {(course.semester || '1ST').toUpperCase()} SEMESTER • {course.level} LEVEL
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View>
            <View style={s.courseHeaderMetaCard}>
              <Text style={[s.metaCourseTitle, { color: C.ink }]}>{currentCourse?.title}</Text>
              <Text style={[s.metaCourseDetails, { color: C.inkMid }]}>
                {currentCourse?.code} — {(currentCourse?.semester || '1ST').toUpperCase()} SEMESTER
              </Text>
            </View>

            <Text style={[s.subtitle, { color: C.inkMid, marginTop: 10 }]}>
              Choose from the available year sheets below to start practicing:
            </Text>

            {loading ? (
              <View style={s.loadingWrapper}>
                <ActivityIndicator size="large" color={C.ink} />
                <Text style={[s.loadingText, { color: C.inkMid }]}>Loading exam packages...</Text>
              </View>
            ) : sheets.length === 0 ? (
              <View style={[s.emptyContainer, { borderColor: C.border, backgroundColor: C.surface }]}>
                <Text style={[s.emptyMainTitle, { color: C.ink }]}>No Question Sheets</Text>
                <Text style={[s.emptySub, { color: C.inkMid }]}>
                  No past question sheets are saved locally or available online for {currentCourse?.code} yet.
                </Text>
              </View>
            ) : (
              <View style={s.sheetsContainer}>
                {sheets.map(sheet => (
                  <View key={sheet.id} style={[s.sheetCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={s.sheetContent}>
                      <Text style={[s.sheetYearText, { color: C.ink }]}>{sheet.year} Exams</Text>
                      <Text style={[s.sheetMetaText, { color: C.inkMid }]}>
                        {sheet.semester} Semester • {sheet.academicLevel}L Paper
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[s.sheetStartBtn, { backgroundColor: C.ink }]}
                      onPress={() => handleStartExam(sheet)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.sheetStartBtnText}>Start Paper</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const createStyles = (C: typeof THEMES.light) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.bg,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerTitle: {
      fontFamily: F.bold,
      fontSize: 18,
      color: C.ink,
    },
    backBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    backBtnText: {
      fontFamily: F.medium,
      fontSize: 14,
    },
    offlineBanner: {
      backgroundColor: '#FFF2E0',
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    offlineBannerText: {
      fontFamily: F.medium,
      fontSize: 11,
      color: '#B06000',
      textAlign: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 18,
    },
    scrollContentExam: {
      padding: 16,
    },
    subtitle: {
      fontFamily: F.body,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    loadingWrapper: {
      alignItems: 'center',
      paddingVertical: 80,
    },
    loadingText: {
      fontFamily: F.medium,
      fontSize: 14,
      marginTop: 12,
    },
    coursesContainer: {
      gap: 12,
    },
    courseCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    cardLeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    courseCode: {
      fontFamily: F.bold,
      fontSize: 18,
    },
    badgeOffline: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    badgeOfflineText: {
      fontFamily: F.bold,
      fontSize: 9,
      letterSpacing: 0.5,
    },
    courseTitle: {
      fontFamily: F.body,
      fontSize: 14,
      marginBottom: 12,
    },
    cardFooterMeta: {
      marginTop: 4,
    },
    footerMetaText: {
      fontSize: 11,
      fontFamily: F.bold,
      letterSpacing: 0.8,
    },
    courseHeaderMetaCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 18,
      marginBottom: 14,
    },
    metaCourseTitle: {
      fontFamily: F.bold,
      fontSize: 18,
      marginBottom: 4,
    },
    metaCourseDetails: {
      fontFamily: F.medium,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    sheetsContainer: {
      gap: 12,
    },
    sheetCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetContent: {
      flex: 1,
      marginRight: 12,
    },
    sheetYearText: {
      fontFamily: F.bold,
      fontSize: 16,
      marginBottom: 4,
    },
    sheetMetaText: {
      fontFamily: F.body,
      fontSize: 12,
    },
    sheetStartBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    sheetStartBtnText: {
      fontFamily: F.bold,
      fontSize: 13,
      color: '#FFF',
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 24,
      borderRadius: 16,
      borderWidth: 1,
      marginVertical: 40,
    },
    emptyMainTitle: {
      fontFamily: F.bold,
      fontSize: 16,
      marginBottom: 6,
    },
    emptySub: {
      fontFamily: F.body,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    examHeaderTitle: {
      fontFamily: F.bold,
      fontSize: 15,
      color: C.ink,
    },
    examProgressIndicator: {
      fontFamily: F.body,
      fontSize: 11,
      color: C.inkLight,
    },
    progressWrapper: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
    },
    examCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      marginBottom: 16,
    },
    questionInfoBadgeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    infoBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    infoBadgeText: {
      fontFamily: F.bold,
      fontSize: 10,
      letterSpacing: 0.8,
    },
    navButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    navPageBtn: {
      flex: 1,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    navPageBtnDisabled: {
      opacity: 0.5,
    },
    navPageBtnText: {
      fontFamily: F.medium,
      fontSize: 14,
    },
    centerSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 60,
    },
    // Hermes Modal Styles
    hermesOverlay: {
      flex: 1,
      backgroundColor: 'rgba(13, 13, 18, 0.55)',
      justifyContent: 'flex-end',
    },
    hermesContent: {
      height: '82%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    hermesHeader: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    hermesTitle: {
      color: '#ffffff',
      fontFamily: F.bold,
      fontSize: 13,
      letterSpacing: 1.2,
    },
    hermesChatScroll: {
      flex: 1,
    },
    hermesBubble: {
      padding: 13,
      borderRadius: 16,
      marginBottom: 10,
    },
    hermesUser: {
      borderBottomRightRadius: 4,
    },
    hermesBot: {
      borderBottomLeftRadius: 4,
    },
    hermesText: {
      fontFamily: F.body,
      fontSize: 14.5,
      lineHeight: 21,
    },
    hermesInputRow: {
      flexDirection: 'row',
      padding: 12,
      borderTopWidth: 1,
      gap: 8,
    },
    hermesInput: {
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontFamily: F.body,
      fontSize: 14,
    },
    hermesSend: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
