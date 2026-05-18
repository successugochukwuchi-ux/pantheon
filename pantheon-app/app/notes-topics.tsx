import React, { useEffect, useRef, useState } from 'react';
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
import { C, F } from '../components/Theme';

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

function ProgressBarDark({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
  }, []);
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
        // Fetch Course
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        let courseData: Course | null = null;
        if (courseDoc.exists()) {
          courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
          setCourse(courseData);
          console.log("[NotesTopics] Course loaded:", courseData.code);
        } else {
          console.warn("[NotesTopics] Course document not found for ID:", courseId);
        }

        // Fetch Notes
        const q = query(
          collection(db, 'notes'),
          where('courseId', '==', courseId)
        );
        const snapshot = await getDocs(q);
        const fetchedNotes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          completed: false // Default, will update below
        })) as Note[];
        
        console.log("[NotesTopics] Fetched notes count:", fetchedNotes.length);

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
        <ActivityIndicator size="large" color={C.ink} />
        <Text style={{ marginTop: 12, fontFamily: F.medium, color: C.inkMid }}>Loading topics...</Text>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: F.medium, color: C.inkMid }}>Course not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.gold, fontFamily: F.bold }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/notes')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.dot, { marginBottom: 4 }]} />
          <View style={[s.dot, { marginBottom: 4 }]} />
          <View style={s.dot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark hero card */}
        <Animated.View
          style={[s.heroCard, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
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
          <ProgressBarDark value={course.progress || 0} />

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
              style={[s.filterTab, filter === f && s.filterTabActive]}
              activeOpacity={0.8}
            >
              <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionLabel}>SELECT A TOPIC</Text>

        {/* Topic rows */}
        {filtered.length > 0 ? (
          filtered.map((topic, i) => {
            return (
              <Animated.View
                key={topic.id}
                style={{ opacity: 1, transform: [{ translateY: 0 }] }}
              >
                <TouchableOpacity
                  style={s.topicCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (course?.id && topic?.id) {
                      router.push(`/note-viewer?courseId=${course.id}&noteId=${topic.id}`);
                    }
                  }}
                >
                  <View style={[s.topicCheck, topic.completed && s.topicCheckDone]}>
                    {topic.completed ? (
                      <Text style={s.checkmark}>✓</Text>
                    ) : (
                      <Text style={s.topicNum}>{String(i + 1).padStart(2, '0')}</Text>
                    )}
                  </View>
                  <View style={s.topicMeta}>
                    <Text style={s.topicTitle}>{topic.title}</Text>
                    <View style={s.topicSubRow}>
                      <Text style={s.topicDuration}>{topic.duration || '5 min read'}</Text>
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
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.medium, color: C.inkMid }}>No topics found for this course.</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 16, color: C.ink, letterSpacing: 2 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  backArrowHead: {
    position: 'absolute', left: 0, width: 9, height: 9,
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink,
    transform: [{ rotate: '45deg' }],
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.ink },

  // Hero
  heroCard: {
    backgroundColor: C.surfaceDark,
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
  progressFill: { height: '100%', backgroundColor: C.gold, borderRadius: 99 },
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
    borderWidth: 1.5, borderColor: C.border,
  },
  filterTabActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterTabText: { fontFamily: F.bold, fontSize: 11, color: C.inkLight, letterSpacing: 1.2 },
  filterTabTextActive: { color: '#fff' },

  sectionLabel: {
    fontFamily: F.medium, fontSize: 11, color: C.inkLight,
    letterSpacing: 2, marginBottom: 12,
  },

  // Topic cards
  topicCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topicCheck: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  topicCheckDone: { backgroundColor: C.ink, borderColor: C.ink },
  checkmark: { fontFamily: F.bold, fontSize: 14, color: '#fff' },
  topicNum: { fontFamily: F.bold, fontSize: 13, color: C.inkLight },
  topicMeta: { flex: 1 },
  topicTitle: { fontFamily: F.medium, fontSize: 15, color: C.ink, marginBottom: 5, lineHeight: 20 },
  topicSubRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicDuration: { fontFamily: F.body, fontSize: 12, color: C.inkLight },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1 },
  chevron: { fontSize: 22, color: C.border, fontWeight: '300' },
});
