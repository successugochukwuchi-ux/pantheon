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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { BirdIcon, CalculatorIcon } from '../components/Icons';
import { NoteRenderer } from '../components/NoteRenderer';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { getDatabase, isCourseDownloadedLocal, getLocalNotes, getLocalCourse } from '../lib/db';

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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIConfig {
  provider: 'gemini' | 'groq' | 'openrouter';
  apiKey: string;
  model?: string;
  isActive?: boolean;
}

async function chatWithHermesMobile(messages: ChatMessage[], noteContent: string, config?: AIConfig) {
  const provider = config?.provider || 'groq';
  let model = config?.model;
  
  if (!model) {
    model = provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'gemini' ? 'gemini-2.0-flash-lite' : 'google/gemini-2.0-flash-001';
  }
  
  // Clean model ID for Groq
  if (provider === 'groq' && model.includes('/')) {
    const parts = model.split('/');
    model = parts[parts.length - 1]; 
  }

  const rawKey = config?.apiKey || '';
  // Extreme trim: removes ALL whitespace, surrounding quotes, and invisible characters
  const apiKey = rawKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  if (!apiKey) {
    throw new Error(`${provider === 'gemini' ? 'Google Gemini' : provider === 'groq' ? 'Groq' : 'OpenRouter'} Chat AI is not configured. Please set an API Key in the Admin Panel > Level 4 > Hermes Chat configuration.`);
  }

  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are Hermes, a helpful academic assistant. 
    STRATEGIC DIRECTIVES:
    1. Answer strictly based on the provided NOTE CONTENT.
    2. If a question is unrelated to the notes, politely decline.
    3. Use LaTeX for ALL mathematical formulas or scientific notations (e.g., $E=mc^2$ or \\frac{a}{b}).
    4. Keep responses concise and focused to ensure fast response times.
    
    NOTE CONTENT:
    ${noteContent}
    `
  };

  // ─── GOOGLE GEMINI (Direct) ──────────────────────────────────────────────────
  if (provider === 'gemini') {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Convert OpenAI-style system role to Gemini format
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${messages[messages.length - 1].content}` }]
        }
      ]
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData?.error?.message || `Gemini API error (${response.status})`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
  }

  // ─── GROQ / OPENROUTER ──────────────────────────────────────────────────────
  const baseUrl = provider === 'groq' 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://openrouter.ai/api/v1/chat/completions';

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: [systemPrompt, ...messages],
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    const errInfo = errData.error?.error || errData.error || errData;
    const errMsg = errInfo.message || `Failed to connect to Hermes via ${provider}`;
    const errCode = errInfo.code || 'unknown';
    throw new Error(`${errMsg} | Code: ${errCode} | Provider: ${provider.toUpperCase()} | Model: ${model}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
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
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const { noteId, courseId } = useLocalSearchParams<{ noteId: string; courseId: string }>();
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [hermesOpen, setHermesOpen] = useState(false);
  const [hermesMsg, setHermesMsg] = useState('');
  const [hermesChat, setHermesChat] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am Hermes. Ask me anything about this note.' }
  ]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [hermesLoading, setHermesLoading] = useState(false);

  // Calculator states
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcAngleMode, setCalcAngleMode] = useState<'DEG' | 'RAD'>('DEG');

  const [note, setNote] = useState<Note | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const { isOffline } = useAuth();

  useEffect(() => {
    const cid = courseId || note?.courseId;
    if (!cid) return;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevNote, setPrevNote] = useState<Note | null>(null);
  const [nextNote, setNextNote] = useState<Note | null>(null);

  // Animations
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Track completion
  const lastTrackedId = useRef<string | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const isCompleted = useRef(false);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset.y;
    const maximumOffset = contentSize.height - layoutMeasurement.height;
    
    if (maximumOffset <= 0) return;
    
    const percentage = Math.max(0, Math.min(100, Math.round((currentOffset / maximumOffset) * 100)));
    if (percentage !== scrollPct) {
      setScrollPct(percentage);
      Animated.spring(progressAnim, {
        toValue: percentage,
        useNativeDriver: false,
        tension: 40,
        friction: 7
      }).start();
    }
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
    async function fetchNoteData() {
      if (!noteId || !profile) {
        console.warn('NoteViewer: Missing noteId or profile');
        return;
      }
      
      setLoading(true);
      setError(null);
      console.log('NoteViewer: Fetching note', noteId);
      
      try {
        let currentNote: Note | null = null;
        const ldb = getDatabase();

        if (ldb && ldb.getFirstSync) {
          const res = ldb.getFirstSync('SELECT * FROM notes WHERE id = ?', [noteId]) as any;
          if (res) {
            currentNote = {
              id: res.id,
              courseId: res.courseId,
              title: res.title,
              content: res.content,
              order: res.order,
            };
          }
        }

        if (!currentNote) {
          const noteDoc = await getDoc(doc(db, 'notes', noteId));
          if (noteDoc.exists()) {
            currentNote = { id: noteId, ...noteDoc.data() } as Note;
          }
        }

        if (currentNote) {
          setNote(currentNote);
          console.log('NoteViewer: Note loaded', currentNote.title);

          // 1. Fetch adjacent notes for navigation
          try {
            let allNotesInCourse: Note[] = [];
            if (isCourseDownloadedLocal(currentNote.courseId)) {
              allNotesInCourse = getLocalNotes(currentNote.courseId).map(n => ({
                id: n.id,
                courseId: n.courseId,
                title: n.title,
                content: n.content,
                order: n.order
              } as Note));
            } else {
              const q = query(
                collection(db, 'notes'),
                where('courseId', '==', currentNote.courseId)
              );
              const notesSnap = await getDocs(q);
              allNotesInCourse = notesSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as Note));
            }
            allNotesInCourse.sort((a, b) => (a.order || 0) - (b.order || 0));
              
            const idx = allNotesInCourse.findIndex(n => n.id === noteId);
            setPrevNote(idx > 0 ? allNotesInCourse[idx - 1] : null);
            setNextNote(idx < allNotesInCourse.length - 1 ? allNotesInCourse[idx + 1] : null);
            console.log('NoteViewer: Nav notes set', { hasPrev: !!(idx > 0), hasNext: !!(idx < allNotesInCourse.length - 1) });
          } catch (navErr) {
            console.error("NoteViewer: Nav fetch error", navErr);
            handleFirestoreError(navErr, OperationType.LIST, 'notes');
          }

          // 2. Update Progress
          if (lastTrackedId.current !== noteId) {
            lastTrackedId.current = noteId;
            try {
              console.log('NoteViewer: Loading previous progress');
              const noteProgressRef = doc(db, 'progress', `${profile.uid}_${noteId}`);
              const progSnap = await getDoc(noteProgressRef);
              
              let initialProgress = 0;
              if (progSnap.exists()) {
                const data = progSnap.data();
                initialProgress = data.percentage || 0;
                if (data.completed) isCompleted.current = true;
              }
              
              setScrollPct(initialProgress);
              progressAnim.setValue(initialProgress);

              const allNotesIds = (await getDocs(query(collection(db, 'notes'), where('courseId', '==', currentNote.courseId)))).docs.map(d => d.id);
              const totalNotesCount = allNotesIds.length;

              const userProgSnap = await getDocs(query(
                collection(db, 'progress'),
                where('uid', '==', profile.uid),
                where('type', '==', 'note'),
                where('completed', '==', true)
              ));
              const completedInCourse = userProgSnap.docs.filter(d => allNotesIds.includes(d.data().targetId)).length;

              const coursePercent = totalNotesCount > 0 ? Math.round((completedInCourse / totalNotesCount) * 100) : 0;
              setNote(prev => prev ? ({ ...prev, progress: coursePercent }) : null);
            } catch (progErr) {
              console.error("NoteViewer: Progress load error", progErr);
            }
          }
        } else {
          console.warn('NoteViewer: doc does not exist', noteId);
          setError(`Course not found: topic ${noteId}`);
        }
      } catch (e) {
        console.error("NoteViewer: Main fetch error", e);
        handleFirestoreError(e, OperationType.GET, 'notes');
        setError('Failed to load note content');
      } finally {
        setLoading(false);
      }
    }
    fetchNoteData();
  }, [noteId, profile]);

  useEffect(() => {
    if (!loading && note) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(progressAnim, {
          toValue: scrollPct || 0,
          duration: 900,
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

  const handleSendHermes = async () => {
    if (!hermesMsg.trim() || hermesLoading) return;

    if (aiConfig && aiConfig.isActive === false) {
      setHermesChat(prev => [...prev, { role: 'assistant', content: 'Hermes AI chatbot is currently inactive. Please enable it in the admin panel.' }]);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: hermesMsg };
    const extendedChat = [...hermesChat, userMessage];
    setHermesChat(extendedChat);
    setHermesMsg('');
    setHermesLoading(true);

    try {
      const botResponse = await chatWithHermesMobile(extendedChat, note?.content || '', aiConfig || undefined);
      setHermesChat(prev => [...prev, { role: 'assistant', content: botResponse }]);
    } catch (err: any) {
      console.error('Hermes AI Chat Error:', err);
      setHermesChat(prev => [...prev, { role: 'assistant', content: `Error: ${err.message || 'Failed to generate response'}` }]);
    } finally {
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

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Hermes Floating Interface */}
      <Modal visible={hermesOpen} transparent animationType="slide">
        <View style={s.hermesOverlay}>
           <View style={[s.hermesContent, { backgroundColor: C.bg }]}>
              <View style={[s.hermesHeader, { backgroundColor: C.surfaceDark }]}>
                 <BirdIcon color="#fff" />
                 <Text style={s.hermesTitle}>HERMES AI</Text>
                 <TouchableOpacity onPress={() => setHermesOpen(false)}>
                   <Text style={{ color: '#fff', fontFamily: F.bold }}>Close</Text>
                 </TouchableOpacity>
              </View>
              <ScrollView style={s.hermesChatScroll} contentContainerStyle={{ padding: 16 }}>
                {hermesChat.map((m, i) => (
                  <View key={i} style={[s.hermesBubble, m.role === 'user' ? s.hermesUser : [s.hermesBot, { backgroundColor: C.surface, width: '100%', maxWidth: '100%', padding: 0 }] ]}>
                    {m.role === 'user' ? (
                      <Text style={[s.hermesText, { color: '#fff' }]}>{m.content}</Text>
                    ) : (
                      <NoteRenderer 
                        content={m.content} 
                        bgOverride={C.surface}
                        paddingOverride="14px 18px"
                        inkOverride={C.ink}
                      />
                    )}
                  </View>
                ))}
                {hermesLoading && (
                  <View style={[s.hermesBubble, s.hermesBot, { backgroundColor: C.surface, alignItems: 'center', padding: 10, alignSelf: 'flex-start' }]}>
                    <ActivityIndicator size="small" color={C.activeText} />
                  </View>
                )}
              </ScrollView>
              <View style={[s.hermesInputRow, { borderTopColor: C.border }]}>
                <TextInput 
                  style={[s.hermesInput, { backgroundColor: C.surface, color: C.ink }]} 
                  placeholder="Ask Hermes..." 
                  value={hermesMsg}
                  onChangeText={setHermesMsg}
                  placeholderTextColor={C.inkLight}
                  onSubmitEditing={handleSendHermes}
                />
                <TouchableOpacity 
                   style={[s.hermesSend, { backgroundColor: C.ink }]}
                   onPress={handleSendHermes}
                   disabled={hermesLoading}
                >
                   {hermesLoading ? (
                     <ActivityIndicator size="small" color={C.bg} />
                   ) : (
                     <BirdIcon color={C.bg} />
                   )}
                </TouchableOpacity>
              </View>
           </View>
        </View>
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
          onPress={() => router.push({ pathname: '/notes-topics', params: { courseId: note.courseId } })}
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
          onPress={() => setToolbarVisible(!toolbarVisible)}
          activeOpacity={0.7}
          style={s.iconBtn}
        >
          <View style={[s.dot, { backgroundColor: C.ink, marginBottom: 4 }]} />
          <View style={[s.dot, { backgroundColor: C.ink, marginBottom: 4 }]} />
          <View style={[s.dot, { backgroundColor: C.ink }]} />
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

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
          {/* Course tag */}
          <View style={[s.coursePill, { backgroundColor: C.tagBg }]}>
            <Text style={[s.coursePillText, { color: C.tagText }]}>{courseCode ? courseCode.toUpperCase() : (courseId?.toUpperCase() || 'COURSE')}</Text>
          </View>

          {/* Title */}
          <Text style={[s.articleTitle, { color: C.ink }]}>{note.title}</Text>

          {/* Date */}
          <View style={s.dateRow}>
            <View style={s.calIcon}>
              <View style={[s.calTop, { backgroundColor: C.ink }]} />
              <View style={[s.calGrid, { borderColor: C.ink, borderTopWidth: 0 }]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[s.calDot, { backgroundColor: C.ink }]} />
                ))}
              </View>
            </View>
            <Text style={[s.dateText, { color: C.inkLight }]}>{note.date || 'LATEST UPDATE'}</Text>
          </View>

          {/* Note content rendered with NoteRenderer (WebView) */}
          <NoteRenderer content={note.content} />

          {/* Summary */}
          {note.summary && (
            <View style={[s.summaryWrap, { borderTopColor: C.border }]}>
              <Text style={[s.summaryLabel, { color: C.inkLight }]}>SUMMARY</Text>
              <View style={[s.summaryBar, { backgroundColor: C.ink }]} />
              <Text style={[s.summaryText, { color: C.inkMid }]}>{note.summary}</Text>
            </View>
          )}

          {/* Prev / Next navigation */}
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, { borderColor: C.border }, !prevNote && s.navBtnDisabled]}
              disabled={!prevNote}
              activeOpacity={0.85}
              onPress={() =>
                prevNote &&
                router.push({
                  pathname: '/note-viewer',
                  params: { courseId, noteId: prevNote.id },
                })
              }
            >
              <Text style={[s.navBtnText, { color: C.inkMid }, !prevNote && [s.navBtnTextDisabled, { color: C.inkLight }]]}>← Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.navBtnPrimary, { backgroundColor: C.ink }, !nextNote && s.navBtnDisabled]}
              disabled={!nextNote}
              activeOpacity={0.85}
              onPress={() =>
                nextNote &&
                router.push({
                  pathname: '/note-viewer',
                  params: { courseId, noteId: nextNote.id },
                })
              }
            >
              <Text style={[s.navBtnPrimaryText, { color: C.bg }, !nextNote && [s.navBtnTextDisabled, { color: C.inkLight }]]}>
                Next Topic →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </Animated.View>
      </ScrollView>

      {/* Floating Buttons */}
      <View style={{ position: 'absolute', bottom: 32, right: 20, alignItems: 'center' }}>
        <TouchableOpacity 
          style={[s.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: C.ink, marginBottom: 16 }]} 
          onPress={() => setHermesOpen(true)}
          activeOpacity={0.8}
        >
          <BirdIcon color={C.bg} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: C.ink }]} 
          onPress={() => setCalcOpen(true)}
          activeOpacity={0.8}
        >
          <CalculatorIcon color={C.bg} />
        </TouchableOpacity>
      </View>

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
    flex: 1, borderWith: 1.5, borderWidth: 1.5,
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
  calcExprText: { fontSize: 16, fontFamily: F.mono, marginBottom: 6 },
  calcResultText: { fontSize: 26, fontFamily: F.bold },
  calcRowBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  calcGrid: { flex: 4, gap: 6 },
  calcRow: { flexDirection: 'row', gap: 6, flex: 1 },
  calcGridBtn: { flex: 1, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  calcGridText: { fontSize: 18, fontFamily: F.bold },
  calcGridTextScientific: { fontSize: 13, fontFamily: F.medium },
});
