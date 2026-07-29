import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDownloadedCoursesLocal } from '../lib/db';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';

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
  isRecommended?: boolean;
}

function ProgressBar({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 800, useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={s.progressTrack}>
      <Animated.View
        style={[
          s.progressFill,
          {
            backgroundColor: C.activeText,
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

function CourseCard({
  course,
  index,
  onPress,
}: {
  course: Course;
  index: number;
  onPress: () => void;
}) {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const fadeY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeY, {
        toValue: 0,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.card, { opacity, transform: [{ translateY: fadeY }] }]}>
      {course.isRecommended && (
        <View style={s.recommendedBadge}>
          <Text style={s.recommendedText}>FOR YOU</Text>
        </View>
      )}
      <View style={s.cardTop}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={s.subject} numberOfLines={1}>{course.level} Level • {course.semester} Semester</Text>
          <Text style={s.code} numberOfLines={1}>{course.code}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.inkMid, marginTop: 4 }} numberOfLines={1}>
            {course.title}
          </Text>
        </View>
        <View style={s.iconBox}>
          <Text style={s.iconText}>{course.code ? course.code.charAt(0) : 'C'}</Text>
        </View>
      </View>
      <View style={s.progressRow}>
        <Text style={s.progressLabel}>Completion</Text>
        <Text style={s.progressPct}>{course.progress || 0}%</Text>
      </View>
      <ProgressBar value={course.progress || 0} />
      <View style={s.actions}>
        <TouchableOpacity 
          style={s.viewBtn} 
          activeOpacity={0.85} 
          onPress={() => router.push(`/notes-topics?courseId=${course.id}`)}
        >
          <Text style={s.viewBtnText}>VIEW NOTES</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={s.discussBtn} 
          activeOpacity={0.8}
          onPress={() => router.push(`/course-discussion?courseId=${course.id}`)}
        >
          <Text style={s.discussIcon}>💬</Text>
          <Text style={s.discussBtnText}>CHAT</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NotesScreen() {
  const router = useRouter();
  const { profile, systemConfig, isOffline } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !systemConfig) return;
    
    setLoading(true);
    const semester = (!systemConfig.currentSemester || systemConfig.currentSemester === 'none') ? '1st' : systemConfig.currentSemester;

    const loadAndFilter = async (list: any[], callback: (res: any[]) => void) => {
      const filtered = await getFilteredCoursesForStudent(list, profile, true);
      const mapped = filtered.map(c => ({
        id: c.id,
        code: c.code || '',
        title: c.title || '',
        semester: c.semester || semester,
        level: c.level || '',
        department: c.department || '',
        progress: c.progress || 0
      }));
      callback(mapped);
    };

    if (isOffline) {
      try {
        const localCourses = getDownloadedCoursesLocal();
        loadAndFilter(localCourses, (filteredLocal) => {
          setCourses(filteredLocal);
        }).finally(() => setLoading(false));
      } catch (err) {
        console.log('Error loading offline courses:', err);
        setLoading(false);
      }
      return;
    }

    // Immediate offline/local sync fallback
    try {
      const localCourses = getDownloadedCoursesLocal();
      if (localCourses && localCourses.length > 0) {
        loadAndFilter(localCourses, (filteredLocal) => {
          setCourses(filteredLocal);
          setLoading(false);
        });
      }
    } catch (err) {
      console.log('Offline/SQLite courses loading skipped:', err);
    }

    // 1. Fetch all courses for the semester (Match Web Dashboard/Notes logic)
    const q = query(
      collection(db, 'courses'),
      where('semester', '==', semester)
    );

    const fetchCoursesAndProgress = async () => {
      try {
        const snapshot = await getDocs(q);
        const allFetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];

        // 2. Fetch or Listen to Progress (Match Web Dashboard logic)
        const progQ = query(
          collection(db, 'progress'),
          where('uid', '==', profile.uid),
          where('type', '==', 'course')
        );

        const pSnap = await getDocs(progQ);
        const progMap: Record<string, number> = {};
        pSnap.docs.forEach(d => {
          const data = d.data();
          if (data.targetId) progMap[data.targetId] = data.percentage || 0;
        });

        // 3. Filter and merge progress
        loadAndFilter(allFetched, (filtered) => {
          const withProgress = filtered.map(c => ({
            ...c,
            progress: progMap[c.id] || 0
          }));

          // Sort by code
          const sorted = withProgress.sort((a, b) => a.code.localeCompare(b.code));

          setCourses(sorted);
          setLoading(false);
        });
      } catch (e) {
        console.error("Courses/Progress fetch error (using cache fallback if offline):", e);
        setLoading(false);
      }
    };

    fetchCoursesAndProgress();
  }, [profile, systemConfig]);

  const filteredCourses = useMemo(() => {
    return courses.filter(c => 
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [courses, searchQuery]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.backBtn}>
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lecture Notes</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.bellBtn} onPress={() => router.push('/notifications')}>
          <View style={s.bellBody} />
          <View style={s.bellBase} />
          <View style={s.bellClapper} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Semester label */}
        <View style={s.semesterWrap}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <View style={s.semesterPill}>
              <Text style={s.semesterPillText}>ACADEMIC SESSION</Text>
            </View>
            {isOffline && (
              <View style={[s.semesterPill, { backgroundColor: '#FADBD8' }]}>
                <Text style={[s.semesterPillText, { color: '#C0392B' }]}>OFFLINE MODE</Text>
              </View>
            )}
          </View>
          <Text style={s.semesterTitle}>{systemConfig?.currentSemester === '2nd' ? '2nd' : '1st'} Semester</Text>
        </View>

        {/* Search Bar */}
        <View style={s.searchWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="Search courses by code or title..."
            placeholderTextColor={C.inkLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View style={{ paddingVertical: 100, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.ink} />
            <Text style={{ marginTop: 12, fontFamily: F.medium, color: C.inkMid }}>Loading courses...</Text>
          </View>
        ) : filteredCourses.length > 0 ? (
          filteredCourses.map((course, i) => (
            <CourseCard
              key={course.id}
              course={course}
              index={i}
              onPress={() => {}}
            />
          ))
        ) : (
          <View style={{ paddingVertical: 100, alignItems: 'center', paddingHorizontal: 40 }}>
            <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, textAlign: 'center', marginBottom: 8 }}>
              No courses found
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 14, color: C.inkMid, textAlign: 'center' }}>
              We couldn't find any courses matching your search. Try searching for a course code like "PHY101".
            </Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav active="notes" />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (C: any) => {
  const getContrastColor = (hexColor: string) => {
    if (!hexColor) return '#FFFFFF';
    const hex = hexColor.replace('#', '');
    if (hex.length < 6) return '#FFFFFF';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#0A0A0A' : '#FFFFFF';
  };

  const textContrast = getContrastColor(C.ink);

  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  // Header
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
  headerTitle: {
    fontFamily: F.bold,
    fontSize: 17,
    color: C.ink,
    letterSpacing: 0.3,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: C.ink,
    borderRadius: 1,
  },
  backArrowHead: {
    position: 'absolute',
    left: 0,
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: C.ink,
    transform: [{ rotate: '45deg' }],
  },
  bellBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBody: {
    width: 14,
    height: 13,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 2,
    borderColor: C.ink,
    borderBottomWidth: 0,
    marginTop: 2,
  },
  bellBase: { width: 20, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  bellClapper: {
    width: 6,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 2,
    borderColor: C.ink,
    borderTopWidth: 0,
    marginTop: -1,
  },

  // Semester
  semesterWrap: { paddingTop: 28, paddingBottom: 12, paddingHorizontal: 4 },
  semesterPill: {
    alignSelf: 'flex-start',
    backgroundColor: C.pill,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 8,
  },
  semesterPillText: {
    fontFamily: F.medium,
    fontSize: 11,
    color: C.pillText,
    letterSpacing: 1.5,
  },
  semesterTitle: {
    fontFamily: F.display,
    fontSize: 38,
    color: C.ink,
    lineHeight: 42,
  },

  // Search
  searchWrap: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  searchInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },

  // Cards
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: C.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  recommendedText: {
    color: C.bg,
    fontFamily: F.bold,
    fontSize: 8,
    letterSpacing: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subject: {
    fontFamily: F.medium,
    fontSize: 11,
    color: C.inkLight,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  code: { fontFamily: F.display, fontSize: 28, color: C.ink, lineHeight: 30 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontFamily: F.display, fontSize: 20, color: C.ink },

  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: { fontFamily: F.medium, fontSize: 13, color: C.inkMid },
  progressPct: { fontFamily: F.bold, fontSize: 13, color: C.ink },
  progressTrack: {
    height: 5,
    backgroundColor: C.border,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.ink,
    borderRadius: 99,
  },

  // Actions
  actions: { flexDirection: 'row', gap: 10 },
  viewBtn: {
    flex: 1,
    backgroundColor: C.ink,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  viewBtnText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: textContrast,
    letterSpacing: 1.2,
  },
  discussBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 13,
  },
  discussIcon: { fontSize: 13 },
  discussBtnText: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.ink,
    letterSpacing: 0.5,
  },
  });
};

