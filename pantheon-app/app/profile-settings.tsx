import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: -1 }] }} />
      <View style={{ position: 'absolute', width: 5, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '-45deg' }, { translateX: -3 }, { translateY: 2.5 }] }} />
    </View>
  );
}

function EditIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 12, height: 2, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const AVATAR_STYLES = [
  { id: 'bottts', label: 'Robots' },
  { id: 'avataaars', label: 'Humans' },
  { id: 'pixel-art', label: 'Pixels' },
  { id: 'adventurer', label: 'Adventurers' },
  { id: 'miniavs', label: 'Minimalist' },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  
  const [style, setStyle] = useState('avataaars');
  const [seed, setSeed] = useState('');
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [hideAchievements, setHideAchievements] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setMobileNumber(profile.mobileNumber || '');
      setSeed(profile.uid || '');
      // Try to extract style and seed from existing photoURL if possible
      if (profile.photoURL) {
        const match = profile.photoURL.match(/\/7\.x\/([^/]+)\/svg\?seed=([^&]+)/);
        if (match) {
          setStyle(match[1]);
          setSeed(match[2]);
        }
      }
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const photoURL = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
      await updateDoc(doc(db, 'users', user.uid), {
        username,
        mobileNumber,
        photoURL,
      });
      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon color={C.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Avatar Section */}
        <View style={s.card}>
          <View style={s.avatarContainer}>
             <Image 
               source={{ uri: `https://api.dicebear.com/7.x/${style}/png?seed=${seed}` }} 
               style={s.avatar} 
             />
          </View>

          <Text style={s.label}>CHOOSE STYLE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.styleBox}>
            {AVATAR_STYLES.map((s_item) => (
              <TouchableOpacity 
                key={s_item.id} 
                style={[s.styleBtn, style === s_item.id && s.styleBtnActive]}
                onPress={() => setStyle(s_item.id)}
              >
                <Text style={[s.styleBtnText, style === s_item.id && s.styleBtnTextActive]}>{s_item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <Text style={s.label}>AVATAR SEED</Text>

          <View style={s.seedInputRow}>
            <TextInput
              style={s.seedInput}
              value={seed}
              onChangeText={setSeed}
              placeholder="e.g. unique_seed"
              placeholderTextColor={C.inkLight}
            />
            <TouchableOpacity style={s.doneBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={C.bg} size="small" /> : <CheckIcon color={C.bg} />}
            </TouchableOpacity>
          </View>
          <Text style={s.helperText}>Seeds are unique keys for your generated profile icon.</Text>
        </View>

        {/* Username Section */}
        <View style={s.card}>
          <Text style={s.label}>DISPLAY USERNAME</Text>
          <View style={s.inputWrapper}>
            <TextInput
              style={s.usernameInput}
              value={username}
              onChangeText={setUsername}
            />
            <EditIcon color={C.inkMid} />
          </View>
        </View>

        {/* Mobile Number Section */}
        <View style={s.card}>
          <Text style={s.label}>MOBILE NUMBER</Text>
          <View style={s.inputWrapper}>
            <TextInput
              style={s.usernameInput}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
            />
            <EditIcon color={C.inkMid} />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={s.card}>
          <View style={s.switchRow}>
             <View style={{ flex: 1 }}>
               <Text style={s.switchLabel}>Hide CBT Achievements</Text>
               <Text style={s.switchDesc}>When enabled, other students won't see your practice results on your profile.</Text>
             </View>
             <Switch 
               value={hideAchievements} 
               onValueChange={setHideAchievements}
               trackColor={{ false: C.border, true: C.activeText || '#27AE60' }}
               thumbColor="#FFF"
             />
          </View>
        </View>

        <TouchableOpacity 
          style={[s.saveBtn, loading && { opacity: 0.7 }]} 
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={s.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={s.discardBtn} 
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={s.discardBtnText}>DISCARD UPDATES</Text>
        </TouchableOpacity>

        <View style={s.footerDivider} />
        
        <Text style={s.footerText}>
          COLEARN STUDENT IDENTITY SYSTEM V4.2.0 • FUTO CORE ENCRYPTED
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 20, color: C.ink, marginLeft: 16 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  avatarContainer: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.bgAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  avatar: { width: 120, height: 120 },
  styleBox: { flexDirection: 'row', marginBottom: 24, paddingBottom: 4 },
  styleBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: C.bgAlt, 
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  styleBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  styleBtnText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },
  styleBtnTextActive: { color: C.bg },

  label: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.inkLight,
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  seedInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  seedInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 56,
    fontFamily: F.medium,
    fontSize: 18,
    color: C.ink,
  },
  doneBtn: {
    width: 56,
    height: 56,
    backgroundColor: C.ink,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.inkMid,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    height: 56,
  },
  usernameInput: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: 18,
    color: C.ink,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontFamily: F.bold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 6,
  },
  switchDesc: {
    fontFamily: F.medium,
    fontSize: 14,
    color: C.inkMid,
    lineHeight: 20,
  },

  saveBtn: {
    backgroundColor: C.ink,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnText: {
    fontFamily: F.bold,
    fontSize: 18,
    color: C.bg,
  },

  discardBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  discardBtnText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.inkLight,
    letterSpacing: 2,
  },

  footerDivider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 24,
  },
  footerText: {
    fontFamily: F.bold,
    fontSize: 10,
    color: C.inkLight,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
