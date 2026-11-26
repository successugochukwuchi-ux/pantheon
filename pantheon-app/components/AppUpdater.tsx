import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AppState,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
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
  downloadUrlArm64?: string;
  downloadUrlArm32?: string;
  playStoreUrl: string;
  appStoreUrl: string;
}

function selectBestApkUrl(rel: MobileSystemRelease): string {
  const archs = (Device.supportedCpuArchitectures || []).map((a) => a.toLowerCase());
  const isArm64 = archs.some((a) => a.includes('arm64') || a.includes('aarch64') || a.includes('v8'));
  const isArm32 = archs.some((a) => a.includes('armeabi') || a.includes('armv7'));

  if (isArm64) {
    return rel.downloadUrlArm64 || rel.downloadUrl || rel.downloadUrlArm32 || '';
  }
  if (isArm32) {
    return rel.downloadUrlArm32 || rel.downloadUrl || rel.downloadUrlArm64 || '';
  }
  return rel.downloadUrl || rel.downloadUrlArm64 || rel.downloadUrlArm32 || '';
}

type UpdatePhase = 'prompt' | 'downloading' | 'ready' | 'error';

const MIN_VALID_APK_BYTES = 500 * 1024; // 500 KB minimum sanity check to reject HTML error pages
const APK_CACHE_PREFIX = 'colearn-update-';

const INSTALLED_BUILD_MARKER_KEY = '@installed_build_marker';

function getSafeVersionKey(versionNumber: string): string {
  return versionNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatBytesToMb(bytes: number): string {
  if (!bytes || bytes <= 0) return '0.0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AppUpdater() {
  const [modalVisible, setModalVisible] = useState(false);
  const [release, setRelease] = useState<MobileSystemRelease | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('prompt');
  const [progress, setProgress] = useState(0);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [downloadedUri, setDownloadedUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLaunchingInstaller, setIsLaunchingInstaller] = useState(false);

  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);
  const lastProgressUiRef = useRef<number>(0);
  const awaitingInstallPermissionRef = useRef<boolean>(false);
  const downloadedUriRef = useRef<string | null>(null);
  downloadedUriRef.current = downloadedUri;

  const cleanupOldCachedApks = useCallback(async (keepFileName?: string) => {
    try {
      const dirs = [FileSystem.cacheDirectory, FileSystem.documentDirectory].filter(
        (d): d is string => Boolean(d)
      );
      await Promise.all(
        dirs.map(async (dir) => {
          try {
            const entries = await FileSystem.readDirectoryAsync(dir);
            await Promise.all(
              entries
                .filter((name) => name.toLowerCase().endsWith('.apk') && name !== keepFileName)
                .map((name) =>
                  FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => {})
                )
            );
          } catch {
            // Non-fatal per-directory cleanup
          }
        })
      );
    } catch {
      // Non-fatal cache cleanup
    }
  }, []);

  const cleanupInstalledBuildApksOnLaunch = useCallback(async () => {
    try {
      const currentMarker = `${APP_BUILD_VERSION}::${APP_HARDCODED_AVUUID}`;
      const local = getAppVersionLocal();
      const storedMarker = await AsyncStorage.getItem(INSTALLED_BUILD_MARKER_KEY).catch(() => null);

      const isFreshInstallOrUpgrade =
        !local.avuuid ||
        local.avuuid !== APP_HARDCODED_AVUUID ||
        local.versionNumber !== APP_BUILD_VERSION ||
        storedMarker !== currentMarker;

      if (isFreshInstallOrUpgrade) {
        saveAppVersionLocal(APP_BUILD_VERSION, APP_HARDCODED_AVUUID);
        await AsyncStorage.setItem(INSTALLED_BUILD_MARKER_KEY, currentMarker).catch(() => {});
        // Fresh install or newly updated version booted: purge all cached installer APKs
        await cleanupOldCachedApks();
        return;
      }

      // Always ensure no APK matching the currently running version lingers in cache
      const currentApkName = `${APK_CACHE_PREFIX}${getSafeVersionKey(APP_BUILD_VERSION)}.apk`;
      const dirs = [FileSystem.cacheDirectory, FileSystem.documentDirectory].filter(
        (d): d is string => Boolean(d)
      );
      await Promise.all(
        dirs.map((dir) =>
          FileSystem.deleteAsync(`${dir}${currentApkName}`, { idempotent: true }).catch(() => {})
        )
      );
    } catch {
      // Non-fatal background cleanup
    }
  }, [cleanupOldCachedApks]);

  const checkAppVersion = useCallback(async () => {
    try {
      // Fetch active mobile release doc from Firestore
      const snap = await getDoc(doc(db, 'system', 'mobile'));
      if (!snap.exists()) return;

      const active = snap.data() as MobileSystemRelease;
      if (!active || !active.versionNumber) return;

      // Check if active version differs from app's hardcoded hash or version
      const isNewVersionAvailable =
        active.avuuid !== APP_HARDCODED_AVUUID ||
        active.versionNumber !== APP_BUILD_VERSION;

      if (!isNewVersionAvailable) {
        // Already on current version; clean up any leftover cached installer APKs
        cleanupOldCachedApks();
        return;
      }

      // Purge any stale cached APKs that aren't for this exact pending release
      const activeApkName = `${APK_CACHE_PREFIX}${getSafeVersionKey(active.versionNumber)}.apk`;
      cleanupOldCachedApks(activeApkName);

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
  }, [cleanupOldCachedApks]);

  useEffect(() => {
    // Run local APK cleanup immediately in background (works offline too), then check Firestore
    cleanupInstalledBuildApksOnLaunch().finally(() => {
      checkAppVersion();
    });
  }, [cleanupInstalledBuildApksOnLaunch, checkAppVersion]);

  const launchApkInstaller = useCallback(async (localApkUri: string) => {
    if (Platform.OS !== 'android') return;
    setIsLaunchingInstaller(true);
    setErrorMsg(null);
    try {
      const contentUri = await FileSystem.getContentUriAsync(localApkUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch (err: any) {
      console.error('[AppUpdater] Failed to launch Android package installer:', err);
      setErrorMsg(
        err?.message || 'Could not launch the Android installer. Please allow install permission and try again.'
      );
      setPhase('ready');
    } finally {
      setIsLaunchingInstaller(false);
    }
  }, []);

  // Automatically re-launch the APK installer when the user returns from enabling "Install unknown apps"
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && awaitingInstallPermissionRef.current && downloadedUriRef.current) {
        awaitingInstallPermissionRef.current = false;
        launchApkInstaller(downloadedUriRef.current);
      }
    });
    return () => subscription.remove();
  }, [launchApkInstaller]);

  const openInstallPermissionSettings = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    awaitingInstallPermissionRef.current = true;
    const packageName = Application.applicationId || 'com.pillara.colearn';
    try {
      await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
        data: `package:${packageName}`,
      });
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.SECURITY_SETTINGS');
      } catch {
        awaitingInstallPermissionRef.current = false;
        Alert.alert(
          'Permission Required',
          'Open Android Settings > Apps > CoLearn > Install unknown apps and enable "Allow from this source".'
        );
      }
    }
  }, []);

  const handleRefuse = async () => {
    if (!release || phase === 'downloading') return;
    try {
      await AsyncStorage.setItem(`@update_refused_${release.versionNumber}`, 'true');
      setModalVisible(false);
    } catch (e) {
      console.error('Failed to save update refusal state:', e);
      setModalVisible(false);
    }
  };

  const handleCancelDownload = async () => {
    if (downloadResumableRef.current) {
      try {
        await downloadResumableRef.current.cancelAsync();
      } catch {
        // Ignore cancel errors
      }
      downloadResumableRef.current = null;
    }
    setPhase('prompt');
    setProgress(0);
    setBytesWritten(0);
    setBytesTotal(0);
    setErrorMsg(null);
  };

  const handleDownloadAndUpdate = async () => {
    if (!release) return;

    // Handle Play Store / App Store releases natively when configured
    if (Platform.OS === 'android' && release.hostMode === 'playstore' && release.playStoreUrl) {
      try {
        await Linking.openURL(release.playStoreUrl);
      } catch {
        Alert.alert('Error', 'Could not open Play Store listing.');
      }
      return;
    }

    if (Platform.OS !== 'android') {
      const storeUrl = release.appStoreUrl || release.downloadUrl;
      if (!storeUrl) {
        Alert.alert('Unavailable', 'Update link is currently unavailable. Please try again later.');
        return;
      }
      try {
        await Linking.openURL(storeUrl);
      } catch {
        Alert.alert('Error', 'Could not open update link.');
      }
      return;
    }

    const url = selectBestApkUrl(release);
    if (!url) {
      Alert.alert('Unavailable', 'Update link is currently unavailable. Please try again later.');
      return;
    }

    if (!FileSystem.cacheDirectory) {
      setErrorMsg('Local storage directory is unavailable for downloading the update.');
      setPhase('error');
      return;
    }

    const safeVersion = getSafeVersionKey(release.versionNumber);
    const fileName = `${APK_CACHE_PREFIX}${safeVersion}.apk`;
    const localApkUri = `${FileSystem.cacheDirectory}${fileName}`;

    try {
      // Remove older cached APK versions to keep device storage clean
      await cleanupOldCachedApks(fileName);

      // Reuse already-downloaded APK if valid (e.g., returning from settings)
      const existingInfo = await FileSystem.getInfoAsync(localApkUri);
      if (existingInfo.exists && typeof existingInfo.size === 'number' && existingInfo.size >= MIN_VALID_APK_BYTES) {
        setDownloadedUri(localApkUri);
        setPhase('ready');
        await launchApkInstaller(localApkUri);
        return;
      }

      if (existingInfo.exists) {
        await FileSystem.deleteAsync(localApkUri, { idempotent: true }).catch(() => {});
      }

      setPhase('downloading');
      setProgress(0);
      setBytesWritten(0);
      setBytesTotal(0);
      setErrorMsg(null);
      lastProgressUiRef.current = 0;

      const resumable = FileSystem.createDownloadResumable(
        url,
        localApkUri,
        {},
        (downloadProgress) => {
          const written = downloadProgress.totalBytesWritten || 0;
          const total = downloadProgress.totalBytesExpectedToWrite || 0;
          const ratio = total > 0 ? Math.min(1, Math.max(0, written / total)) : 0;
          const now = Date.now();
          if (now - lastProgressUiRef.current >= 150 || ratio >= 1) {
            lastProgressUiRef.current = now;
            setBytesWritten(written);
            setBytesTotal(total);
            setProgress(ratio);
          }
        }
      );

      downloadResumableRef.current = resumable;
      const result = await resumable.downloadAsync();
      downloadResumableRef.current = null;

      if (!result?.uri) {
        throw new Error('Download was interrupted before finishing.');
      }

      if (typeof result.status === 'number' && result.status >= 400) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
        throw new Error(`Update server returned HTTP ${result.status}.`);
      }

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || typeof fileInfo.size !== 'number' || fileInfo.size < MIN_VALID_APK_BYTES) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
        throw new Error('Downloaded file is incomplete or invalid. Please retry.');
      }

      setProgress(1);
      setBytesWritten(fileInfo.size);
      setBytesTotal(fileInfo.size);
      setDownloadedUri(result.uri);
      setPhase('ready');

      await launchApkInstaller(result.uri);
    } catch (err: any) {
      downloadResumableRef.current = null;
      const msg = String(err?.message || '');
      // Ignore user-initiated cancel
      if (msg.toLowerCase().includes('cancel')) {
        return;
      }
      console.error('[AppUpdater] In-app APK download failed:', err);
      setErrorMsg('Download failed. Check your internet connection and try again.');
      setPhase('error');
    }
  };

  if (!modalVisible || !release) return null;

  const progressPct = Math.round(progress * 100);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={modalVisible}
      onRequestClose={() => {
        if (!release.isMandatory && phase !== 'downloading') handleRefuse();
      }}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.badgeRow}>
            <View style={[s.badge, release.isMandatory ? s.badgeMandatory : s.badgeOptional]}>
              <Text style={s.badgeText}>
                {release.isMandatory ? 'UPDATE REQUIRED' : 'UPDATE AVAILABLE'}
              </Text>
            </View>
          </View>

          <Text style={s.title}>Update Available</Text>
          <Text style={s.versionSub}>
            Version v{release.versionNumber} is now available
          </Text>

          <ScrollView style={s.changelogBox} showsVerticalScrollIndicator={false}>
            <Text style={s.changelogHeading}>What's New:</Text>
            <Text style={s.changelogText}>
              {release.changelog || 'Performance improvements and bug fixes.'}
            </Text>
          </ScrollView>

          {phase === 'downloading' && (
            <View style={s.progressContainer}>
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Updating...</Text>
                <Text style={s.progressPct}>
                  {bytesTotal > 0 ? `${progressPct}%` : formatBytesToMb(bytesWritten)}
                </Text>
              </View>
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressFill,
                    { width: `${bytesTotal > 0 ? progressPct : 100}%`, opacity: bytesTotal > 0 ? 1 : 0.45 },
                  ]}
                />
              </View>
              <Text style={s.progressSub}>
                {bytesTotal > 0
                  ? `${formatBytesToMb(bytesWritten)} / ${formatBytesToMb(bytesTotal)}`
                  : `${formatBytesToMb(bytesWritten)} downloaded`}
              </Text>
            </View>
          )}

          {phase === 'ready' && (
            <View style={s.infoBanner}>
              <Text style={s.infoBannerTitle}>Update downloaded</Text>
              <Text style={s.infoBannerText}>
                If Android asks for permission to install apps, turn on "Allow from this source" for CoLearn and tap Install.
              </Text>
            </View>
          )}

          {phase === 'error' && errorMsg && (
            <View style={s.errorBanner}>
              <Text style={s.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={s.actionRow}>
            {phase === 'prompt' && (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={handleDownloadAndUpdate}
                activeOpacity={0.8}
              >
                <Text style={s.btnPrimaryText}>Update Now</Text>
              </TouchableOpacity>
            )}

            {phase === 'downloading' && (
              <TouchableOpacity
                style={s.btnSecondaryOutline}
                onPress={handleCancelDownload}
                activeOpacity={0.8}
              >
                <Text style={s.btnSecondaryOutlineText}>Cancel download</Text>
              </TouchableOpacity>
            )}

            {phase === 'ready' && (
              <>
                <TouchableOpacity
                  style={s.btnPrimary}
                  onPress={() => downloadedUri && launchApkInstaller(downloadedUri)}
                  disabled={isLaunchingInstaller}
                  activeOpacity={0.8}
                >
                  {isLaunchingInstaller ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={s.btnPrimaryText}>Install Update Now</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.btnSecondaryOutline}
                  onPress={openInstallPermissionSettings}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnSecondaryOutlineText}>Allow Install Permission</Text>
                </TouchableOpacity>
              </>
            )}

            {phase === 'error' && (
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={handleDownloadAndUpdate}
                activeOpacity={0.8}
              >
                <Text style={s.btnPrimaryText}>Retry Download</Text>
              </TouchableOpacity>
            )}

            {!release.isMandatory && phase !== 'downloading' && (
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
    maxHeight: 130,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111827',
    borderRadius: 4,
  },
  progressSub: {
    fontSize: 11,
    color: '#6B7280',
  },
  infoBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 3,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 17,
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
  btnSecondaryOutline: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryOutlineText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
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
