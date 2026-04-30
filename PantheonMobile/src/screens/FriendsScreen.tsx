import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { UserPlus, UserMinus, MessageSquare, Search, UserCheck, Clock, Users } from 'lucide-react-native';
import { UserProfile } from '../types';

export const FriendsScreen = ({ navigation }: any) => {
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen for friend requests
    const qRequests = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, async (snapshot) => {
      const requestData = [];
      for (const d of snapshot.docs) {
          const data = d.data();
          const fromUserDoc = await getDoc(doc(db, 'users', data.fromUid));
          requestData.push({ id: d.id, ...data, fromUser: fromUserDoc.data() });
      }
      setRequests(requestData);
    });

    // Listen for friendships
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsubFriends = onSnapshot(qFriends, async (snapshot) => {
      const friendProfiles: UserProfile[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const friendUid = data.uids.find((uid: string) => uid !== user.uid);
        const friendDoc = await getDoc(doc(db, 'users', friendUid));
        if (friendDoc.exists()) {
          friendProfiles.push(friendDoc.data() as UserProfile);
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
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' });
      await addDoc(collection(db, 'friendships'), {
        uids: [user?.uid, request.fromUid],
        createdAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
    } catch (error) {
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const removeFriend = async (friendUid: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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

      <ScrollView>
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pending Requests ({requests.length})</Text>
            {requests.map(req => (
              <View key={req.id} style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <DicebearAvatar seed={req.fromUser?.username || req.fromUid} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.username, { color: colors.foreground }]}>{req.fromUser?.username}</Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sent you a request</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => acceptRequest(req)} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                    <UserCheck size={18} color={colors.primaryForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => rejectRequest(req.id)} style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                    <UserMinus size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Friends ({friends.length})</Text>
          <FlatList
            data={friends}
            keyExtractor={item => item.uid}
            scrollEnabled={false}
            renderItem={({ item }) => (
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
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Users size={48} color={colors.mutedForeground} opacity={0.3} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>You haven't added any friends yet.</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
};

import { deleteDoc } from 'firebase/firestore';

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
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
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
