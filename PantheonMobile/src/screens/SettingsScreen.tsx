import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { themes } from '../theme/colors';
import { Copy, Check, Moon, Sun, Palette, Droplets, TreePine, User, Save } from 'lucide-react-native';
import Clipboard from '@react-native-clipboard/clipboard';

export const SettingsScreen = () => {
  const { user, profile } = useAuth();
  const { theme: currentTheme, setTheme, colors } = useTheme();

  const [username, setUsername] = useState(profile?.username || '');
  const [avatarSeed, setAvatarSeed] = useState(profile?.username || user?.uid || 'default');
  const [avatarStyle, setAvatarStyle] = useState('avataaars');
  const [loading, setLoading] = useState(false);

  const avatarStyles = [
    'adventurer', 'avataaars', 'big-smile', 'bottts', 'croodles',
    'fun-emoji', 'lorelei', 'notionists', 'open-peeps', 'pixel-art'
  ];

  const themeOptions = [
    { id: 'light', name: 'Light', icon: Sun },
    { id: 'dark', name: 'Dark', icon: Moon },
    { id: 'sepia', name: 'Sepia', icon: Palette },
    { id: 'ocean', name: 'Ocean', icon: Droplets },
    { id: 'forest', name: 'Forest', icon: TreePine },
    { id: 'midnight', name: 'Midnight', icon: Moon },
    { id: 'sunset', name: 'Sunset', icon: Sun },
    { id: 'lavender', name: 'Lavender', icon: Palette },
  ];

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      if (user) {
        const photoURL = `https://api.dicebear.com/7.x/${avatarStyle}/png?seed=${avatarSeed}`;
        await updateProfile(user, { photoURL });
        await updateDoc(doc(db, 'users', user.uid), {
          username: username,
          photoURL: photoURL
        });
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'ID copied to clipboard');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile & Avatar</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.avatarContainer}>
            <DicebearAvatar seed={avatarSeed} style={avatarStyle} size={80} />
            <View style={styles.avatarInputs}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Avatar Seed</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                value={avatarSeed}
                onChangeText={setAvatarSeed}
                placeholder="Enter seed..."
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Username</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 12 }]}>Avatar Style</Text>
          <View style={styles.styleGrid}>
            {avatarStyles.map(style => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleBtn,
                  {
                    backgroundColor: avatarStyle === style ? colors.primary : colors.muted,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setAvatarStyle(style)}
              >
                <Text style={[
                  styles.styleBtnText,
                  { color: avatarStyle === style ? colors.primaryForeground : colors.foreground }
                ]}>
                  {style.replace('-', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleUpdateProfile}
            disabled={loading}
          >
            <Save size={20} color={colors.primaryForeground} />
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Profile Changes</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Appearance</Text>
        <View style={styles.themeGrid}>
          {themeOptions.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.themeCard,
                {
                  borderColor: currentTheme === t.id ? colors.primary : colors.border,
                  backgroundColor: currentTheme === t.id ? colors.muted : colors.card
                }
              ]}
              onPress={() => setTheme(t.id as any)}
            >
              <View style={[styles.themeIcon, { backgroundColor: (themes as any)[t.id].primary }]}>
                <t.icon size={20} color={(themes as any)[t.id].primaryForeground} />
              </View>
              <Text style={[styles.themeName, { color: colors.foreground }]}>{t.name}</Text>
              {currentTheme === t.id && <Check size={14} color={colors.primary} style={styles.checkIcon} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account Identification</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.idRow}>
            <View>
              <Text style={[styles.idLabel, { color: colors.mutedForeground }]}>STUDENT ID</Text>
              <Text selectable style={[styles.idValue, { color: colors.foreground }]}>{profile?.studentId || 'N/A'}</Text>
            </View>
            <TouchableOpacity onPress={() => copyToClipboard(profile?.studentId || '')}>
              <Copy size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.idRow, { marginTop: 16 }]}>
            <View>
              <Text style={[styles.idLabel, { color: colors.mutedForeground }]}>PERMISSION LEVEL</Text>
              <Text style={[styles.idValue, { color: colors.foreground }]}>{profile?.level || '1'}</Text>
            </View>
          </View>

          <View style={[styles.idRow, { marginTop: 16 }]}>
            <View>
              <Text style={[styles.idLabel, { color: colors.mutedForeground }]}>FIREBASE UID</Text>
              <Text selectable style={[styles.idValue, { color: colors.foreground, fontSize: 12 }]}>{user?.uid}</Text>
            </View>
            <TouchableOpacity onPress={() => copyToClipboard(user?.uid || '')}>
              <Copy size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInputs: {
    flex: 1,
    marginLeft: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  styleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  styleBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  saveBtnText: {
    fontWeight: 'bold',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  themeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeName: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  idValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
