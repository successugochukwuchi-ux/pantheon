import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';
import { InfoIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

// ── Sub-components ────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 4, width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function GearIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.8, borderColor: C.ink }} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <View key={deg} style={{ position: 'absolute', width: 3, height: 2, backgroundColor: C.ink, borderRadius: 1, transform: [{ rotate: `${deg}deg` }, { translateY: -8 }] }} />
      ))}
    </View>
  );
}

function SparkleIcon() {
  return (
    <View style={{ width: 20, height: 20 }}>
      <View style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', bottom: 4, left: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      <View style={{ position: 'absolute', top: 8, left: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' }} />
    </View>
  );
}

function HeadsetIcon() {
  return (
    <View style={{ width: 20, height: 18, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.8, borderColor: C.ink, borderBottomWidth: 0, justifyContent: 'flex-end', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: -2 }}>
        <View style={{ width: 5, height: 8, backgroundColor: C.ink, borderRadius: 2 }} />
        <View style={{ width: 5, height: 8, backgroundColor: C.ink, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function MessageIcon() {
  return (
    <View style={{ width: 20, height: 16, borderWidth: 1.8, borderColor: C.ink, borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 2, backgroundColor: C.ink, borderRadius: 1, marginBottom: 2 }} />
      <View style={{ width: 10, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', bottom: -4, left: 4, width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 4, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.ink }} />
    </View>
  );
}

function ProfileSmallIcon() {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.8, borderColor: C.ink }} />
      <View style={{ width: 16, height: 5, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.8, borderColor: C.ink, borderBottomWidth: 0 }} />
    </View>
  );
}

function SettingRow({ icon, title, subtitle, isDark, onPress }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  isDark?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.row, isDark && s.rowDark]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[s.rowIconBox, isDark && s.rowIconBoxDark]}>
        {icon}
      </View>
      <View style={s.rowInfo}>
        <Text style={[s.rowTitle, isDark && s.rowTitleDark]}>{title}</Text>
        <Text style={[s.rowSub, isDark && s.rowSubDark]}>{subtitle}</Text>
      </View>
      <View style={[s.rowChevron, { opacity: isDark ? 0.8 : 0.3 }]}>
        <View style={[s.chevronLine, { borderColor: isDark ? '#fff' : C.ink }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login' as any);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/dashboard' as any)} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatarContainer}>
            {profile?.photoURL ? (
              <Image 
                source={{ uri: profile.photoURL.replace('/svg', '/png') }} 
                style={s.avatarPlaceholder} 
              />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>{profile?.username?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
            )}
            <View style={[s.statusIndicator, profile?.isActivated && { backgroundColor: '#2ECC71' }]} />
          </View>
          
          <View style={s.nameRow}>
            <Text style={s.userName}>{profile?.username || 'User'}</Text>
            <View style={[s.activeBadge, !profile?.isActivated && { backgroundColor: '#FADBD8' }]}>
              <Text style={[s.activeBadgeText, !profile?.isActivated && { color: '#C0392B' }]}>
                {profile?.isActivated ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          
          <Text style={s.userDept}>{profile?.department || 'N/A'}</Text>
          
          <View style={s.badgeRow}>
            <View style={s.pillBadge}>
              <Text style={s.pillBadgeText}>{profile?.academicLevel ? `${profile.academicLevel} LVL` : 'N/A'}</Text>
            </View>
            <View style={s.pillBadge}>
              <Text style={s.pillBadgeText}>ID: {profile?.studentId || '...'}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <Text style={s.sectionLabel}>ACCOUNT & PREFERENCES</Text>
        <SettingRow
          icon={<ProfileSmallIcon />}
          title="Profile Settings"
          subtitle="Update your personal data and visibility"
          onPress={() => router.push('/profile-settings')}
        />
        <SettingRow
          icon={<GearIcon />}
          title="General Settings"
          subtitle="App preferences, theme, and language"
          onPress={() => router.push('/general-settings')}
        />
        <SettingRow
          isDark
          icon={<SparkleIcon />}
          title="Note Grabber"
          subtitle="Save notes and past questions for offline use"
          onPress={() => router.push('/note-grabber')}
        />

        <Text style={s.sectionLabel}>SUPPORT</Text>
        <SettingRow
          icon={<HeadsetIcon />}
          title="Contact Admin"
          subtitle="Get help with academic or app issues"
          onPress={() => Linking.openURL('https://wa.me/2348118429150?text=Admin%20Support')}
        />
        <SettingRow
          icon={<MessageIcon />}
          title="Give Feedback"
          subtitle="Help us improve your PANTHEON experience"
          onPress={() => router.push('/feedback')}
        />
        <SettingRow
          icon={<InfoIcon color={C.ink} />}
          title="Help Center"
          subtitle="Frequently asked questions and guides"
          onPress={() => Linking.openURL('https://wa.me/2348118429150?text=Help%20Center')}
        />

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Text style={s.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={s.versionText}>PANTHEON v2.4.0 • FUTO Edition</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="settings" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontFamily: F.bold, fontSize: 28, color: C.ink },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Profile Card
  profileCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: { marginBottom: 16 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: C.ink,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontFamily: F.bold, fontSize: 32, color: C.ink },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, borderColor: C.ink },
  statusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2ECC71',
    borderWidth: 3,
    borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  userName: { fontFamily: F.bold, fontSize: 32, color: C.ink },
  activeBadge: { backgroundColor: '#E8F6EF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  activeBadgeText: { fontFamily: F.bold, fontSize: 11, color: '#27AE60', letterSpacing: 0.5 },
  userDept: { fontFamily: F.medium, fontSize: 16, color: C.inkMid, marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  pillBadge: { backgroundColor: C.tagBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  pillBadgeText: { fontFamily: F.bold, fontSize: 14, color: C.tagText },

  // Sections
  sectionLabel: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.inkMid,
    opacity: 0.8,
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 16,
  },

  row: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowDark: { backgroundColor: C.surfaceDark, borderColor: C.surfaceDark },
  rowIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rowIconBoxDark: { backgroundColor: 'rgba(255,255,255,0.15)' },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  rowTitleDark: { color: '#fff' },
  rowSub: { fontFamily: F.medium, fontSize: 13, color: C.inkMid, opacity: 0.7 },
  rowSubDark: { color: 'rgba(255,255,255,0.6)' },
  rowChevron: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  chevronLine: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },

  // Logout
  logoutBtn: {
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: C.error,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  logoutBtnText: { fontFamily: F.bold, fontSize: 16, color: C.error },
  versionText: {
    fontFamily: F.medium,
    fontSize: 14,
    color: C.inkLight,
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.8,
  },
});
