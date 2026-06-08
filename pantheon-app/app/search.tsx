import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { F } from '../components/Theme';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SearchResultsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Load some students in directory originally
  useEffect(() => {
    async function loadInitialDirectory() {
      setSearching(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), limit(24)));
        const list = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== profile?.uid); // exclude self
        setResults(list);
      } catch (err) {
        console.error("Error loading directory users:", err);
      } finally {
        setSearching(false);
      }
    }
    loadInitialDirectory();
  }, [profile]);

  // Perform dynamic search on text input changes
  useEffect(() => {
    if (search.trim().length === 0) {
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), limit(150)));
        const list = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== profile?.uid);

        const lowerQuery = search.toLowerCase().trim();
        const filtered = list.filter(user => {
          const uName = (user.username || user.name || '').toLowerCase();
          const uDept = (user.department || '').toLowerCase();
          const uId = (user.studentId || '').toLowerCase();
          return uName.includes(lowerQuery) || uDept.includes(lowerQuery) || uId.includes(lowerQuery);
        });

        setResults(filtered);
      } catch (err) {
        console.error("Fuzzy searching failed:", err);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [search, profile]);

  const handleViewProfile = (student: any) => {
    router.push({
      pathname: '/profile-view',
      params: {
        uid: student.id
      }
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn} onPress={() => setSidebarOpen(true)}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>COLEARN</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={s.searchWrap}>
          <View style={s.searchIconContainer}>
            <SearchIcon />
          </View>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search students by username, major..."
            placeholderTextColor={C.inkLight}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
              <Text style={s.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results Header */}
        <View style={s.resultsHeader}>
          <Text style={s.resultsTitle}>{search.trim() ? 'Search Results' : 'Student Directory'}</Text>
          <Text style={s.resultsCount}>{results.length} Active Records</Text>
        </View>

        {/* Results List */}
        {searching ? (
          <View style={s.searchingArea}>
            <ActivityIndicator size="large" color={C.activeText} />
            <Text style={[s.searchingText, { color: C.inkLight }]}>Searching directory index...</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={s.emptyArea}>
            <Text style={[s.emptyLabelText, { color: C.inkLight }]}>No matching students located.</Text>
          </View>
        ) : (
          results.map((item) => (
            <View key={item.id} style={s.resultCard}>
              <View style={s.avatarContainer}>
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL.replace('/svg', '/png') }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: C.tagBg, borderColor: C.border }]}>
                    <Text style={s.placeholderIcon}>👤</Text>
                  </View>
                )}
              </View>
              <View style={s.infoContainer}>
                <Text style={s.studentName}>{item.username || item.name || 'CoLearn Student'}</Text>
                <Text style={s.studentSub}>{item.department || 'General Science'}</Text>
                <Text style={s.studentSub}>{item.academicLevel ? `${item.academicLevel} Level` : '100 Level'}</Text>
                <Text style={s.studentUid}>UID: {item.studentId || 'N/A'}</Text>
              </View>
              <TouchableOpacity style={s.viewBtn} activeOpacity={0.8} onPress={() => handleViewProfile(item)}>
                <Text style={s.viewBtnText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="search" />
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Search Bar
  searchWrap: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
  },
  searchIconContainer: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: 15,
    color: C.ink,
  },
  clearBtn: { padding: 4 },
  clearText: { color: C.inkLight, fontSize: 14 },

  // Results Header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  resultsTitle: { fontFamily: F.bold, fontSize: 22, color: C.ink },
  resultsCount: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.7 },

  // Result Card
  resultCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  placeholderIcon: { fontSize: 24, opacity: 0.4 },
  
  infoContainer: { flex: 1 },
  studentName: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  studentSub: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.7, marginBottom: 2 },
  studentUid: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.7 },

  viewBtn: {
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  viewBtnText: { fontFamily: F.bold, fontSize: 12, color: C.surface },

  searchingArea: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  searchingText: { fontFamily: F.bold, fontSize: 13, marginTop: 12 },

  emptyArea: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  emptyLabelText: { fontFamily: F.semibold, fontSize: 14 },
});
