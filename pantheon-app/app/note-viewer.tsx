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
import { speakText, stopSpeech, pauseSpeech, resumeSpeech } from '../lib/ttsService';
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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIConfig {
  provider: 'gemini' | 'groq' | 'openrouter' | 'openai' | 'custom';
  baseUrl?: string;
  apiKey: string;
  model?: string;
  isActive?: boolean;
}

async function chatWithHermesMobile(messages: ChatMessage[], noteContent: string, config?: AIConfig) {
  const provider = config?.provider || 'groq';
  let model = config?.model;
  
  if (!model) {
    model = provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'gemini' ? 'gemini-2.0-flash-lite' : provider === 'openrouter' ? 'google/gemini-2.0-flash-001' : 'gpt-4o-mini';
  }
  
  // Clean model ID for Groq
  if (provider === 'groq' && model.includes('/')) {
    const parts = model.split('/');
    model = parts[parts.length - 1]; 
  }

  const rawKey = config?.apiKey || '';
  // Extreme trim: removes ALL whitespace, surrounding quotes, and invisible characters
  const apiKey = rawKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 1. Truncate note content to prevent model context limits
  const maxNoteLength = 15000;
  const truncatedNote = (noteContent || '').length > maxNoteLength
    ? noteContent.substring(0, maxNoteLength) + "\n\n[Study Note content truncated to fit system context window limitations...]"
    : (noteContent || '');

  // 2. Slice messages history to keep context footprint small
  const maxHistoryCount = 8;
  const slicedMessages = (messages || []).length > maxHistoryCount
    ? messages.slice(-maxHistoryCount)
    : (messages || []);

  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are Hermes, a hyper-focused academic assistant designed to help the user query their study notes.

CRITICAL REFUSAL MANDATES:
1. You can ONLY answer questions that can be directly and objectively answered using the provided "STUDY NOTE CONTENT" below.
2. If the user's latest question is NOT fully and directly addressed in the provided STUDY NOTE CONTENT, or if they ask general knowledge questions, language translation questions, programming questions, or questions about yourself (who you are, your model, etc.), you MUST decline.
3. In such cases of off-topic or unanswerable queries, you MUST respond EXACTLY with the following sentence and nothing else:
"I can only assist you with questions directly related to this note."
4. Do NOT translate languages, do NOT answer in French unless the study note is explicitly about the French language, and do NOT make up information.
5. Use LaTeX for ALL mathematical formulas or scientific notations (e.g., $E=mc^2$ or \\frac{a}{b}).
6. Keep all answers highly concise, factual, and strictly relevant.

STUDY NOTE CONTENT:
${truncatedNote}
`
  };

  // Determine base URL
  let rawBaseUrl = config?.baseUrl ? config.baseUrl.trim().replace(/\/+$/, '') : '';

  if (!rawBaseUrl) {
    if (provider === 'groq') rawBaseUrl = 'https://api.groq.com/openai/v1';
    else if (provider === 'openrouter') rawBaseUrl = 'https://openrouter.ai/api/v1';
    else if (provider === 'openai' || provider === 'custom') rawBaseUrl = 'https://api.openai.com/v1';
  }

  // ─── GOOGLE GEMINI (Direct) ──────────────────────────────────────────────────
  if (provider === 'gemini' && !rawBaseUrl) {
    if (!apiKey) {
      throw new Error('Google Gemini Chat AI is not configured. Please set an API Key in the Admin Panel.');
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Convert OpenAI-style system role to Gemini format
    const latestUserMsg = slicedMessages.length > 0 ? slicedMessages[slicedMessages.length - 1].content : '';
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${latestUserMsg}` }]
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

  // ─── OPENAI-COMPATIBLE ENDPOINT (Groq, OpenRouter, OpenAI, Custom, etc.) ──────
  if (rawBaseUrl.endsWith('/chat/completions')) {
    rawBaseUrl = rawBaseUrl.replace(/\/chat\/completions$/, '');
  }
  const finalEndpoint = `${rawBaseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (provider === 'openrouter') {
    headers['X-Title'] = 'Hermes Academic Assistant';
  }

  const response = await fetch(finalEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: [systemPrompt, ...slicedMessages],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errInfo = errData.error?.error || errData.error || errData;
    const errMsg = errInfo.message || `Failed to connect to Hermes via ${provider}`;
    const errCode = errInfo.code || response.status;
    throw new Error(`${errMsg} | Code: ${errCode} | Provider: ${provider.toUpperCase()} | Model: ${model} | Endpoint: ${finalEndpoint}`);
  }

  const data = await response.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error("Unexpected response structure from AI provider.");
  }

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
  const [hermesOpen, setHermesOpen] = useState(false);
  const [hermesMsg, setHermesMsg] = useState('');
  const [hermesChat, setHermesChat] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I am Hermes. Ask me anything about this note.' }
  ]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [hermesLoading, setHermesLoading] = useState(false);

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
  const [noteIndex, setNoteIndex] = useState<number>(-1);

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
            // Arranged in alphabetical order
            allNotesInCourse.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
              
            const idx = allNotesInCourse.findIndex(n => n.id === noteId);
            setNoteIndex(idx);
            setPrevNote(idx > 0 ? allNotesInCourse[idx - 1] : null);
            setNextNote(idx < allNotesInCourse.length - 1 ? allNotesInCourse[idx + 1] : null);
            console.log('NoteViewer: Nav notes set', { idx, hasPrev: !!(idx > 0), hasNext: !!(idx < allNotesInCourse.length - 1) });
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

  // Text-To-Speech Clean Up effect
  useEffect(() => {
    return () => {
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        console.log(e);
      }
    };
  }, []);

  const convertLatexToSpeakable = (text: string): string => {
    if (!text) return '';
    // Convert standard inline and block LaTeX ($...$ or $$...$$) into phonetically clean English
    return text.replace(/\$\$?([\s\S]+?)\$\$?/g, (_, formula) => {
      let speakable = formula.trim();

      // 1. Pre-processing: remove formatting tags and bracket controls
      speakable = speakable.replace(/\\left/g, '').replace(/\\right/g, '');
      speakable = speakable.replace(/\\mathrm/g, '');
      speakable = speakable.replace(/\\text\s*\{([^}]+)\}/g, ' $1 ');
      speakable = speakable.replace(/\\mathrm\s*\{([^}]+)\}/g, ' $1 ');

      // 2. Trigonometric and common mathematical functions
      speakable = speakable.replace(/\\sin\b/g, ' sine of, ');
      speakable = speakable.replace(/\\cos\b/g, ' cosine of, ');
      speakable = speakable.replace(/\\tan\b/g, ' tangent of, ');
      speakable = speakable.replace(/\\ln\b/g, ' natural log of, ');
      speakable = speakable.replace(/\\log\b/g, ' log of, ');

      // 3. Vector / Arrow markers
      speakable = speakable.replace(/\\vec\{(\w)\}/g, ' vector, $1, ');
      speakable = speakable.replace(/\\bar\{(\w)\}/g, ' $1 bar, ');
      speakable = speakable.replace(/\\hat\{(\w)\}/g, ' $1 hat, ');

      // 4. Limits
      speakable = speakable.replace(/\\lim_\{([^\}]+)\s*\\to\s*([^}]+)\}/g, ' limit as $1, approaches $2, ');
      speakable = speakable.replace(/\\lim_\{([^\}]+)\}/g, ' limit as $1, ');

      // 5. Summations (Sum from lower to upper of ...)
      speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' sum from $1, to $2, of, ');
      speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^(\w)/g, ' sum from $1, to $2, of, ');
      speakable = speakable.replace(/\\sum\b/g, ' sum ');

      // 6. Integrals (Integral from lower to upper of ...)
      speakable = speakable.replace(/\\int_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' integral from $1, to $2, of, ');
      speakable = speakable.replace(/\\int_\{([^\}]+)\}\^(\w)/g, ' integral from $1, to $2, of, ');
      speakable = speakable.replace(/\\int\b/g, ' integral ');

      // 7. Fractions (handle derivatives first: \frac{dy}{dx} -> derivative of y with respect to x)
      speakable = speakable.replace(/\\frac\{d(\w)\}\{d(\w)\}/g, ' derivative of $1, with respect to $2, ');
      speakable = speakable.replace(/\\frac\{\\partial\s*(\w)\}\{\\partial\s*(\w)\}/g, ' partial derivative of $1, with respect to $2, ');
      
      let prev;
      do {
        prev = speakable;
        speakable = speakable.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, ' ($1, divided by, $2) ');
      } while (speakable !== prev);

      // 8. Superscripts / powers (avoiding collision with sum/integral limits already parsed)
      speakable = speakable.replace(/(\w+)\^2\b/g, '$1, squared, ');
      speakable = speakable.replace(/(\w+)\^3\b/g, '$1, cubed, ');
      speakable = speakable.replace(/\{?([^}^^]+)\}?\^\{([^}]+)\}/g, '$1, to the power of, $2, ');
      speakable = speakable.replace(/\{?([^}^^]+)\}?\^(\w)/g, '$1, to the power of, $2, ');

      // 9. Square roots
      speakable = speakable.replace(/\\sqrt\s*\{([^}]+)\}/g, ' the square root of, $1, ');
      speakable = speakable.replace(/\\sqrt\s*(\w)/g, ' the square root of, $1, ');

      // 10. Greek Letters conversion
      const greekLetters: Record<string, string> = {
        '\\alpha': 'alpha',
        '\\beta': 'beta',
        '\\gamma': 'gamma',
        '\\delta': 'delta',
        '\\epsilon': 'epsilon',
        '\\zeta': 'zeta',
        '\\eta': 'eta',
        '\\theta': 'theta',
        '\\iota': 'iota',
        '\\kappa': 'kappa',
        '\\lambda': 'lambda',
        '\\mu': 'mu',
        '\\nu': 'nu',
        '\\xi': 'xi',
        '\\pi': 'pi',
        '\\rho': 'rho',
        '\\sigma': 'sigma',
        '\\tau': 'tau',
        '\\upsilon': 'upsilon',
        '\\phi': 'phi',
        '\\chi': 'chi',
        '\\psi': 'psi',
        '\\omega': 'omega',
        '\\Delta': 'delta',
        '\\Sigma': 'sigma',
        '\\Omega': 'omega',
      };

      Object.entries(greekLetters).forEach(([latex, spoken]) => {
        const escaped = latex.replace(/\\/g, '\\\\');
        const regex = new RegExp(escaped, 'g');
        speakable = speakable.replace(regex, ` ${spoken} `);
      });

      // 11. Subscripts: v_initial -> v initial, v_{i} -> v i
      speakable = speakable.replace(/(\w+)_\{([^}]+)\}/g, '$1 sub $2');
      speakable = speakable.replace(/(\w+)_(\w)/g, '$1 sub $2');

      // 12. Math Operators & Relations
      speakable = speakable.replace(/\\infty/g, ' infinity ');
      speakable = speakable.replace(/\\partial/g, ' partial derivative ');
      speakable = speakable.replace(/\\times/g, ' times ');
      speakable = speakable.replace(/\\cdot/g, ' times ');
      speakable = speakable.replace(/\\div/g, ' divided by ');
      speakable = speakable.replace(/\\pm/g, ' plus or minus ');
      speakable = speakable.replace(/\\approx/g, ' approximately equals ');
      speakable = speakable.replace(/\\le/g, ' is less than or equal to ');
      speakable = speakable.replace(/\\ge/g, ' is greater than or equal to ');
      speakable = speakable.replace(/\\neq/g, ' is not equal to ');
      speakable = speakable.replace(/\\to/g, ' approaches ');
      speakable = speakable.replace(/\\(dots|ldots|cdots)/g, ', and so on, ');
      speakable = speakable.replace(/=/g, ', equals, ');
      speakable = speakable.replace(/\+/g, ' plus ');
      speakable = speakable.replace(/-/g, ' minus ');
      
      // Clean up leftover symbols, parenthesis and curly braces
      speakable = speakable.replace(/[{}]/g, ' ');
      speakable = speakable.replace(/\\/g, ' ');
      speakable = speakable.replace(/\s+/g, ' ').trim();

      return ` ${speakable} `;
    });
  };

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

      // Clean text extraction from blocks
      let cleanText = '';
      try {
        const blocks = JSON.parse(note?.content || '');
        if (Array.isArray(blocks)) {
          const rawTextParts = blocks
            .map((b: any) => {
              if (!b) return '';
              const type = b.type || '';
              if (type === 'h1' || type === 'h2' || type === 'h3' || type === 'h4' || type === 'text' || type === 'paragraph' || type === 'callout' || type === 'quote') {
                return b.content || '';
              }
              if (type === 'math' && b.content) {
                const cleaned = b.content.trim();
                if (cleaned.startsWith('$')) return cleaned;
                return `$$${cleaned}$$`;
              }
              if (type === 'table' && b.content) {
                try {
                  const rows = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
                  if (Array.isArray(rows)) {
                    return "Table content: " + rows.map((r: any) => Array.isArray(r) ? r.join(', ') : String(r)).join('. ');
                  }
                } catch {
                  return b.content || '';
                }
              }
              if (type === 'diagram' || type === 'image') {
                const caption = b.settings?.caption || b.settings?.description || b.settings?.alt || '';
                if (caption.trim()) {
                  return `Diagram showing: ${caption.trim()}`;
                }
                return '';
              }
              if (type === 'bullet-list' || type === 'numbered-list' || type === 'list') {
                return b.content || '';
              }
              if (type === 'question' && b.content) {
                try {
                  const q = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
                  return `Question: ${q.question || ''}. Correct answer: ${q.correct || ''}.`;
                } catch {
                  return '';
                }
              }
              if (typeof b.content === 'string' && !b.content.startsWith('http') && !b.content.startsWith('data:')) {
                return b.content;
              }
              return '';
            })
            .filter(Boolean);

          let joined = rawTextParts.join('... ');
          // Strip base64, SVG XML and raw HTML tags
          joined = joined.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
          joined = joined.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, '');
          joined = joined.replace(/<svg[\s\S]*?<\/svg>/gi, '');
          joined = joined.replace(/<[^>]*>/g, '');

          if (!joined.trim()) {
            joined = `${note?.title || 'Study Note'}. ${note?.summary || ''}`;
          }
          cleanText = convertLatexToSpeakable(joined);
        } else {
          let rawText = note?.content || note?.title || '';
          rawText = rawText.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
          rawText = rawText.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, '');
          rawText = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, '');
          rawText = rawText.replace(/<[^>]*>/g, '');
          cleanText = convertLatexToSpeakable(rawText);
        }
      } catch {
        let rawText = note?.content || note?.title || '';
        // Strip raw base64 data strings (very large continuous blocks of characters)
        rawText = rawText.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
        rawText = rawText.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, ''); // strip any giant token of 100+ chars (common for base64)
        
        // Strip SVG XML structures
        rawText = rawText.replace(/<svg[\s\S]*?<\/svg>/gi, '');
        
        // Strip general HTML tags
        rawText = rawText.replace(/<[^>]*>/g, '');
        
        // Strip markdown image strings
        rawText = rawText.replace(/!\[.*?\]\(.*?\)/g, '');
        
        // Clean up other markdown elements
        rawText = rawText
          .replace(/#+\s+/g, '')
          .replace(/\*\*|__/g, '')
          .replace(/\*|_/g, '')
          .trim();
        
        cleanText = convertLatexToSpeakable(rawText);
      }

      if (!cleanText || !cleanText.trim()) {
        cleanText = `${note?.title || 'Lecture Note'}.`;
      }

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

  const sanitizeHermesError = (rawMessage: string) => {
    let errorCode = "UNKNOWN";
    let cleanMsg = rawMessage || "Failed to generate response";

    // Try to parse status code
    const codeMatch = cleanMsg.match(/(?:Code|status):\s*(\d+)/i);
    if (codeMatch) {
      errorCode = codeMatch[1];
    }

    // If there are segments separated by '|' or similar, keep only the first segment which is the human-friendly message
    if (cleanMsg.includes('|')) {
      cleanMsg = cleanMsg.split('|')[0].trim();
    }

    // Remove potential sensitive keywords (case-insensitive)
    const blacklist = [
      /groq/gi, /openrouter/gi, /openai/gi, /gemini/gi, /claude/gi, /google/gi,
      /gpt-[a-zA-Z0-9.-]+/gi, /llama[a-zA-Z0-9.-]*/gi, /mixtral/gi, /deepseek/gi,
      /https?:\/\/\S+/gi, /\/\S+completions/gi, /endpoint:\s*\S+/gi, /provider:\s*\S+/gi,
      /model:\s*\S+/gi
    ];

    for (const pattern of blacklist) {
      cleanMsg = cleanMsg.replace(pattern, '').trim();
    }

    // Clean trailing spaces, punctuation or extra dividers
    cleanMsg = cleanMsg.replace(/\s*[|:-]+\s*$/g, '').trim() || "An unexpected network error occurred.";

    return `Error Code: ${errorCode}\nError Message: ${cleanMsg}\n\nPlease inform an administrator about this issue.`;
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
      const sanitizedErrorMsg = sanitizeHermesError(err.message);
      setHermesChat(prev => [...prev, { role: 'assistant', content: sanitizedErrorMsg }]);
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
        <View style={{ width: 36, height: 36 }} />
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

          {/* Audio Reader Widget (Text-To-Speech) */}
          <View style={{
            backgroundColor: C.surface,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 16,
            marginVertical: 18,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: speechIsPlaying && !speechIsPaused ? C.activeText + '15' : C.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12
                }}>
                  <Text style={{ fontSize: 16, color: speechIsPlaying && !speechIsPaused ? C.activeText : C.ink }}>🔊</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>Audio Study Assistant</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.inkLight, marginTop: 1 }} numberOfLines={1}>
                    {speechIsPreparing
                      ? `Preparing voiceover (${speechPrepProgress}%)...`
                      : speechIsPlaying
                      ? (speechIsPaused ? 'Playback paused' : 'Reading study guide...')
                      : 'Listen to this complete note'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleToggleSpeakNote}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: speechIsPreparing ? C.activeText + '20' : (speechIsPlaying && !speechIsPaused ? C.border : C.ink),
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
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
                      paddingHorizontal: 10,
                      paddingVertical: 7,
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

          {/* Note content rendered with NoteRenderer (WebView) */}
          <NoteRenderer content={note.content} onFocusBlock={(type, content) => setFocusedBlock({ type, content })} />

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
                <View style={{ maxHeight: 320, minHeight: 120, width: '100%' }}>
                  <NoteRenderer 
                    content={JSON.stringify([{ id: 'focus_math', type: 'math', content: focusedBlock.content }])} 
                    bgOverride={C.surface}
                    paddingOverride="20px"
                    scrollableMath={true}
                  />
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
