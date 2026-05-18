import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { NoteRenderer } from '../components/NoteRenderer';

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
  const params = useLocalSearchParams<{
    courseId: string; duration: string; numQuestions: string; year: string;
  }>();

  const courseId = params.courseId ?? 'mth101';
  const totalSeconds = (parseInt(params.duration) || 0) * 60;
  const numQ = parseInt(params.numQuestions) || 40;
  const timerEnabled = totalSeconds > 0;

  const [questions] = useState(() => getQuestions(courseId, numQ));
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
  }, [answers, questions]);

  const answered = Object.keys(answers).length;
  const q = questions[currentIdx];
  const courseLabel = courseId.toUpperCase().replace(/([a-z]+)(\d+)/, '$1 $2');

  // Navigator display: show first 8, ellipsis, last
  const navItems: (number | '...')[] = questions.length <= 10
    ? questions.map((_, i) => i)
    : [...Array(8).keys(), '...', questions.length - 1];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7} style={s.menuBtn}>
          {[0,1,2].map(i => <View key={i} style={s.menuLine} />)}
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <View style={s.bellBody} />
          <View style={s.bellBase} />
          <View style={s.bellClapper} />
        </TouchableOpacity>
      </View>

      {/* Sub-header: course + timer */}
      <View style={s.subHeader}>
        <View style={s.coursePill}>
          <Text style={s.coursePillText}>{courseLabel}</Text>
        </View>
        {timerEnabled && (
          <View style={s.timerBox}>
            <Text style={s.timerIcon}>⏱</Text>
            <Text style={[s.timerText, timeLeft < 60 && s.timerTextUrgent]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Question card */}
        <Animated.View style={[s.questionCard, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.questionMeta}>
            <Text style={s.questionNum}>QUESTION {currentIdx + 1} OF {questions.length}</Text>
            <TouchableOpacity onPress={toggleFlag} activeOpacity={0.7} style={s.flagBtn}>
              <Text style={[s.flagIcon, flagged.has(currentIdx) && s.flagIconActive]}>⚑</Text>
              <Text style={[s.flagText, flagged.has(currentIdx) && s.flagTextActive]}>
                {flagged.has(currentIdx) ? 'Flagged' : 'Flag Question'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: 20 }}>
            <NoteRenderer content={q.q} />
          </View>

          {/* Options */}
          <View style={s.options}>
            {q.opts.map((opt, oi) => {
              const selected = answers[currentIdx] === oi;
              return (
                <TouchableOpacity
                  key={oi}
                  style={[s.optionRow, selected && s.optionRowSelected]}
                  onPress={() => handleSelect(oi)}
                  activeOpacity={0.85}
                >
                  <View style={[s.optionLabel, selected && s.optionLabelSelected]}>
                    <Text style={[s.optionLabelText, selected && s.optionLabelTextSelected]}>
                      {OPTION_LABELS[oi]}
                    </Text>
                  </View>
                  <Text style={[s.optionText, selected && s.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Prev / Next */}
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.prevBtn, currentIdx === 0 && s.btnDisabled]}
            disabled={currentIdx === 0}
            onPress={() => goTo(currentIdx - 1)}
            activeOpacity={0.85}
          >
            <Text style={s.prevBtnText}>← Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.nextBtn, currentIdx === questions.length - 1 && s.btnDisabled]}
            disabled={currentIdx === questions.length - 1}
            onPress={() => goTo(currentIdx + 1)}
            activeOpacity={0.85}
          >
            <Text style={s.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Progress summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>Progress Summary</Text>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>ANSWERED</Text>
              <Text style={s.statNum}>{pad(answered)}</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statLabel}>REMAINING</Text>
              <Text style={s.statNum}>{pad(questions.length - answered)}</Text>
            </View>
          </View>

          {/* Question navigator */}
          <Text style={s.navLabel2}>QUESTION NAVIGATOR</Text>
          <View style={s.navGrid}>
            {navItems.map((item, i) => {
              if (item === '...') {
                return <Text key="ellipsis" style={s.ellipsis}>···</Text>;
              }
              const idx = item as number;
              const isAnswered = idx in answers;
              const isCurrent = idx === currentIdx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    s.navCell,
                    isAnswered && s.navCellAnswered,
                    isCurrent && s.navCellCurrent,
                  ]}
                  onPress={() => goTo(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.navCellText, (isAnswered || isCurrent) && s.navCellTextActive]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, answered < questions.length && s.submitBtnDisabled]}
            onPress={() => handleSubmit(false)}
            activeOpacity={answered < questions.length ? 1 : 0.88}
          >
            <Text style={[s.submitBtnText, answered < questions.length && s.submitBtnTextDisabled]}>
              SUBMIT ASSESSMENT
            </Text>
          </TouchableOpacity>
          {answered < questions.length && (
            <Text style={s.submitHint}>ONLY ENABLED WHEN 100% COMPLETE</Text>
          )}
        </View>

        {/* Study mode banner */}
        <View style={s.studyBanner}>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 16, color: C.ink, letterSpacing: 2 },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', gap: 5 },
  menuLine: { width: 22, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  bellBody: { width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 0 },
  bellBase: { width: 20, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  bellClapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2, borderColor: C.ink, borderTopWidth: 0, marginTop: -1, alignSelf: 'center' },

  // Sub-header
  subHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  coursePill: { backgroundColor: C.surfaceDark, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  coursePillText: { fontFamily: F.bold, fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerIcon: { fontSize: 14 },
  timerText: { fontFamily: F.bold, fontSize: 18, color: C.ink, letterSpacing: 1 },
  timerTextUrgent: { color: '#C0392B' },

  // Question card
  questionCard: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 1,
    borderColor: C.border, padding: 18, marginTop: 14, marginBottom: 12,
  },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  questionNum: { fontFamily: F.medium, fontSize: 11, color: C.inkLight, letterSpacing: 1.2 },
  flagBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flagIcon: { fontSize: 14, color: C.inkLight },
  flagIconActive: { color: C.ink },
  flagText: { fontFamily: F.medium, fontSize: 12, color: C.inkLight },
  flagTextActive: { color: C.ink, fontFamily: F.bold },
  questionText: { fontFamily: F.display, fontSize: 18, color: C.ink, lineHeight: 26, marginBottom: 20 },

  // Options
  options: { gap: 10 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  optionRowSelected: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  optionLabel: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  optionLabelSelected: { backgroundColor: '#fff', borderColor: '#fff' },
  optionLabelText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },
  optionLabelTextSelected: { color: '#27AE60' },
  optionText: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  optionTextSelected: { color: '#fff' },

  // Prev/Next
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  prevBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtn: {
    flex: 1, backgroundColor: C.ink, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  prevBtnText: { fontFamily: F.bold, fontSize: 14, color: C.inkMid },
  nextBtnText: { fontFamily: F.bold, fontSize: 14, color: '#fff' },

  // Summary card
  summaryCard: {
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 1,
    borderColor: C.border, padding: 18, marginBottom: 12,
  },
  summaryTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: C.bg, borderRadius: 12,
    padding: 14, alignItems: 'flex-start',
  },
  statLabel: { fontFamily: F.medium, fontSize: 10, color: C.inkLight, letterSpacing: 1.2, marginBottom: 6 },
  statNum: { fontFamily: F.display, fontSize: 28, color: C.ink },
  navLabel2: { fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 1.5, marginBottom: 10 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  navCell: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.unansweredNav,
    justifyContent: 'center', alignItems: 'center',
  },
  navCellAnswered: { backgroundColor: C.answeredNav },
  navCellCurrent: { backgroundColor: C.ink, borderWidth: 2, borderColor: C.ink },
  navCellText: { fontFamily: F.bold, fontSize: 12, color: C.inkLight },
  navCellTextActive: { color: '#fff' },
  ellipsis: { fontFamily: F.bold, fontSize: 16, color: C.inkLight, alignSelf: 'center', paddingHorizontal: 4 },

  submitBtn: {
    backgroundColor: C.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 6,
  },
  submitBtnDisabled: { backgroundColor: C.border },
  submitBtnText: { fontFamily: F.bold, fontSize: 14, color: '#fff', letterSpacing: 1.2 },
  submitBtnTextDisabled: { color: C.inkLight },
  submitHint: { fontFamily: F.medium, fontSize: 10, color: C.inkLight, textAlign: 'center', letterSpacing: 1 },

  // Study mode
  studyBanner: {
    backgroundColor: C.surfaceDark, borderRadius: 14,
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

  // Bottom Nav
  bottomNav: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 40, paddingVertical: 10, paddingHorizontal: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'space-around',
  },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 3, borderRadius: 30 },
  navTabActive: { backgroundColor: C.surfaceDark, paddingHorizontal: 20, flex: 0, paddingVertical: 10, minWidth: 60 },
  navLabel: { fontFamily: F.medium, fontSize: 11, color: C.navInactive },

  inkMid: C.inkMid,
});

const inkMid = C.inkMid;
