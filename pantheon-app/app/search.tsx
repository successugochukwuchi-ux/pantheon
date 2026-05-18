import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { C, F } from '../components/Theme';

const SEARCH_RESULTS = [
  {
    id: '1',
    name: 'Kelechi Okafor',
    dept: 'Mechanical Engineering',
    level: '200 Level',
    uid: '20230001452',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Kelechi Nnamdi',
    dept: 'Computer Science',
    level: '100 Level',
    uid: '20230009821',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Kelechi Amadi',
    dept: 'Civil Engineering',
    level: '200 Level',
    uid: '20230002134',
    image: null,
  },
  {
    id: '4',
    name: 'Chidimma Kelechi',
    dept: 'Electrical Engineering',
    level: '100 Level',
    uid: '20230005567',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
  },
  {
    id: '5',
    name: 'Kelechi Iheanacho',
    dept: 'Project Management',
    level: '200 Level',
    uid: '20230003342',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
  },
  {
    id: '6',
    name: 'Grace Kelechi',
    dept: 'Biochemistry',
    level: '100 Level',
    uid: '20230008891',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop',
  },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SearchResultsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('Kelechi');

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
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
            placeholder="Search students..."
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
              <Text style={s.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results Header */}
        <View style={s.resultsHeader}>
          <Text style={s.resultsTitle}>Search Results</Text>
          <Text style={s.resultsCount}>12 Results Found</Text>
        </View>

        {/* Results List */}
        {SEARCH_RESULTS.map((item) => (
          <View key={item.id} style={s.resultCard}>
            <View style={s.avatarContainer}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPlaceholder]}>
                  <Text style={s.placeholderIcon}>👤</Text>
                </View>
              )}
            </View>
            <View style={s.infoContainer}>
              <Text style={s.studentName}>{item.name}</Text>
              <Text style={s.studentSub}>{item.dept}</Text>
              <Text style={s.studentSub}>{item.level}</Text>
              <Text style={s.studentUid}>UID: {item.uid}</Text>
            </View>
            <TouchableOpacity style={s.viewBtn} activeOpacity={0.8}>
              <Text style={s.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="search" />
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
    paddingHorizontal: 12,
    height: 56,
    marginBottom: 24,
  },
  searchIconContainer: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: 16,
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
  resultsTitle: { fontFamily: F.bold, fontSize: 24, color: C.ink },
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
  avatarPlaceholder: { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: { fontSize: 24, opacity: 0.4 },
  
  infoContainer: { flex: 1 },
  studentName: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  studentSub: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.7, marginBottom: 2 },
  studentUid: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.7 },

  viewBtn: {
    backgroundColor: C.surfaceDark,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginLeft: 8,
  },
  viewBtnText: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
});
