import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
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
  content?: string;
  duration?: string;
  completed?: boolean;
  tag?: 'CORE' | 'ADVANCED';
  order?: number;
  createdAt?: any;
}

function extractNotePlainText(content: string | undefined | null): string {
  if (!content) return '';
  try {
    const blocks = JSON.parse(content);
    if (Array.isArray(blocks)) {
      return blocks
        .map((b: any) => {
          if (!b) return '';
          if (typeof b.content === 'string') return b.content;
          if (b.type === 'quiz' && b.question) return `${b.question} ${Array.isArray(b.options) ? b.options.join(' ') : ''}`;
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
  } catch {}
  return content;
}

function searchCourseNote(topic: Note, queryStr: string): { matches: boolean; snippet: string } {
  const q = (queryStr || '').trim().toLowerCase();
  if (!q) return { matches: true, snippet: '' };

  const titleLower = (topic.title || '').toLowerCase();
  const titleMatches = titleLower.includes(q);

  const plainText = extractNotePlainText(topic.content);
  const plainTextLower = plainText.toLowerCase();
  const matchIndex = plainTextLower.indexOf(q);

  if (titleMatches || matchIndex !== -1) {
    let snippet = '';
    if (matchIndex !== -1) {
      const start = Math.max(0, matchIndex - 35);
      const end = Math.min(plainText.length, matchIndex + q.length + 55);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < plainText.length ? '...' : '';
      snippet = prefix + plainText.substring(start, end).replace(/\s+/g, ' ').trim() + suffix;
    } else {
      snippet = `Matched in title: "${topic.title}"`;
    }
    return { matches: true, snippet };
  }

  return { matches: false, snippet: '' };
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
  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [filter, setFilter] = useState<'ALL' | 'CORE' | 'ADVANCED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
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
            content: (n as any).content || '',
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

        // Arranged in alphabetical order
        const notesWithProgress = fetchedNotes.map(n => ({
          ...n,
          completed: completedIds.includes(n.id)
        })).sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

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
  
  const searchFilteredTopics = useMemo(() => {
    return topics
      .filter((t) => filter === 'ALL' || t.tag === filter)
      .map((t) => ({ topic: t, searchResult: searchCourseNote(t, searchQuery) }))
      .filter((item) => item.searchResult.matches);
  }, [topics, filter, searchQuery]);

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

        {/* Search within this course */}
        <View style={[s.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.searchIcon, { color: C.inkLight }]}>🔍</Text>
          <TextInput
            placeholder={`Search topics in ${course.code}...`}
            placeholderTextColor={C.inkLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[s.searchInput, { color: C.ink }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.searchClear, { color: C.inkLight }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={[s.searchSummary, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.searchSummaryText, { color: C.inkLight }]}>
              Found <Text style={{ fontFamily: F.bold, color: C.ink }}>{searchFilteredTopics.length}</Text> of {topics.length} topic{topics.length === 1 ? '' : 's'} in {course.code} mentioning "{searchQuery}"
            </Text>
          </View>
        )}

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

        <Text style={[s.sectionLabel, { color: C.inkLight }]}>TOPICS (ALPHABETICAL)</Text>

        {/* Topic rows */}
        {searchFilteredTopics.length > 0 ? (
          searchFilteredTopics.map(({ topic, searchResult }, i) => {
            const originalIndex = topics.findIndex(t => t.id === topic.id);
            const isTopicLocked = isUnactivatedStudent && originalIndex > 0;
            return (
              <Animated.View
                key={topic.id}
                style={{ opacity: 1, transform: [{ translateY: 0 }] }}
              >
                <TouchableOpacity
                  style={[s.topicCard, { backgroundColor: C.surface, borderColor: C.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (isTopicLocked) {
                      Alert.alert(
                        'Academic Trial Limit',
                        'Standard accounts only have access to the oldest study guide/lecture note of each course. Activate your account using an activation pin to unlock all notes, past questions, and full study materials.',
                        [
                          { text: 'Activate Account', onPress: () => router.push('/dashboard') },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                      return;
                    }
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
                    {searchQuery.trim().length > 0 && searchResult.snippet ? (
                      <View style={[s.snippetBox, { backgroundColor: C.bg, borderColor: C.border }]}>
                        <Text style={[s.snippetText, { color: C.inkLight }]} numberOfLines={2}>
                          {searchResult.snippet}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {isTopicLocked ? (
                    <Text style={{ fontSize: 16, color: C.inkLight, marginRight: 4 }}>🔒</Text>
                  ) : (
                    <Text style={[s.chevron, { color: C.border }]}>›</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })
        ) : topics.length > 0 && searchQuery ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
            <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 15, textAlign: 'center' }}>
              No matching notes in {course.code}
            </Text>
            <Text style={{ fontFamily: F.body, color: C.inkLight, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              No note mentions "{searchQuery}".
            </Text>
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={{ marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border }}
            >
              <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 12 }}>Clear Search</Text>
            </TouchableOpacity>
          </View>
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

  // Search box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 13, padding: 0 },
  searchClear: { fontSize: 14, paddingLeft: 8, fontWeight: 'bold' },
  searchSummary: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  searchSummaryText: { fontFamily: F.body, fontSize: 11 },
  snippetBox: {
    marginTop: 6,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  snippetText: {
    fontFamily: F.body,
    fontSize: 10.5,
    lineHeight: 14,
  },

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
