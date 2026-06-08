import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { isCourseDownloadedLocal, getLocalQuestions, parseFirestoreQuestion, getLocalCourse } from '../lib/db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

// ── Question bank ─────────────────────────────────────────────────────────────
const QUESTION_BANK: Record<string, { q: string; opts: string[]; answer: number }[]> = {
  mth101: [
    { q: 'In the context of architectural engineering, calculate the resultant force of a distributed load where the function is given by f(x) = 2x + 5 over a span of 10 meters.', opts: ['150 Newtons (Resultant Force)', '200 Newtons (Resultant Force)', '250 Newtons (Resultant Force)', '100 Newtons (Resultant Force)', 'None of the above'], answer: 2 },
    { q: 'Find the limit: lim(x→2) of (x² − 4) / (x − 2)', opts: ['0', '2', '4', 'Undefined', 'None of the above'], answer: 2 },
    { q: 'What is the derivative of f(x) = 3x³ − 2x + 7?', opts: ['9x² − 2', '9x² + 2', '3x² − 2', '9x³ − 2', 'None of the above'], answer: 0 },
    { q: 'Evaluate the integral: ∫(2x + 3)dx', opts: ['x² + 3x + C', '2x² + 3x + C', 'x² + C', '2x + C', 'None of the above'], answer: 0 },
    { q: 'The slope of the tangent to y = x² at x = 3 is:', opts: ['3', '6', '9', '12', 'None of the above'], answer: 1 },
    { q: 'Which of the following is a condition for a function to be continuous at x = c?', opts: ['f(c) must be defined', 'lim(x→c) f(x) must exist', 'lim(x→c) f(x) = f(c)', 'All of the above', 'None of the above'], answer: 3 },
    { q: 'Find dy/dx if y = sin(3x)', opts: ['cos(3x)', '3cos(3x)', '−3cos(3x)', '3sin(3x)', 'None of the above'], answer: 1 },
    { q: 'What is ∫₀² x² dx?', opts: ['4/3', '8/3', '4', '2', 'None of the above'], answer: 1 },
    { q: 'A function f(x) = x³ − 6x² + 9x has a local minimum at x =', opts: ['1', '3', '0', '−1', 'None of the above'], answer: 1 },
    { q: 'The second derivative of f(x) = x⁴ − 4x is:', opts: ['4x³ − 4', '12x²', '4x² − 4', '12x² − 4', 'None of the above'], answer: 1 },
    { q: 'If f(x) = eˣ, then f′(x) is:', opts: ['xeˣ⁻¹', 'eˣ', 'eˣln(e)', '1', 'None of the above'], answer: 1 },
    { q: 'The series 1 + 1/2 + 1/4 + 1/8 + ... converges to:', opts: ['1', '2', '∞', '0', 'None of the above'], answer: 1 },
  ],
  phy101: [
    { q: 'A body moving with initial velocity u = 10 m/s decelerates at 2 m/s². How far does it travel before stopping?', opts: ['25 m', '50 m', '20 m', '100 m', 'None of the above'], answer: 0 },
    { q: "Newton's second law states that force equals:", opts: ['mass × velocity', 'mass × acceleration', 'mass × displacement', 'velocity × time', 'None of the above'], answer: 1 },
    { q: 'A 5 kg object is accelerated at 3 m/s². What net force acts on it?', opts: ['8 N', '15 N', '1.67 N', '0.6 N', 'None of the above'], answer: 1 },
    { q: 'Kinetic energy is expressed as:', opts: ['mgh', '½mv²', 'mv', 'F × d', 'None of the above'], answer: 1 },
    { q: 'The unit of impulse is:', opts: ['Newton', 'Joule', 'Newton-second', 'Watt', 'None of the above'], answer: 2 },
    { q: 'Which of the following is a vector quantity?', opts: ['Speed', 'Mass', 'Temperature', 'Displacement', 'None of the above'], answer: 3 },
    { q: 'A 2 kg ball traveling at 5 m/s has momentum of:', opts: ['2.5 kg·m/s', '10 kg·m/s', '3 kg·m/s', '7 kg·m/s', 'None of the above'], answer: 1 },
    { q: 'The work done by a 10 N force through 5 m displacement at 60° to motion is:', opts: ['50 J', '25 J', '43.3 J', '0 J', 'None of the above'], answer: 1 },
    { q: 'Gravitational potential energy is given by:', opts: ['mgh', '½mv²', 'F/m', 'ma', 'None of the above'], answer: 0 },
    { q: 'When two objects collide elastically, which is conserved?', opts: ['Momentum only', 'Kinetic energy only', 'Both momentum and kinetic energy', 'Neither', 'None of the above'], answer: 2 },
    { q: 'The period of a simple pendulum depends on:', opts: ['Mass of bob', 'Length only', 'Amplitude', 'Material of string', 'None of the above'], answer: 1 },
    { q: 'Escape velocity from Earth is approximately:', opts: ['7.9 km/s', '11.2 km/s', '9.8 km/s', '3.0 km/s', 'None of the above'], answer: 1 },
  ],
  default: [
    { q: 'Which of the following is NOT a fundamental SI unit?', opts: ['Metre', 'Kilogram', 'Newton', 'Second', 'None of the above'], answer: 2 },
    { q: 'The process of converting a solid directly to a gas is called:', opts: ['Melting', 'Condensation', 'Sublimation', 'Evaporation', 'None of the above'], answer: 2 },
    { q: 'pH of pure water at 25°C is:', opts: ['5', '6', '7', '8', 'None of the above'], answer: 2 },
    { q: 'The atomic number of Carbon is:', opts: ['4', '6', '8', '12', 'None of the above'], answer: 1 },
    { q: 'Ohm\'s Law relates:', opts: ['Force and mass', 'Voltage, current and resistance', 'Energy and time', 'Momentum and velocity', 'None of the above'], answer: 1 },
    { q: 'Which gas makes up about 78% of Earth\'s atmosphere?', opts: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon', 'None of the above'], answer: 2 },
    { q: 'The speed of light in vacuum is approximately:', opts: ['3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10¹² m/s', 'None of the above'], answer: 1 },
    { q: 'The chemical formula for water is:', opts: ['H₂O₂', 'HO', 'H₂O', 'H₃O', 'None of the above'], answer: 2 },
    { q: 'The unit of electrical resistance is:', opts: ['Ampere', 'Volt', 'Ohm', 'Watt', 'None of the above'], answer: 2 },
    { q: 'Force is measured in:', opts: ['Joules', 'Newtons', 'Watts', 'Pascals', 'None of the above'], answer: 1 },
    { q: 'Acceleration due to gravity at Earth\'s surface is approximately:', opts: ['8.9 m/s²', '9.8 m/s²', '10.8 m/s²', '11.2 m/s²', 'None of the above'], answer: 1 },
    { q: 'The SI unit of power is:', opts: ['Joule', 'Newton', 'Watt', 'Pascal', 'None of the above'], answer: 2 },
  ],
};

function getQuestions(courseId: string, count: number) {
  const bank = QUESTION_BANK[courseId] ?? QUESTION_BANK.default;
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  const base = [];
  while (base.length < count) {
    base.push(...shuffled);
  }
  return base.slice(0, count).map((q, i) => ({ ...q, num: i + 1 }));
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CbtExamScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const { isOffline } = useAuth();

  const params = useLocalSearchParams<{
    courseId: string; duration: string; limit: string; year: string;
  }>();

  const courseId = params.courseId ?? 'mth101';
  const totalSeconds = (parseInt(params.duration) || 0) * 60;
  const numQ = parseInt(params.limit) || 40;
  const timerEnabled = totalSeconds > 0;

  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [courseCode, setCourseCode] = useState('');

  useEffect(() => {
    const localC = getLocalCourse(courseId);
    if (localC && localC.code) {
      setCourseCode(localC.code);
    } else if (!isOffline) {
      const docRef = doc(db, 'courses', courseId);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          setCourseCode(snap.data().code || '');
        }
      }).catch(err => console.log('Error fetching course details in cbt-exam:', err));
    }
  }, [courseId, isOffline]);

  useEffect(() => {
    const loadQuestions = async () => {
      setLoadingQuestions(true);
      let qList: any[] = [];
      
      // 1. Try local SQLite DB
      try {
        if (isCourseDownloadedLocal(courseId)) {
          const dbQs = getLocalQuestions(courseId);
          if (dbQs && dbQs.length > 0) {
            const shuffled = [...dbQs].sort(() => Math.random() - 0.5);
            qList = shuffled.slice(0, numQ).map((q, i) => ({ ...q, num: i + 1 }));
            console.log("[CbtExam] Questions loaded from local SQLite database:", qList.length);
          }
        }
      } catch (err) {
        console.error("[CbtExam] Error loading local questions:", err);
      }

      // 2. If online and not loaded locally, fetch from Firestore
      if (qList.length === 0 && !isOffline) {
        try {
          console.log("[CbtExam] Offline DB empty/not downloaded. Fetching from Firestore for course:", courseId);
          const sheetsQuery = query(
            collection(db, 'questionSheets'),
            where('courseId', '==', courseId),
            where('isAvailable', '==', true)
          );
          const sheetsSnap = await getDocs(sheetsQuery);
          const sheetIds = sheetsSnap.docs.map(doc => doc.id);
          
          if (sheetIds.length > 0) {
            const allFetchedQuestions = await Promise.all(
              sheetIds.map(async (sheetId) => {
                const questionsQuery = query(
                  collection(db, 'questions'),
                  where('sheetId', '==', sheetId)
                );
                const qSnap = await getDocs(questionsQuery);
                return qSnap.docs.map(doc => {
                  const data = doc.data();
                  return parseFirestoreQuestion(doc.id, { ...data, courseId });
                });
              })
            );
            
            const flattened = allFetchedQuestions.flat();
            if (flattened.length > 0) {
              const shuffled = flattened.sort(() => Math.random() - 0.5);
              qList = shuffled.slice(0, numQ).map((q, i) => ({ ...q, num: i + 1 }));
              console.log("[CbtExam] Questions loaded from Firestore:", qList.length);
            }
          }
        } catch (err) {
          console.error("[CbtExam] Error loading online questions from Firestore:", err);
        }
      }

      // 3. Fallback to static QUESTION_BANK
      if (qList.length === 0) {
        qList = getQuestions(courseId, numQ);
        console.log("[CbtExam] Questions loaded from static QUESTION_BANK:", qList.length);
      }

      setQuestions(qList);
      AsyncStorage.setItem('colearn_active_exam_questions', JSON.stringify(qList)).catch(() => {});
      setLoadingQuestions(false);
    };

    loadQuestions();
  }, [courseId, numQ, isOffline]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [started] = useState(Date.now());

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Timer
  useEffect(() => {
    if (!timerEnabled) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Back handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Exit Exam?', 'Your progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.push('/cbt-setup') },
      ]);
      return true;
    });
    return () => sub.remove();
  }, []);

  const animateSlide = (direction: 'left' | 'right', cb: () => void) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: direction === 'left' ? -30 : 30, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    cb();
  };

  const goTo = (idx: number) => {
    if (idx === currentIdx) return;
    animateSlide(idx > currentIdx ? 'left' : 'right', () => setCurrentIdx(idx));
  };

  const handleSelect = (optIdx: number) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: optIdx }));
  };

  const toggleFlag = () => {
    setFlagged(prev => {
      const next = new Set(prev);
      next.has(currentIdx) ? next.delete(currentIdx) : next.add(currentIdx);
      return next;
    });
  };

  const handleSubmit = useCallback((auto = false) => {
    const confirm = () => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const correct = questions.filter((q, i) => answers[i] === q.answer).length;
      
      // Save answers for corrections review page
      AsyncStorage.setItem('colearn_active_exam_answers', JSON.stringify(answers)).catch(() => {});
      
      router.push({
        pathname: '/cbt-results',
        params: {
          courseId,
          total: String(questions.length),
          correct: String(correct),
          elapsed: String(elapsed),
          answers: JSON.stringify(answers),
        },
      });
    };
    if (auto) { confirm(); return; }
    Alert.alert('Submit Assessment?', 'Are you sure you want to submit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: confirm },
    ]);
  }, [answers, questions, started, courseId]);

  const answered = Object.keys(answers).length;

  if (loadingQuestions || !questions || questions.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.activeText} />
        <Text style={{ marginTop: 12, fontSize: 15, fontFamily: F.bold, color: C.ink }}>Loading Questions...</Text>
      </SafeAreaView>
    );
  }

  const q = questions[currentIdx];
  const courseLabel = courseCode ? courseCode.toUpperCase() : courseId.toUpperCase().replace(/([a-z]+)(\d+)/, '$1 $2');

  // Navigator display: show first 8, ellipsis, last
  const navItems: (number | '...')[] = questions.length <= 10
    ? questions.map((_, i) => i)
    : [...Array(8).keys(), '...', questions.length - 1];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity activeOpacity={0.7} style={s.menuBtn}>
          {[0,1,2].map(i => <View key={i} style={[s.menuLine, { backgroundColor: C.ink }]} />)}
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.bellBody, { borderColor: C.ink }]} />
          <View style={[s.bellBase, { backgroundColor: C.ink }]} />
          <View style={[s.bellClapper, { borderColor: C.ink }]} />
        </TouchableOpacity>
      </View>

      {/* Sub-header: course + timer */}
      <View style={[s.subHeader, { borderBottomColor: C.border }]}>
        <View style={[s.coursePill, { backgroundColor: C.surfaceDark }]}>
          <Text style={s.coursePillText}>{courseLabel}</Text>
        </View>
        {timerEnabled && (
          <View style={s.timerBox}>
            <Text style={s.timerIcon}>⏱</Text>
            <Text style={[s.timerText, { color: C.ink }, timeLeft < 60 && s.timerTextUrgent]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Question card */}
        <Animated.View style={[s.questionCard, { backgroundColor: C.surface, borderColor: C.border, transform: [{ translateX: slideAnim }] }]}>
          <View style={s.questionMeta}>
            <Text style={[s.questionNum, { color: C.inkLight }]}>QUESTION {currentIdx + 1} OF {questions.length}</Text>
            <TouchableOpacity onPress={toggleFlag} activeOpacity={0.7} style={s.flagBtn}>
              <Text style={[s.flagIcon, { color: C.inkLight }, flagged.has(currentIdx) && [s.flagIconActive, { color: C.ink }]]}>⚑</Text>
              <Text style={[s.flagText, { color: C.inkLight }, flagged.has(currentIdx) && [s.flagTextActive, { color: C.ink }]]}>
                {flagged.has(currentIdx) ? 'Flagged' : 'Flag Question'}
              </Text>
            </TouchableOpacity>
          </View>

          <QuestionRenderer
            question={q.q}
            options={q.opts}
            selectedOptionIndex={answers[currentIdx]}
            onSelectOption={(oi) => handleSelect(oi)}
          />
        </Animated.View>

        {/* Prev / Next */}
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.prevBtn, { borderColor: C.border }, currentIdx === 0 && s.btnDisabled]}
            disabled={currentIdx === 0}
            onPress={() => goTo(currentIdx - 1)}
            activeOpacity={0.85}
          >
            <Text style={[s.prevBtnText, { color: C.inkMid }]}>← Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.nextBtn, { backgroundColor: C.ink }, currentIdx === questions.length - 1 && s.btnDisabled]}
            disabled={currentIdx === questions.length - 1}
            onPress={() => goTo(currentIdx + 1)}
            activeOpacity={0.85}
          >
            <Text style={[s.nextBtnText, { color: C.bg }]}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Progress summary */}
        <View style={[s.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.summaryTitle, { color: C.ink }]}>Progress Summary</Text>
          <View style={s.statsRow}>
            <View style={[s.statBox, { backgroundColor: C.bg }]}>
              <Text style={[s.statLabel, { color: C.inkLight }]}>ANSWERED</Text>
              <Text style={[s.statNum, { color: C.ink }]}>{pad(answered)}</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: C.bg }]}>
              <Text style={[s.statLabel, { color: C.inkLight }]}>REMAINING</Text>
              <Text style={[s.statNum, { color: C.ink }]}>{pad(questions.length - answered)}</Text>
            </View>
          </View>

          {/* Question navigator */}
          <Text style={[s.navLabel2, { color: C.inkLight }]}>QUESTION NAVIGATOR</Text>
          <View style={s.navGrid}>
            {navItems.map((item, i) => {
              if (item === '...') {
                return <Text key="ellipsis" style={[s.ellipsis, { color: C.inkLight }]}>···</Text>;
              }
              const idx = item as number;
              const isAnswered = idx in answers;
              const isCurrent = idx === currentIdx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.navCell,
                    { backgroundColor: C.border },
                    isAnswered && [s.navCellAnswered, { backgroundColor: C.inkMid }],
                    isCurrent && [s.navCellCurrent, { backgroundColor: C.ink, borderColor: C.ink }],
                  ]}
                  onPress={() => goTo(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.navCellText, { color: C.inkLight }, (isAnswered || isCurrent) && [s.navCellTextActive, { color: C.bg }]]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: C.ink }, answered < questions.length && [s.submitBtnDisabled, { backgroundColor: C.border }]]}
            onPress={() => handleSubmit(false)}
            disabled={answered < questions.length}
            activeOpacity={0.88}
          >
            <Text style={[s.submitBtnText, { color: C.bg }, answered < questions.length && [s.submitBtnTextDisabled, { color: C.inkLight }]]}>
              SUBMIT ASSESSMENT
            </Text>
          </TouchableOpacity>
          {answered < questions.length && (
            <Text style={[s.submitHint, { color: C.inkLight }]}>ONLY ENABLED WHEN 100% COMPLETE</Text>
          )}
        </View>

        {/* Study mode banner */}
        <View style={[s.studyBanner, { backgroundColor: C.surfaceDark }]}>
          <View style={s.studyIcon}>
            <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.studyTitle}>STUDY MODE ACTIVE</Text>
            <Text style={s.studySub}>Focus mode is enabled. Notifications are silenced.</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="cbt" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 16, letterSpacing: 2 },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', gap: 5 },
  menuLine: { width: 22, height: 2, borderRadius: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  bellBody: { width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderBottomWidth: 0 },
  bellBase: { width: 20, height: 2, borderRadius: 1 },
  bellClapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2, borderTopWidth: 0, marginTop: -1, alignSelf: 'center' },

  // Sub-header
  subHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  coursePill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  coursePillText: { fontFamily: F.bold, fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerIcon: { fontSize: 14 },
  timerText: { fontFamily: F.bold, fontSize: 18, letterSpacing: 1 },
  timerTextUrgent: { color: '#C0392B' },

  // Question card
  questionCard: {
    borderRadius: 18, borderWidth: 1,
    padding: 18, marginTop: 14, marginBottom: 12,
  },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  questionNum: { fontFamily: F.medium, fontSize: 11, letterSpacing: 1.2 },
  flagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flagIcon: { fontSize: 14 },
  flagIconActive: { },
  flagText: { fontFamily: F.medium, fontSize: 12 },
  flagTextActive: { fontFamily: F.bold },
  questionText: { fontFamily: F.display, fontSize: 18, lineHeight: 26, marginBottom: 20 },

  // Options
  options: { gap: 10 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  optionRowSelected: { },
  optionLabel: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  optionLabelSelected: { },
  optionLabelText: { fontFamily: F.bold, fontSize: 13 },
  optionLabelTextSelected: { },
  optionText: { flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  optionTextSelected: { },

  // Prev/Next
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  prevBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtn: {
    flex: 1, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  prevBtnText: { fontFamily: F.bold, fontSize: 14 },
  nextBtnText: { fontFamily: F.bold, fontSize: 14 },

  // Summary card
  summaryCard: {
    borderRadius: 18, borderWidth: 1,
    padding: 18, marginBottom: 12,
  },
  summaryTitle: { fontFamily: F.bold, fontSize: 16, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, borderRadius: 12,
    padding: 14, alignItems: 'flex-start',
  },
  statLabel: { fontFamily: F.medium, fontSize: 10, letterSpacing: 1.2, marginBottom: 6 },
  statNum: { fontFamily: F.display, fontSize: 28 },
  navLabel2: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.5, marginBottom: 10 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  navCell: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  navCellAnswered: { },
  navCellCurrent: { borderWidth: 2 },
  navCellText: { fontFamily: F.bold, fontSize: 12 },
  navCellTextActive: { },
  ellipsis: { fontFamily: F.bold, fontSize: 16, alignSelf: 'center', paddingHorizontal: 4 },

  submitBtn: {
    borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 6,
  },
  submitBtnDisabled: { },
  submitBtnText: { fontFamily: F.bold, fontSize: 14, letterSpacing: 1.2 },
  submitBtnTextDisabled: { },
  submitHint: { fontFamily: F.medium, fontSize: 10, textAlign: 'center', letterSpacing: 1 },

  // Study mode
  studyBanner: {
    borderRadius: 14,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 12,
  },
  studyIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  studyTitle: { fontFamily: F.bold, fontSize: 12, color: '#fff', letterSpacing: 1, marginBottom: 3 },
  studySub: { fontFamily: F.body, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});
