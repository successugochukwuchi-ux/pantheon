import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  setDoc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { BotIcon } from '../components/Icons';
import { NoteRenderer } from '../components/NoteRenderer';
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
  // We don't throw hered to avoid crashing the UI, we update state instead
}

const { width } = Dimensions.get('window');

interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order?: number;
  date?: string;
  progress?: number;
  summary?: string;
}

// ── Toolbar overlay ───────────────────────────────────────────────────────────
function Toolbar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  const actions = ['Highlight', 'Bookmark', 'Add Note', 'Share'];
  return (
    <View style={s.toolbarOverlay}>
      {actions.map((a) => (
        <TouchableOpacity key={a} style={s.toolbarItem} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.toolbarItemText}>{a}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NoteViewerScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { noteId, courseId } = useLocalSearchParams<{ noteId: string; courseId: string }>();
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [hermesOpen, setHermesOpen] = useState(false);
  const [hermesMsg, setHermesMsg] = useState('');
  const [hermesChat, setHermesChat] = useState([
    { role: 'bot', text: 'Hi! I am Hermes. Ask me anything about this note.' }
  ]);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevNote, setPrevNote] = useState<Note | null>(null);
  const [nextNote, setNextNote] = useState<Note | null>(null);

  // Animations
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Track completion
  const lastTrackedId = useRef<string | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const isCompleted = useRef(false);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset.y;
    const maximumOffset = contentSize.height - layoutMeasurement.height;
    
    if (maximumOffset <= 0) return;
    
    const percentage = Math.max(0, Math.min(100, Math.round((currentOffset / maximumOffset) * 100)));
    if (percentage !== scrollPct) {
      setScrollPct(percentage);
      Animated.spring(progressAnim, {
        toValue: percentage,
        useNativeDriver: false,
        tension: 40,
        friction: 7
      }).start();
    }
  };

  const saveProgress = async (pct: number) => {
    if (!profile || !noteId) return;
    try {
      const isDone = pct >= 95;
      await setDoc(doc(db, 'progress', `${profile.uid}_${noteId}`), {
        uid: profile.uid,
        targetId: noteId,
        type: 'note',
        percentage: isDone ? 100 : pct,
        completed: isDone,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (isDone && !isCompleted.current) {
        isCompleted.current = true;
        // Optionally update course progress here as well
      }
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  };

  useEffect(() => {
    if (scrollPct > 0 && scrollPct % 10 === 0) { // Save every 10%
      saveProgress(scrollPct);
    }
    if (scrollPct >= 95 && !isCompleted.current) {
      saveProgress(100);
    }
  }, [scrollPct]);

  useEffect(() => {
    async function fetchNoteData() {
      if (!noteId || !profile) {
        console.warn('NoteViewer: Missing noteId or profile');
        return;
      }
      
      setLoading(true);
      setError(null);
      console.log('NoteViewer: Fetching note', noteId);
      
      try {
        const noteDoc = await getDoc(doc(db, 'notes', noteId));
        if (noteDoc.exists()) {
          const currentNote = { id: noteId, ...noteDoc.data() } as Note;
          setNote(currentNote);
          console.log('NoteViewer: Note loaded', currentNote.title);

          // 1. Fetch adjacent notes for navigation
          try {
            const q = query(
              collection(db, 'notes'),
              where('courseId', '==', currentNote.courseId)
            );
            const notesSnap = await getDocs(q);
            const allNotesInCourse = notesSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Note))
              .sort((a, b) => (a.order || 0) - (b.order || 0));
              
            const idx = allNotesInCourse.findIndex(n => n.id === noteId);
            setPrevNote(idx > 0 ? allNotesInCourse[idx - 1] : null);
            setNextNote(idx < allNotesInCourse.length - 1 ? allNotesInCourse[idx + 1] : null);
            console.log('NoteViewer: Nav notes set', { hasPrev: !!(idx > 0), hasNext: !!(idx < allNotesInCourse.length - 1) });
          } catch (navErr) {
            console.error("NoteViewer: Nav fetch error", navErr);
            handleFirestoreError(navErr, OperationType.LIST, 'notes');
          }

          // 2. Update Progress
          if (lastTrackedId.current !== noteId) {
            lastTrackedId.current = noteId;
            try {
              console.log('NoteViewer: Loading previous progress');
              const noteProgressRef = doc(db, 'progress', `${profile.uid}_${noteId}`);
              const progSnap = await getDoc(noteProgressRef);
              
              let initialProgress = 0;
              if (progSnap.exists()) {
                const data = progSnap.data();
                initialProgress = data.percentage || 0;
                if (data.completed) isCompleted.current = true;
              }
              
              setScrollPct(initialProgress);
              progressAnim.setValue(initialProgress);

              const allNotesIds = (await getDocs(query(collection(db, 'notes'), where('courseId', '==', currentNote.courseId)))).docs.map(d => d.id);
              const totalNotesCount = allNotesIds.length;

              const userProgSnap = await getDocs(query(
                collection(db, 'progress'),
                where('uid', '==', profile.uid),
                where('type', '==', 'note'),
                where('completed', '==', true)
              ));
              const completedInCourse = userProgSnap.docs.filter(d => allNotesIds.includes(d.data().targetId)).length;

              const coursePercent = totalNotesCount > 0 ? Math.round((completedInCourse / totalNotesCount) * 100) : 0;
              setNote(prev => prev ? ({ ...prev, progress: coursePercent }) : null);
            } catch (progErr) {
              console.error("NoteViewer: Progress load error", progErr);
            }
          }
        } else {
          console.warn('NoteViewer: doc does not exist', noteId);
          setError(`Course not found: topic ${noteId}`);
        }
      } catch (e) {
        console.error("NoteViewer: Main fetch error", e);
        handleFirestoreError(e, OperationType.GET, 'notes');
        setError('Failed to load note content');
      } finally {
        setLoading(false);
      }
    }
    fetchNoteData();
  }, [noteId, profile]);

  useEffect(() => {
    if (!loading && note) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(progressAnim, {
          toValue: scrollPct || 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [loading, note]);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.ink} />
        <Text style={{ marginTop: 12, fontFamily: F.medium, color: C.inkMid }}>Opening note...</Text>
      </SafeAreaView>
    );
  }

  if (error || !note) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontFamily: F.medium, color: C.inkMid, textAlign: 'center', padding: 20 }}>
          {error || (loading ? 'Opening note...' : 'Note not found.')}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.gold, fontFamily: F.bold }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Hermes Floating Interface */}
      <Modal visible={hermesOpen} transparent animationType="slide">
        <View style={s.hermesOverlay}>
           <View style={s.hermesContent}>
              <View style={s.hermesHeader}>
                 <BotIcon color="#fff" />
                 <Text style={s.hermesTitle}>HERMES AI</Text>
                 <TouchableOpacity onPress={() => setHermesOpen(false)}>
                   <Text style={{ color: '#fff', fontFamily: F.bold }}>Close</Text>
                 </TouchableOpacity>
              </View>
              <ScrollView style={s.hermesChatScroll} contentContainerStyle={{ padding: 16 }}>
                {hermesChat.map((m, i) => (
                  <View key={i} style={[s.hermesBubble, m.role === 'user' ? s.hermesUser : s.hermesBot]}>
                    <Text style={[s.hermesText, m.role === 'user' && { color: '#fff' }]}>{m.text}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={s.hermesInputRow}>
                <TextInput 
                  style={s.hermesInput} 
                  placeholder="Ask Hermes..." 
                  value={hermesMsg}
                  onChangeText={setHermesMsg}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity 
                   style={s.hermesSend}
                   onPress={() => {
                     if (!hermesMsg) return;
                     const newChat = [...hermesChat, { role: 'user', text: hermesMsg }];
                     setHermesChat(newChat);
                     setHermesMsg('');
                     setTimeout(() => {
                       setHermesChat([...newChat, { role: 'bot', text: "Hermes is analyzing the note content... Is there a specific part you want me to explain?" }]);
                     }, 1000);
                   }}
                >
                   <BotIcon color="#fff" />
                </TouchableOpacity>
              </View>
           </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/notes-topics', params: { courseId: note.courseId } })}
          activeOpacity={0.7}
          style={s.iconBtn}
        >
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity
          onPress={() => setToolbarVisible(!toolbarVisible)}
          activeOpacity={0.7}
          style={s.iconBtn}
        >
          <View style={[s.dot, { marginBottom: 4 }]} />
          <View style={[s.dot, { marginBottom: 4 }]} />
          <View style={s.dot} />
        </TouchableOpacity>
      </View>

      {/* Progress bar - Sleek fixed bar at top */}
      <View style={s.progressContainer}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
          {/* Course tag */}
          <View style={s.coursePill}>
            <Text style={s.coursePillText}>{courseId?.toUpperCase() || 'COURSE'}</Text>
          </View>

          {/* Title */}
          <Text style={s.articleTitle}>{note.title}</Text>

          {/* Date */}
          <View style={s.dateRow}>
            <View style={s.calIcon}>
              <View style={s.calTop} />
              <View style={s.calGrid}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={s.calDot} />
                ))}
              </View>
            </View>
            <Text style={s.dateText}>{note.date || 'LATEST UPDATE'}</Text>
          </View>

          {/* Note content rendered with NoteRenderer (WebView) */}
          <NoteRenderer content={note.content} />

          {/* Summary */}
          {note.summary && (
            <View style={s.summaryWrap}>
              <Text style={s.summaryLabel}>SUMMARY</Text>
              <View style={s.summaryBar} />
              <Text style={s.summaryText}>{note.summary}</Text>
            </View>
          )}

          {/* Prev / Next navigation */}
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, !prevNote && s.navBtnDisabled]}
              disabled={!prevNote}
              activeOpacity={0.85}
              onPress={() =>
                prevNote &&
                router.push({
                  pathname: '/note-viewer',
                  params: { courseId, noteId: prevNote.id },
                })
              }
            >
              <Text style={[s.navBtnText, !prevNote && s.navBtnTextDisabled]}>← Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.navBtnPrimary, !nextNote && s.navBtnDisabled]}
              disabled={!nextNote}
              activeOpacity={0.85}
              onPress={() =>
                nextNote &&
                router.push({
                  pathname: '/note-viewer',
                  params: { courseId, noteId: nextNote.id },
                })
              }
            >
              <Text style={[s.navBtnPrimaryText, !nextNote && s.navBtnTextDisabled]}>
                Next Topic →
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </Animated.View>
      </ScrollView>

      {/* Floating Buttons */}
      <View style={{ position: 'absolute', bottom: 32, right: 20, alignItems: 'center' }}>
        <TouchableOpacity 
          style={[s.fab, { position: 'relative', bottom: 0, right: 0, backgroundColor: '#000', marginBottom: 16 }]} 
          onPress={() => setHermesOpen(true)}
          activeOpacity={0.8}
        >
          <BotIcon color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[s.fab, { position: 'relative', bottom: 0, right: 0 }]} 
          onPress={() => setToolbarVisible(!toolbarVisible)}
          activeOpacity={0.8}
        >
          <Text style={s.fabIcon}>✎</Text>
        </TouchableOpacity>
      </View>

      <Toolbar visible={toolbarVisible} onClose={() => setToolbarVisible(false)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { 
    padding: 20, 
    paddingBottom: 60,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 850 : undefined,
    alignSelf: 'center',
  },

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
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.ink },

  // Progress
  progressContainer: {
    height: 3,
    backgroundColor: C.border,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.gold }, // Gold color for progress bar

  // Article
  coursePill: {
    alignSelf: 'flex-start', backgroundColor: C.pill,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16,
  },
  coursePillText: { fontFamily: F.bold, fontSize: 11, color: C.pillText, letterSpacing: 1 },
  articleTitle: {
    fontFamily: F.display, fontSize: 30, color: C.ink,
    lineHeight: 36, marginBottom: 14,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  calIcon: { width: 14, height: 14 },
  calTop: {
    width: 14, height: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3,
    borderWidth: 1.5, borderColor: C.inkLight, borderBottomWidth: 0,
  },
  calGrid: { flexDirection: 'row', gap: 2, paddingTop: 1 },
  calDot: { width: 3, height: 3, borderRadius: 1, backgroundColor: C.inkLight },
  dateText: { fontFamily: F.body, fontSize: 13, color: C.inkLight },

  // Sections
  section: { marginBottom: 28 },
  sectionHeading: {
    fontFamily: F.display, fontSize: 24, color: C.ink,
    marginBottom: 14, lineHeight: 28,
  },
  bodyText: {
    fontFamily: F.body, fontSize: 15, color: C.inkMid,
    lineHeight: 24, marginBottom: 16,
  },

  // Formula
  formulaBox: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 20, alignItems: 'center', marginBottom: 16,
  },
  formulaText: {
    fontFamily: F.display, fontSize: 18, color: C.ink,
    lineHeight: 28, textAlign: 'center', marginBottom: 12,
  },
  formulaLabel: {
    fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 2,
  },

  // Checklist
  checklist: {
    borderLeftWidth: 3, borderLeftColor: C.border,
    paddingLeft: 16, marginBottom: 16,
  },
  checklistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2,
  },
  checkMark: { fontFamily: F.bold, fontSize: 11, color: '#fff' },
  checkText: { fontFamily: F.body, fontSize: 14, color: C.inkMid, lineHeight: 22, flex: 1 },

  // Bullets (Unordered Lists)
  bulletList: {
    paddingLeft: 8,
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 20,
    color: C.ink,
    marginRight: 12,
    lineHeight: 24,
    marginTop: -2, // Adjust vertically for better alignment
  },
  bulletText: {
    fontFamily: F.body,
    fontSize: 15,
    color: C.inkMid,
    lineHeight: 24,
    flex: 1,
  },

  // Diagram
  diagram: {
    height: 180, backgroundColor: '#E2E0DA', borderRadius: 14,
    overflow: 'hidden', position: 'relative', marginBottom: 8, marginTop: 8,
  },
  diagramGrid: { ...StyleSheet.absoluteFillObject },
  gridLineH: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  axis: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.2)' },
  axisH: { left: 0, right: 0, top: '50%', height: 1.5 },
  axisV: { top: 0, bottom: 0, left: '50%', width: 1.5 },
  diagramCaption: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
  },
  diagramCaptionText: {
    fontFamily: F.medium, fontSize: 11, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start',
    overflow: 'hidden',
  },

  // Summary
  summaryWrap: {
    borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 20, marginBottom: 28,
  },
  summaryLabel: {
    fontFamily: F.bold, fontSize: 10, color: C.inkLight,
    letterSpacing: 2, marginBottom: 12,
  },
  summaryBar: { width: 32, height: 3, backgroundColor: C.ink, borderRadius: 2, marginBottom: 14 },
  summaryText: {
    fontFamily: F.display, fontSize: 16, color: C.inkMid,
    lineHeight: 26, fontStyle: 'italic',
  },

  // Nav
  navRow: { flexDirection: 'row', gap: 12 },
  navBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  navBtnPrimary: {
    flex: 1, backgroundColor: C.ink,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },
  navBtnPrimaryText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  navBtnTextDisabled: { color: C.inkLight },

  // FAB
  fab: {
    position: 'absolute', bottom: 32, right: 20,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 20, color: '#fff' },

  // Toolbar
  toolbarOverlay: {
    position: 'absolute', bottom: 164, right: 20,
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    minWidth: 160,
  },
  toolbarItem: { paddingVertical: 13, paddingHorizontal: 18 },
  toolbarItemText: { fontFamily: F.medium, fontSize: 14, color: C.ink },

  // Hermes Styles
  hermesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  hermesContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', overflow: 'hidden' },
  hermesHeader: { backgroundColor: '#000', padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hermesTitle: { fontFamily: F.bold, fontSize: 18, color: '#fff' },
  hermesChatScroll: { flex: 1 },
  hermesBubble: { padding: 14, borderRadius: 18, marginBottom: 12, maxWidth: '85%' },
  hermesUser: { alignSelf: 'flex-end', backgroundColor: '#000' },
  hermesBot: { alignSelf: 'flex-start', backgroundColor: '#F3F2EE' },
  hermesText: { fontFamily: F.body, fontSize: 15, color: C.ink, lineHeight: 22 },
  hermesInputRow: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center', gap: 12 },
  hermesInput: { flex: 1, height: 48, backgroundColor: '#F7F7FA', borderRadius: 24, paddingHorizontal: 20, fontFamily: F.body, fontSize: 15, color: C.ink },
  hermesSend: { width: 48, height: 48, backgroundColor: '#000', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
});
