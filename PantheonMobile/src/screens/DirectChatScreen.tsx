import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { Send, Reply, X, FileText, ChevronRight, Flag, MoreVertical } from 'lucide-react-native';
import { ChatMessage, Note } from '../types';

export const DirectChatScreen = ({ route, navigation }: any) => {
  const { roomId, targetUid, name } = route.params;
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatRoomId, setChatRoomId] = useState(roomId);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isNotePickerVisible, setIsNotePickerVisible] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const initializeChat = async () => {
      let activeRoomId = chatRoomId;

      if (!activeRoomId && targetUid && user) {
        // Find existing DM
        const q = query(collection(db, 'chats'), where('type', '==', 'dm'), where('uids', 'array-contains', user.uid));
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => d.data().uids.includes(targetUid));

        if (existing) {
          activeRoomId = existing.id;
        } else {
          // Create new DM
          const newDoc = await addDoc(collection(db, 'chats'), {
            type: 'dm',
            uids: [user.uid, targetUid],
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            name: name || 'Chat'
          });
          activeRoomId = newDoc.id;
        }
        setChatRoomId(activeRoomId);
      }

      if (activeRoomId) {
        const q = query(
          collection(db, 'chats', activeRoomId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
          setMessages(msgs);
          setLoading(false);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        return unsubscribe;
      } else {
          setLoading(false);
      }
    };

    const unsubPromise = initializeChat();
    return () => {
        unsubPromise.then(unsub => {
            if (typeof unsub === 'function') unsub();
        });
    };
  }, [chatRoomId, targetUid, user]);

  const handleSend = async () => {
    if (!newMessage.trim() || !chatRoomId || !user) return;

    const text = newMessage.trim();
    const currentReply = replyingTo;

    setNewMessage('');
    setReplyingTo(null);

    try {
      const msgData: any = {
        senderUid: user.uid,
        senderName: profile?.username || 'User',
        senderPhotoURL: profile?.photoURL || '',
        text,
        createdAt: new Date().toISOString()
      };

      if (selectedNote) {
        msgData.referencedNoteId = selectedNote.id;
        setSelectedNote(null);
      }

      if (currentReply) {
        msgData.replyTo = {
          messageId: currentReply.id,
          text: currentReply.text,
          senderName: currentReply.senderName
        };
      }

      await addDoc(collection(db, 'chats', chatRoomId, 'messages'), msgData);

      await updateDoc(doc(db, 'chats', chatRoomId), {
        lastMessage: text,
        lastUpdatedAt: new Date().toISOString()
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || !user || !chatRoomId) return;
    try {
        await addDoc(collection(db, 'reports'), {
            reporterId: user.uid,
            chatId: chatRoomId,
            reason: reportReason,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        setIsReportModalVisible(false);
        setReportReason('');
        Alert.alert('Success', 'Report submitted to moderators.');
    } catch (e) {
        Alert.alert('Error', 'Failed to submit report');
    }
  };

  const fetchNotes = async () => {
    try {
      const q = query(collection(db, 'notes'), limit(20));
      const snap = await getDocs(q);
      setAvailableNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
    } catch (e) {
      console.error(e);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderUid === user?.uid;

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMe && <DicebearAvatar seed={item.senderName || item.senderUid} size={32} />}
        <View style={styles.messageContent}>
          <TouchableOpacity
            onLongPress={() => setReplyingTo(item)}
            style={[
              styles.messageBubble,
              isMe ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              isMe ? styles.myBubble : styles.otherBubble
            ]}
          >
            {item.replyTo && (
              <View style={[styles.replyPreview, { backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : colors.muted }]}>
                <Text style={[styles.replyName, { color: isMe ? colors.primaryForeground : colors.primary }]}>{item.replyTo.senderName}</Text>
                <Text numberOfLines={1} style={[styles.replyText, { color: isMe ? colors.primaryForeground : colors.mutedForeground }]}>{item.replyTo.text}</Text>
              </View>
            )}
            {item.referencedNoteId && (
              <TouchableOpacity
                style={[styles.noteRef, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : colors.muted }]}
                onPress={async () => {
                    const noteDoc = await getDoc(doc(db, 'notes', item.referencedNoteId!));
                    if (noteDoc.exists()) {
                        navigation.navigate('NoteDetail', { note: { id: noteDoc.id, ...noteDoc.data() } });
                    } else {
                        Alert.alert('Error', 'Note not found');
                    }
                }}
              >
                <FileText size={16} color={isMe ? colors.primaryForeground : colors.primary} />
                <Text style={[styles.noteRefText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>Shared Note</Text>
                <ChevronRight size={14} color={isMe ? colors.primaryForeground : colors.mutedForeground} />
              </TouchableOpacity>
            )}
            <Text style={[styles.messageText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>
              {item.text}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.timeText, { color: colors.mutedForeground }, isMe && { textAlign: 'right' }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{name || 'Chat'}</Text>
          <TouchableOpacity onPress={() => setIsReportModalVisible(true)}>
              <Flag size={20} color={colors.destructive} />
          </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputWrapper, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {replyingTo && (
          <View style={[styles.replyArea, { backgroundColor: colors.muted }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyToLabel, { color: colors.primary }]}>Replying to {replyingTo.senderName}</Text>
              <Text numberOfLines={1} style={[styles.replyToText, { color: colors.mutedForeground }]}>{replyingTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {selectedNote && (
          <View style={[styles.notePreview, { backgroundColor: colors.muted }]}>
             <FileText size={16} color={colors.primary} />
             <Text numberOfLines={1} style={[styles.notePreviewText, { color: colors.foreground }]}>Referencing: {selectedNote.title}</Text>
             <TouchableOpacity onPress={() => setSelectedNote(null)}>
                <X size={16} color={colors.mutedForeground} />
             </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.attachBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
                fetchNotes();
                setIsNotePickerVisible(true);
            }}
          >
             <FileText size={20} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isNotePickerVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reference a Note</Text>
                    <TouchableOpacity onPress={() => setIsNotePickerVisible(false)}>
                        <X size={24} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={availableNotes}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.noteItemPicker, { borderBottomColor: colors.border }]}
                            onPress={() => {
                                setSelectedNote(item);
                                setIsNotePickerVisible(false);
                            }}
                        >
                            <FileText size={20} color={colors.primary} />
                            <Text style={[styles.noteItemText, { color: colors.foreground }]}>{item.title}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
                  />
              </View>
          </View>
      </Modal>

      <Modal visible={isReportModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report Chat</Text>
                  <TextInput
                    style={[styles.reportInput, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder="Reason for report..."
                    placeholderTextColor={colors.mutedForeground}
                    value={reportReason}
                    onChangeText={setReportReason}
                    multiline
                  />
                  <View style={styles.modalButtons}>
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setIsReportModalVisible(false)}>
                          <Text style={{ color: colors.foreground }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.destructive }]} onPress={handleReport}>
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit Report</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  myMessageRow: {
    alignSelf: 'flex-end',
  },
  otherMessageRow: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    marginLeft: 8,
    marginRight: 8,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    borderTopRightRadius: 4,
  },
  otherBubble: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  inputWrapper: {
    padding: 12,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyToLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  replyToText: {
    fontSize: 12,
  },
  replyPreview: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(0,0,0,0.2)',
  },
  replyName: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  replyText: {
    fontSize: 11,
  },
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
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 32,
  },
  modalContent: {
      padding: 24,
      borderRadius: 16,
  },
  modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
  },
  reportInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      height: 100,
      textAlignVertical: 'top',
      marginBottom: 16,
  },
  modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
  },
  modalBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
  }
});
