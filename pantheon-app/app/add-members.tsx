import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { collection, query, limit, getDocs, addDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function SearchIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.8, borderColor: C.inkLight }} />
      <View style={{ position: 'absolute', right: 3, bottom: 3, width: 6, height: 2, backgroundColor: C.inkLight, borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function ArrowRightIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.bg, borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: 2, width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.bg, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function AddMemberIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, borderWidth: 1.5, borderColor: C.inkLight, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 1.5, backgroundColor: C.inkLight, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 1.5, height: 10, backgroundColor: C.inkLight, borderRadius: 1 }} />
    </View>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

interface Student {
  id: string;
  username: string;
  photoURL?: string;
  department?: string;
  academicLevel?: string;
  At?: string;
}

function FriendItem({ student, onAdd, isAdded, styles }: { student: Student; onAdd: () => void; isAdded: boolean; styles: any }) {
  const { colors: C } = useTheme();
  return (
    <View style={[styles.friendCard, { backgroundColor: C.surface, borderColor: C.border }]}>
      {student.photoURL ? (
        <Image source={{ uri: student.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
          <Text style={{ fontSize: 18, opacity: 0.4 }}>👤</Text>
        </View>
      )}
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, { color: C.ink }]}>{student.username || 'Student'}</Text>
        <Text style={[styles.friendSub, { color: C.inkLight }]}>{student.department || 'General Science'} • {student.academicLevel || '100 Level'}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.addBtn, { borderColor: C.ink }, isAdded && { backgroundColor: C.ink }]} 
        onPress={onAdd}
        activeOpacity={0.7}
      >
        <Text style={[styles.addBtnText, { color: C.ink }, isAdded && { color: C.bg }]}>
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
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  
  const [selected, setSelected] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load students directory from Firestore (scoped by university At if defined)
  useEffect(() => {
    async function loadDirectory() {
      if (!profile) return;
      setLoading(true);
      try {
        const userUniversity = profile.At || 'futo';
        const qUsers = query(
          collection(db, 'users'),
          where('At', '==', userUniversity),
          limit(50)
        );
        const snapshot = await getDocs(qUsers);
        const list = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as Omit<Student, 'id'> }))
          .filter(u => u.id !== profile?.uid); // exclude self
        setStudents(list);
      } catch (err) {
        console.error("Error loading directory for groups:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDirectory();
  }, [profile]);

  // Handle fuzzy search
  const displayedStudents = students.filter(student => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const sName = (student.username || '').toLowerCase();
    const sDept = (student.department || '').toLowerCase();
    return sName.includes(q) || sDept.includes(q);
  });

  const toggleFriend = (student: Student) => {
    if (selected.find(f => f.id === student.id)) {
      setSelected(prev => prev.filter(f => f.id !== student.id));
    } else if (selected.length < 10) {
      setSelected(prev => [...prev, student]);
    } else {
      Alert.alert('Limit Reached', 'You can select at most 10 members for a study group.');
    }
  };

  const handleCreateGroup = async () => {
    if (!profile || !groupName) return;
    if (selected.length === 0) {
      Alert.alert('Selection Error', 'Please select at least one study mate.');
      return;
    }

    setSubmitting(true);
    try {
      const gNameStr = String(groupName);
      
      // Write to global Firestore chats collection
      await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: gNameStr,
        uids: [profile.uid, ...selected.map(f => f.id)],
        lastMessage: `Group "${gNameStr}" created by ${profile.username || 'Student'}`,
        lastSenderId: profile.uid,
        lastUpdatedAt: new Date().toISOString(),
        At: profile.At || 'futo'
      });

      Alert.alert('Study Group Formed', `"${gNameStr}" has been created successfully. Let study commence!`, [
        { text: 'Enter Group Chat', onPress: () => router.push('/social') }
      ]);
    } catch (e) {
      console.error("Failed to commit study group:", e);
      Alert.alert('Creation Failed', 'Could not form the group. Try checking your network.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIcon}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={[s.logoText, { color: C.ink }]}>COLEARN</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[s.pageTitle, { color: C.ink }]}>Add Members</Text>
        <Text style={[s.pageSub, { color: C.inkMid }]}>Create your COLEARN studying squad for: "{groupName}"</Text>

        <View style={[s.searchContainer, { backgroundColor: C.surface, borderColor: C.border }]}>
          <SearchIcon />
          <TextInput
            style={[s.searchInput, { color: C.ink }]}
            placeholder="Search students by username or major..."
            placeholderTextColor={C.inkLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: C.ink }]}>Available Peers</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.activeText || C.ink} style={{ marginVertical: 32 }} />
        ) : displayedStudents.length === 0 ? (
          <Text style={{ textAlign: 'center', color: C.inkLight, marginVertical: 24, fontFamily: F.medium }}>No students found matching your query.</Text>
        ) : (
          displayedStudents.map(student => (
            <FriendItem 
              key={student.id} 
              student={student} 
              isAdded={!!selected.find(f => f.id === student.id)}
              onAdd={() => toggleFriend(student)}
              styles={s}
            />
          ))
        )}

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Selected Members Footer */}
      <View style={[s.footer, { backgroundColor: C.surface, borderTopColor: C.border }]}>
        <Text style={[s.selectedCount, { color: C.inkLight }]}>SELECTED ({selected.length}/10)</Text>
        <View style={s.selectedAvatars}>
          {selected.map(f => (
            <View key={f.id} style={s.selectedAvatarWrapper}>
              {f.photoURL ? (
                <Image source={{ uri: f.photoURL }} style={[s.selectedAvatar, { borderColor: C.ink }]} />
              ) : (
                <View style={[s.selectedAvatar, { backgroundColor: C.bgAlt, borderColor: C.ink, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 10 }}>👤</Text>
                </View>
              )}
              <TouchableOpacity style={[s.removeBtn, { backgroundColor: C.ink }]} onPress={() => toggleFriend(f)}>
                <Text style={{ color: C.bg, fontSize: 8, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {selected.length < 10 && (
            <View style={[s.addMorePlaceholder, { borderColor: C.border }]}>
              <AddMemberIcon />
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={[s.createBtn, { backgroundColor: C.ink }, (selected.length === 0 || submitting) && { opacity: 0.5 }]}
          disabled={selected.length === 0 || submitting}
          onPress={handleCreateGroup}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <>
              <Text style={[s.createBtnText, { color: C.bg }]}>Create Group</Text>
              <ArrowRightIcon />
            </>
          )}
        </TouchableOpacity>
      </View>

      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: F.bold, fontSize: 24, letterSpacing: -1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  pageTitle: { fontFamily: F.bold, fontSize: 32, marginBottom: 8 },
  pageSub: { fontFamily: F.medium, fontSize: 16, marginBottom: 24, lineHeight: 22 },

  searchContainer: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 32,
  },
  searchInput: { flex: 1, marginLeft: 10, fontFamily: F.medium, fontSize: 15 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: F.bold, fontSize: 22 },

  friendCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  friendInfo: { flex: 1 },
  friendName: { fontFamily: F.bold, fontSize: 16, marginBottom: 2 },
  friendSub: { fontFamily: F.bold, fontSize: 11 },
  addBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: { fontFamily: F.bold, fontSize: 11 },

  footer: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  selectedCount: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.5, marginBottom: 10 },
  selectedAvatars: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  selectedAvatarWrapper: { position: 'relative' },
  selectedAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
  removeBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtn: {
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: { fontFamily: F.bold, fontSize: 15 },
});
