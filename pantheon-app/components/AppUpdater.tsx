import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_HARDCODED_AVUUID, APP_BUILD_VERSION } from '../constants/versionConfig';
import { saveAppVersionLocal, getAppVersionLocal } from '../lib/db';

interface MobileSystemRelease {
  versionNumber: string;
  secretPhrase?: string;
  avuuid: string;
  changelog: string;
  isMandatory: boolean;
  hostMode: 'colearn' | 'playstore';
  downloadUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
}

export function AppUpdater() {
  const [modalVisible, setModalVisible] = useState(false);
  const [release, setRelease] = useState<MobileSystemRelease | null>(null);

  useEffect(() => {
    checkAppVersion();
  }, []);

  const checkAppVersion = async () => {
    try {
      // Sync local SQLite with current build defaults first if empty
      const local = getAppVersionLocal();
      if (!local.avuuid) {
        saveAppVersionLocal(APP_BUILD_VERSION, APP_HARDCODED_AVUUID);
      }

      // Fetch active mobile release doc from Firestore
      const snap = await getDoc(doc(db, 'system', 'mobile'));
      if (!snap.exists()) return;

      const active = snap.data() as MobileSystemRelease;
      if (!active || !active.versionNumber) return;

      // Check if active version differs from app's hardcoded hash or version
      const isNewVersionAvailable =
        active.avuuid !== APP_HARDCODED_AVUUID ||
        active.versionNumber !== APP_BUILD_VERSION;

      if (!isNewVersionAvailable) return;

      // If update is optional (isMandatory === false), check if user previously refused this version
      if (!active.isMandatory) {
        const refused = await AsyncStorage.getItem(`@update_refused_${active.versionNumber}`);
        if (refused === 'true') {
          console.log(`[AppUpdater] User previously refused optional update v${active.versionNumber}. Suppressing prompt.`);
          return;
        }
      }

      setRelease(active);
      setModalVisible(true);
    } catch (err) {
      console.error('[AppUpdater] Failed to check for app updates:', err);
    }
  };

  const handleRefuse = async () => {
    if (!release) return;
    try {
      await AsyncStorage.setItem(`@update_refused_${release.versionNumber}`, 'true');
      setModalVisible(false);
    } catch (e) {
      console.error('Failed to save update refusal state:', e);
      setModalVisible(false);
    }
  };

  const handleDownloadAndUpdate = async () => {
    const url = release?.downloadUrl;
    if (!url) {
      Alert.alert('Error', 'Download link is not configured in Firebase.');
      return;
    }

    try {
      if (Platform.OS === 'android') {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: url,
            packageName: 'com.android.chrome',
          });
          return;
        } catch {
          // Fallback if Chrome package intent cannot be resolved directly
        }
      }
      await Linking.openURL(url);
    } catch (err) {
      console.error('[AppUpdater] Failed to open download link:', err);
      Alert.alert('Error', 'Could not open Chrome or browser for download.');
    }
  };

  if (!modalVisible || !release) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={modalVisible}
      onRequestClose={() => {
        if (!release.isMandatory) handleRefuse();
      }}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.badgeRow}>
            <View style={[s.badge, release.isMandatory ? s.badgeMandatory : s.badgeOptional]}>
              <Text style={s.badgeText}>
                {release.isMandatory ? 'CRITICAL UPDATE' : 'NEW UPDATE AVAILABLE'}
              </Text>
            </View>
          </View>

          <Text style={s.title}>Update CoLearn Mobile</Text>
          <Text style={s.versionSub}>
            Version v{release.versionNumber} is now available
          </Text>

          <ScrollView style={s.changelogBox} showsVerticalScrollIndicator={false}>
            <Text style={s.changelogHeading}>What's New:</Text>
            <Text style={s.changelogText}>
              {release.changelog || 'Performance improvements and bug fixes.'}
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={handleDownloadAndUpdate}
              activeOpacity={0.8}
            >
              <Text style={s.btnPrimaryText}>Download and update</Text>
            </TouchableOpacity>

            {!release.isMandatory && (
              <TouchableOpacity
                style={s.btnSecondary}
                onPress={handleRefuse}
                activeOpacity={0.8}
              >
                <Text style={s.btnSecondaryText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeMandatory: {
    backgroundColor: '#FEE2E2',
  },
  badgeOptional: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    color: '#000000',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  versionSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  changelogBox: {
    maxHeight: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  changelogHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  changelogText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  actionRow: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  btnSecondary: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
});
