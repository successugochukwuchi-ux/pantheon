import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { C, F } from '../components/Theme';

interface Message {
  id: string;
  userId: string;
  username: string;
  text: string;
  userLevel: string;
  createdAt: string;
  referencedNoteId?: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

export default function CourseDiscussionScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { profile } = useAuth();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const scrollRef = useRef<ScrollView>(null);

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
    if (!text.trim() || !profile || !courseId) return;
    
    setSending(true);
    const msgData = {
      courseId,
      userId: profile.uid,
      username: profile.username || 'Student',
      userLevel: profile.level || '1',
      userAcademicLevel: profile.academicLevel || '100',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      setText('');
      await addDoc(collection(db, 'discussions'), msgData);
    } catch (e) {
      console.error("Error sending message:", e);
      setText(msgData.text); // Restore text if failed
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.ink} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.backBtn}>
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <View style={s.headerMeta}>
          <Text style={s.headerTitle}>{course?.code || 'Chat'}</Text>
          <Text style={s.headerSub}>{course?.title || 'Course Discussion'}</Text>
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
              <Text style={s.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const myMsg = msg.userId === profile?.uid;
              const isAdmin = msg.userLevel === '3' || msg.userLevel === '4';
              
              return (
                <View key={msg.id} style={[s.bubbleRow, myMsg ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  {!myMsg && (
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{msg.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[s.bubble, myMsg ? s.bubbleMe : s.bubbleThem]}>
                    <View style={s.bubbleHeader}>
                      <Text style={[s.bubbleName, myMsg ? { color: 'rgba(255,255,255,0.7)' } : { color: C.inkLight }]}>
                        {msg.username}
                      </Text>
                      {isAdmin && (
                        <View style={s.adminBadge}>
                          <Text style={s.adminBadgeText}>MOD</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.bubbleText, myMsg ? { color: '#fff' } : { color: C.ink }]}>
                      {msg.text}
                    </Text>
                    <Text style={[s.bubbleTime, myMsg ? { color: 'rgba(255,255,255,0.4)' } : { color: C.inkLight }]}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor={C.inkLight}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity 
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={!text.trim() || sending}
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

const s = StyleSheet.create({
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
  headerTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  headerSub: { fontFamily: F.medium, fontSize: 11, color: C.inkLight, textTransform: 'uppercase' },
  
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  backArrowHead: {
    position: 'absolute', left: 14, width: 9, height: 9,
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink,
    transform: [{ rotate: '45deg' }],
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  bubbleRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: F.bold, fontSize: 12, color: C.inkMid },
  
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
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  bubbleName: { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.5 },
  adminBadge: { backgroundColor: C.gold, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  adminBadgeText: { fontSize: 8, fontFamily: F.bold, color: '#fff' },
  bubbleText: { fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontFamily: F.medium, fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },

  empty: { paddingVertical: 100, alignItems: 'center' },
  emptyText: { fontFamily: F.medium, fontSize: 14, color: C.inkLight },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, marginTop: -2 },
});
