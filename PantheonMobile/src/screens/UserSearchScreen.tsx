import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { Search, UserPlus } from 'lucide-react-native';
import { UserProfile } from '../types';

export const UserSearchScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const qId = query(collection(db, 'users'), where('studentId', '==', searchTerm.trim()));
      const qUsername = query(collection(db, 'users'), where('username', '==', searchTerm.trim()));

      const [idSnap, userSnap] = await Promise.all([getDocs(qId), getDocs(qUsername)]);

      const foundUsers: UserProfile[] = [];
      idSnap.forEach(d => foundUsers.push(d.data() as UserProfile));
      userSnap.forEach(d => {
        if (!foundUsers.find(u => u.uid === d.id)) {
          foundUsers.push(d.data() as UserProfile);
        }
      });

      setResults(foundUsers.filter(u => u.uid !== user?.uid));
    } catch (error) {
      Alert.alert('Error', 'Failed to search for users');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUser: UserProfile) => {
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', user?.uid),
        where('toUid', '==', targetUser.uid),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        Alert.alert('Info', 'Request already sent');
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user?.uid,
        toUid: targetUser.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Friend request sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send request');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.searchContainer, { backgroundColor: colors.muted }]}>
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Search by Username or Student ID"
            placeholderTextColor={colors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={handleSearch}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Search</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultItem, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate('PublicProfile', { userId: item.uid })}
            >
              <DicebearAvatar seed={item.username || item.uid} />
              <View style={styles.resultInfo}>
                <Text style={[styles.username, { color: colors.foreground }]}>{item.username}</Text>
                <Text style={[styles.studentId, { color: colors.mutedForeground }]}>ID: {item.studentId}</Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => sendFriendRequest(item)}
              >
                <UserPlus size={18} color={colors.primaryForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchTerm && !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found.</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
  },
  loader: {
    marginTop: 32,
  },
  list: {
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentId: {
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    marginTop: 64,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
