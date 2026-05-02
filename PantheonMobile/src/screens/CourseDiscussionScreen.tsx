import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { collection, query, orderBy, limit, onSnapshot, addDoc, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { DiscussionMessage, Note } from '../types';
import { Send, FileText, ChevronRight, X } from 'lucide-react-native';

export const CourseDiscussionScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNotePickerVisible, setIsNotePickerVisible] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'discussions'),
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as any));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId]);

  const fetchNotes = async () => {
    try {
      const q = query(collection(db, 'notes'), where('courseId', '==', courseId), limit(20));
      const snap = await getDocs(q);
      setAvailableNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user) {return;}

    const text = inputText.trim();
    const noteId = selectedNote?.id;
    setInputText('');
    setSelectedNote(null);

    try {
      await addDoc(collection(db, 'discussions'), {
        courseId: courseId,
        userId: user.uid,
        username: profile?.username || 'Student',
        userLevel: profile?.level || '1',
        text: text,
        referencedNoteId: noteId || null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageWrapper,
            item.userId === user?.uid ? styles.myMessageWrapper : styles.otherMessageWrapper,
          ]}>
            <View style={[
              styles.messageBubble,
              item.userId === user?.uid ? styles.myBubble : styles.otherBubble,
            ]}>
              <View style={styles.senderInfo}>
                <Text style={styles.senderName}>{item.username}</Text>
                <Text style={styles.senderLevel}>L{item.userLevel}</Text>
              </View>
              {item.referencedNoteId && (
                <TouchableOpacity
                  style={[styles.noteRef, { backgroundColor: item.userId === user?.uid ? 'rgba(255,255,255,0.1)' : theme.colors.muted }]}
                  onPress={async () => {
                      const noteDoc = await getDoc(doc(db, 'notes', item.referencedNoteId!));
                      if (noteDoc.exists()) {
                          navigation.navigate('NoteDetail', { note: { id: noteDoc.id, ...noteDoc.data() } });
                      } else {
                          Alert.alert('Error', 'Note not found');
                      }
                  }}
                >
                  <FileText size={16} color={item.userId === user?.uid ? theme.colors.primaryForeground : theme.colors.primary} />
                  <Text style={[styles.noteRefText, { color: item.userId === user?.uid ? theme.colors.primaryForeground : theme.colors.foreground }]}>Shared Note</Text>
                  <ChevronRight size={14} color={item.userId === user?.uid ? theme.colors.primaryForeground : theme.colors.mutedForeground} />
                </TouchableOpacity>
              )}
              <Text style={[
                styles.messageText,
                item.userId === user?.uid ? styles.myMessageText : styles.otherMessageText,
              ]}>{item.text}</Text>
            </View>
          </View>
        )}
        inverted
        contentContainerStyle={styles.list}
      />

      <View style={styles.inputContainer}>
        {selectedNote && (
          <View style={[styles.notePreview, { backgroundColor: theme.colors.muted }]}>
             <FileText size={16} color={theme.colors.primary} />
             <Text numberOfLines={1} style={[styles.notePreviewText, { color: theme.colors.foreground }]}>Referencing: {selectedNote.title}</Text>
             <TouchableOpacity onPress={() => setSelectedNote(null)}>
                <X size={16} color={theme.colors.mutedForeground} />
             </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TouchableOpacity
            style={[styles.attachBtn, { backgroundColor: theme.colors.muted }]}
            onPress={() => {
                fetchNotes();
                setIsNotePickerVisible(true);
            }}
          >
             <FileText size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TextInput
          style={styles.input}
          placeholder="Message group..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send size={20} color={theme.colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isNotePickerVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.colors.foreground }]}>Reference a Note</Text>
                    <TouchableOpacity onPress={() => setIsNotePickerVisible(false)}>
                        <X size={24} color={theme.colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={availableNotes}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.noteItemPicker, { borderBottomColor: theme.colors.border }]}
                            onPress={() => {
                                setSelectedNote(item);
                                setIsNotePickerVisible(false);
                            }}
                        >
                            <FileText size={20} color={theme.colors.primary} />
                            <Text style={[styles.noteItemText, { color: theme.colors.foreground }]}>{item.title}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />}
                  />
              </View>
          </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  noteRef: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  noteRefText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  notePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  notePreviewText: {
    flex: 1,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  noteItemPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  noteItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: theme.spacing.md,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  myBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: theme.colors.muted,
    borderBottomLeftRadius: 4,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.mutedForeground,
  },
  senderLevel: {
    fontSize: 10,
    color: theme.colors.mutedForeground,
    backgroundColor: theme.colors.border,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  messageText: {
    fontSize: 15,
  },
  myMessageText: {
    color: theme.colors.primaryForeground,
  },
  otherMessageText: {
    color: theme.colors.foreground,
  },
  inputContainer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
