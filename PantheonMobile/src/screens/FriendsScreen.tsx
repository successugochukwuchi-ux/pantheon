import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { UserPlus, UserMinus, MessageSquare, Search, UserCheck, X } from 'lucide-react-native';
import { UserProfile } from '../types';

export const FriendsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    if (!user) return;

    // Listen for friend requests
    const qRequests = query(collection(db, 'friend_requests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, async (snapshot) => {
      const requestData = [];
      for (const d of snapshot.docs) {
          const data = d.data();
          const fromUserDoc = await getDoc(doc(db, 'users', data.fromUid));
          if (fromUserDoc.exists()) {
            requestData.push({ id: d.id, ...data, fromUser: fromUserDoc.data() });
          }
      }
      setRequests(requestData);
    }, (error: any) => {
      console.error('[FR_LIST_ERR]', error);
    });

    // Listen for friendships
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsubFriends = onSnapshot(qFriends, async (snapshot) => {
      const friendProfiles: UserProfile[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const friendUid = data.uids.find((uid: string) => uid !== user.uid);
        if (friendUid) {
            const friendDoc = await getDoc(doc(db, 'users', friendUid));
            if (friendDoc.exists()) {
              friendProfiles.push(friendDoc.data() as UserProfile);
            }
        }
      }
      setFriends(friendProfiles);
      setLoading(false);
    });

    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [user]);

  const acceptRequest = async (request: any) => {
    try {
      await addDoc(collection(db, 'friendships'), {
        uids: [user?.uid, request.fromUid],
        createdAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, 'friend_requests', request.id));
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error: any) {
      console.error('[FR_ACCEPT_ERR]', error);
      const errorCode = error.code || 'UNKNOWN';
      Alert.alert('Error', `Failed to accept request. (Code: ${errorCode})`);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
    } catch (error: any) {
      console.error('[FR_REJECT_ERR]', error);
      const errorCode = error.code || 'UNKNOWN';
      Alert.alert('Error', `Failed to reject request. (Code: ${errorCode})`);
    }
  };

  const removeFriend = async (friendUid: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to unfriend this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            const q = query(collection(db, 'friendships'), where('uids', 'array-contains', user?.uid));
            const snapshot = await getDocs(q);
            const friendshipDoc = snapshot.docs.find(d => d.data().uids.includes(friendUid));
            if (friendshipDoc) {
              await deleteDoc(doc(db, 'friendships', friendshipDoc.id));
              Alert.alert('Success', 'Friend removed');
            }
          }
        }
      ]
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.muted }]}
          onPress={() => navigation.navigate('UserSearch')}
        >
          <Search size={20} color={colors.mutedForeground} />
          <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Search for new friends...</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('friends')}
          >
              <Text style={[styles.tabText, { color: activeTab === 'friends' ? colors.primary : colors.mutedForeground }]}>Friends ({friends.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('requests')}
          >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.tabText, { color: activeTab === 'requests' ? colors.primary : colors.mutedForeground }]}>Requests</Text>
                {requests.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
                        <Text style={styles.badgeText}>{requests.length}</Text>
                    </View>
                )}
              </View>
          </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'friends' ? friends : requests}
        keyExtractor={item => item.id || item.uid}
        renderItem={({ item }) => {
            if (activeTab === 'friends') {
                return (
                    <TouchableOpacity
                        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('PublicProfile', { userId: item.uid })}
                    >
                        <DicebearAvatar seed={item.username || item.uid} />
                        <View style={styles.itemInfo}>
                            <Text style={[styles.username, { color: colors.foreground }]}>{item.username}</Text>
                            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Level {item.academicLevel || item.level}</Text>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('DirectChat', { roomId: null, targetUid: item.uid, name: item.username })}
                                style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                            >
                                <MessageSquare size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeFriend(item.uid)} style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                                <UserMinus size={18} color={colors.destructive} />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                );
            } else {
                return (
                    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <DicebearAvatar seed={item.fromUser?.username || item.fromUid} />
                        <View style={styles.itemInfo}>
                            <Text style={[styles.username, { color: colors.foreground }]}>{item.fromUser?.username}</Text>
                            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Wants to be friends</Text>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={() => acceptRequest(item)} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                                <UserCheck size={18} color={colors.primaryForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => rejectRequest(item.id)} style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                                <X size={18} color={colors.destructive} />
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            }
        }}
        ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    {activeTab === 'friends' ? "You haven't added any friends yet." : "No pending friend requests."}
                </Text>
            </View>
        }
        contentContainerStyle={styles.list}
      />
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
  header: {
    padding: 16,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchText: {
    fontSize: 14,
  },
  tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
  },
  tabText: {
      fontWeight: 'bold',
      fontSize: 14,
  },
  badge: {
      paddingHorizontal: 6,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
  },
  badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
  },
});
