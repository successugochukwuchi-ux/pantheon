import React, { useState, useRef, useEffect } from 'react';
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
import { C, F } from '../components/Theme';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

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
const YEARS = ['All Years', '2023', '2022', '2021', '2020', '2019'];

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
  const [open, setOpen] = useState(false);
  const label = courses.find(c => c.id === selected)?.label ?? 'Choose a course...';

  return (
    <>
      <TouchableOpacity style={s.dropdown} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.dropdownText, !selected && s.dropdownPlaceholder]}>{label}</Text>
        <Text style={s.dropdownChevron}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select Course</Text>
          <FlatList
            data={courses}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.modalItem, selected === item.id && s.modalItemActive]}
                onPress={() => { onSelect(item.id, item.label); setOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={[s.modalItemText, selected === item.id && s.modalItemTextActive]}>
                  {item.label}
                </Text>
                {selected === item.id && <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

// ── Year Selector Modal ────────────────────────────────────────────────────────
function YearSelector({ selected, onSelect }: { selected: string; onSelect: (y: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={s.yearRow} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <View style={s.yearCalIcon}>
          <View style={s.calTop} />
          <View style={s.calBottom} />
        </View>
        <Text style={s.yearSelectLabel}>Select Year(s)</Text>
        <View style={s.yearBadge}>
          <Text style={s.yearBadgeText}>{selected}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select Year</Text>
          {YEARS.map(y => (
            <TouchableOpacity
              key={y}
              style={[s.modalItem, selected === y && s.modalItemActive]}
              onPress={() => { onSelect(y); setOpen(false); }}
              activeOpacity={0.8}
            >
              <Text style={[s.modalItemText, selected === y && s.modalItemTextActive]}>{y}</Text>
              {selected === y && <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CbtSetupScreen() {
  const router = useRouter();
  const { profile, systemConfig } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [duration, setDuration] = useState(30);
  const [numQuestions, setNumQuestions] = useState('');
  const [selectedYear, setSelectedYear] = useState('All Years');

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
      try {
        const semester = systemConfig.currentSemester || '1st';
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
          const courseDept = (c.department || '').toLowerCase();
          const courseLevel = (c.level || '').replace('LVL', '');

          const levelMatch = courseLevel === userLevel || 
                            (userLevel === '100' && courseLevel === '1') ||
                            (userLevel === '1' && courseLevel === '100');
          
          let isRecommended = false;
          if (levelMatch) {
            if (!c.department || courseDept === 'general' || courseDept === 'college') {
              isRecommended = true;
            } else {
              const userTokens = userDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
              const courseTokens = courseDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
              if (userTokens.some(ut => courseDept.includes(ut)) || courseTokens.some(ct => userDept.includes(ct))) {
                isRecommended = true;
              }
            }
          }
          return { ...c, isRecommended };
        }).sort((a, b) => {
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          return a.code.localeCompare(b.code);
        }).map(c => ({
          ...c,
          label: c.isRecommended ? `⭐ ${c.code} — ${c.title}` : `${c.code} — ${c.title}`
        }));

        setCourses(prioritized);
      } catch (e) {
        console.error("Error fetching courses for CBT:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, [profile, systemConfig]);

  const handleStart = () => {
    if (!selectedCourse) {
      Alert.alert('Select a Course', 'Please choose a course before starting.');
      return;
    }
    const count = parseInt(numQuestions) || 40;
    router.push({
      pathname: '/cbt-exam',
      params: {
        courseId: selectedCourse,
        duration: String(timerEnabled ? duration : 0),
        numQuestions: String(Math.min(Math.max(count, 5), 100)),
        year: selectedYear,
      },
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn} onPress={() => router.push('/notifications')}>
          <View style={s.bellBody} />
          <View style={s.bellBase} />
          <View style={s.bellClapper} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Page heading */}
        <Animated.View style={{ opacity, transform: [{ translateY: fadeY }] }}>
          <Text style={s.pageTitle}>CBT Practice Setup</Text>
          <Text style={s.pageSubtitle}>
            Configure your exam environment for optimal simulation of the FUTO Computer Based Test.
          </Text>

          {/* Config card */}
          <View style={s.card}>
            {/* Course selector */}
            <Text style={s.fieldLabel}>SELECT COURSE</Text>
            {loading ? (
               <View style={s.dropdown}>
                 <Text style={s.dropdownPlaceholder}>Loading courses...</Text>
               </View>
            ) : courses.length > 0 ? (
               <CourseDropdown courses={courses} selected={selectedCourse} onSelect={(id) => setSelectedCourse(id)} />
            ) : (
               <View style={[s.dropdown, { borderColor: '#E74C3C', borderWidth: 1 }]}>
                 <Text style={{ color: '#E74C3C', fontSize: 13, fontFamily: F.medium }}>No courses found for your level/semester</Text>
               </View>
            )}

            <View style={s.divider} />

            {/* Timer toggle */}
            <View style={s.timerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.timerTitle}>Enable Timer</Text>
                <Text style={s.timerSub}>Simulate actual exam time constraints</Text>
              </View>
              <Switch
                value={timerEnabled}
                onValueChange={setTimerEnabled}
                trackColor={{ false: C.border, true: C.ink }}
                thumbColor={C.surface}
                ios_backgroundColor={C.border}
              />
            </View>

            <View style={s.divider} />

            {/* Duration */}
            <Text style={s.fieldLabel}>TIME DURATION (MINUTES)</Text>
            <View style={s.durationRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.durationBtn, duration === d && s.durationBtnActive, !timerEnabled && s.durationBtnDisabled]}
                  onPress={() => timerEnabled && setDuration(d)}
                  activeOpacity={timerEnabled ? 0.8 : 1}
                >
                  <Text style={[s.durationBtnText, duration === d && s.durationBtnTextActive]}>
                    {d} MIN
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.divider} />

            {/* Number of questions */}
            <Text style={s.fieldLabel}>NUMBER OF QUESTIONS</Text>
            <TextInput
              style={s.input}
              placeholder="e.g., 40"
              placeholderTextColor={C.inkLight}
              keyboardType="number-pad"
              value={numQuestions}
              onChangeText={setNumQuestions}
              maxLength={3}
            />

            <View style={s.divider} />

            {/* Year selector */}
            <YearSelector selected={selectedYear} onSelect={setSelectedYear} />

            <View style={s.divider} />

            {/* Start button */}
            <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.88}>
              <Text style={s.startBtnText}>Start Practice</Text>
              <Text style={s.startBtnArrow}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Info card below */}
          <View style={s.infoCard}>
            <Text style={s.infoIcon}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.infoTitle}>Pro Tip</Text>
              <Text style={s.infoBody}>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 16, color: C.ink, letterSpacing: 2 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  backArrowHead: {
    position: 'absolute', left: 0, width: 9, height: 9,
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink,
    transform: [{ rotate: '45deg' }],
  },
  bellBody: { width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 0 },
  bellBase: { width: 20, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  bellClapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2, borderColor: C.ink, borderTopWidth: 0, marginTop: -1, alignSelf: 'center' },

  // Page heading
  pageTitle: { fontFamily: F.display, fontSize: 32, color: C.ink, marginTop: 28, marginBottom: 10 },
  pageSubtitle: { fontFamily: F.body, fontSize: 15, color: C.inkMid, lineHeight: 22, marginBottom: 24 },

  // Card
  card: {
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 20,
    marginBottom: 16,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 18 },
  fieldLabel: { fontFamily: F.bold, fontSize: 11, color: C.inkLight, letterSpacing: 1.5, marginBottom: 12 },

  // Dropdown
  dropdown: {
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownText: { fontFamily: F.medium, fontSize: 16, color: C.ink },
  dropdownPlaceholder: { color: C.inkLight },
  dropdownChevron: { fontSize: 18, color: C.inkMid },

  // Timer
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  timerTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  timerSub: { fontFamily: F.body, fontSize: 13, color: C.inkMid },

  // Duration
  durationRow: { flexDirection: 'row', gap: 10 },
  durationBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  durationBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  durationBtnDisabled: { opacity: 0.4 },
  durationBtnText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },
  durationBtnTextActive: { color: '#fff' },

  // Input
  input: {
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    fontFamily: F.body, fontSize: 16, color: C.ink,
  },

  // Year row
  yearRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  yearCalIcon: { width: 22, height: 22 },
  calTop: { width: 22, height: 11, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.5, borderColor: C.ink, borderBottomWidth: 0 },
  calBottom: { width: 22, height: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderWidth: 1.5, borderColor: C.ink, borderTopWidth: 0 },
  yearSelectLabel: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  yearBadge: { backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  yearBadgeText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },

  // Start button
  startBtn: {
    backgroundColor: C.ink, borderRadius: 14,
    paddingVertical: 18, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  startBtnText: { fontFamily: F.medium, fontSize: 17, color: '#fff' },
  startBtnArrow: { fontSize: 14, color: '#fff' },

  // Info card
  infoCard: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 20, marginTop: 2 },
  infoTitle: { fontFamily: F.bold, fontSize: 14, color: C.ink, marginBottom: 4 },
  infoBody: { fontFamily: F.body, fontSize: 13, color: C.inkMid, lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '75%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: F.bold, fontSize: 18, color: C.ink, marginBottom: 16 },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 6,
  },
  modalItemActive: { backgroundColor: C.ink },
  modalItemText: { fontFamily: F.medium, fontSize: 15, color: C.ink },
  modalItemTextActive: { color: '#fff' },
});
