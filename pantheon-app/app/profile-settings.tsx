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
import * as ImagePicker from 'expo-image-picker';
import { getDefaultVoice, setDefaultVoice, speakText, stopSpeech, MICROSOFT_VOICES } from '../lib/ttsService';

// ── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 10, borderWidth: 1.5, borderColor: color, borderRadius: 2, marginTop: 2 }} />
      <View style={{ position: 'absolute', top: 5, width: 4, height: 4, borderRadius: 2, borderWidth: 1, borderColor: color }} />
      <View style={{ position: 'absolute', top: 3.5, right: 3.5, width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 1, width: 4, height: 1.5, backgroundColor: color }} />
    </View>
  );
}

function SparklesIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: 2, left: 3, width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: 2, right: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}

function UploadIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 2, height: 10, backgroundColor: color, marginTop: -2 }} />
      <View style={{ position: 'absolute', top: 6, left: 8, width: 6, height: 1.5, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', top: 6, right: 8, width: 6, height: 1.5, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      <View style={{ position: 'absolute', bottom: 5, width: 12, height: 1.5, backgroundColor: color }} />
    </View>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 12, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 4, height: 1.5, backgroundColor: color, marginTop: -3 }} />
      <View style={{ width: 10, height: 9, borderWidth: 1.2, borderColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: 1 }} />
    </View>
  );
}

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

  // Voice TTS settings
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [testingVoice, setTestingVoice] = useState(false);

  useEffect(() => {
    getDefaultVoice().then((v) => setSelectedVoice(v));
  }, []);

  // Custom photo upload state
  const [avatarSource, setAvatarSource] = useState<'dicebear' | 'custom'>('dicebear');
  const [customPhotoURL, setCustomPhotoURL] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setMobileNumber(profile.mobileNumber || '');
      setSeed(profile.uid || '');
      
      const photo = profile.photoURL || '';
      if (photo) {
        const isDicebear = photo.includes('dicebear.com');
        if (isDicebear) {
          setAvatarSource('dicebear');
          const match = photo.match(/\/7\.x\/([^/]+)\/(svg|png)\?seed=([^&]+)/);
          if (match) {
            setStyle(match[1]);
            setSeed(match[3]);
          }
        } else {
          setAvatarSource('custom');
          setCustomPhotoURL(photo);
        }
      }
    }
  }, [profile]);

  const handlePickAndUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const uri = result.assets[0].uri;
      setUploading(true);

      const fileType = uri.split('.').pop() || 'jpg';
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: `photo.${fileType}`,
        type: `image/${fileType}`,
      } as any);
      formData.append('upload_preset', 'colodge_unsigned');
      formData.append('folder', 'colodge_listings');

      const response = await fetch('https://api.cloudinary.com/v1_1/lfrjrbtz/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Upload server returned an error');
      }

      const data = await response.json();
      if (data.secure_url) {
        setCustomPhotoURL(data.secure_url);
        setAvatarSource('custom');
        Alert.alert('Success', 'Profile picture uploaded! Tap "Save Changes" below to complete.');
      } else {
        throw new Error('No secure URL returned from server');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'An error occurred during image upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveCustomPhoto = () => {
    setCustomPhotoURL('');
    setAvatarSource('dicebear');
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const photoURL = avatarSource === 'custom' && customPhotoURL
        ? customPhotoURL
        : `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;

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
               source={{ uri: avatarSource === 'custom' && customPhotoURL ? customPhotoURL : `https://api.dicebear.com/7.x/${style}/png?seed=${seed}` }} 
               style={s.avatar} 
             />
          </View>

          {/* Toggle buttons */}
          <View style={s.sourceToggleContainer}>
            <TouchableOpacity
              style={[s.sourceToggleBtn, avatarSource === 'custom' && s.sourceToggleBtnActive]}
              onPress={() => setAvatarSource('custom')}
            >
              <CameraIcon color={avatarSource === 'custom' ? C.ink : C.inkLight} />
              <Text style={[s.sourceToggleText, avatarSource === 'custom' && s.sourceToggleTextActive]}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sourceToggleBtn, avatarSource === 'dicebear' && s.sourceToggleBtnActive]}
              onPress={() => setAvatarSource('dicebear')}
            >
              <SparklesIcon color={avatarSource === 'dicebear' ? C.ink : C.inkLight} />
              <Text style={[s.sourceToggleText, avatarSource === 'dicebear' && s.sourceToggleTextActive]}>AI Avatar</Text>
            </TouchableOpacity>
          </View>

          {avatarSource === 'custom' ? (
            <View>
              {customPhotoURL ? (
                <View style={s.activeBanner}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={s.activeBannerTitle}>✓ Custom Photo Active</Text>
                    <Text style={s.activeBannerSubtitle}>Tap "Save Changes" below to finalize your profile.</Text>
                  </View>
                  <TouchableOpacity style={s.removeBtn} onPress={handleRemoveCustomPhoto}>
                    <TrashIcon color={C.ink} />
                    <Text style={s.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[s.uploadBox, uploading && s.uploadBoxActive]} 
                  onPress={handlePickAndUpload}
                  disabled={uploading}
                >
                  <View style={s.uploadIconCircle}>
                    {uploading ? (
                      <ActivityIndicator color={C.ink} size="small" />
                    ) : (
                      <UploadIcon color={C.inkMid} />
                    )}
                  </View>
                  <Text style={s.uploadBoxTitle}>
                    {uploading ? 'Uploading picture...' : 'Choose Profile Picture'}
                  </Text>
                  <Text style={s.uploadBoxSubtitle}>
                    Supports JPEG, PNG, WEBP files
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View>
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
              </View>
              <Text style={s.helperText}>Seeds are unique keys for your generated profile icon.</Text>
            </View>
          )}
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

        {/* Natural Voice TTS Section */}
        <View style={s.card}>
          <Text style={s.label}>READALOUD NATURAL VOICE (MICROSOFT TTS)</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.inkMid, marginBottom: 12 }}>
            Choose your preferred Microsoft natural voice for reading study notes aloud. Stored locally on this device.
          </Text>

          <View style={{ gap: 8, marginBottom: 16 }}>
            {MICROSOFT_VOICES.map((v) => {
              const isSelected = selectedVoice === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? (C.activeText || '#27AE60') : C.border,
                    backgroundColor: isSelected ? (C.activeBg || 'rgba(39,174,96,0.08)') : C.surface,
                  }}
                  onPress={async () => {
                    setSelectedVoice(v.id);
                    await setDefaultVoice(v.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 14, color: isSelected ? (C.activeText || '#27AE60') : C.ink }}>
                      {v.name}
                    </Text>
                    <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.inkMid }}>
                      Language: {v.lang} • Gender: {v.gender}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.activeText || '#27AE60', justifyContent: 'center', alignItems: 'center' }}>
                      <CheckIcon color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: C.border,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={async () => {
              if (testingVoice) {
                await stopSpeech();
                setTestingVoice(false);
              } else {
                setTestingVoice(true);
                await speakText(
                  "Hello! This is a preview of your default Microsoft natural reading voice for Colearn study notes.",
                  {
                    voiceId: selectedVoice,
                    onDone: () => setTestingVoice(false),
                    onError: () => setTestingVoice(false),
                  }
                );
              }
            }}
            activeOpacity={0.8}
          >
            {testingVoice ? (
              <ActivityIndicator size="small" color={C.ink} />
            ) : (
              <SparklesIcon color={C.ink} />
            )}
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>
              {testingVoice ? 'Playing Preview...' : 'Test Selected Voice'}
            </Text>
          </TouchableOpacity>
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
  sourceToggleContainer: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: C.bgAlt || '#F4F4F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    width: '100%',
    maxWidth: 240,
    alignSelf: 'center',
  },
  sourceToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sourceToggleBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sourceToggleText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.inkLight,
  },
  sourceToggleTextActive: {
    color: C.ink,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bgAlt || '#FAFAFA',
    minHeight: 120,
    marginBottom: 16,
  },
  uploadBoxActive: {
    borderColor: C.ink,
    backgroundColor: C.surface,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.ink,
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadBoxSubtitle: {
    fontFamily: F.medium,
    fontSize: 11,
    color: C.inkLight,
    textAlign: 'center',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#E6F4EA',
    borderColor: '#A3E4D7',
    marginTop: 12,
    width: '100%',
  },
  activeBannerTitle: {
    fontFamily: F.bold,
    fontSize: 12,
    color: '#196F3D',
  },
  activeBannerSubtitle: {
    fontFamily: F.medium,
    fontSize: 10,
    color: '#229954',
    marginTop: 2,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  removeBtnText: {
    fontFamily: F.bold,
    fontSize: 11,
    color: C.inkMid,
  },
});
