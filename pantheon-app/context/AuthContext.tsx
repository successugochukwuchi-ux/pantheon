const LOCAL_ACTIVE_SESSION_ID = Math.random().toString(36).substring(2, 15);
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc, orderBy, limit } from 'firebase/firestore';
import { Alert, AppState, Platform, Modal, View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../lib/firebase';
import { saveCoursesFromServer, clearUserProfileLocal, clearAllCoursesLocal, saveLastLoggedInStudentId, saveProfileLocal, getUserProfileLocal } from '../lib/db';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import { getDeviceUUID, getUserDeviceUUID, generateNewDeviceUUID, getMobileDeviceName } from '../lib/device';
import { fetchMobileAdminContactForUniversity, MobileAdminContact } from '../lib/support';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface UserProfile {
  uid: string;
  studentId: string;
  email: string;
  username: string;
  department: string;
  mobileNumber: string;
  academicLevel: string;
  level: string;
  permissionLevel: string;
  isActivated: boolean;
  remainingsemesters?: number;
  remainingSemesters?: number;
  referralCount: number;
  referredBy: string | null;
  theme: string;
  photoURL: string;
  createdAt: string;
  isBanned?: boolean;
  banReason?: string;
  At?: string;
  currentSessionId?: string;
  canTakeScreenshots?: boolean;
  screenshotAllowed?: boolean;
}

interface SystemConfig {
  currentSemester: '1st' | '2nd' | 'none';
  maintenanceMode: boolean;
}

export interface PromoConfig {
  isActive: boolean;
  quota: number;
  count: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  systemConfig: SystemConfig | null;
  promoConfig: PromoConfig | null;
  loading: boolean;
  isOffline: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  systemConfig: null,
  promoConfig: null,
  loading: true,
  isOffline: false,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [promoConfig, setPromoConfig] = useState<PromoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [prevSemester, setPrevSemester] = useState<string | null>(null);
  const [prevAcademicLevel, setPrevAcademicLevel] = useState<string | null>(null);

  const [deviceLimitModalInfo, setDeviceLimitModalInfo] = useState<{
    visible: boolean;
    admin: MobileAdminContact | null;
    email: string;
    studentId: string;
    semester: string;
  }>({
    visible: false,
    admin: null,
    email: '',
    studentId: '',
    semester: '1st',
  });

  useEffect(() => {
    if (systemConfig) {
      if (prevSemester && prevSemester !== systemConfig.currentSemester) {
        console.log(`[Semester Change] Semester changed from ${prevSemester} to ${systemConfig.currentSemester}. Deleting downloaded SQLite courses...`);
        try {
          clearAllCoursesLocal();
        } catch (e) {
          console.error("Failed to clear local courses on semester switch:", e);
        }
      }
      setPrevSemester(systemConfig.currentSemester);
    }
  }, [systemConfig?.currentSemester]);

  useEffect(() => {
    if (profile?.academicLevel) {
      if (prevAcademicLevel && prevAcademicLevel !== profile.academicLevel) {
        console.log(`[Academic Level Change] Academic level changed from ${prevAcademicLevel} to ${profile.academicLevel}. Clearing local downloaded SQLite courses...`);
        try {
          clearAllCoursesLocal();
          AsyncStorage.removeItem('colearn_last_downloaded_uid').catch(() => {});
        } catch (e) {
          console.error("Failed to clear local courses on academic level switch:", e);
        }
      }
      setPrevAcademicLevel(profile.academicLevel);
    }
  }, [profile?.academicLevel]);

  useEffect(() => {
    async function initAuth() {
      try {
        const cachedProfile = await AsyncStorage.getItem('colearn_profile');
        if (cachedProfile) {
          setProfile(JSON.parse(cachedProfile));
        }
        const cachedConfig = await AsyncStorage.getItem('colearn_system_config');
        if (cachedConfig) {
          setSystemConfig(JSON.parse(cachedConfig));
        }
        const cachedPromo = await AsyncStorage.getItem('colearn_promo_config');
        if (cachedPromo) {
          setPromoConfig(JSON.parse(cachedPromo));
        }
      } catch (err) {
        console.log('Failed to load cached auth details:', err);
      }

      // Fetch system config and save locally
      const unsubscribeConfig = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
        if (snapshot.exists()) {
          const config = snapshot.data() as SystemConfig;
          setSystemConfig(config);
          AsyncStorage.setItem('colearn_system_config', JSON.stringify(config)).catch(() => {});
        }
      }, (err) => {
        console.log('Offline: Using local copy for system config:', err);
      });

      // Fetch promo config and save locally
      const unsubscribePromo = onSnapshot(doc(db, 'system', 'promo'), (snapshot) => {
        if (snapshot.exists()) {
          const pConfig = snapshot.data() as PromoConfig;
          setPromoConfig(pConfig);
          AsyncStorage.setItem('colearn_promo_config', JSON.stringify(pConfig)).catch(() => {});
        }
      }, (err) => {
        console.log('Offline: Using local copy for promo config:', err);
      });

      const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (!u) {
          setProfile(null);
          setLoading(false);
          await AsyncStorage.removeItem('colearn_profile').catch(() => {});
          await AsyncStorage.removeItem('colearn_system_config').catch(() => {});
          try {
            clearUserProfileLocal();
          } catch (e) {
            console.log('Error clearing local user profile:', e);
          }
        } else {
          try {
            const cachedProfile = await AsyncStorage.getItem('colearn_profile');
            if (cachedProfile) {
              setLoading(false);
            }
          } catch (e) {
            console.log(e);
          }
        }
      });

      return () => {
        unsubscribeAuth();
        unsubscribeConfig();
        unsubscribePromo();
      };
    }

    const unsubPromise = initAuth();
    return () => {
      unsubPromise.then((unsub) => unsub?.()).catch((err) => console.log(err));
    };
  }, []);

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    if (user) {
      const setupProfileAndSession = async () => {
        // 0. Instantly hydrate profile from local SQLite (0 delay, 0 reads)
        try {
          const cachedLocal = getUserProfileLocal(user.uid);
          if (cachedLocal) {
            setProfile(cachedLocal);
            setLoading(false);
          }
        } catch (e) {}

        // Get current semester
        let currentSemester = '1st';
        try {
          const configSnap = await getDoc(doc(db, 'system', 'config'));
          if (configSnap.exists()) {
            currentSemester = configSnap.data().currentSemester || '1st';
          }
        } catch (e) {}

        // Fetch user document once to verify device slot before starting listener
        let userSnap;
        try {
          userSnap = await getDoc(doc(db, 'users', user.uid));
        } catch (e) {
          console.error("Failed to fetch user doc for device verification:", e);
        }

        const userData = userSnap?.exists() ? userSnap.data() : {};
        const isLevel5 = userData.level === '5' || user.email === 'successugochukwuchi@gmail.com';
        let devices = userData.devices || [];
        const currentDevices = devices.filter((d: any) => d.semester === currentSemester);

        let deviceId = await getUserDeviceUUID(user.uid);
        const deviceName = getMobileDeviceName();

        if (deviceId) {
          // Device has stored UUID for this user account
          const matched = currentDevices.find((d: any) => d.id === deviceId);
          if (!matched) {
            if (!isLevel5 && currentDevices.length >= 2) {
              const adminContact = await fetchMobileAdminContactForUniversity(userData.At);
              setDeviceLimitModalInfo({
                visible: true,
                admin: adminContact,
                email: user.email || userData.email || '',
                studentId: userData.studentId || '',
                semester: currentSemester,
              });
              setProfile(null);
              signOut(auth).catch(() => {});
              Alert.alert(
                "Device Limit Reached",
                `This account has reached the maximum of 2 devices for this semester.\n\nAvailable Administrator for ${(userData.At || 'futo').toUpperCase()}:\n• Name: ${adminContact.name}\n• WhatsApp: +${adminContact.whatsapp}`,
                [
                  { text: "Dismiss", style: "cancel" },
                  {
                    text: "Chat on WhatsApp",
                    onPress: () => {
                      const msg = encodeURIComponent(`Hello ${adminContact.name}, I reached the 2-device limit on my CoLearn account (${user.email || userData.email || ''}${userData.studentId ? `, Student ID: ${userData.studentId}` : ''}) for ${currentSemester} semester. Please help reset or unlink my device.`);
                      Linking.openURL(`https://wa.me/${adminContact.whatsapp}?text=${msg}`).catch(() => {});
                    }
                  },
                  {
                    text: "Call Admin",
                    onPress: () => {
                      Linking.openURL(`tel:${adminContact.phone.replace(/\s+/g, '')}`).catch(() => {});
                    }
                  }
                ]
              );
              return;
            } else {
              // Re-register device
              const newDevice = {
                id: deviceId,
                name: deviceName,
                semester: currentSemester,
                os: Platform.OS,
                addedAt: new Date().toISOString()
              };
              currentDevices.push(newDevice);
              await updateDoc(doc(db, 'users', user.uid), { devices: currentDevices }).catch(() => {});
            }
          } else if (matched.name !== deviceName) {
            matched.name = deviceName;
            await updateDoc(doc(db, 'users', user.uid), { devices: currentDevices }).catch(() => {});
          }
        } else {
          // First time on this device for this user account
          if (!isLevel5 && currentDevices.length >= 2) {
            const adminContact = await fetchMobileAdminContactForUniversity(userData.At);
            setDeviceLimitModalInfo({
              visible: true,
              admin: adminContact,
              email: user.email || userData.email || '',
              studentId: userData.studentId || '',
              semester: currentSemester,
            });
            setProfile(null);
            signOut(auth).catch(() => {});
            Alert.alert(
                "Device Limit Reached",
                `This account has reached the maximum of 2 devices for this semester.\n\nAvailable Administrator for ${(userData.At || 'futo').toUpperCase()}:\n• Name: ${adminContact.name}\n• WhatsApp: +${adminContact.whatsapp}`,
                [
                  { text: "Dismiss", style: "cancel" },
                  {
                    text: "Chat on WhatsApp",
                    onPress: () => {
                      const msg = encodeURIComponent(`Hello ${adminContact.name}, I reached the 2-device limit on my CoLearn account (${user.email || userData.email || ''}${userData.studentId ? `, Student ID: ${userData.studentId}` : ''}) for ${currentSemester} semester. Please help reset or unlink my device.`);
                      Linking.openURL(`https://wa.me/${adminContact.whatsapp}?text=${msg}`).catch(() => {});
                    }
                  },
                  {
                    text: "Call Admin",
                    onPress: () => {
                      Linking.openURL(`tel:${adminContact.phone.replace(/\s+/g, '')}`).catch(() => {});
                    }
                  }
                ]
              );
            return;
          } else {
            deviceId = await generateNewDeviceUUID(user.uid);
            const newDevice = {
              id: deviceId,
              name: deviceName,
              semester: currentSemester,
              os: Platform.OS,
              addedAt: new Date().toISOString()
            };
            currentDevices.push(newDevice);
            await updateDoc(doc(db, 'users', user.uid), { devices: currentDevices }).catch(() => {});
          }
        }

        const activeDeviceId = deviceId;

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const isUserLevel5 = data.level === '5' || user.email === 'successugochukwuchi@gmail.com';
            const liveDevices = (data.devices || []).filter((d: any) => d.semester === currentSemester);
            
            // Disconnect ONLY if activeDeviceId was explicitly removed from liveDevices (exempt L5)
            const stillRegistered = isUserLevel5 || liveDevices.some((d: any) => d.id === activeDeviceId);

            if (!stillRegistered) {
              setProfile(null);
              signOut(auth).catch(err => console.log('Sign out error:', err));
              Alert.alert(
                "Device Disconnected",
                "Your device has been forcefully disconnected by an administrator."
              );
              return;
            }

            // Removed old session ID checks to allow two devices to stay online
            
            const normalizedProfile: UserProfile = {
              uid: user.uid,
              studentId: data.studentId || '', 
              email: data.email || user.email || '',
              username: data.username || data.name || 'Student',
              department: data.department || 'Student',
              mobileNumber: data.mobileNumber || data.phone || '',
              // Match web app: level is permission, academicLevel is the study level
              academicLevel: data.academicLevel || '100',
              level: data.level || '1',
              permissionLevel: data.level || '1',
              isActivated: data.isActivated ?? false,
              remainingsemesters: data.remainingsemesters ?? data.remainingSemesters ?? (data.level === '3' ? (data.isActivated ? 1 : 0) : undefined),
              remainingSemesters: data.remainingsemesters ?? data.remainingSemesters ?? (data.level === '3' ? (data.isActivated ? 1 : 0) : undefined),
              referralCount: data.referralCount || 0,
              referredBy: data.referredBy || null,
              theme: data.theme || 'light',
              photoURL: data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toDate?.().toISOString() || new Date().toISOString()) : new Date().toISOString(),
              isBanned: data.isBanned ?? false,
              banReason: data?.banReason || '',
              At: data.At || 'futo',
              canTakeScreenshots: data.canTakeScreenshots ?? data.screenshotAllowed ?? false,
              screenshotAllowed: data.canTakeScreenshots ?? data.screenshotAllowed ?? false,
            };

            // If studentId is missing, generate a pretty placeholder
            if (!normalizedProfile.studentId) {
               normalizedProfile.studentId = `CLN-${user.uid.slice(0, 4).toUpperCase()}-${user.uid.slice(-4).toUpperCase()}`;
            }

            saveLastLoggedInStudentId(normalizedProfile.studentId);
            saveProfileLocal(normalizedProfile);
            setProfile(normalizedProfile);
            AsyncStorage.setItem('colearn_profile', JSON.stringify(normalizedProfile)).catch(() => {});
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to session (offline fallback used):', error);
          setLoading(false);
        });
      };
      setupProfileAndSession();
    }

    return () => unsubscribeProfile();
  }, [user]);



  // Keep track of connection status periodically
  useEffect(() => {
    async function verifyConnection() {
      // Always ping google to ensure accurate offline status, even if navigator.onLine is true
      // Sometimes navigator.onLine is true but actual internet is unavailable
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(id);
        setIsOffline(false);
      } catch (err) {
        setIsOffline(true);
      }
    }

    verifyConnection();
    const interval = setInterval(verifyConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Background Notification Dispatcher
  useEffect(() => {
    if (!profile || isOffline) return;

    // A. Environment and Permission Setup via expo-notifications & Web APIs
    const requestPermissions = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (e) {
        console.log('Background expo-notification permission check/request failed:', e);
      }

      // Web Notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch (e) {
            console.log('Web Notification permission request failed:', e);
          }
        }
      }
    };
    requestPermissions();

    const showLocalNotify = async (title: string, body: string) => {
      // 1. Mobile (Expo) Notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: null, // deliver immediately
        });
      } catch (e) {
        console.warn("Failed scheduling local mobile notification:", e);
      }

      // 2. Web/Desktop Notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, { body });
          } catch (e) {
            console.warn("Failed standard web Notification instantiation:", e);
          }
        }
      }
    };

    const unsubscribes: (() => void)[] = [];

    // Track processed IDs to prevent duplicate alerts on initial loading/snapshot fires
    const knownNotificationIds = new Set<string>();
    const knownAnnouncementIds = new Set<string>();
    const knownFriendRequestIds = new Set<string>();
    const knownDiscussionIds = new Set<string>();
    const seenChatUpdates = new Set<string>();
    const knownNewsIds = new Set<string>();

    let isNotificationsInitial = true;
    let isAnnouncementsInitial = true;
    let isFriendRequestsInitial = true;
    let isDiscussionsInitial = true;
    let isChatsInitial = true;
    let isNewsInitial = true;

    // 1. Friend Requests Listener
    try {
      const qFriendReq = query(
        collection(db, 'friend_requests'),
        where('toUid', '==', profile.uid),
        where('status', '==', 'pending')
      );
      const unsub = onSnapshot(qFriendReq, (snap) => {
        if (isFriendRequestsInitial) {
          snap.docs.forEach(doc => knownFriendRequestIds.add(doc.id));
          isFriendRequestsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownFriendRequestIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownFriendRequestIds.add(change.doc.id);
            showLocalNotify(
              "New Friend Request",
              `${data.fromUsername || 'Someone'} passed you a friend request!`
            );
          }
        });
      }, (err) => console.log("Bg Notify: Friend Requests error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: Friend requests subscriber failed:", e);
    }

    // 2. Direct Messages and Group Chat (chats)
    try {
      const qChats = query(
        collection(db, 'chats'),
        where('uids', 'array-contains', profile.uid)
      );
      const unsub = onSnapshot(qChats, (snap) => {
        if (isChatsInitial) {
          snap.docs.forEach(doc => {
            const d = doc.data();
            if (d.lastUpdatedAt) {
              seenChatUpdates.add(`${doc.id}_${d.lastUpdatedAt}`);
            }
          });
          isChatsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (data.lastSenderId && data.lastSenderId !== profile.uid) {
              const signature = `${change.doc.id}_${data.lastUpdatedAt}`;
              if (!seenChatUpdates.has(signature)) {
                seenChatUpdates.add(signature);
                const title = data.type === 'dm' ? "Direct Message" : (data.name || "Study Alliance Chat");
                showLocalNotify(title, data.lastMessage || "New message received!");
              }
            }
          }
        });
      }, (err) => console.log("Bg Notify: Chats error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: Chats subscription failed:", e);
    }

    // 3. User Notifications
    try {
      const qNotif = query(
        collection(db, 'notifications'),
        where('userId', '==', profile.uid)
      );
      const unsub = onSnapshot(qNotif, (snap) => {
        if (isNotificationsInitial) {
          snap.docs.forEach(doc => knownNotificationIds.add(doc.id));
          isNotificationsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownNotificationIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownNotificationIds.add(change.doc.id);
            if (!data.isRead) {
              showLocalNotify(
                data.title || "New Notification",
                data.desc || data.message || "An update occurred."
              );
            }
          }
        });
      }, (err) => console.log("Bg Notify: Notifications error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: Notifications trigger failed:", e);
    }

    // 4. Institutional Announcements (limited to last 15 to save reads)
    try {
      const qAnn = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(15)
      );
      const unsub = onSnapshot(qAnn, (snap) => {
        if (isAnnouncementsInitial) {
          snap.docs.forEach(doc => knownAnnouncementIds.add(doc.id));
          isAnnouncementsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownAnnouncementIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownAnnouncementIds.add(change.doc.id);
            
            // Check university filter
            if (data.At && profile.At && data.At !== profile.At) {
              return;
            }
            
            // Check if announcement targets us
            const userDept = (profile.department || '').toLowerCase();
            const userLevel = (profile.academicLevel || '100').replace('LVL', '').replace('lvl', '');
            
            let isTarget = false;
            if (data.targetType === 'all') isTarget = true;
            else if (data.targetType === 'uid' && data.targetValue === profile.uid) isTarget = true;
            else if (data.targetType === 'department' && (profile.department || '').toLowerCase().includes((data.targetValue || '').toLowerCase())) isTarget = true;
            else if (data.targetType === 'academicLevel' && (data.targetValue || '').replace('LVL', '').replace('lvl', '') === userLevel) isTarget = true;

            if (isTarget) {
              showLocalNotify(
                "New Announcement: " + (data.title || "Campus Bulletin"),
                data.desc || data.detail || "Academic board published an alert."
              );
            }
          }
        });
      }, (err) => console.log("Bg Notify: Announcements error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: Announcements subscription failed:", e);
    }

    // 5. Discussion board listener removed to save Firestore reads (study groups notifications are disabled)

    // 6. News Board (news, limited to last 10 to save reads)
    try {
      const qNews = query(
        collection(db, 'news'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const unsub = onSnapshot(qNews, (snap) => {
        if (isNewsInitial) {
          snap.docs.forEach(doc => knownNewsIds.add(doc.id));
          isNewsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownNewsIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownNewsIds.add(change.doc.id);
            if (data.At && profile.At && data.At !== profile.At) {
              return;
            }
            showLocalNotify(
              "News Board: " + (data.title || "Latest Update"),
              data.content || data.body || "New campus update posted"
            );
          }
        });
      }, (err) => console.log("Bg Notify: News Board error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: News Board subscription failed:", e);
    }

    // Unsubscribe all trackers on cleanup or profile change
    return () => {
      unsubscribes.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    };
  }, [profile, isOffline]);

  const logout = async () => {
    try {
      setLoading(true);
      if (profile?.studentId) {
        saveLastLoggedInStudentId(profile.studentId);
      }
      await signOut(auth);
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem('colearn_profile').catch(() => {});
      await AsyncStorage.removeItem('colearn_system_config').catch(() => {});
      await AsyncStorage.removeItem('colearn_promo_config').catch(() => {});
      // Note: We retain downloaded offline courses and student ID in SQLite
      // so if the same user or another user with identical courses logs in,
      // redundant re-syncing is completely skipped.
      try {
        clearUserProfileLocal();
      } catch (e) {
        console.log('Error clearing local user profile cache:', e);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig, promoConfig, loading, isOffline, logout }}>
      {children}

      {deviceLimitModalInfo.visible && deviceLimitModalInfo.admin && (
        <Modal
          visible={deviceLimitModalInfo.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setDeviceLimitModalInfo(prev => ({ ...prev, visible: false }))}
        >
          <View style={mobileDeviceLimitStyles.overlay}>
            <View style={mobileDeviceLimitStyles.card}>
              <View style={mobileDeviceLimitStyles.badge}>
                <Text style={mobileDeviceLimitStyles.badgeText}>
                  {deviceLimitModalInfo.admin.university} CAMPUS DESK
                </Text>
              </View>

              <Text style={mobileDeviceLimitStyles.title}>Device Limit Reached</Text>
              <Text style={mobileDeviceLimitStyles.description}>
                This account has reached the maximum of 2 devices for the current semester ({deviceLimitModalInfo.semester}).
              </Text>

              <View style={mobileDeviceLimitStyles.adminBox}>
                <Text style={mobileDeviceLimitStyles.adminRole}>Available Administrator</Text>
                <Text style={mobileDeviceLimitStyles.adminName}>{deviceLimitModalInfo.admin.name}</Text>
                <Text style={mobileDeviceLimitStyles.adminPhone}>{deviceLimitModalInfo.admin.phone}</Text>
              </View>

              <TouchableOpacity
                style={mobileDeviceLimitStyles.whatsappButton}
                activeOpacity={0.8}
                onPress={() => {
                  const msg = encodeURIComponent(
                    `Hello ${deviceLimitModalInfo.admin?.name}, I reached the 2-device limit on my CoLearn account (${deviceLimitModalInfo.email}${deviceLimitModalInfo.studentId ? `, Student ID: ${deviceLimitModalInfo.studentId}` : ''}) for ${deviceLimitModalInfo.semester} semester. Please help reset or unlink my device.`
                  );
                  Linking.openURL(`https://wa.me/${deviceLimitModalInfo.admin?.whatsapp}?text=${msg}`).catch(() => {});
                }}
              >
                <Text style={mobileDeviceLimitStyles.whatsappButtonText}>💬 Chat on WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={mobileDeviceLimitStyles.callButton}
                activeOpacity={0.8}
                onPress={() => {
                  if (deviceLimitModalInfo.admin?.phone) {
                    Linking.openURL(`tel:${deviceLimitModalInfo.admin.phone.replace(/\s+/g, '')}`).catch(() => {});
                  }
                }}
              >
                <Text style={mobileDeviceLimitStyles.callButtonText}>📞 Call Administrator</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={mobileDeviceLimitStyles.dismissButton}
                activeOpacity={0.7}
                onPress={() => setDeviceLimitModalInfo(prev => ({ ...prev, visible: false }))}
              >
                <Text style={mobileDeviceLimitStyles.dismissButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </AuthContext.Provider>
  );
}

const mobileDeviceLimitStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  adminBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  adminName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  adminPhone: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  whatsappButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  callButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    height: 44,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  callButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
});

