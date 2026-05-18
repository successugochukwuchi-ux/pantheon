import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, SearchIcon, BellIcon } from '../components/Icons';
import { C, F, width } from '../components/Theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivationModal } from '../components/ActivationModal';

const CARD_GAP = 12;
const CARD_W = (width - 32 - CARD_GAP) / 2;

const STUDENT = {
  name: 'FUTO Student',
  department: 'Electrical Engineering',
  level: '100LVL',
  uid: 'PNT-2026-X92',
  semester: '1ST SEMESTER',
  avatar: null, // placeholder
};

const UPDATES = [
  {
    id: '1',
    tag: 'URGENT',
    tagStyle: 'urgent',
    time: '2 hours ago',
    title: 'MTH 101 Final Exam Schedule Released',
    body: 'The management of FUTO has officially released the schedule for the first-...',
  },
  {
    id: '2',
    tag: 'NEW FEATURE',
    tagStyle: 'new',
    time: 'Yesterday',
    title: 'Interactive CBT Mode Now Available',
    body: 'We have updated the PANTHEON engine to include AI-driven explanations for...',
  },
  {
    id: '3',
    tag: 'ACADEMIC',
    tagStyle: 'academic',
    time: 'Oct 12, 2023',
    title: 'GST 101 Lecture Notes Updated',
    body: 'Full PDF summaries for chapters 5 through 12 have been uploaded to the...',
  },
];

const HUB_ITEMS = [
  { id: 'cbt',     icon: '⊡',  label: 'CBT Practice',   dark: true  },
  { id: 'notes',   icon: '🗒',  label: 'Lecture Notes',  dark: false },
  { id: 'video',   icon: '▶',  label: 'Video Library',  dark: false },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TopBar({ onMenu, onSearch, onBell }: {
  onMenu: () => void; onSearch: () => void; onBell: () => void;
}) {
  return (
      <View style={s.topBar}>
      <TouchableOpacity onPress={onMenu} activeOpacity={0.7} style={s.topBarIcon}>
        <HamburgerIcon />
      </TouchableOpacity>
      <Text style={s.topBarBrand}>PANTHEON</Text>
      <View style={s.topBarRight}>
        <TouchableOpacity onPress={onSearch} activeOpacity={0.7} style={s.topBarIcon}>
          <SearchIcon />
        </TouchableOpacity>
        <TouchableOpacity onPress={onBell} activeOpacity={0.7} style={s.topBarIcon}>
          <BellIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileCard() {
  const { profile, systemConfig } = useAuth();
  const { colors: C } = useTheme();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!profile) return null;

  return (
    <View style={s.profileCard}>
      {/* Avatar */}
      <View style={s.avatarWrap}>
        {profile.photoURL ? (
          <Image 
            source={{ uri: profile.photoURL.replace('/svg', '/png') }} 
            style={s.avatarPlaceholder} 
          />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.avatarInitial}>{profile.username?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        )}
      </View>

      <Text style={s.studentName}>{profile.username || 'Anonymous'}</Text>

      {/* Tags */}
      <View style={s.tagRow}>
        <View style={s.tag}>
          <Text style={s.tagText}>{profile.department || 'N/A'}</Text>
        </View>
        <View style={s.tag}>
          <Text style={s.tagText}>{profile.academicLevel ? `${profile.academicLevel} LVL` : 'N/A'}</Text>
        </View>
      </View>

      {/* UID */}
      <TouchableOpacity style={s.uidRow} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={[s.uidLabel, { color: C.inkLight }]}>Student ID: </Text>
        <Text style={[s.uidValue, { color: C.inkMid }]}>{profile.studentId || 'N/A'}</Text>
        <Text style={[s.uidCopy, { color: C.inkLight }]}>{copied ? '✓' : '⧉'}</Text>
      </TouchableOpacity>

      <View style={s.divider} />

      {/* Status row */}
      <View style={s.statusRow}>
        <View style={s.statusCell}>
          <Text style={s.statusLabel}>ACTIVATION STATUS</Text>
          <View style={[s.activePill, !profile.isActivated && { backgroundColor: '#FADBD8' }]}>
            <Text style={[s.activePillText, !profile.isActivated && { color: '#C0392B' }]}>
              {profile.isActivated ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
        <View style={s.statusDivider} />
        <View style={s.statusCell}>
          <Text style={s.statusLabel}>CURRENT SEMESTER</Text>
          <Text style={s.semesterValue}>
            {systemConfig?.currentSemester === '1st' ? '1ST SEMESTER' : 
             systemConfig?.currentSemester === '2nd' ? '2ND SEMESTER' : 'NO ACTIVE SEMESTER'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AcademicHub() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const handlePress = (id: string) => {
    if (id === 'notes') { router.push('/notes'); return; }
    if (id === 'cbt') { router.push('/cbt-setup'); return; }
    if (id === 'video') { router.push('/video-library'); return; }
    Alert.alert('Coming soon', `${id} screen is under construction.`);
  };
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: C.ink }]}>Academic Hub</Text>
      <View style={s.hubGrid}>
        {HUB_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              s.hubCard, 
              { backgroundColor: C.surface, borderColor: C.border },
              item.dark && [s.hubCardDark, { backgroundColor: C.surfaceDark, borderColor: C.surfaceDark }]
            ]}
            onPress={() => handlePress(item.id)}
            activeOpacity={0.85}
          >
            <Text style={[s.hubIcon, { color: C.ink }, item.dark && { color: C.surface }]}>{item.icon}</Text>
            <Text style={[s.hubLabel, { color: C.ink }, item.dark && { color: C.surface }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function UpdateCard({ item }: { item: typeof UPDATES[0] }) {
  const { colors: C } = useTheme();
  
  const getTagStyle = (type: string) => {
    switch (type) {
      case 'urgent':   return { bg: '#FADBD8', text: '#C0392B' };
      case 'new':      return { bg: '#E8F6EF', text: '#27AE60' };
      case 'academic': return { bg: '#EBF5FB', text: '#2980B9' };
      default:         return { bg: C.tagBg, text: C.tagText };
    }
  };

  const ts = getTagStyle(item.tagStyle);
  return (
    <TouchableOpacity style={[s.updateCard, { backgroundColor: C.surface, borderColor: C.border }]} activeOpacity={0.8}>
      <View style={s.updateMeta}>
        <View style={[s.updateTag, { backgroundColor: ts.bg }]}>
          <Text style={[s.updateTagText, { color: ts.text }]}>{item.tag}</Text>
        </View>
        <Text style={[s.updateTime, { color: C.inkLight }]}>{item.time}</Text>
      </View>
      <Text style={[s.updateTitle, { color: C.ink }]}>{item.title}</Text>
      <Text style={[s.updateBody, { color: C.inkMid }]}>{item.body}</Text>
    </TouchableOpacity>
  );
}

function UpdatesSection() {
  const { colors: C } = useTheme();
  return (
    <View style={s.section}>
      <View style={s.updatesHeader}>
        <Text style={[s.sectionTitle, { color: C.ink }]}>Updates from Pillara{'\n'}Education 2026</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={[s.viewAll, { color: C.ink }]}>View{'\n'}All</Text>
        </TouchableOpacity>
      </View>
      {UPDATES.map((u) => <UpdateCard key={u.id} item={u} />)}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <TopBar onMenu={() => setSidebarOpen(true)} onSearch={() => router.push('/search')} onBell={() => router.push('/notifications')} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard />
        <AcademicHub />
        <UpdatesSection />
        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNav active="home" />

      <ActivationModal />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },

  // TopBar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topBarBrand: { fontFamily: F.bold, fontSize: 16, color: C.ink, letterSpacing: 2 },
  topBarRight: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  topBarIcon: { padding: 4 },

  // Profile card
  profileCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: { marginBottom: 14 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D8D6E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: C.border,
  },
  avatarInitial: { fontFamily: F.bold, fontSize: 24, color: C.inkMid },
  studentName: { fontFamily: F.display, fontSize: 26, color: C.ink, marginBottom: 10 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tag: {
    backgroundColor: C.tagBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: { fontFamily: F.medium, fontSize: 12, color: C.tagText },
  uidRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  uidLabel: { fontFamily: F.body, fontSize: 13, color: C.inkLight },
  uidValue: { fontFamily: F.medium, fontSize: 13, color: C.inkMid },
  uidCopy: { fontSize: 14, color: C.inkLight, marginLeft: 6 },
  divider: { width: '100%', height: 1, backgroundColor: C.border, marginBottom: 16 },
  statusRow: { flexDirection: 'row', width: '100%', alignItems: 'flex-start' },
  statusCell: { flex: 1, alignItems: 'flex-start' },
  statusDivider: { width: 1, height: 40, backgroundColor: C.border, marginHorizontal: 16 },
  statusLabel: { fontFamily: F.medium, fontSize: 10, color: C.inkLight, letterSpacing: 1.2, marginBottom: 6 },
  activePill: {
    backgroundColor: C.activeBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activePillText: { fontFamily: F.bold, fontSize: 11, color: C.activeText, letterSpacing: 0.5 },
  semesterValue: { fontFamily: F.bold, fontSize: 14, color: C.ink },

  // Section
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: F.display, fontSize: 22, color: C.ink, marginBottom: 14, lineHeight: 28 },

  // Academic Hub grid
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  hubCard: {
    width: CARD_W,
    height: CARD_W,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  hubCardDark: { backgroundColor: C.surfaceDark, borderColor: C.surfaceDark },
  hubIcon: { fontSize: 32, color: C.ink },
  hubIconDark: { color: C.surface },
  hubLabel: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  hubLabelDark: { color: C.surface },

  // Updates
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  viewAll: { fontFamily: F.medium, fontSize: 13, color: C.ink, textDecorationLine: 'underline', textAlign: 'right' },
  updateCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
  },
  updateMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  updateTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  updateTagText: { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.8 },
  updateTime: { fontFamily: F.body, fontSize: 12, color: C.inkLight },
  updateTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink, marginBottom: 6, lineHeight: 21 },
  updateBody: { fontFamily: F.body, fontSize: 13, color: C.inkMid, lineHeight: 19 },
});
