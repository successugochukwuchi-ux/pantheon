import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Modal,
  FlatList,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getDownloadedCoursesLocal } from '../lib/db';

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
  department?: string;
  label: string;
}

const DURATIONS = [30, 60, 90];

// ── Dropdown Modal ─────────────────────────────────────────────────────────────
function CourseDropdown({
  courses,
  selected,
  onSelect,
}: {
  courses: Course[];
  selected: string | null;
  onSelect: (id: string, label: string) => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const [open, setOpen] = useState(false);
  const label = courses.find(c => c.id === selected)?.label ?? 'Choose a course...';

  return (
    <>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1 }]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.dropdownText, { color: C.ink }, !selected && [s.dropdownPlaceholder, { color: C.inkLight }]]}>{label}</Text>
        <Text style={[s.dropdownChevron, { color: C.inkMid }]}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[s.modalSheet, { backgroundColor: C.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: C.border }]} />
          <Text style={[s.modalTitle, { color: C.ink }]}>Select Course</Text>
          <FlatList
            data={courses}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.modalItem, selected === item.id && [s.modalItemActive, { backgroundColor: C.ink }]]}
                onPress={() => { onSelect(item.id, item.label); setOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={[s.modalItemText, { color: C.ink }, selected === item.id && [s.modalItemTextActive, { color: C.bg }]]}>
                  {item.label}
                </Text>
                {selected === item.id && <Text style={{ color: C.bg, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CbtSetupScreen() {
  const router = useRouter();
  const { profile, systemConfig, isOffline } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [duration, setDuration] = useState(30);
  const [numQuestions, setNumQuestions] = useState('');

  const fadeY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeY, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      if (!profile || !systemConfig) return;
      setLoading(true);
      const semester = systemConfig.currentSemester || '1st';

      // Load local downloaded courses immediately for instant offline support
      let localPopulated = false;
      try {
        const localCourses = getDownloadedCoursesLocal();
        if (localCourses && localCourses.length > 0) {
          const mappedLocal = localCourses.map(c => ({
            id: c.id,
            code: c.code || '',
            title: c.title || '',
            semester: c.semester || semester,
            level: c.level || '',
            department: c.department || '',
            label: `⭐ ${c.code} — ${c.title}`
          }));
          setCourses(mappedLocal);
          setSelectedCourse(mappedLocal[0].id);
          localPopulated = true;
          setLoading(false);
        }
      } catch (err) {
        console.log('Skipping local downloaded courses init in CBT setup:', err);
      }

      if (isOffline) {
        // Fully bypass firestore if fully offline
        setLoading(false);
        return;
      }

      try {
        // Fetch all courses for the semester (Match web logic - don't hide everything)
        const q = query(
          collection(db, 'courses'),
          where('semester', '==', semester)
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            label: `${d.code} — ${d.title}`
          };
        }) as Course[];
        
        const userDept = (profile.department || '').toLowerCase();
        const userLevel = (profile.academicLevel || '100').replace('LVL', '');

        // Sort: Recommended first
        const prioritized = fetched.map(c => {
          const isDept = c.department?.toLowerCase() === userDept;
          const isLvl = String(c.level) === userLevel;
          let weight = 0;
          if (isDept) weight += 2;
          if (isLvl) weight += 1;
          return { course: c, weight };
        });

        prioritized.sort((a, b) => b.weight - a.weight);

        const sortedMapped = prioritized.map(p => {
          const isRec = p.weight > 0;
          return {
            ...p.course,
            label: `${isRec ? '✦ ' : ''}${p.course.code} — ${p.course.title}`
          };
        });

        // Merge with existing local ones (removing duplicates)
        setCourses(prev => {
          const prevIds = prev.map(p => p.id);
          const filteredSorted = sortedMapped.filter(s => !prevIds.includes(s.id));
          const merged = [...prev, ...filteredSorted];
          if (merged.length > 0 && !selectedCourse) {
            setSelectedCourse(merged[0].id);
          }
          return merged;
        });
      } catch (e) {
        console.error("Error fetching courses for CBT Practice:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, [profile, systemConfig, isOffline]);

  const handleStart = () => {
    if (!selectedCourse) {
      Alert.alert('No Selection', 'Please select a course to begin practicing.');
      return;
    }
    const parsedNum = parseInt(numQuestions, 10);
    if (!numQuestions || isNaN(parsedNum) || parsedNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of questions to load.');
      return;
    }

    router.push({
      pathname: '/cbt-exam',
      params: {
        courseId: selectedCourse,
        duration: timerEnabled ? String(duration) : '0',
        limit: String(parsedNum),
      },
    });
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity, transform: [{ translateY: fadeY }] }}>
          {/* Welcome Text */}
          <Text style={[s.pageTitle, { color: C.ink }]}>CBT Practice</Text>
          <Text style={[s.pageSubtitle, { color: C.inkMid }]}>
            Master FUTO exams in a real-time, customizable simulation environment.
          </Text>

          {/* Form Card */}
          <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
            {/* Field 1: Course */}
            <Text style={[s.fieldLabel, { color: C.inkLight }]}>CHOOSE YOUR COURSE</Text>
            <CourseDropdown
              courses={courses}
              selected={selectedCourse}
              onSelect={(id) => setSelectedCourse(id)}
            />

            <View style={[s.divider, { backgroundColor: C.border }]} />

            {/* Field 2: Timer Toggle */}
            <View style={s.timerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.timerTitle, { color: C.ink }]}>Practice Timer</Text>
                <Text style={[s.timerSub, { color: C.inkLight }]}>Simulate under precise exam duration.</Text>
              </View>
              <Switch
                value={timerEnabled}
                onValueChange={setTimerEnabled}
                trackColor={{ false: C.border, true: C.ink }}
                thumbColor={Platform.OS === 'ios' ? undefined : (timerEnabled ? C.bg : '#fff')}
              />
            </View>

            {timerEnabled && (
              <View style={{ marginTop: 18 }}>
                <Text style={[s.fieldLabel, { color: C.inkLight }]}>CHOOSE TIME ALLOCATED (MINUTES)</Text>
                <View style={s.durationRow}>
                  {DURATIONS.map((dur) => (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        s.durationBtn,
                        { borderColor: C.border },
                        duration === dur && [s.durationBtnActive, { backgroundColor: C.ink, borderColor: C.ink }],
                      ]}
                      onPress={() => setDuration(dur)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.durationBtnText, { color: C.inkMid }, duration === dur && { color: C.bg }]}>
                        {dur} Mins
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={[s.divider, { backgroundColor: C.border }]} />

            {/* Field 3: Max questions */}
            <Text style={[s.fieldLabel, { color: C.inkLight }]}>DESIRED NUMBER OF QUESTIONS</Text>
            <TextInput
              style={[s.input, { backgroundColor: C.bg, color: C.ink, borderColor: C.border, borderWidth: 1 }]}
              placeholder="e.g., 40"
              placeholderTextColor={C.inkLight}
              keyboardType="number-pad"
              value={numQuestions}
              onChangeText={setNumQuestions}
              maxLength={3}
            />

            <View style={[s.divider, { backgroundColor: C.border }]} />

            {/* Start button */}
            <TouchableOpacity style={[s.startBtn, { backgroundColor: C.ink }]} onPress={handleStart} activeOpacity={0.88}>
              <Text style={[s.startBtnText, { color: C.bg }]}>Start Practice</Text>
              <Text style={[s.startBtnArrow, { color: C.bg }]}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Info card below */}
          <View style={[s.infoCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={s.infoIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.infoTitle, { color: C.ink }]}>Pro Tip</Text>
              <Text style={[s.infoBody, { color: C.inkLight }]}>
                Enable the timer for a realistic exam experience. Past questions from recent years
                tend to repeat in FUTO CBT.
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      <BottomNav active="cbt" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

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

  // Page heading
  pageTitle: { fontFamily: F.display, fontSize: 32, marginTop: 28, marginBottom: 10 },
  pageSubtitle: { fontFamily: F.body, fontSize: 15, lineHeight: 22, marginBottom: 24 },

  // Card
  card: {
    borderRadius: 20,
    borderWidth: 1, padding: 20,
    marginBottom: 16,
  },
  divider: { height: 1, marginVertical: 18 },
  fieldLabel: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.5, marginBottom: 12 },

  // Dropdown
  dropdown: {
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownText: { fontFamily: F.medium, fontSize: 16 },
  dropdownPlaceholder: { },
  dropdownChevron: { fontSize: 18 },

  // Timer
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  timerTitle: { fontFamily: F.bold, fontSize: 16, marginBottom: 4 },
  timerSub: { fontFamily: F.body, fontSize: 13 },

  // Duration
  durationRow: { flexDirection: 'row', gap: 10 },
  durationBtn: {
    flex: 1, borderWidth: 1.5,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  durationBtnActive: { },
  durationBtnDisabled: { opacity: 0.4 },
  durationBtnText: { fontFamily: F.bold, fontSize: 13 },
  durationBtnTextActive: { },

  // Input
  input: {
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    fontFamily: F.body, fontSize: 16,
  },

  // Start button
  startBtn: {
    borderRadius: 14,
    paddingVertical: 18, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  startBtnText: { fontFamily: F.medium, fontSize: 17 },
  startBtnArrow: { fontSize: 14 },

  // Info card
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 20, marginTop: 2 },
  infoTitle: { fontFamily: F.bold, fontSize: 14, marginBottom: 4 },
  infoBody: { fontFamily: F.body, fontSize: 13, lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '75%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: F.bold, fontSize: 18, marginBottom: 16 },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 6,
  },
  modalItemActive: { },
  modalItemText: { fontFamily: F.medium, fontSize: 15 },
  modalItemTextActive: { },
});
