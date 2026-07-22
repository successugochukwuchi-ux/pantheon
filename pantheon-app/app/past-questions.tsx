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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NoteRenderer } from '../components/NoteRenderer';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { BottomNav } from '../components/BottomNav';
import { F, THEMES } from '../components/Theme';
import { 
  getDownloadedCoursesLocal, 
  getLocalQuestionSheets, 
  getLocalQuestions 
} from '../lib/db';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';

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
  const { profile, systemConfig } = useAuth();
  const { colors: C, themeName } = useTheme();
  
  // Responsive stylesheet
  const s = useMemo(() => createStyles(C), [C]);

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        {/* Simple Header */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
            <View style={[s.backArrow, { backgroundColor: C.ink }]} />
            <View style={[s.backArrowHead, { borderColor: C.ink }]} />
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            PAST QUESTIONS
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>📚</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Past Questions Locked
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
            Past Questions and official exam papers are premium features reserved for activated accounts. Activate your student profile using an activation pin to unlock full access to years of exam resources!
          </Text>

          <TouchableOpacity
            style={{ width: '100%', height: 56, backgroundColor: C.ink, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ width: '100%', height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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

  // Anim state
  const questionAnim = useRef(new Animated.Value(0)).current;

  // 1. Load Courses (supports both Online and Offline)
  useEffect(() => {
    async function loadCourses() {
      setLoading(true);
      try {
        const activeSemester = (!systemConfig?.currentSemester || systemConfig.currentSemester === 'none') ? '1st' : systemConfig.currentSemester;
        
        const isSameSemester = (courseSem: string, activeSem: string) => {
          const normCourse = (courseSem || '').toLowerCase().trim();
          const normActive = (activeSem || '1st').toLowerCase().trim();
          
          if (normCourse === normActive) return true;
          if (normActive === '1st' && (normCourse === 'first' || normCourse === '1st')) return true;
          if (normActive === '2nd' && (normCourse === 'second' || normCourse === '2nd')) return true;
          return false;
        };

        // Attempt SQLite local load first as default
        const localCourses = getDownloadedCoursesLocal().filter(lc => isSameSemester(lc.semester || '', activeSemester));
        if (localCourses.length > 0) {
          const filteredLocal = await getFilteredCoursesForStudent(
            localCourses.map(c => ({ ...c, isDownloaded: true })),
            profile,
            true,
            activeSemester
          );
          if (filteredLocal.length > 0) {
            setCourses(filteredLocal);
            setLoading(false);
          }
        }

        if (isOffline) {
          setIsOfflineMode(true);
          setLoading(false);
          return;
        }

        // Attempt firebase stream if online
        if (db) {
          const qCourses = query(collection(db, 'courses'), where('semester', '==', activeSemester));
          const snap = await getDocs(qCourses);
          let fbCourses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
          
          // Enrich with local downloaded status
          const downloadedIds = new Set(localCourses.map(c => c.id));
          
          // Double safeguard: append any local downloaded courses that are not returned online
          localCourses.forEach(lc => {
            if (!fbCourses.some(fc => fc.id === lc.id)) {
              fbCourses.push({
                id: lc.id,
                code: lc.code || '',
                title: lc.title || '',
                semester: lc.semester || 'first',
                level: lc.level || '100',
                department: lc.department || ''
              });
            }
          });

          // Extra safety local filter
          fbCourses = fbCourses.filter(fc => isSameSemester(fc.semester || '', activeSemester));

          fbCourses = await getFilteredCoursesForStudent(fbCourses, profile, true, activeSemester);

          const enriched = fbCourses.map(c => ({
            ...c,
            isDownloaded: downloadedIds.has(c.id)
          })).sort((a, b) => a.code.localeCompare(b.code));
          
          setCourses(enriched);
          setIsOfflineMode(false);
        } else {
          throw new Error('Firebase disabled or unreachable');
        }
      } catch (err) {
        console.log('PastQuestions screen: Loading offline course data', err);
        setIsOfflineMode(true);
        const activeSemester = (!systemConfig?.currentSemester || systemConfig.currentSemester === 'none') ? '1st' : systemConfig.currentSemester;
        const isSameSemester = (courseSem: string, activeSem: string) => {
          const normCourse = (courseSem || '').toLowerCase().trim();
          const normActive = (activeSem || '1st').toLowerCase().trim();
          
          if (normCourse === normActive) return true;
          if (normActive === '1st' && (normCourse === 'first' || normCourse === '1st')) return true;
          if (normActive === '2nd' && (normCourse === 'second' || normCourse === '2nd')) return true;
          return false;
        };
        // Fallback to SQLite cached downloaded courses
        const localCourses = getDownloadedCoursesLocal()
          .filter(lc => isSameSemester(lc.semester || '', activeSemester))
          .map(c => ({
            ...c,
            isDownloaded: true
          }) as Course).sort((a, b) => a.code.localeCompare(b.code));
        setCourses(localCourses);
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, [profile, systemConfig]);

  // 2. Load Sheets whenever a course is selected
  useEffect(() => {
    if (!selectedCourseId) {
      setSheets([]);
      return;
    }
    
    async function loadSheets() {
      setLoading(true);
      try {
        // SQLite first
        const offlineSheets = getLocalQuestionSheets(selectedCourseId);
        if (offlineSheets.length > 0) {
          offlineSheets.sort((a, b) => b.year.localeCompare(a.year));
          setSheets(offlineSheets);
          setLoading(false);
          if (isOfflineMode) return;
        }

        if (!isOfflineMode && db) {
          // Fetch from Firestore if local SQLite had no sheets or to check updates
          const qSheets = query(
            collection(db, 'questionSheets'), 
            where('courseId', '==', selectedCourseId),
            where('isAvailable', '==', true)
          );
          const snap = await getDocs(qSheets);
          let fbSheets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet));
          
          if (fbSheets.length > 0) {
            fbSheets.sort((a, b) => b.year.localeCompare(a.year));
            setSheets(fbSheets);
          }
        }
      } catch (err) {
        console.log('Offline question sheets loading fallback', err);
        const offlineSheets = getLocalQuestionSheets(selectedCourseId);
        offlineSheets.sort((a, b) => b.year.localeCompare(a.year));
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
      // 1. Try SQLite questions first
      const offlineQs = getLocalQuestions(sheet.courseId).filter(q => q.sheetId === sheet.id);
      const finalLocalQs = offlineQs.length > 0 ? offlineQs : getLocalQuestions(sheet.courseId);

      if (finalLocalQs.length > 0) {
        setQuestions(finalLocalQs);
        setSelectedSheet(sheet);
        setExamStarted(true);
        setCurrentIndex(0);
        setUserAnswers({});
        setShowFeedback({});
        setLoading(false);
        console.log('PastQuestions screen: Loaded questions directly from local SQLite.');
        return;
      }

      if (!isOfflineMode && db) {
        // Fetch from Firestore if no local questions
        const qQuestions = query(collection(db, 'questions'), where('sheetId', '==', sheet.id));
        const snap = await getDocs(qQuestions);
        const fbQuestions = snap.docs.map(doc => {
          const data = doc.data();
          
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
            id: doc.id,
            courseId: data.courseId,
            q: data.q || data.text || '',
            opts: optsArray,
            answer: correctIdx,
            sheetId: data.sheetId,
            explanation: data.explanation || ''
          } as Question;
        });

        if (fbQuestions.length === 0) {
          Alert.alert('Empty', 'No questions uploaded for this exam year yet.');
          setLoading(false);
          return;
        }

        setQuestions(fbQuestions);
        setSelectedSheet(sheet);
        setExamStarted(true);
        setCurrentIndex(0);
        setUserAnswers({});
        setShowFeedback({});
      } else {
        Alert.alert('Offline', 'No offline questions found for this exam year.');
      }
    } catch (err: any) {
      console.log('Error launching past question cbt exam engine:', err);
      Alert.alert('Load Failure', err.message || 'Could not load questions. Try syncing course offline first.');
    } finally {
      setLoading(false);
    }
  };

  // Answer handler
  const handleAnswerSelect = (optionIndex: number) => {
    if (showFeedback[currentIndex]) return; // No overriding once answered
    setUserAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
  };

  // Slide animation trigger
  useEffect(() => {
    if (examStarted) {
      questionAnim.setValue(0);
      Animated.timing(questionAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [currentIndex, examStarted]);

  // Back button behaviour
  const handleExitExam = () => {
    Alert.alert('Exit Practice', 'Are you sure you want to stop this past questions review?', [
      { text: 'Keep Studying', style: 'cancel' },
      { text: 'Exit Review', onPress: () => setExamStarted(false) }
    ]);
  };

  // Selected Course details
  const currentCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  // Current Question
  const currentQ = questions[currentIndex];

  // RENDER FLOWS ───────────────────────────────────────────

  // Rendering A: Loading Spinner
  if (loading && !examStarted && !selectedCourseId) {
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

  // Rendering B: Practice CBT Exam Sheet Mode
  if (examStarted && currentQ) {
    const isAnswered = showFeedback[currentIndex];
    const selectedAnswerIndex = userAnswers[currentIndex];
    const correctAnswerIndex = currentQ.answer;
    const isAnswerCorrect = selectedAnswerIndex === correctAnswerIndex;

    return (
      <SafeAreaView style={s.root} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleExitExam} activeOpacity={0.7} style={s.backBtn}>
            <Text style={[s.backBtnText, { color: C.ink }]}>✕ Exit</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.examHeaderTitle}>{currentCourse?.code} ({selectedSheet?.year})</Text>
            <Text style={s.examProgressIndicator}>Question {currentIndex + 1} of {questions.length}</Text>
          </View>
          <View style={{ width: 50 }} />
        </View>

        {/* Progress Bar */}
        <View style={s.progressWrapper}>
          <View style={[s.progressTrack, { backgroundColor: C.tabBg }]}>
            <View 
              style={[
                s.progressFill, 
                { 
                  backgroundColor: C.activeText,
                  width: `${((currentIndex + 1) / questions.length) * 100}%` 
                }
              ]} 
            />
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContentExam} showsVerticalScrollIndicator={false}>
          {/* Question Slide Card */}
          <Animated.View style={[s.examCard, { opacity: questionAnim }]}>
            
            {/* Tag Badge */}
            <View style={s.questionInfoBadgeRow}>
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

            <QuestionRenderer
              question={currentQ.q}
              options={currentQ.opts}
              selectedOptionIndex={selectedAnswerIndex}
              correctOptionIndex={correctAnswerIndex}
              isAnswered={isAnswered}
              explanation={currentQ.explanation}
              onSelectOption={(i) => handleAnswerSelect(i)}
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
              <Text style={[s.navPageBtnText, { color: C.ink }, currentIndex === 0 && { color: C.navInactive }]}>
                ◀ Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.navPageBtn, currentIndex === questions.length - 1 && s.navPageBtnDisabled, { borderColor: C.border }]}
              onPress={() => {
                if (currentIndex === questions.length - 1) {
                  setExamStarted(false);
                } else {
                  setCurrentIndex(prev => prev + 1);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.navPageBtnText, { color: C.ink }]}>
                {currentIndex === questions.length - 1 ? 'Finish review' : 'Next Question ▶'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
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
          // View 1: List all course cards available
          <View>
            <Text style={[s.subtitle, { color: C.inkMid }]}>
              Select a course to view official FUTO study past examination papers.
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
                {courses.map((course) => (
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
                        {course.semester.toUpperCase()} SEMESTER • {course.level} LEVEL
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          // View 2: List Sheets available for selected course
          <View>
            <View style={s.courseHeaderMetaCard}>
              <Text style={[s.metaCourseTitle, { color: C.ink }]}>{currentCourse?.title}</Text>
              <Text style={[s.metaCourseDetails, { color: C.inkMid }]}>
                {currentCourse?.code} — {currentCourse?.semester.toUpperCase()} SEMESTER
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
                {sheets.map((sheet) => (
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

      {/* Main navigation footer */}
      <BottomNav />
    </SafeAreaView>
  );
}

// ── StyleSheet Generation Logic ─────────────────────────────
const createStyles = (C: typeof THEMES.light) => StyleSheet.create({
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

  // Interactive CBT layout
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
  questionTextContainer: {
    marginBottom: 16,
  },
  optionsSpacing: {
    gap: 10,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  optLetterCirc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optLetterText: {
    fontFamily: F.bold,
    fontSize: 13,
  },
  optText: {
    flex: 1,
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 20,
  },
  correctIndicatorText: {
    fontFamily: F.bold,
    fontSize: 11,
    color: '#2E7D32',
    marginLeft: 8,
  },
  wrongIndicatorText: {
    fontFamily: F.bold,
    fontSize: 11,
    color: '#C62828',
    marginLeft: 8,
  },
  explanationCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  explanationTitle: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
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
});
