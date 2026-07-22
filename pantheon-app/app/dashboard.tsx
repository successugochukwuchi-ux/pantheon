import React, { useState, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, SearchIcon, BellIcon } from '../components/Icons';
import { F, width } from '../components/Theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivationModal } from '../components/ActivationModal';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CARD_GAP = 12;
const CARD_W = (width - 32 - CARD_GAP) / 2;

const HUB_ITEMS = [
  { id: 'cbt',            icon: '⊡',  label: 'CBT Practice',   dark: true  },
  { id: 'notes',          icon: '🗒',  label: 'Lecture Notes',  dark: false },
  { id: 'past_questions', icon: '🕒', label: 'Past Questions', dark: false },
  { id: 'video',          icon: '▶',  label: 'Video Library',  dark: false },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TopBar({ onMenu, onSearch, onBell, s, C }: {
  onMenu: () => void; onSearch: () => void; onBell: () => void; s: any; C: any;
}) {
  return (
    <View style={[s.topBar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
      <View style={s.topBarLeft}>
        <TouchableOpacity onPress={onMenu} activeOpacity={0.7} style={s.topBarIcon}>
          <HamburgerIcon color={C.ink} />
        </TouchableOpacity>
      </View>
      <Text style={[s.topBarBrand, { color: C.ink }]}>COLEARN</Text>
      <View style={s.topBarRight}>
        <TouchableOpacity onPress={onSearch} activeOpacity={0.7} style={s.topBarIcon}>
          <SearchIcon color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onBell} activeOpacity={0.7} style={s.topBarIcon}>
          <BellIcon color={C.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProfileCard({ s, C }: { s: any; C: any }) {
  const { profile, systemConfig } = useAuth();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (profile?.studentId) {
      Clipboard.setString(profile.studentId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!profile) return null;

  return (
    <View style={[s.profileCard, { backgroundColor: C.surface, borderColor: C.border }]}>
      {/* Avatar */}
      <View style={s.avatarWrap}>
        {profile.photoURL ? (
          <Image 
            source={{ uri: profile.photoURL.replace('/svg', '/png') }} 
            style={s.avatarPlaceholder} 
          />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: C.border }]}>
            <Text style={[s.avatarInitial, { color: C.inkMid }]}>{profile.username?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        )}
      </View>

      <Text style={[s.studentName, { color: C.ink }]}>{profile.username || 'Anonymous'}</Text>

      {/* Tags */}
      <View style={s.tagRow}>
        <View style={[s.tag, { backgroundColor: C.tagBg }]}>
          <Text style={[s.tagText, { color: C.tagText }]}>{profile.department || 'N/A'}</Text>
        </View>
        <View style={[s.tag, { backgroundColor: C.tagBg }]}>
          <Text style={[s.tagText, { color: C.tagText }]}>{profile.academicLevel ? `${profile.academicLevel} LVL` : 'N/A'}</Text>
        </View>
      </View>

      {/* UID */}
      <TouchableOpacity style={s.uidRow} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={[s.uidLabel, { color: C.inkLight }]}>Student ID: </Text>
        <Text style={[s.uidValue, { color: C.inkMid }]}>{profile.studentId || 'N/A'}</Text>
        <Text style={[s.uidCopy, { color: C.inkLight }]}>{copied ? '✓' : '⧉'}</Text>
      </TouchableOpacity>

      <View style={[s.divider, { backgroundColor: C.border }]} />

      {/* Status row */}
      <View style={s.statusRow}>
        <View style={s.statusCell}>
          <Text style={[s.statusLabel, { color: C.inkLight }]}>ACTIVATION STATUS</Text>
          <View style={[s.activePill, { backgroundColor: profile.isActivated ? C.activeBg : '#FADBD8' }]}>
            <Text style={[s.activePillText, { color: profile.isActivated ? C.activeText : '#C0392B' }]}>
              {profile.isActivated ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
        <View style={[s.statusDivider, { backgroundColor: C.border }]} />
        <View style={s.statusCell}>
          <Text style={[s.statusLabel, { color: C.inkLight }]}>CURRENT SEMESTER</Text>
          <Text style={[s.semesterValue, { color: C.ink }]}>
            {systemConfig?.currentSemester === '1st' ? '1ST SEMESTER' : 
             systemConfig?.currentSemester === '2nd' ? '2ND SEMESTER' : 'NO ACTIVE SEMESTER'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getContrastColor(hexColor: string) {
  if (!hexColor) return '#FFFFFF';
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0A0A0A' : '#FFFFFF';
}

function AcademicHub({ s, C }: { s: any; C: any }) {
  const router = useRouter();
  const handlePress = (id: string) => {
    if (id === 'notes') { router.push('/notes'); return; }
    if (id === 'cbt') { router.push('/cbt-setup'); return; }
    if (id === 'video') { router.push('/video-library'); return; }
    if (id === 'past_questions') { router.push('/past-questions'); return; }
    if (id === 'timetable') { router.push('/timetable'); return; }
    Alert.alert('Coming soon', `${id} screen is under construction.`);
  };

  const contrastColor = useMemo(() => getContrastColor(C.selectedBg), [C.selectedBg]);

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
              item.dark && [s.hubCardDark, { backgroundColor: C.selectedBg, borderColor: C.selectedBg }]
            ]}
            onPress={() => handlePress(item.id)}
            activeOpacity={0.85}
          >
            <Text style={[s.hubIcon, { color: C.ink }, item.dark && { color: contrastColor }]}>{item.icon}</Text>
            <Text style={[s.hubLabel, { color: C.ink }, item.dark && { color: contrastColor }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function UpdateCard({ item, s, C }: { item: any; s: any; C: any }) {
  const formattedTime = useMemo(() => {
    if (!item.createdAt) return 'Recent';
    try {
      const d = item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
      // simplified relative day format
      const diff = new Date().getTime() - d.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return 'Just now';
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Yesterday';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  }, [item.createdAt]);

  const tagColor = useMemo(() => {
    const type = item.type || 'announcement';
    switch (type) {
      case 'urgent': return { bg: '#FADBD8', text: '#C0392B', label: 'URGENT' };
      case 'material': return { bg: '#EBF5FB', text: '#2980B9', label: 'MATERIAL' };
      case 'system': return { bg: '#EBF5FB', text: '#2980B9', label: 'SYSTEM' };
      default: return { bg: '#E8F6EF', text: '#27AE60', label: 'ANNOUNCEMENT' };
    }
  }, [item.type]);

  return (
    <TouchableOpacity style={[s.updateCard, { backgroundColor: C.surface, borderColor: C.border }]} activeOpacity={0.8}>
      <View style={s.updateMeta}>
        <View style={[s.updateTag, { backgroundColor: tagColor.bg }]}>
          <Text style={[s.updateTagText, { color: tagColor.text }]}>{tagColor.label}</Text>
        </View>
        <Text style={[s.updateTime, { color: C.inkLight }]}>{formattedTime}</Text>
      </View>
      <Text style={[s.updateTitle, { color: C.ink }]}>{item.title}</Text>
      <Text style={[s.updateBody, { color: C.inkMid }]} numberOfLines={3}>{item.content || item.body || ''}</Text>
    </TouchableOpacity>
  );
}

function UpdatesSection({ s, C }: { s: any; C: any }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'news'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let newsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by university (At) matching profile
      if (profile?.At) {
        newsData = newsData.filter((item: any) => !item.At || item.At.toLowerCase() === profile.At.toLowerCase());
      } else {
        newsData = newsData.filter((item: any) => !item.At || item.At.toLowerCase() === 'futo');
      }

      // Sort newest news first
      newsData.sort((a: any, b: any) => {
        const timeA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
        const timeB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
        return timeB - timeA;
      });
      setNews(newsData.slice(0, 5));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching news updates:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  return (
    <View style={s.section}>
      <View style={s.updatesHeader}>
        <Text style={[s.sectionTitle, { color: C.ink }]}>News Board</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={C.activeText} style={{ marginVertical: 20 }} />
      ) : news.length === 0 ? (
        <View style={[s.updateCard, { backgroundColor: C.surface, borderColor: C.border, padding: 24, alignItems: 'center' }]}>
          <Text style={{ fontFamily: F.medium, color: C.inkLight, fontSize: 13 }}>No updates released on News Board yet.</Text>
        </View>
      ) : (
        news.map((item) => <UpdateCard key={item.id} item={item} s={s} C={C} />)
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, loading, isDownloadingCourses, downloadPercent, downloadStatus } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/' as any);
      } else if (profile?.isBanned) {
        router.replace('/banned' as any);
      }
    }
  }, [user, profile, loading]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <TopBar 
        onMenu={() => setSidebarOpen(true)} 
        onSearch={() => router.push('/search')} 
        onBell={() => router.push('/notifications')} 
        s={s} 
        C={C} 
      />

      {isDownloadingCourses && (
        <View style={[s.downloadBanner, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View style={s.downloadBannerTop}>
            <Text style={[s.downloadBannerText, { color: C.ink }]} numberOfLines={1}>
              {downloadStatus}
            </Text>
            <Text style={[s.downloadBannerPercent, { color: C.activeText || '#2ECC71' }]}>
              {downloadPercent}%
            </Text>
          </View>
          <View style={[s.progressBarBg, { backgroundColor: C.border }]}>
            <View style={[s.progressBarFill, { width: `${downloadPercent}%`, backgroundColor: C.activeText || '#2ECC71' }]} />
          </View>
        </View>
      )}
      
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard s={s} C={C} />
        <AcademicHub s={s} C={C} />
        <UpdatesSection s={s} C={C} />
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="home" />

      <ActivationModal />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },

  // Download Banner
  downloadBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  downloadBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  downloadBannerText: {
    fontFamily: F.medium,
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  downloadBannerPercent: {
    fontFamily: F.bold,
    fontSize: 12,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // TopBar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  topBarLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  topBarBrand: {
    fontFamily: F.bold,
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  topBarRight: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  topBarIcon: { padding: 4 },

  // Profile card
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: { marginBottom: 14 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: C.border,
  },
  avatarInitial: { fontFamily: F.bold, fontSize: 24 },
  studentName: { fontFamily: F.display, fontSize: 26, marginBottom: 10 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: { fontFamily: F.medium, fontSize: 12 },
  uidRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  uidLabel: { fontFamily: F.body, fontSize: 13 },
  uidValue: { fontFamily: F.medium, fontSize: 13 },
  uidCopy: { fontSize: 14, marginLeft: 6 },
  divider: { width: '100%', height: 1, marginBottom: 16 },
  statusRow: { flexDirection: 'row', width: '100%', alignItems: 'flex-start' },
  statusCell: { flex: 1, alignItems: 'flex-start' },
  statusDivider: { width: 1, height: 40, marginHorizontal: 16 },
  statusLabel: { fontFamily: F.medium, fontSize: 10, letterSpacing: 1.2, marginBottom: 6 },
  activePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activePillText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.5 },
  semesterValue: { fontFamily: F.bold, fontSize: 14 },

  // Section
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: F.display, fontSize: 22, marginBottom: 14, lineHeight: 28 },

  // Academic Hub grid
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  hubCard: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  hubCardDark: { },
  hubIcon: { fontSize: 32 },
  hubIconDark: { },
  hubLabel: { fontFamily: F.medium, fontSize: 14 },
  hubLabelDark: { },

  // Updates
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  updateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  updateMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  updateTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  updateTagText: { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.8 },
  updateTime: { fontFamily: F.body, fontSize: 12 },
  updateTitle: { fontFamily: F.bold, fontSize: 15, marginBottom: 6, lineHeight: 21 },
  updateBody: { fontFamily: F.body, fontSize: 13, lineHeight: 19 },
});
