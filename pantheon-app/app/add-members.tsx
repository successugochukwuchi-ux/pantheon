import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function UserCircleIcon() {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.ink, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink, marginBottom: 1 }} />
      <View style={{ width: 16, height: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.5, borderColor: C.ink, borderBottomWidth: 0 }} />
    </View>
  );
}

function SearchIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#8E8E8E' }} />
      <View style={{ position: 'absolute', right: 4, bottom: 4, width: 6, height: 2, backgroundColor: '#8E8E8E', borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function ArrowRightIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
      <View style={{ width: 14, height: 2, backgroundColor: '#fff', borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: 2, width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#fff', transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function AddMemberIcon() {
  return (
    <View style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: '#8E8E8E', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 1.5, backgroundColor: '#8E8E8E', borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 1.5, height: 10, backgroundColor: '#8E8E8E', borderRadius: 1 }} />
    </View>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

interface Friend {
  id: string;
  name: string;
  level: string;
  dept: string;
  avatar: string;
}

const FRIENDS: Friend[] = [
  { id: '1', name: 'Felix Nwankwo', level: 'LEVEL 300', dept: 'ENG 301', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop' },
  { id: '2', name: 'Amara Chidi', level: 'LEVEL 100', dept: 'CSC 101', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop' },
  { id: '3', name: 'Uche Okoro', level: 'LEVEL 400', dept: 'EEE 405', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop' },
  { id: '4', name: 'Blessing Obi', level: 'LEVEL 200', dept: 'MTH 201', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=100&auto=format&fit=crop' },
];

function FriendItem({ friend, onAdd, isAdded }: { friend: Friend; onAdd: () => void; isAdded: boolean }) {
  return (
    <View style={s.friendCard}>
      <Image source={{ uri: friend.avatar }} style={s.avatar} />
      <View style={s.friendInfo}>
        <Text style={s.friendName}>{friend.name}</Text>
        <Text style={s.friendSub}>{friend.level} • {friend.dept}</Text>
      </View>
      <TouchableOpacity 
        style={[s.addBtn, isAdded && s.addBtnAdded]} 
        onPress={onAdd}
        activeOpacity={0.7}
      >
        <Text style={[s.addBtnText, isAdded && s.addBtnTextAdded]}>
          {isAdded ? 'ADDED' : 'ADD'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AddMembersScreen() {
  const router = useRouter();
  const { groupName } = useLocalSearchParams();
  const [selected, setSelected] = useState<Friend[]>([]);
  const [search, setSearch] = useState('');

  const toggleFriend = (friend: Friend) => {
    if (selected.find(f => f.id === friend.id)) {
      setSelected(prev => prev.filter(f => f.id !== friend.id));
    } else if (selected.length < 10) {
      setSelected(prev => [...prev, friend]);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIcon}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.logoText}>PANTHEON</Text>
        <TouchableOpacity style={s.headerIcon}>
          <UserCircleIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Add Members</Text>
        <Text style={s.pageSub}>Create your PANTHEON circle by inviting peers.</Text>

        <View style={s.searchContainer}>
          <SearchIcon />
          <TextInput
            style={s.searchInput}
            placeholder="Find friends by name or UID..."
            placeholderTextColor="#8E8E8E"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Suggested Friends</Text>
          <View style={s.onlineBadge}>
            <Text style={s.onlineText}>8 ONLINE</Text>
          </View>
        </View>

        {FRIENDS.map(friend => (
          <FriendItem 
            key={friend.id} 
            friend={friend} 
            isAdded={!!selected.find(f => f.id === friend.id)}
            onAdd={() => toggleFriend(friend)}
          />
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Selected Members Footer */}
      <View style={s.footer}>
        <Text style={s.selectedCount}>SELECTED ({selected.length}/10)</Text>
        <View style={s.selectedAvatars}>
          {selected.map(f => (
            <View key={f.id} style={s.selectedAvatarWrapper}>
              <Image source={{ uri: f.avatar }} style={s.selectedAvatar} />
              <TouchableOpacity style={s.removeBtn} onPress={() => toggleFriend(f)}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addMorePlaceholder}>
            <AddMemberIcon />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[s.createBtn, selected.length === 0 && { opacity: 0.5 }]}
          disabled={selected.length === 0}
          onPress={() => router.replace('/social')}
        >
          <Text style={s.createBtnText}>Create Group</Text>
          <ArrowRightIcon />
        </TouchableOpacity>
      </View>

      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE5',
  },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: F.bold, fontSize: 24, letterSpacing: -1, color: '#000' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  pageTitle: { fontFamily: F.bold, fontSize: 32, color: C.ink, marginBottom: 8 },
  pageSub: { fontFamily: F.medium, fontSize: 16, color: C.inkMid, marginBottom: 24, lineHeight: 22 },

  searchContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0CEC4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 32,
  },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: F.medium, fontSize: 16, color: C.ink },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: F.bold, fontSize: 24, color: C.ink },
  onlineBadge: { backgroundColor: '#E5E4DE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  onlineText: { fontFamily: F.bold, fontSize: 11, color: '#8E8E8E', letterSpacing: 0.5 },

  friendCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  friendInfo: { flex: 1 },
  friendName: { fontFamily: F.bold, fontSize: 17, color: C.ink, marginBottom: 2 },
  friendSub: { fontFamily: F.bold, fontSize: 12, color: '#8E8E8E' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnAdded: { backgroundColor: '#000' },
  addBtnText: { fontFamily: F.bold, fontSize: 12, color: '#000' },
  addBtnTextAdded: { color: '#fff' },

  footer: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0EEE5',
  },
  selectedCount: { fontFamily: F.bold, fontSize: 11, color: '#8E8E8E', letterSpacing: 0.5, marginBottom: 10 },
  selectedAvatars: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  selectedAvatarWrapper: { position: 'relative' },
  selectedAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#000' },
  removeBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D0CEC4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
});
