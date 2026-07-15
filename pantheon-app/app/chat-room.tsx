import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { F } from '../components/Theme';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, doc, getDoc, limit, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDownloadedCoursesLocal, getLocalNotes } from '../lib/db';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';

// ── Icons with Dynamic Theming ───────────────────────────────────────────────

function BackIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function MoreIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
    </View>
  );
}

function PlusIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 2, height: 16, backgroundColor: C.ink, borderRadius: 1 }} />
    </View>
  );
}

function BookIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 16, borderWidth: 1.5, borderColor: C.ink, borderRadius: 2 }} />
      <View style={{ position: 'absolute', width: 8, height: 1.5, backgroundColor: C.ink, top: 6 }} />
      <View style={{ position: 'absolute', width: 8, height: 1.5, backgroundColor: C.ink, top: 10 }} />
    </View>
  );
}

function SendIcon() {
  return (
    <View style={{ width: 18, height: 18, marginRight: -2 }}>
      <Text style={{ fontSize: 16, color: '#fff' }}>➔</Text>
    </View>
  );
}

function NoteIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 40, height: 40, backgroundColor: C.inkLight || '#333', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18, color: '#fff' }}>📝</Text>
    </View>
  );
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: any;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  referencedNoteId?: string;
  referencedNoteTitle?: string;
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const params = useLocalSearchParams<{
    id?: string;
    chatId?: string;
    otherUid?: string;
    name?: string;
    isGroup?: string;
  }>();

  const { profile, systemConfig, isOffline } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(params.id || params.chatId || null);
  const [chatName, setChatName] = useState(params.name || 'Chat Room');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msg, setMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message['replyTo'] | null>(null);
  
  // Note Picker
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseForNote, setSelectedCourseForNote] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  // Menu, Report States
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState<'reason' | 'detail' | 'success'>('reason');
  const [selectedReason, setSelectedReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportedMsgId, setReportedMsgId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const REPORT_REASONS = [
    'Bullying or Harassment',
    'Spam',
    'Hate Speech',
    'Academic Dishonesty',
    'Inappropriate Content',
    'Other'
  ];

  // 1. Establish DM or load existing chatId with strict friend/membership security check
  useEffect(() => {
    async function initChatSession() {
      if (!profile) return;
      
      let cid = params.id || params.chatId || null;
      let otherUid = params.otherUid || null;
      let isDM = params.isGroup !== 'true';

      setLoading(true);

      // If DM started via user profile view Lookup / Deep link:
      if (!cid && otherUid) {
        try {
          const chatsRef = collection(db, 'chats');
          const q = query(chatsRef, where('uids', 'array-contains', profile.uid));
          const snap = await getDocs(q);
          
          const existingChat = snap.docs.find(doc => {
            const data = doc.data();
            return data.type === 'dm' && data.uids?.includes(otherUid);
          });

          if (existingChat) {
            cid = existingChat.id;
          } else {
            // Verify friendship exists before creating a brand new DM chat
            const fQuery = query(collection(db, 'friendships'), where('uids', 'array-contains', profile.uid));
            const fSnap = await getDocs(fQuery);
            const isFriend = fSnap.docs.some(d => (d.data().uids || []).includes(otherUid));

            if (!isFriend) {
              Alert.alert(
                'Access Restricted',
                'Chatting is only available between two friends or study group members.',
                [{ text: 'Return', onPress: () => router.replace('/social') }]
              );
              setLoading(false);
              return;
            }

            // Create a brand new DM chat since they are verified friends!
            const newChat = await addDoc(collection(db, 'chats'), {
              type: 'dm',
              uids: [profile.uid, otherUid],
              lastMessage: 'Chat started',
              lastSenderId: profile.uid,
              lastUpdatedAt: new Date().toISOString()
            });
            cid = newChat.id;
          }
        } catch (e) {
          console.error("Failed to lookup/create DM session:", e);
        }
      }

      // If we have a roomId already, let's inspect the chat document for restrictions
      if (cid) {
        try {
          const chatDoc = await getDoc(doc(db, 'chats', cid));
          if (chatDoc.exists()) {
            const chatData = chatDoc.data() as any;
            isDM = chatData.type === 'dm';
            const chatUids = chatData.uids || [];

            if (isDM) {
              const targetUid = chatUids.find((id: string) => id !== profile.uid);
              if (targetUid) {
                // Verify friendship relationship exists in friendships collection
                const fQuery = query(collection(db, 'friendships'), where('uids', 'array-contains', profile.uid));
                const fSnap = await getDocs(fQuery);
                const isFriend = fSnap.docs.some(d => (d.data().uids || []).includes(targetUid));

                if (!isFriend) {
                  Alert.alert(
                    'Access Restricted',
                    'Chatting is only available between two friends or study group members.',
                    [{ text: 'Return', onPress: () => router.replace('/social') }]
                  );
                  setLoading(false);
                  return;
                }
              }
            } else {
              // Group Chat membership check
              if (!chatUids.includes(profile.uid)) {
                Alert.alert(
                  'Access Restricted',
                  'You must be a member of this study group to view or write to this channel.',
                  [{ text: 'Return', onPress: () => router.replace('/social') }]
                );
                setLoading(false);
                return;
              }
            }

            setActiveChatId(cid);

            // Hydrate group or friend name if not passed in params
            if (!params.name) {
              if (isDM) {
                const targetUid = chatUids.find((id: string) => id !== profile.uid);
                if (targetUid) {
                  const targetUserDoc = await getDoc(doc(db, 'users', targetUid));
                  if (targetUserDoc.exists()) {
                    setChatName(targetUserDoc.data().username || targetUserDoc.data().name || 'Classmate');
                  }
                }
              } else {
                setChatName(chatData.name || 'Study Group');
              }
            }
          } else {
            Alert.alert('Error', 'This study thread does not exist.');
            router.replace('/social');
            return;
          }
        } catch (e) {
          console.error("Error loading chat room:", e);
        }
      }

      setLoading(false);
    }

    initChatSession();
  }, [params.id, params.chatId, params.otherUid, params.isGroup, profile]);

  // 2. Setup live message updates
  useEffect(() => {
    if (!activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderUid || data.senderId || '',
          senderName: data.senderName || '',
          text: data.text || '',
          replyTo: data.replyTo || undefined,
          referencedNoteId: data.referencedNoteId || undefined,
          referencedNoteTitle: data.referencedNoteTitle || undefined,
          createdAt: data.createdAt,
        };
      });
      setMessages(list);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 300);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // 3. Load notes list
  useEffect(() => {
    async function loadNotes() {
      try {
        const localCourses = getDownloadedCoursesLocal();
        let list: any[] = [];
        if (localCourses && localCourses.length > 0) {
          localCourses.forEach(c => {
            const dbNotes = getLocalNotes(c.id);
            dbNotes.forEach((n: any) => {
              list.push({ id: n.id, title: n.title, courseId: c.id });
            });
          });
        }
        
        if (!isOffline) {
          try {
            const snapshot = await getDocs(query(collection(db, 'notes')));
            const fbNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (fbNotes.length > 0) {
              list = fbNotes;
            }
          } catch (e) {
            console.log("Error loading cloud notes for reference:", e);
          }
        }
        setAvailableNotes(list);
      } catch (err) {
        console.error("Error loading reference notes list:", err);
      }
    }
    loadNotes();
  }, [isOffline]);

  // Load courses in current semester
  useEffect(() => {
    let active = true;
    async function loadCourses() {
      try {
        const semester = systemConfig?.currentSemester || '1st';
        const localCourses = getDownloadedCoursesLocal();
        if (isOffline && localCourses && localCourses.length > 0) {
          const filteredLocal = await getFilteredCoursesForStudent(localCourses, profile, true, semester);
          if (active) setCourses(filteredLocal);
          return;
        }

        const q = query(collection(db, 'courses'), where('semester', '==', semester));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let finalCourses = list;
        if (list.length === 0) {
          const qAll = query(collection(db, 'courses'));
          const snapAll = await getDocs(qAll);
          const listAll = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
          finalCourses = listAll;
        }
        
        const filtered = await getFilteredCoursesForStudent(finalCourses, profile, true, semester);
        if (active) setCourses(filtered);
      } catch (err) {
        console.error("Error loading courses for reference picker:", err);
        try {
          const localCourses = getDownloadedCoursesLocal();
          if (localCourses && localCourses.length > 0) {
            const semester = systemConfig?.currentSemester || '1st';
            const filteredLocal = await getFilteredCoursesForStudent(localCourses, profile, true, semester);
            if (active) setCourses(filteredLocal);
          }
        } catch (_) {}
      }
    }
    loadCourses();
    return () => { active = false; };
  }, [systemConfig, isOffline, profile]);
  const handleSend = async () => {
    if (!profile || !activeChatId) {
      Alert.alert('Error', 'Thread not established.');
      return;
    }
    const txt = msg.trim();
    if (!txt && !selectedNote) return;

    try {
      const msgPayload: any = {
        senderId: profile.uid,
        senderUid: profile.uid,
        senderName: profile.username || 'Student',
        text: txt,
        createdAt: new Date().toISOString()
      };

      if (replyingTo) {
        msgPayload.replyTo = replyingTo;
      }

      if (selectedNote) {
        msgPayload.referencedNoteId = selectedNote.id;
        msgPayload.referencedNoteTitle = selectedNote.title;
        if (!msgPayload.text) {
          msgPayload.text = `Shared note reference: ${selectedNote.title}`;
        }
      }

      // 1. Add to nested messages subcollection
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), msgPayload);
      
      // 2. Touch parent chat channel for lastMessage timestamp update
      await updateDoc(doc(db, 'chats', activeChatId), {
         lastMessage: msgPayload.text || txt,
         lastSenderId: profile.uid,
         lastUpdatedAt: new Date().toISOString()
      });

      setMsg('');
      setSelectedNote(null);
      setReplyingTo(null);
    } catch (e) {
      console.error("Error sending message:", e);
      Alert.alert('Sending Failed', 'Offline or transaction failed. Reconnect internet.');
    }
  };

  const handleMsgLongPress = (item: Message) => {
    Alert.alert(
      'Message Options',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reply (Targeted Reply)', 
          onPress: () => {
            setReplyingTo({
              messageId: item.id,
              text: item.text,
              senderName: item.senderName
            });
          }
        },
        { 
          text: 'Report Spam/Harassment', 
          style: 'destructive',
          onPress: () => {
            setReportedMsgId(item.id);
            setReportOpen(true);
            setReportStep('reason');
          }
        }
      ]
    );
  };

  const handleReportSubmit = async () => {
    if (!profile || !selectedReason) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterUid: profile.uid,
        reporterName: profile.username || 'Student',
        chatId: activeChatId,
        messageId: reportedMsgId || '',
        reason: selectedReason,
        detail: reportDetail.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        At: profile.At || 'futo'
      });
      setReportStep('success');
    } catch (e) {
      console.error("Failed to commit report doc:", e);
      Alert.alert('Report Submission Error', 'Could not save report.');
    }
  };

  const handleReferenceSelect = (note: any) => {
    setSelectedNote(note);
    setSelectedCourseForNote(null);
    setNotePickerOpen(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.centerScreen, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.activeText} />
        <Text style={[s.centerText, { color: C.ink }]}>Checking authorization stream...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Note Picker Modal */}
      <Modal visible={notePickerOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: C.surface, minHeight: 450 }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.ink }]}>
                {selectedCourseForNote ? `Select Note (${courses.find(c => c.id === selectedCourseForNote)?.code || 'Course'})` : 'Refer a Note'}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedCourseForNote(null); setNotePickerOpen(false); }}>
                <Text style={[s.modalClose, { color: C.inkLight }]}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            {selectedCourseForNote && (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <TouchableOpacity onPress={() => setSelectedCourseForNote(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: F.bold, color: C.activeText || '#27AE60' }}>← Back to Courses</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {!selectedCourseForNote ? (
                courses.length === 0 ? (
                  <Text style={[s.emptyNotesPicker, { color: C.inkMid, padding: 20, textAlign: 'center' }]}>No active semester courses found.</Text>
                ) : (
                  courses.map(course => (
                    <TouchableOpacity 
                       key={course.id} 
                       style={[s.noteItem, { borderBottomColor: C.border }]}
                       onPress={() => setSelectedCourseForNote(course.id)}
                    >
                       <Text style={[s.noteItemTitle, { color: C.ink }]}>{course.code}</Text>
                       <Text style={[s.noteItemCourse, { color: C.inkMid }]}>{course.title}</Text>
                    </TouchableOpacity>
                  ))
                )
              ) : (
                availableNotes.filter(n => n.courseId && String(n.courseId).toLowerCase() === String(selectedCourseForNote).toLowerCase()).length === 0 ? (
                  <Text style={[s.emptyNotesPicker, { color: C.inkMid, padding: 20, textAlign: 'center' }]}>No academic notes found for this course.</Text>
                ) : (
                  availableNotes.filter(n => n.courseId && String(n.courseId).toLowerCase() === String(selectedCourseForNote).toLowerCase()).map(n => (
                    <TouchableOpacity 
                       key={n.id} 
                       style={[s.noteItem, { borderBottomColor: C.border }]}
                       onPress={() => handleReferenceSelect(n)}
                    >
                       <Text style={[s.noteItemTitle, { color: C.ink }]}>{n.title}</Text>
                       <Text style={[s.noteItemCourse, { color: C.activeText || C.inkMid }]}>Tap to reference note</Text>
                    </TouchableOpacity>
                  ))
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={[s.headerTitle, { color: C.ink }]} numberOfLines={1}>{chatName}</Text>
          <Text style={[s.headerStatus, { color: C.activeText || C.inkMid }]}>{params.isGroup === 'true' ? '🔒 END-TO-END GROUP ALLIANCE' : '🔒 PEER-TO-PEER ENCRYPTED'}</Text>
        </View>
        <View style={s.headerActions}>
           <TouchableOpacity style={s.headerIconBtn} onPress={() => setMenuOpen(true)}>
             <MoreIcon />
           </TouchableOpacity>
        </View>
      </View>

      {/* 3-Dot Options Dropdown */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity 
          style={s.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuOpen(false)}
        >
          <View style={[s.menuContent, { backgroundColor: C.surface, borderColor: C.border }]}>
            {params.isGroup === 'true' && (
              <TouchableOpacity 
                style={[s.menuItem, { borderBottomColor: C.border }]} 
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/add-members');
                }}
              >
                <Text style={[s.menuItemText, { color: C.ink }]}>+ Add Member</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[s.menuItem, { borderBottomColor: C.border }]} 
              onPress={() => {
                setMenuOpen(false);
                setReportedMsgId(null);
                setReportOpen(true);
                setReportStep('reason');
              }}
            >
              <Text style={[s.menuItemText, { color: '#E74C3C' }]}>⚠️ Flag abuse</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Flag / Report Flow */}
      <Modal visible={reportOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: C.surface }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: C.ink }]}>Incident Report</Text>
              <TouchableOpacity onPress={() => setReportOpen(false)}>
                <Text style={[s.modalClose, { color: C.inkLight }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {reportStep === 'reason' && (
              <ScrollView>
                <Text style={[s.reportSub, { color: C.inkMid }]}>Select report factor:</Text>
                {REPORT_REASONS.map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={[s.reasonItem, { borderBottomColor: C.border }]}
                    onPress={() => {
                      setSelectedReason(r);
                      setReportStep('detail');
                    }}
                  >
                    <Text style={[s.reasonText, { color: C.ink }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {reportStep === 'detail' && (
              <View style={{ paddingBottom: 24 }}>
                <Text style={[s.reportSub, { color: C.inkMid }]}>Details & circumstances:</Text>
                <Text style={[s.reportMiniHint, { color: C.activeText || C.inkLight }]}>Category: {selectedReason}</Text>
                <TextInput
                  style={[s.reportInput, { borderColor: C.border, color: C.ink, backgroundColor: C.bgAlt }]}
                  placeholder="Include context or timestamps..."
                  placeholderTextColor={C.inkLight}
                  multiline
                  numberOfLines={4}
                  value={reportDetail}
                  onChangeText={setReportDetail}
                />
                <TouchableOpacity style={[s.reportSubmitBtn, { backgroundColor: C.ink }]} onPress={handleReportSubmit}>
                   <Text style={[s.reportSubmitText, { color: C.bg }]}>Submit Incident Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {reportStep === 'success' && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ fontSize: 44, marginBottom: 12, color: C.activeText || '#27AE60' }}>✓</Text>
                <Text style={[s.successTitle, { color: C.ink }]}>Report Filed</Text>
                <Text style={[s.successMsg, { color: C.inkMid }]}>
                  Your feedback has been appended to CoLearn security filters.
                </Text>
                <TouchableOpacity style={[s.reportSubmitBtn, { backgroundColor: C.ink }]} onPress={() => setReportOpen(false)}>
                   <Text style={[s.reportSubmitText, { color: C.bg }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Messages Scroll Area */}
      <ScrollView 
        ref={scrollRef} 
        style={s.scroll} 
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={s.emptyChatArea}>
            <Text style={[s.emptyChatTitle, { color: C.ink }]}>Conversation Channel Empty</Text>
            <Text style={[s.emptyChatDesc, { color: C.inkMid }]}>Press & hold any incoming chat block to reference replies or toggle safety flags.</Text>
          </View>
        ) : (
          messages.map((item) => {
            const isMe = item.senderId === profile?.uid;
            return (
              <TouchableOpacity 
                key={item.id} 
                style={[s.msgWrapper, isMe && { justifyContent: 'flex-end' }]} 
                onLongPress={() => handleMsgLongPress(item)}
                activeOpacity={0.9}
              >
                {!isMe && (
                  <View style={[s.msgAvatarPlaceholder, { backgroundColor: C.tagBg || C.bgAlt, borderColor: C.border }]}>
                    <Text style={[s.msgAvatarText, { color: C.ink }]}>{item.senderName[0]?.toUpperCase() || 'S'}</Text>
                  </View>
                )}
                <View style={[s.msgContentArea, isMe && { alignItems: 'flex-end' }]}>
                   {!isMe && <Text style={[s.msgSender, { color: C.inkMid }]}>{item.senderName}</Text>}
                   <View style={[s.msgBubble, { backgroundColor: C.surface, borderColor: C.border }, isMe && [s.msgBubbleMe, { backgroundColor: C.ink, borderColor: C.ink }]]}>
                     {item.replyTo && (
                       <View style={[s.replyBar, { borderLeftColor: C.inkLight }, isMe && { borderLeftColor: 'rgba(255,255,255,0.4)' }]}>
                          <Text style={[s.replySender, { color: C.ink }, isMe && { color: 'rgba(255,255,255,0.7)' }]}>@{item.replyTo.senderName}</Text>
                          <Text style={[s.replyText, { color: C.inkMid }, isMe && { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>
                            {item.replyTo.text}
                          </Text>
                       </View>
                     )}
                     
                     <Text style={[s.msgText, { color: C.ink }, isMe && { color: C.bg }]}>{item.text}</Text>
                     <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12, borderTopWidth: 0.5, borderTopColor: isMe ? 'rgba(255,255,255,0.2)' : (C.border || 'rgba(0,0,0,0.1)'), paddingTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                       <Text style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.7)' : C.inkMid }}>
                         {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </Text>
                       <TouchableOpacity 
                         onPress={() => {
                           setReplyingTo({
                             messageId: item.id,
                             text: item.text,
                             senderName: item.senderName
                           });
                         }}
                         style={{ padding: 2 }}
                         activeOpacity={0.7}
                       >
                         <Text style={{ fontSize: 11, fontFamily: F.bold, color: isMe ? '#A3E4D7' : (C.activeText || '#27AE60') }}>Reply</Text>
                       </TouchableOpacity>
                     </View>

                     {item.referencedNoteId && (
                       <TouchableOpacity 
                         style={[s.refCard, { backgroundColor: C.bgAlt, borderColor: C.border }, isMe && s.refCardMe]} 
                         activeOpacity={0.8}
                         onPress={() => router.push({
                           pathname: '/note-viewer',
                           params: { noteId: item.referencedNoteId }
                         })}
                       >
                          <NoteIcon />
                          <View style={s.refInfo}>
                             <Text style={[s.refTitle, { color: C.ink }, isMe && { color: '#fff' }]} numberOfLines={1}>{item.referencedNoteTitle}</Text>
                             <Text style={[s.refSubtitle, { color: C.inkLight }, isMe && { color: 'rgba(255,255,255,0.7)' }]}>Tap to explore note</Text>
                          </View>
                       </TouchableOpacity>
                     )}
                   </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Input Tray */}
      <View style={[s.inputContainer, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        {replyingTo && (
          <View style={[s.replyOverlay, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
            <View style={[s.replyIndicator, { backgroundColor: C.ink }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.replySenderAdmin, { color: C.ink }]}>Replying to @{replyingTo.senderName}</Text>
              <Text style={[s.replyTextAdmin, { color: C.inkMid }]} numberOfLines={1}>{replyingTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={s.replyCloseBtn}>
              <Text style={{ fontSize: 20, color: C.ink }}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        {selectedNote && (
          <View style={[s.replyOverlay, { backgroundColor: C.bgAlt, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.activeText || '#27AE60' }]}>
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={{ fontSize: 10, fontFamily: F.bold, color: C.activeText || '#27AE60' }}>REFERENCING NOTE</Text>
              <Text style={{ fontSize: 13, fontFamily: F.bold, color: C.ink }} numberOfLines={1}>{selectedNote.title}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedNote(null)} style={s.replyCloseBtn}>
              <Text style={{ fontSize: 20, color: C.ink }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[s.inputWrapper, { backgroundColor: C.bgAlt }]}>
            <TextInput 
              style={[s.textInput, { color: C.ink }]}
              placeholder="Type messages..."
              placeholderTextColor={C.inkLight}
              value={msg}
              onChangeText={setMsg}
            />
            <TouchableOpacity 
              style={s.inputIcon} 
              onPress={() => setNotePickerOpen(true)}
            >
              <BookIcon />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[s.sendBtn, { backgroundColor: C.ink }]}
            onPress={() => handleSend()}
          >
            <SendIcon />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { fontSize: 14, fontFamily: F.bold, marginTop: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerTitle: { fontFamily: F.bold, fontSize: 18 },
  headerStatus: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1 },
  headerActions: { flexDirection: 'row' },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  emptyChatArea: { flex: 1, paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  emptyChatTitle: { fontFamily: F.bold, fontSize: 18, marginBottom: 4 },
  emptyChatDesc: { fontFamily: F.medium, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },

  msgWrapper: { flexDirection: 'row', marginBottom: 16 },
  msgAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10, alignSelf: 'flex-end', borderWidth: 1 },
  msgAvatarText: { fontFamily: F.bold, fontSize: 14 },

  msgContentArea: { maxWidth: '80%' },
  msgSender: { fontFamily: F.bold, fontSize: 12, marginBottom: 3, marginLeft: 4 },
  msgBubble: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  msgBubbleMe: { },
  msgText: { fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
  
  replyBar: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
    paddingVertical: 2,
  },
  replySender: { fontFamily: F.bold, fontSize: 11, marginBottom: 1 },
  replyText: { fontFamily: F.medium, fontSize: 12 },

  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  refCardMe: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333',
  },
  refInfo: { flex: 1, marginLeft: 10 },
  refTitle: { fontFamily: F.bold, fontSize: 13 },
  refSubtitle: { fontFamily: F.medium, fontSize: 11 },

  // Input
  inputContainer: {
    borderTopWidth: 1,
    padding: 12,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: 15,
  },
  inputIcon: { padding: 4, marginLeft: 8 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  replyOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  replyIndicator: { width: 4, height: 32, borderRadius: 2, marginRight: 10 },
  replySenderAdmin: { fontFamily: F.bold, fontSize: 12 },
  replyTextAdmin: { fontFamily: F.medium, fontSize: 12 },
  replyCloseBtn: { padding: 4, marginLeft: 8 },

  // Dropdown Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  menuContent: {
    position: 'absolute',
    top: 60,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    width: 180,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  menuItemText: { fontFamily: F.bold, fontSize: 13 },

  // Modal Report
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: F.bold, fontSize: 18 },
  modalClose: { fontFamily: F.bold, fontSize: 14 },
  
  reportSub: { fontFamily: F.bold, fontSize: 14, marginBottom: 12 },
  reportMiniHint: { fontFamily: F.bold, fontSize: 12, marginBottom: 8 },
  reasonItem: { paddingVertical: 14, borderBottomWidth: 1 },
  reasonText: { fontFamily: F.bold, fontSize: 14 },

  reportInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontFamily: F.medium, fontSize: 14, height: 100, textAlignVertical: 'top', marginBottom: 16 },
  reportSubmitBtn: { borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  reportSubmitText: { fontFamily: F.bold, fontSize: 14 },

  successTitle: { fontFamily: F.bold, fontSize: 20, marginBottom: 8, marginTop: 10 },
  successMsg: { fontFamily: F.medium, fontSize: 13, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },

  emptyNotesPicker: { fontFamily: F.medium, fontSize: 13, textAlign: 'center', padding: 32 },
  noteItem: { padding: 14, borderBottomWidth: 1 },
  noteItemTitle: { fontFamily: F.bold, fontSize: 14 },
  noteItemCourse: { fontFamily: F.medium, fontSize: 11, marginTop: 2 },
});
