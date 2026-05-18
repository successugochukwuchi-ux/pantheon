import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { C, F, width } from '../components/Theme';

const PENDING = [
  { id: '1', name: 'Chinelo Obi', dept: 'Electrical Engineering', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' },
  { id: '2', name: 'Tunde Ade', dept: 'Mechanical Eng.', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop' },
];

const FRIENDS = [
  { id: '1', name: 'Kelechi Iheanacho', dept: 'Cyber Security, Year 3', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop' },
  { id: '2', name: 'Amarachi Okafor', dept: 'Information Tech, Year 2', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop' },
  { id: '3', name: 'Emeka Nnamdi', dept: 'Civil Engineering, Year 4', image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop' },
  { id: '4', name: 'Obinna Okoro', dept: 'Chemical Eng., Year 1', image: null },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SocialHubScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Friends' | 'Requests' | 'Groups'>('Friends');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} activeOpacity={0.7} style={s.iconBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} activeOpacity={0.7} style={s.iconBtn}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Social Hub</Text>
        <Text style={s.pageSubtitle}>Connect and collaborate with fellow FUTO students.</Text>

        {/* Tab Toggle */}
        <View style={s.tabContainer}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'Friends' && s.tabActive]}
            onPress={() => setActiveTab('Friends')}
          >
            <Text style={[s.tabText, activeTab === 'Friends' && s.tabTextActive]}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'Groups' && s.tabActive]}
            onPress={() => setActiveTab('Groups')}
          >
            <Text style={[s.tabText, activeTab === 'Groups' && s.tabTextActive]}>Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'Requests' && s.tabActive]}
            onPress={() => setActiveTab('Requests')}
          >
            <Text style={[s.tabText, activeTab === 'Requests' && s.tabTextActive]}>Requests (3)</Text>
          </TouchableOpacity>
        </View>

        {/* Groups Tab Content */}
        {activeTab === 'Groups' && (
          <View>
            <TouchableOpacity 
              style={s.createGroupCard} 
              onPress={() => router.push('/create-group')}
              activeOpacity={0.8}
            >
              <View style={s.plusCircle}>
                <Text style={s.plusText}>+</Text>
              </View>
              <View>
                <Text style={s.createTitle}>Create Study Group</Text>
                <Text style={s.createSubtitle}>Organize a learning squad for your courses.</Text>
              </View>
            </TouchableOpacity>

            <Text style={s.sectionLabel}>YOUR GROUPS</Text>
            <TouchableOpacity 
              style={s.friendCard} 
              onPress={() => router.push('/chat-room')}
              activeOpacity={0.8}
            >
              <View style={s.friendTop}>
                <View style={[s.friendAvatarBox, { backgroundColor: '#E0E0E0', borderRadius: 12, width: 64, height: 64, justifyContent: 'center', alignItems: 'center' }]}>
                   <Text style={[s.initials, { fontSize: 24 }]}>QM</Text>
                </View>
                <View style={s.friendDetails}>
                  <Text style={s.friendName}>Quantum Mechanics Squad</Text>
                  <Text style={s.friendDept}>8 Members • Active Now</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Requests - ONLY in Requests Tab */}
        {activeTab === 'Requests' && (
          <View>
            <Text style={s.sectionLabel}>PENDING REQUESTS</Text>
            {PENDING.map((user) => (
              <View key={user.id} style={s.pendingCard}>
                <Image source={{ uri: user.image }} style={s.pendingAvatar} />
                <View style={s.requestInfo}>
                  <Text style={s.requestName}>{user.name}</Text>
                  <Text style={s.requestDept}>{user.dept}</Text>
                </View>
                <View style={s.requestActions}>
                  <TouchableOpacity style={s.acceptBtn}>
                    <Text style={s.btnIcon}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn}>
                    <Text style={s.btnIconClose}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={{ height: 20 }} />
          </View>
        )}

        {/* Your Friends section - ONLY in Friends Tab */}
        {activeTab === 'Friends' && (
          <View>
            <View style={s.friendsHeaderRow}>
              <Text style={s.sectionLabel}>YOUR FRIENDS (124)</Text>
              <View style={s.searchRow}>
                <SearchIcon />
                <TextInput style={s.searchInput} placeholder="Find a friend..." placeholderTextColor={C.inkLight} />
              </View>
            </View>

            {FRIENDS.map((friend) => (
              <View key={friend.id} style={s.friendCard}>
                <View style={s.friendTop}>
                  <View style={s.friendAvatarBox}>
                    {friend.image ? (
                      <Image source={{ uri: friend.image }} style={s.friendAvatar} />
                    ) : (
                      <View style={[s.friendAvatar, s.avatarPlaceholder]}>
                        <Text style={s.initials}>OO</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.friendDetails}>
                    <Text style={s.friendName}>{friend.name}</Text>
                    <Text style={s.friendDept}>{friend.dept}</Text>
                  </View>
                </View>
                <View style={s.friendBtnRow}>
                  <TouchableOpacity style={s.chatBtn} onPress={() => router.push('/chat-list')}>
                    <Text style={s.chatBtnIcon}>≡</Text>
                    <Text style={s.chatBtnText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.moreBtn}>
                    <View style={s.personIcon}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: C.inkMid }} />
                      <View style={{ width: 10, height: 3, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 1.5, borderColor: C.inkMid, borderBottomWidth: 0, marginTop: 1 }} />
                      <View style={{ position: 'absolute', right: -2, bottom: -2, width: 4, height: 1.5, backgroundColor: C.inkMid }} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  pageTitle: { fontFamily: F.bold, fontSize: 32, color: C.ink, marginBottom: 8 },
  pageSubtitle: { fontFamily: F.body, fontSize: 16, color: C.inkMid, lineHeight: 22, marginBottom: 24 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: C.tabBg,
    borderRadius: 10,
    padding: 4,
    marginBottom: 32,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: C.surface },
  tabText: { fontFamily: F.bold, fontSize: 14, color: C.inkMid },
  tabTextActive: { color: C.ink },
  
  createGroupCard: {
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  plusCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plusText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  createTitle: { fontFamily: F.bold, fontSize: 18, color: '#fff', marginBottom: 4 },
  createSubtitle: { fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  sectionLabel: { fontFamily: F.bold, fontSize: 12, color: C.inkMid, opacity: 0.6, letterSpacing: 1, marginBottom: 12 },

  // Pending Requests
  pendingCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingAvatar: { width: 56, height: 56, borderRadius: 10, marginRight: 12 },
  requestInfo: { flex: 1 },
  requestName: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  requestDept: { fontFamily: F.bold, fontSize: 13, color: C.inkMid, opacity: 0.6 },
  requestActions: { gap: 8 },
  acceptBtn: {
    width: 36, height: 36, backgroundColor: C.ink, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  declineBtn: {
    width: 36, height: 36, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  btnIcon: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnIconClose: { color: C.inkMid, fontSize: 22 },

  // Friends Section
  friendsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEDF1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    width: 160,
  },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: F.bold, fontSize: 13, color: C.ink },

  // Friend Card
  friendCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  friendTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  friendAvatarBox: { marginRight: 14 },
  friendAvatar: { width: 64, height: 64, borderRadius: 12 },
  avatarPlaceholder: { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  initials: { fontFamily: F.bold, fontSize: 20, color: C.inkMid },
  friendDetails: { flex: 1 },
  friendName: { fontFamily: F.bold, fontSize: 18, color: C.ink, marginBottom: 4 },
  friendDept: { fontFamily: F.bold, fontSize: 13, color: C.inkMid, opacity: 0.6 },
  
  friendBtnRow: { flexDirection: 'row', gap: 10 },
  chatBtn: {
    flex: 1, backgroundColor: C.ink, borderRadius: 10, height: 48,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  chatBtnIcon: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  chatBtnText: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
  moreBtn: {
    width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  personIcon: { alignItems: 'center', justifyContent: 'center' },
});
