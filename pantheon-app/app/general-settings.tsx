import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// ── Sub-components & Icons ───────────────────────────────────────────────────

function BackIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function CheckIcon() {
  return (
    <View style={{ width: 24, height: 24, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
       <View style={{ width: 10, height: 2, backgroundColor: '#fff', borderRadius: 1, transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: -0.5 }] }} />
       <View style={{ position: 'absolute', width: 5, height: 2, backgroundColor: '#fff', borderRadius: 1, transform: [{ rotate: '-45deg' }, { translateX: -3.5 }, { translateY: 2.2 }] }} />
    </View>
  );
}

const THEME_OPTIONS = [
  { id: 'light', name: 'Light', color: '#FFFFFF' },
  { id: 'dark', name: 'Dark', color: '#121212' },
  { id: 'sepia', name: 'Sepia', color: '#F4ECD8' },
  { id: 'ocean', name: 'Ocean', color: '#E3F2FD' },
  { id: 'forest', name: 'Forest', color: '#E8F5E9' },
  { id: 'midnight', name: 'Midnight', color: '#0F172A' },
  { id: 'sunset', name: 'Sunset', color: '#FFF7ED' },
  { id: 'lavender', name: 'Lavender', color: '#F5F3FF' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GeneralSettingsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors: C, themeName: activeTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  
  const [notifs, setNotifs] = useState({
    announcements: true,
    dms: true,
    groups: false,
  });

  const handleThemeChange = async (themeId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        theme: themeId,
      });
    } catch (error) {
      console.error('Error updating theme:', error);
      Alert.alert('Error', 'Failed to update theme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon color={C.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.ink }]}>General Settings</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* App Theme Section */}
        <View style={s.sectionHeaderRow}>
          <Text style={[s.sectionTitle, { color: C.ink }]}>App Theme</Text>
          {loading && <ActivityIndicator color={C.ink} size="small" />}
        </View>
        
        <View style={s.themeGrid}>
          {THEME_OPTIONS.map((theme) => (
            <TouchableOpacity 
              key={theme.id} 
              style={[
                s.themeCard, 
                { backgroundColor: C.surface, borderColor: C.border },
                activeTheme === theme.id && [s.themeCardActive, { borderColor: C.ink }]
              ]}
              onPress={() => handleThemeChange(theme.id)}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={[s.themeThumb, { backgroundColor: theme.color, borderColor: theme.id === 'light' ? '#D0CEC4' : 'transparent', borderWidth: theme.id === 'light' ? 1 : 0 }]}>
                {activeTheme === theme.id && <CheckIcon />}
              </View>
              <Text style={[s.themeName, { color: C.inkMid }, activeTheme === theme.id && [s.themeNameActive, { color: C.ink }]]}>
                {theme.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[s.divider, { backgroundColor: C.border }]} />

        {/* Notifications Section */}
        <Text style={[s.sectionTitle, { color: C.ink }]}>Notifications</Text>
        
        <View style={[s.settingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.settingInfo}>
            <Text style={[s.settingLabel, { color: C.ink }]}>Announcements</Text>
            <Text style={[s.settingDesc, { color: C.inkMid }]}>Receive updates from Pillara Education and Departmental boards.</Text>
          </View>
          <Switch 
            value={notifs.announcements} 
            onValueChange={(v) => setNotifs(prev => ({...prev, announcements: v}))}
            trackColor={{ false: C.unansweredNav, true: C.ink }}
            thumbColor="#FFF"
          />
        </View>

        <View style={[s.settingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.settingInfo}>
            <Text style={[s.settingLabel, { color: C.ink }]}>Direct Messages (DMs)</Text>
            <Text style={[s.settingDesc, { color: C.inkMid }]}>Get notified when someone sends you a private message.</Text>
          </View>
          <Switch 
            value={notifs.dms} 
            onValueChange={(v) => setNotifs(prev => ({...prev, dms: v}))}
            trackColor={{ false: C.unansweredNav, true: C.ink }}
            thumbColor="#FFF"
          />
        </View>

        <View style={[s.settingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.settingInfo}>
            <Text style={[s.settingLabel, { color: C.ink }]}>Study Groups</Text>
            <Text style={[s.settingDesc, { color: C.inkMid }]}>Stay updated with activity in your joined study groups.</Text>
          </View>
          <Switch 
            value={notifs.groups} 
            onValueChange={(v) => setNotifs(prev => ({...prev, groups: v}))}
            trackColor={{ false: C.unansweredNav, true: C.ink }}
            thumbColor="#FFF"
          />
        </View>

        {/* Focus Mode Promo */}
        <TouchableOpacity activeOpacity={0.9} style={s.focusPromo}>
          <ImageBackground 
            source={{ uri: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop' }}
            style={s.focusBg}
            imageStyle={{ borderRadius: 20 }}
          >
            <View style={s.focusOverlay}>
              <Text style={s.focusTitle}>Focus Mode</Text>
              <Text style={s.focusDesc}>Optimize your environment for deep study sessions.</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 24, color: C.ink, marginLeft: 16 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  sectionTitle: {
    fontFamily: F.bold,
    fontSize: 32,
    color: C.ink,
    marginBottom: 24,
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },

  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  themeCard: {
    width: '47%',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E4DE',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeCardActive: {
    borderColor: '#000',
    borderWidth: 1.5,
  },
  themeThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeName: {
    fontFamily: F.medium,
    fontSize: 14,
    color: C.inkMid,
  },
  themeNameActive: {
    color: C.ink,
    fontFamily: F.bold,
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E4DE',
    marginVertical: 40,
  },

  settingCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingInfo: { flex: 1, paddingRight: 12 },
  settingLabel: { fontFamily: F.bold, fontSize: 18, color: C.ink, marginBottom: 4 },
  settingDesc: { fontFamily: F.medium, fontSize: 14, color: C.inkMid, lineHeight: 20 },

  focusPromo: {
    marginTop: 20,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  focusBg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  focusOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
    height: '100%',
    justifyContent: 'flex-end',
  },
  focusTitle: { fontFamily: F.bold, fontSize: 20, color: '#FFFFFF', marginBottom: 4 },
  focusDesc: { fontFamily: F.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
});
