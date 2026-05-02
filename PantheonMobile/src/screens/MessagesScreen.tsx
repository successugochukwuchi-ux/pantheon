import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { collection, query, where, onSnapshot, orderBy, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ChatRoom, UserProfile } from '../types';
import { User, ChevronRight, Plus, Users, Check, X, MessageSquare } from 'lucide-react-native';
import { DicebearAvatar } from '../components/DicebearAvatar';

export const MessagesScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [rooms, setRooms] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('uids', 'array-contains', user.uid),
      orderBy('lastUpdatedAt', 'desc')
    );

    const unsubChats = onSnapshot(q, async (snapshot) => {
      const roomItems = [];
      for (const d of snapshot.docs) {
          const data = d.data() as ChatRoom;
          let displayName = data.name;
          let displayAvatar = null;

          if (data.type === 'dm') {
              const friendUid = data.uids.find(id => id !== user.uid);
              if (friendUid) {
                  const friendDoc = await getDoc(doc(db, 'users', friendUid));
                  if (friendDoc.exists()) {
                      const friendData = friendDoc.data() as UserProfile;
                      displayName = friendData.username;
                      displayAvatar = friendData.username || friendUid;
                  }
              }
          }
          roomItems.push({ id: d.id, ...data, displayName, displayAvatar });
      }
      setRooms(roomItems);
    }, (error) => {
      console.error('Error fetching chat rooms:', error);
    });

    // Fetch Course Discussions
    const fetchDiscussions = async () => {
        try {
            const qCourses = query(collection(db, 'courses'));
            const courseSnap = await getDocs(qCourses);
            const userCourses = courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setDiscussions(userCourses.map(c => ({
                id: c.id,
                type: 'discussion',
                name: `${c.code} Discussion`,
                code: c.code
            })));
        } catch (e) {
            console.error('Error fetching discussions:', e);
        } finally {
            setLoading(false);
        }
    };

    fetchDiscussions();

    return () => unsubChats();
  }, [user]);

  const fetchFriends = async () => {
    if (!user) return;
    const q = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsub = onSnapshot(q, async (snapshot) => {
        const friendList: UserProfile[] = [];
        for (const d of snapshot.docs) {
            const friendUid = d.data().uids.find((id: string) => id !== user.uid);
            const friendDoc = await getDoc(doc(db, 'users', friendUid));
            if (friendDoc.exists()) {
                friendList.push(friendDoc.data() as UserProfile);
            }
        }
        setFriends(friendList);
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0 || !user) {
      Alert.alert('Error', 'Please enter a group name and select at least one friend.');
      return;
    }

    try {
      const newRoom = await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: groupName.trim(),
        uids: [user.uid, ...selectedFriends],
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        lastMessage: 'Group created'
      });
      setIsModalVisible(false);
      setGroupName('');
      setSelectedFriends([]);
      navigation.navigate('DirectChat', { roomId: newRoom.id, name: groupName.trim() });
    } catch (error) {
      Alert.alert('Error', 'Failed to create group chat');
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriends(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const allConversations = [...rooms, ...discussions].sort((a, b) => {
      const timeA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
      const timeB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
      return timeB - timeA;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerActions}>
        <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
                fetchFriends();
                setIsModalVisible(true);
            }}
        >
            <Plus size={20} color={colors.primaryForeground} />
            <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>New Group</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={allConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.roomItem, { borderBottomColor: colors.border }]}
            onPress={() => {
                if (item.type === 'discussion') {
                    navigation.navigate('CourseDiscussion', { courseId: item.id, courseCode: item.code });
                } else {
                    navigation.navigate('DirectChat', { roomId: item.id, name: item.displayName || item.name || 'Chat' });
                }
            }}
          >
            <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
              {item.type === 'dm' ? (
                  item.displayAvatar ? <DicebearAvatar seed={item.displayAvatar} size={50} /> : <User size={24} color={colors.mutedForeground} />
              ) : item.type === 'group' ? (
                  <Users size={24} color={colors.primary} />
              ) : (
                  <MessageSquare size={24} color={colors.primary} />
              )}
            </View>
            <View style={styles.roomContent}>
              <View style={styles.roomHeader}>
                <Text style={[styles.roomName, { color: colors.foreground }]}>{item.displayName || item.name || 'Conversation'}</Text>
                <Text style={[styles.roomTime, { color: colors.mutedForeground }]}>
                  {item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleDateString() : ''}
                </Text>
              </View>
              <Text style={[styles.lastMessage, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.type === 'discussion' ? `Join ${item.code} study group discussion` : (item.lastMessage || 'No messages yet')}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.border} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.foreground }]}>No messages yet.</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Your conversations will appear here.</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Study Group</Text>
                    <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                        <X size={24} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder="Group Name (e.g. PHY 101 Study Group)"
                    placeholderTextColor={colors.mutedForeground}
                    value={groupName}
                    onChangeText={setGroupName}
                />

                <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>Select Friends</Text>
                <FlatList
                    data={friends}
                    keyExtractor={item => item.uid}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.friendItem, { borderBottomColor: colors.border }]}
                            onPress={() => toggleFriend(item.uid)}
                        >
                            <DicebearAvatar seed={item.username || item.uid} size={32} />
                            <Text style={[styles.friendName, { color: colors.foreground }]}>{item.username}</Text>
                            <View style={[
                                styles.checkbox,
                                { borderColor: colors.primary },
                                selectedFriends.includes(item.uid) && { backgroundColor: colors.primary }
                            ]}>
                                {selectedFriends.includes(item.uid) && <Check size={12} color={colors.primaryForeground} />}
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: colors.mutedForeground }}>No friends found.</Text>}
                    style={{ maxHeight: 300 }}
                />

                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                    onPress={handleCreateGroup}
                >
                    <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Create Group</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
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
  headerActions: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  createBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  list: {
    flexGrow: 1,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  roomContent: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  roomTime: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
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
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  friendName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
