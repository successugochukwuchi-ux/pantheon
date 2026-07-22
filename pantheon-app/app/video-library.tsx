import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HamburgerIcon, BellIcon, ChevronDownIcon, MoreIcon } from '../components/Icons';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { BottomNav } from '../components/BottomNav';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';

interface Course {
  id: string;
  code: string;
  title: string;
  level?: string;
  semester?: string;
}

interface Note {
  id: string;
  title: string;
  views?: string;
  rating?: number;
  status?: string;
  description?: string;
  summary?: string;
  thumbnail?: string;
  videoUrl: string;
  courseId: string;
}

export default function VideoLibraryScreen() {
  const router = useRouter();
  const { profile, systemConfig } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        {/* Simple Header */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.headerBtn}>
            <Text style={{ fontSize: 28, color: C.ink, marginLeft: 8 }}>‹</Text>
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            VIDEO LIBRARY
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>🎥</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Video Library Locked
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
            Video Library is a premium feature reserved for activated accounts. Activate your student profile using an activation pin to unlock expert-led video lessons, video quizzes, and lecture video archives!
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

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Fetch courses sorted by course code matching current active semester
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const activeSemester = systemConfig?.currentSemester || '1st';
    const q = query(
      collection(db, 'courses'),
      where('semester', '==', activeSemester)
    );
    getDocs(q).then(async (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const filtered = await getFilteredCoursesForStudent(allCourses, profile, true, activeSemester);
      filtered.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setCourses(filtered);
      
      // Auto-select first course if none selected yet or previously selected is no longer valid
      if (filtered.length > 0) {
        if (!selectedCourse || !filtered.some(c => c.id === selectedCourse.id)) {
          setSelectedCourse(filtered[0]);
        }
      } else {
        setSelectedCourse(null);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching courses:', err);
      setLoading(false);
    });
  }, [profile, systemConfig]);

  // 2. Fetch notes belonging to the selected course which have videoUrls
  useEffect(() => {
    if (!selectedCourse?.id || !profile) {
      setNotes([]);
      return;
    }
    const q = query(collection(db, 'notes'), where('courseId', '==', selectedCourse.id));
    getDocs(q).then((snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      // Only keep notes that have a non-empty videoUrl
      const videoNotes = allNotes.filter(n => n.videoUrl && n.videoUrl.trim().length > 0);
      setNotes(videoNotes);
    }).catch((err) => {
      console.error('Error fetching notes:', err);
    });
  }, [selectedCourse, profile]);

  const videoLessonsCount = notes.length;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity style={s.headerBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.courseSelectorWrapper, { backgroundColor: C.bgAlt }]}>
           <Text style={[s.label, { color: C.inkLight }]}>SELECT COURSE</Text>
           <TouchableOpacity 
             style={[s.courseSelector, { backgroundColor: C.surface, borderColor: C.border }]} 
             activeOpacity={0.7}
             onPress={() => setPickerOpen(true)}
           >
              <Text style={[s.courseText, { color: C.ink }]}>
                {selectedCourse ? `${selectedCourse.code} - ${selectedCourse.title}` : 'Select Course...'}
              </Text>
              <ChevronDownIcon />
           </TouchableOpacity>
        </View>

        <View style={s.sectionHeader}>
           <Text style={[s.sectionTitle, { color: C.ink }]}>Video Lessons</Text>
           <Text style={[s.count, { color: C.inkLight }]}>
             {videoLessonsCount} {videoLessonsCount === 1 ? 'LESSON' : 'LESSONS'}
           </Text>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={C.ink} />
          </View>
        ) : notes.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📹</Text>
            <Text style={[s.emptyTitle, { color: C.ink }]}>No video lessons found</Text>
            <Text style={[s.emptyText, { color: C.inkLight }]}>
              There are no video lessons available for this course yet.
            </Text>
          </View>
        ) : (
          <View style={s.videoList}>
            {notes.map((v) => {
              const defaultThumbnail = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop';
              return (
                <TouchableOpacity 
                  key={v.id} 
                  style={[s.videoCard, { backgroundColor: C.surface, borderColor: C.border }]} 
                  activeOpacity={0.85}
                  onPress={() => router.push({ 
                    pathname: '/video-viewer', 
                    params: { 
                      noteId: v.id, 
                      title: v.title,
                      videoUrl: v.videoUrl,
                      courseId: v.courseId
                    } 
                  })}
                >
                  <View style={s.thumbnailWrapper}>
                    <Image source={{ uri: v.thumbnail || defaultThumbnail }} style={s.thumbnail} />
                    <View style={s.durationBadge}>
                      <Text style={s.durationText}>Lesson</Text>
                    </View>
                  </View>
                  
                  <View style={s.cardBody}>
                    <View style={s.titleRow}>
                      <Text style={[s.videoTitle, { color: C.ink }]} numberOfLines={1}>{v.title}</Text>
                      <MoreIcon color={C.inkLight} />
                    </View>
                    <Text style={[s.videoDesc, { color: C.inkMid }]} numberOfLines={2}>
                      {v.summary || v.description || 'Interactive concept check video lesson for this note.'}
                    </Text>
                    
                    <View style={s.metaRow}>
                      <View style={[s.badge, { backgroundColor: C.tagBg || C.bgAlt }]}>
                        <Text style={[s.badgeIcon, { color: C.inkLight }]}>👁</Text>
                        <Text style={[s.badgeText, { color: C.inkMid }]}>{v.views || '1.2k'} views</Text>
                      </View>
                      
                       <View style={[s.badge, { backgroundColor: C.tagBg || C.bgAlt }]}>
                         <Text style={[s.badgeIcon, { color: C.inkLight }]}>☆</Text>
                         <Text style={[s.badgeText, { color: C.inkMid }]}>{v.rating || '4.9'}</Text>
                       </View>

                       {v.status && (
                          <View style={[s.badge, { backgroundColor: v.status === 'Completed' ? '#E8F6EF' : (C.tagBg || C.bgAlt) }]}>
                             {v.status === 'Completed' && <Text style={{ color: '#27AE60', marginRight: 4 }}>✓</Text>}
                             <Text style={[s.badgeText, { color: C.inkMid }, v.status === 'Completed' && { color: '#27AE60' }]}>{v.status}</Text>
                          </View>
                       )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Dynamic Course Picker Modal */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.ink }]}>Select Course</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={s.modalCloseBtn}>
                <Text style={{ fontSize: 24, color: C.inkLight, fontFamily: F.bold }}>×</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.modalItem,
                    selectedCourse?.id === item.id && { backgroundColor: C.bgAlt, borderRadius: 12 }
                  ]}
                  onPress={() => {
                    setSelectedCourse(item);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={[
                    s.modalItemText, 
                    { color: C.ink },
                    selectedCourse?.id === item.id && { fontFamily: F.bold }
                  ]}>
                    {item.code} - {item.title}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <BottomNav active="notes" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 18, letterSpacing: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  
  content: { flex: 1 },
  courseSelectorWrapper: { padding: 16 },
  label: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  courseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseText: { fontFamily: F.bold, fontSize: 15, flex: 1, marginRight: 10 },
  
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: F.bold, fontSize: 22 },
  count: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1 },

  videoList: { paddingHorizontal: 16, gap: 20 },
  videoCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  thumbnailWrapper: { height: 180, width: '100%' },
  thumbnail: { width: '100%', height: '100%', backgroundColor: '#eee' },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
  
  cardBody: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  videoTitle: { flex: 1, fontFamily: F.bold, fontSize: 18 },
  videoDesc: { fontFamily: F.medium, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeIcon: { fontSize: 12, marginRight: 4 },
  badgeText: { fontFamily: F.bold, fontSize: 11 },

  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: F.bold,
    fontSize: 18,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: F.medium,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontFamily: F.bold,
    fontSize: 18,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.02)',
  },
  modalItemText: {
    fontSize: 15,
  },
});
