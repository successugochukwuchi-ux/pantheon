import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { isCourseDownloadedLocal, getLocalNotes, getDatabase } from '../lib/db';

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

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
  department?: string;
  icon?: string;
  subject?: string;
  progress?: number;
}

interface Note {
  id: string;
  title: string;
  duration?: string;
  completed?: boolean;
  tag?: 'CORE' | 'ADVANCED';
  order?: number;
}

function ProgressBarDark({ value, s }: { value: number; s: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={s.progressTrack}>
      <Animated.View
        style={[
          s.progressFill,
          {
            width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

export default function NotesTopicsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [filter, setFilter] = useState<'ALL' | 'CORE' | 'ADVANCED'>('ALL');
  
  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    async function fetchData() {
      if (!courseId || !profile) {
        console.warn("[NotesTopics] Missing courseId or profile");
        return;
      }
      
      console.log("[NotesTopics] Fetching data for courseId:", courseId);
      setLoading(true);
      
      try {
        // Fetch Course and Notes either from local SQLite or Firestore
        let courseData: Course | null = null;
        let fetchedNotes: Note[] = [];

        if (isCourseDownloadedLocal(courseId)) {
          const localNotesData = getLocalNotes(courseId);
          fetchedNotes = localNotesData.map(n => ({
            id: n.id,
            title: n.title,
            duration: n.duration || '10 mins',
            tag: n.tag || 'CORE',
            order: n.order || 0,
            completed: false
          }));

          const ldb = getDatabase();
          if (ldb && ldb.getFirstSync) {
            const cRes = ldb.getFirstSync('SELECT * FROM courses WHERE id = ?', [courseId]) as any;
            if (cRes) {
              courseData = {
                id: cRes.id,
                code: cRes.code,
                title: cRes.title,
                semester: cRes.semester,
                level: cRes.level,
              } as Course;
            }
          }
          if (courseData) {
            setCourse(courseData);
          }
          console.log("[NotesTopics] Loaded from local SQLite database. Notes count:", fetchedNotes.length);
        } else {
          // Fetch Course from Firestore
          const courseDoc = await getDoc(doc(db, 'courses', courseId));
          if (courseDoc.exists()) {
            courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
            setCourse(courseData);
            console.log("[NotesTopics] Course loaded from Firestore:", courseData.code);
          } else {
            console.warn("[NotesTopics] Course document not found on Firestore for ID:", courseId);
          }

          // Fetch Notes from Firestore
          const q = query(
            collection(db, 'notes'),
            where('courseId', '==', courseId)
          );
          const snapshot = await getDocs(q);
          fetchedNotes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            completed: false
          })) as Note[];
          console.log("[NotesTopics] Fetched notes from Firestore count:", fetchedNotes.length);
        }

        // Fetch User Topic Progress
        const progQ = query(
          collection(db, 'progress'),
          where('uid', '==', profile.uid),
          where('type', '==', 'note')
        );
        const progSnap = await getDocs(progQ);
        const completedIds = progSnap.docs
          .filter(d => d.data().completed === true)
          .map(d => d.data().targetId);

        const notesWithProgress = fetchedNotes.map(n => ({
          ...n,
          completed: completedIds.includes(n.id)
        })).sort((a, b) => (a.order || 0) - (b.order || 0));

        setTopics(notesWithProgress);

        // Update overall course progress
        if (courseData) {
          const pct = notesWithProgress.length > 0 
            ? Math.round((notesWithProgress.filter(n => n.completed).length / notesWithProgress.length) * 100) 
            : 0;
          setCourse(prev => prev ? { ...prev, progress: pct } : null);
        }
      } catch (e) {
        console.error("NotesTopics: Error fetching data:", e);
        handleFirestoreError(e, OperationType.GET, 'courses/notes');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [courseId, profile]);

  useEffect(() => {
    if (!loading && course) {
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(heroY, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, course]);

  const completed = topics.filter((t) => t.completed).length;
  const filtered = filter === 'ALL' ? topics : topics.filter((t) => t.tag === filter);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.activeText} />
        <Text style={{ marginTop: 12, fontFamily: F.medium, color: C.inkLight }}>Loading topics...</Text>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: F.medium, color: C.ink }}>Course not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.activeText, fontFamily: F.bold }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.push('/notes')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.dot, { backgroundColor: C.ink, marginBottom: 4 }]} />
          <View style={[s.dot, { backgroundColor: C.ink }]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark hero card */}
        <Animated.View
          style={[s.heroCard, { backgroundColor: C.surfaceDark, opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
        >
          <View style={s.subjectPill}>
            <Text style={s.subjectPillText}>{course.subject || 'COURSE'}</Text>
          </View>
          <View style={s.heroTop}>
            <View style={{ flex: 1, marginRight: 15 }}>
              <Text style={s.heroCode}>{course.code}</Text>
              <Text style={s.heroTitle} numberOfLines={2}>{course.title}</Text>
            </View>
            <View style={s.heroIconBox}>
              <Text style={s.heroIcon}>{course.icon || course.code?.charAt(0)}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={s.progressLabelRow}>
            <Text style={s.progressLabel}>OVERALL PROGRESS</Text>
            <Text style={s.progressPct}>{course.progress || 0}%</Text>
          </View>
          <ProgressBarDark value={course.progress || 0} s={s} />

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{completed}</Text>
              <Text style={s.statLabel}>COMPLETED</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statNum}>{topics.length - completed}</Text>
              <Text style={s.statLabel}>REMAINING</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statNum}>{topics.length}</Text>
              <Text style={s.statLabel}>TOPICS</Text>
            </View>
          </View>
        </Animated.View>

        {/* Filter tabs */}
        <View style={s.filterRow}>
          {(['ALL', 'CORE', 'ADVANCED'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[s.filterTab, { borderColor: C.border }, filter === f && [s.filterTabActive, { backgroundColor: C.ink, borderColor: C.ink }]]}
              activeOpacity={0.8}
            >
              <Text style={[s.filterTabText, { color: C.inkLight }, filter === f && s.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.sectionLabel, { color: C.inkLight }]}>SELECT A TOPIC</Text>

        {/* Topic rows */}
        {filtered.length > 0 ? (
          filtered.map((topic, i) => {
            return (
              <Animated.View
                key={topic.id}
                style={{ opacity: 1, transform: [{ translateY: 0 }] }}
              >
                <TouchableOpacity
                  style={[s.topicCard, { backgroundColor: C.surface, borderColor: C.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (course?.id && topic?.id) {
                      router.push(`/note-viewer?courseId=${course.id}&noteId=${topic.id}`);
                    }
                  }}
                >
                  <View style={[s.topicCheck, { backgroundColor: C.bg, borderColor: C.border }, topic.completed && [s.topicCheckDone, { backgroundColor: C.ink, borderColor: C.ink }]]}>
                    {topic.completed ? (
                      <Text style={s.checkmark}>✓</Text>
                    ) : (
                      <Text style={[s.topicNum, { color: C.inkLight }]}>{String(i + 1).padStart(2, '0')}</Text>
                    )}
                  </View>
                  <View style={s.topicMeta}>
                    <Text style={[s.topicTitle, { color: C.ink }]}>{topic.title}</Text>
                    <View style={s.topicSubRow}>
                      <Text style={[s.topicDuration, { color: C.inkLight }]}>{topic.duration || '5 min read'}</Text>
                      <View
                        style={[
                          s.tagPill,
                          { backgroundColor: topic.tag === 'ADVANCED' ? C.academicBg : C.newBg },
                        ]}
                      >
                        <Text
                          style={[
                            s.tagText,
                            { color: topic.tag === 'ADVANCED' ? C.academicText : C.newText },
                          ]}
                        >
                          {topic.tag || 'CORE'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[s.chevron, { color: C.border }]}>›</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.medium, color: C.inkLight }}>No topics found for this course.</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
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

  // Hero
  heroCard: {
    borderRadius: 20,
    padding: 22,
    marginTop: 16,
    marginBottom: 4,
  },
  subjectPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  subjectPillText: { fontFamily: F.medium, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  heroCode: { fontFamily: F.display, fontSize: 36, color: '#fff', lineHeight: 38 },
  heroTitle: { fontFamily: F.body, fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  heroIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroIcon: { fontFamily: F.display, fontSize: 22, color: '#fff' },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontFamily: F.medium, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2 },
  progressPct: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  progressTrack: {
    height: 5, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 99, overflow: 'hidden', marginBottom: 18,
  },
  progressFill: { height: '100%', backgroundColor: C.activeText, borderRadius: 99 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, padding: 12,
  },
  statNum: { fontFamily: F.display, fontSize: 24, color: '#fff', marginBottom: 4 },
  statLabel: { fontFamily: F.medium, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 18 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5,
  },
  filterTabActive: { },
  filterTabText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2 },
  filterTabTextActive: { color: '#fff' },

  sectionLabel: {
    fontFamily: F.medium, fontSize: 11,
    letterSpacing: 2, marginBottom: 12,
  },

  // Topic cards
  topicCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topicCheck: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  topicCheckDone: { },
  checkmark: { fontFamily: F.bold, fontSize: 14, color: '#fff' },
  topicNum: { fontFamily: F.bold, fontSize: 13 },
  topicMeta: { flex: 1 },
  topicTitle: { fontFamily: F.medium, fontSize: 15, marginBottom: 5, lineHeight: 20 },
  topicSubRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicDuration: { fontFamily: F.body, fontSize: 12 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1 },
  chevron: { fontSize: 22, fontWeight: '300' },
});
