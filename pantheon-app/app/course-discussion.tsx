import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../components/Theme';
import { getLocalNotes } from '../lib/db';

interface Message {
  id: string;
  userId: string;
  username: string;
  text: string;
  userLevel: string;
  userAcademicLevel?: string;
  createdAt: string;
  referencedNoteId?: string;
  referencedNoteTitle?: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

function NoteIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 16, borderWidth: 2, borderColor: color, borderRadius: 2 }}>
        <View style={{ width: 6, height: 2, backgroundColor: color, marginTop: 3, marginLeft: 2 }} />
        <View style={{ width: 8, height: 2, backgroundColor: color, marginTop: 2, marginLeft: 2 }} />
      </View>
    </View>
  );
}

export default function CourseDiscussionScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Note sharing state
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Fetch Notes for reference picker
  useEffect(() => {
    if (!profile || !courseId) return;

    let localNotesArray: any[] = [];
    try {
      localNotesArray = getLocalNotes(courseId);
      if (localNotesArray && localNotesArray.length > 0) {
        setAllNotes(localNotesArray.map(n => ({ id: n.id, ...n, courseId })));
        console.log("Loaded local notes for discussion ref:", localNotesArray.length);
      }
    } catch (e) {
      console.log("Error loading local notes for discussion:", e);
    }

    const qNotes = query(collection(db, 'notes'), where('courseId', '==', courseId));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      const fbNotes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("Fetched cloud notes for discussion ref:", fbNotes.length);
      if (fbNotes.length > 0) {
        setAllNotes(fbNotes);
      } else if (localNotesArray.length === 0) {
        setAllNotes([]);
      }
    }, (err) => {
      console.log("Discussion note loader error:", err);
    });
    return () => unsubNotes();
  }, [profile, courseId]);

  useEffect(() => {
    if (!courseId) return;

    // Fetch Course Info
    async function fetchCourse() {
      try {
        const d = await getDoc(doc(db, 'courses', courseId));
        if (d.exists()) {
          setCourse({ id: d.id, ...d.data() } as Course);
        }
      } catch (e) {
        console.error("Error fetching course:", e);
      }
    }
    fetchCourse();

    // Listen to Messages
    const q = query(
      collection(db, 'discussions'),
      where('courseId', '==', courseId),
      limit(100)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      // Sort client-side to avoid index requirement
      const sortedMsgs = msgs.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      setMessages(sortedMsgs);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }, (err) => {
      console.error("Discussion listener error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [courseId]);

  const handleSend = async () => {
    const textToSend = text.trim();
    if (!textToSend && !selectedNote && !profile || !courseId) return;
    
    setSending(true);
    const msgData: any = {
      courseId,
      userId: profile.uid,
      username: profile.username || 'Student',
      userLevel: profile.level || '1',
      userAcademicLevel: profile.academicLevel || '100',
      text: textToSend,
      createdAt: new Date().toISOString()
    };

    if (selectedNote) {
      msgData.referencedNoteId = selectedNote.id;
      msgData.referencedNoteTitle = selectedNote.title;
      if (!textToSend) {
        msgData.text = `Shared note reference: ${selectedNote.title}`;
      }
    }

    try {
      setText('');
      setSelectedNote(null);
      await addDoc(collection(db, 'discussions'), msgData);
    } catch (e) {
      console.error("Error sending message:", e);
      setText(msgData.text); // Restore text if failed
    } finally {
      setSending(false);
    }
  };

  const availableNotes = useMemo(() => {
    return allNotes.filter(n => !n.courseId || String(n.courseId).toLowerCase() === String(courseId).toLowerCase());
  }, [allNotes, courseId]);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.ink} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Note Picker Modal */}
      <Modal visible={notePickerOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: C.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.ink }]}>Reference Lecture Note</Text>
              <TouchableOpacity onPress={() => setNotePickerOpen(false)}>
                <Text style={[s.modalClose, { color: C.inkLight }]}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {availableNotes.length === 0 ? (
                <Text style={[s.emptyNotesPicker, { color: C.inkMid }]}>No academic notes found for this course in the cloud.</Text>
              ) : (
                availableNotes.map(n => (
                  <TouchableOpacity 
                     key={n.id} 
                     style={[s.noteItem, { borderBottomColor: C.border }]}
                     onPress={() => {
                       setSelectedNote(n);
                       setNotePickerOpen(false);
                     }}
                  >
                     <Text style={[s.noteItemTitle, { color: C.ink }]}>{n.title}</Text>
                     <Text style={[s.noteItemCategory, { color: C.activeText }]}>Tap to attach reference link</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <View style={s.headerMeta}>
          <Text style={[s.headerTitle, { color: C.ink }]}>{course?.code || 'Chat'}</Text>
          <Text style={[s.headerSub, { color: C.inkLight }]}>{course?.title || 'Course Discussion'}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: C.inkLight }]}>No messages yet. Start the conversation!</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const myMsg = msg.userId === profile?.uid;
              const isAdmin = msg.userLevel === '3' || msg.userLevel === '4';
              
              return (
                <View key={msg.id} style={[s.bubbleRow, myMsg ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  {!myMsg && (
                    <View style={[s.avatar, { backgroundColor: C.border }]}>
                      <Text style={[s.avatarText, { color: C.inkMid }]}>{msg.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[s.bubble, myMsg ? s.bubbleMe : [s.bubbleThem, { backgroundColor: C.surface }]]}>
                    <View style={s.bubbleHeader}>
                      <Text style={[s.bubbleName, myMsg ? { color: 'rgba(255,255,255,0.7)' } : { color: C.inkLight }]}>
                        {msg.username}
                      </Text>
                      {isAdmin && (
                        <View style={[s.adminBadge, { backgroundColor: C.gold }]}>
                          <Text style={s.adminBadgeText}>MOD</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.bubbleText, myMsg ? { color: '#fff' } : { color: C.ink }]}>
                      {msg.text}
                    </Text>

                    {msg.referencedNoteId && (
                      <TouchableOpacity
                        style={[s.refCard, myMsg ? s.refCardMe : [s.refCardThem, { backgroundColor: C.bg, borderColor: C.border }]]}
                        activeOpacity={0.8}
                        onPress={() => router.push({
                          pathname: '/note-viewer',
                          params: { courseId, noteId: msg.referencedNoteId }
                        })}
                      >
                        <NoteIcon color={myMsg ? '#fff' : C.activeText} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[s.refCardTitle, { color: myMsg ? '#fff' : C.ink }]} numberOfLines={1}>
                            {msg.referencedNoteTitle || 'Shared Lecture Note'}
                          </Text>
                          <Text style={{ fontSize: 10, color: myMsg ? 'rgba(255,255,255,0.7)' : C.inkLight }}>
                            Tap to read note offline
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <Text style={[s.bubbleTime, myMsg ? { color: 'rgba(255,255,255,0.4)' } : { color: C.inkLight }]}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Selected Note Attachment Preview Bar (just like site) */}
        {selectedNote && (
          <View style={[s.selectedNotePreviewBar, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <NoteIcon color={C.activeText} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={{ fontSize: 10, color: C.inkLight, fontFamily: F.bold, textTransform: 'uppercase' }}>REFERENCING NOTE</Text>
                <Text style={{ fontSize: 13, color: C.ink, fontFamily: F.bold }} numberOfLines={1}>{selectedNote.title}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedNote(null)} style={s.selectedNoteClose}>
              <Text style={{ color: C.inkLight, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={[s.inputBar, { borderTopColor: C.border, backgroundColor: C.bg }]}>
          <TouchableOpacity 
            style={[s.attachBtn, { backgroundColor: C.surface, borderColor: C.border }]} 
            activeOpacity={0.7}
            onPress={() => setNotePickerOpen(true)}
          >
            <NoteIcon color={C.inkMid} />
          </TouchableOpacity>
          <TextInput
            style={[s.input, { backgroundColor: C.surface, color: C.ink }]}
            placeholder={selectedNote ? "Add a comment directly..." : "Type a message..."}
            placeholderTextColor={C.inkLight}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity 
            style={[s.sendBtn, { backgroundColor: C.ink }, (!text.trim() && !selectedNote || sending) && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={(!text.trim() && !selectedNote) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.sendBtnText}>➔</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerMeta: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: F.bold, fontSize: 16 },
  headerSub: { fontFamily: F.medium, fontSize: 11, textTransform: 'uppercase' },
  
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, borderRadius: 1 },
  backArrowHead: {
    position: 'absolute', left: 14, width: 9, height: 9,
    borderLeftWidth: 2, borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  bubbleRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: F.bold, fontSize: 12 },
  
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: C.ink,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    borderBottomLeftRadius: 4,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  bubbleName: { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5 },
  adminBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  adminBadgeText: { fontSize: 8, fontFamily: F.bold, color: '#fff' },
  bubbleText: { fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontFamily: F.medium, fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },

  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  refCardMe: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  refCardThem: {},
  refCardTitle: {
    fontSize: 12,
    fontFamily: F.bold,
  },

  empty: { paddingVertical: 100, alignItems: 'center' },
  emptyText: { fontFamily: F.medium, fontSize: 14 },

  selectedNotePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  selectedNoteClose: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontFamily: F.body,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, marginTop: -2 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  modalTitle: {
    fontFamily: F.bold,
    fontSize: 18,
  },
  modalClose: {
    fontSize: 14,
    fontFamily: F.semibold,
  },
  emptyNotesPicker: {
    fontFamily: F.medium,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
  },
  noteItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 4,
  },
  noteItemTitle: {
    fontFamily: F.bold,
    fontSize: 14,
  },
  noteItemCategory: {
    fontFamily: F.medium,
    fontSize: 11,
  },
});
