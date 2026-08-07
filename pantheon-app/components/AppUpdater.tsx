import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_HARDCODED_AVUUID, APP_BUILD_VERSION } from '../constants/versionConfig';
import { saveAppVersionLocal, getAppVersionLocal } from '../lib/db';

// Helper function to check if app can request package installs
const canRequestPackageInstalls = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    // Try to use Linking.canOpenURL to check if we can open the package installer
    const canOpen = await Linking.canOpenURL('package:com.pillara.colearn');
    return canOpen;
  } catch {
    return false;
  }
};

// Helper function to open the settings screen for granting install permission
const openInstallPermissionSettings = () => {
  if (Platform.OS === 'android') {
    // Open the settings screen where user can grant "Install unknown apps" permission
    // This opens the specific settings page for the current app
    IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:com.pillara.colearn`,
    });
  }
};

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
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleAppleAppStore = () => {
    if (!release?.appStoreUrl) {
      Alert.alert('Error', 'App Store link is not configured.');
      return;
    }
    Linking.openURL(release.appStoreUrl).catch(() => {
      Alert.alert('Error', 'Could not open App Store link.');
    });
  };

  const handlePlayStore = () => {
    if (!release?.playStoreUrl) {
      Alert.alert('Error', 'Play Store link is not configured.');
      return;
    }
    Linking.openURL(release.playStoreUrl).catch(() => {
      Alert.alert('Error', 'Could not open Play Store link.');
    });
  };

  const handleColearnDownload = async () => {
    if (!release?.downloadUrl) {
      Alert.alert('Error', 'Download URL for Android APK is missing.');
      return;
    }

    // On Android, check and prompt for "Install unknown apps" permission before downloading
    if (Platform.OS === 'android') {
      const canRequestInstalls = await canRequestPackageInstalls();
      if (!canRequestInstalls) {
        Alert.alert(
          'Permission Required',
          'To install updates, you need to grant the app permission to install unknown apps. Would you like to open settings to enable this permission?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                openInstallPermissionSettings();
              }
            }
          ]
        );
        return;
      }
    }

    try {
      setDownloading(true);
      setErrorMsg(null);
      setProgress(0);

      const targetPath = `${FileSystem.documentDirectory}colearn_v${release.versionNumber}.apk`;

      const downloadResumable = FileSystem.createDownloadResumable(
        release.downloadUrl,
        targetPath,
        {},
        (downloadProgress) => {
          const p =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          setProgress(Math.min(Math.max(p, 0), 1));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('Download returned empty file path.');
      }

      console.log('[AppUpdater] APK downloaded successfully:', result.uri);

      // Save new version info into SQLite
      saveAppVersionLocal(release.versionNumber, release.avuuid);

      // Trigger Android Intent Installer
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);

        // First, try to launch the install intent with proper flags for Android 7+
        // Using FLAG_GRANT_READ_URI_PERMISSION (1) and FLAG_ACTIVITY_NEW_TASK (268435456)
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1 | 268435456, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
            type: 'application/vnd.android.package-archive',
          });
        } catch (intentErr: any) {
          console.error('[AppUpdater] Install intent failed:', intentErr);
          // If the intent fails, it might be due to missing permission
          // Guide user to enable "Install unknown apps" permission
          Alert.alert(
            'Installation Failed',
            'The app needs permission to install updates. Would you like to open settings to enable "Install unknown apps" permission?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  openInstallPermissionSettings();
                }
              }
            ]
          );
          throw intentErr;
        }
      } else {
        Alert.alert('Success', 'Update package downloaded.');
      }

      setDownloading(false);
      if (!release.isMandatory) {
        setModalVisible(false);
      }
    } catch (err: any) {
      console.error('[AppUpdater] Download/Install error:', err);
      setDownloading(false);
      setErrorMsg(err.message || 'Failed to download or install the update.');
    }
  };

  if (!modalVisible || !release) return null;

  const isIOS = Platform.OS === 'ios';

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

          {downloading && (
            <View style={s.progressContainer}>
              <View style={s.progressHeader}>
                <Text style={s.progressText}>Downloading update...</Text>
                <Text style={s.progressText}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>
          )}

          {errorMsg && <Text style={s.errorText}>{errorMsg}</Text>}

          {/* Action Buttons */}
          <View style={s.actionRow}>
            {isIOS ? (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={handleAppleAppStore}
                activeOpacity={0.8}
              >
                <Text style={s.btnPrimaryText}>Update via App Store</Text>
              </TouchableOpacity>
            ) : release.hostMode === 'playstore' ? (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={handlePlayStore}
                activeOpacity={0.8}
              >
                <Text style={s.btnPrimaryText}>Install from Play Store</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btnPrimary, downloading && s.btnDisabled]}
                onPress={handleColearnDownload}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={s.btnPrimaryText}>Download & Install Update</Text>
                )}
              </TouchableOpacity>
            )}

            {!release.isMandatory && !downloading && (
              <TouchableOpacity
                style={s.btnSecondary}
                onPress={handleRefuse}
                activeOpacity={0.8}
              >
                <Text style={s.btnSecondaryText}>Skip for Now</Text>
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
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
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
  btnDisabled: {
    opacity: 0.6,
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
