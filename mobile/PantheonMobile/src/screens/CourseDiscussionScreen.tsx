import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { collection, query, orderBy, limit, onSnapshot, addDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { DiscussionMessage } from '../types';
import { Send } from 'lucide-react-native';

export const CourseDiscussionScreen = ({ route }: any) => {
  const { courseId } = route.params;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);

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

  const handleSend = async () => {
    if (!inputText.trim() || !user) {return;}

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'discussions'), {
        courseId: courseId,
        userId: user.uid,
        username: profile?.username || 'Student',
        userLevel: profile?.level || '1',
        text: text,
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
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
