import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../lib/firebase';
import { saveCoursesFromServer, clearUserProfileLocal } from '../lib/db';

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
  referralCount: number;
  referredBy: string | null;
  theme: string;
  photoURL: string;
  createdAt: string;
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
        let activeSessionId = '';
        try {
          activeSessionId = await AsyncStorage.getItem('colearn_session_id') || '';
          if (!activeSessionId) {
            activeSessionId = Math.random().toString(36).substring(2, 15);
            await AsyncStorage.setItem('colearn_session_id', activeSessionId);
          }
        } catch (e) {
          activeSessionId = Math.random().toString(36).substring(2, 15);
        }

        // Just write the session to doc initially if we are active
        await updateDoc(doc(db, 'users', user.uid), {
          currentSessionId: activeSessionId
        }).catch(err => console.log('Init session ID error (ignoring offline):', err));

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();

            if (activeSessionId && data.currentSessionId && data.currentSessionId !== activeSessionId) {
              setProfile(null);
              AsyncStorage.removeItem('colearn_session_id').catch(() => {});
              signOut(auth).catch(err => console.log('Sign out error:', err));
              Alert.alert(
                "Logged Out",
                "Your account is open on another device or browser session."
              );
              return;
            }
            
            const normalizedProfile: UserProfile = {
              uid: user.uid,
              studentId: data.studentId || '', 
              email: data.email || user.email || '',
              username: data.username || data.name || 'Student',
              department: data.department || 'FUTO Student',
              mobileNumber: data.mobileNumber || data.phone || '',
              // Match web app: level is permission, academicLevel is the study level
              academicLevel: data.academicLevel || '100',
              level: data.level || '1',
              permissionLevel: data.level || '1',
              isActivated: data.isActivated ?? false,
              referralCount: data.referralCount || 0,
              referredBy: data.referredBy || null,
              theme: data.theme || 'light',
              photoURL: data.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toDate?.().toISOString() || new Date().toISOString()) : new Date().toISOString(),
            };

            // If studentId is missing, generate a pretty placeholder
            if (!normalizedProfile.studentId) {
               normalizedProfile.studentId = `CLN-${user.uid.slice(0, 4).toUpperCase()}-${user.uid.slice(-4).toUpperCase()}`;
            }

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

  // Verify session lock on App State foreground change
  useEffect(() => {
    let isSubscribed = true;
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && user && isSubscribed) {
        try {
          const activeSessionId = await AsyncStorage.getItem('colearn_session_id');
          if (activeSessionId) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && isSubscribed) {
              const data = userDoc.data();
              if (data && data.currentSessionId && data.currentSessionId !== activeSessionId) {
                setProfile(null);
                await AsyncStorage.removeItem('colearn_session_id').catch(() => {});
                await signOut(auth).catch(() => {});
                Alert.alert(
                  "Logged Out",
                  "Your account is open on another device or browser session."
                );
              }
            }
          }
        } catch (err) {
          console.error("Session re-verification on resume error:", err);
        }
      }
    });

    return () => {
      isSubscribed = false;
      subscription.remove();
    };
  }, [user]);

  // Keep track of connection status periodically
  useEffect(() => {
    async function verifyConnection() {
      if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
        if (!navigator.onLine) {
          setIsOffline(true);
          return;
        }
      }

      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2500);
        // Use a highly reliable CORS-enabled endpoint
        const response = await fetch('https://api.github.com/', {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(id);
        setIsOffline(!response.ok);
      } catch (err) {
        // If we got a network error or abort but navigator.onLine is true, assume we have a live interface
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          setIsOffline(false);
        } else {
          setIsOffline(true);
        }
      }
    }

    verifyConnection();
    const interval = setInterval(verifyConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync recommended courses to SQLite when logged in and online
  useEffect(() => {
    if (!profile || !systemConfig || isOffline) return;

    const syncCourses = async () => {
      try {
        const activeSemester = systemConfig.currentSemester || '1st';
        const q = query(
          collection(db, 'courses'),
          where('semester', '==', activeSemester)
        );
        const snapshot = await getDocs(q);
        const allFetched = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        const userDept = (profile.department || '').toLowerCase();
        const userLevel = (profile.academicLevel || '100').replace('LVL', '');

        const coursesToSave = allFetched.filter(c => {
          const courseDept = (c.department || '').toLowerCase();
          const courseLevel = (c.level || '').replace('LVL', '');

          const levelMatch = courseLevel === userLevel || 
                            (userLevel === '100' && courseLevel === '1') ||
                            (userLevel === '1' && courseLevel === '100');
          
          if (levelMatch) {
            if (!c.department || courseDept === 'general' || courseDept === 'college') {
              return true;
            } else {
              const userTokens = userDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
              const courseTokens = courseDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
              if (userTokens.some(ut => courseDept.includes(ut)) || courseTokens.some(ct => userDept.includes(ct))) {
                return true;
              }
            }
          }
          return false;
        });

        saveCoursesFromServer(coursesToSave);
      } catch (err) {
        console.log('[Background Auto-Sync] Course synchronization skipped (offline):', err);
      }
    };

    syncCourses();
  }, [profile, systemConfig, isOffline]);

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

    // 4. Institutional Announcements
    try {
      const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
        if (isAnnouncementsInitial) {
          snap.docs.forEach(doc => knownAnnouncementIds.add(doc.id));
          isAnnouncementsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownAnnouncementIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownAnnouncementIds.add(change.doc.id);
            
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

    // 5. Discussion board (courses Study Group messages)
    try {
      const unsub = onSnapshot(collection(db, 'discussions'), (snap) => {
        if (isDiscussionsInitial) {
          snap.docs.forEach(doc => knownDiscussionIds.add(doc.id));
          isDiscussionsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownDiscussionIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownDiscussionIds.add(change.doc.id);

            // Notify if NOT the sender themselves
            if (data.userId && data.userId !== profile.uid) {
              showLocalNotify(
                `Study Group Board: ${data.username || "Student"}`,
                data.text || "New interaction posted!"
              );
            }
          }
        });
      }, (err) => console.log("Bg Notify: Study Groups error:", err));
      unsubscribes.push(unsub);
    } catch (e) {
      console.log("Bg Notify: Discussions subscription failed:", e);
    }

    // 6. News Board (news)
    try {
      const unsub = onSnapshot(collection(db, 'news'), (snap) => {
        if (isNewsInitial) {
          snap.docs.forEach(doc => knownNewsIds.add(doc.id));
          isNewsInitial = false;
          return;
        }
        snap.docChanges().forEach(change => {
          if (change.type === 'added' && !knownNewsIds.has(change.doc.id)) {
            const data = change.doc.data();
            knownNewsIds.add(change.doc.id);
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
      await signOut(auth);
      setUser(null);
      setProfile(null);
      await AsyncStorage.removeItem('colearn_profile').catch(() => {});
      await AsyncStorage.removeItem('colearn_system_config').catch(() => {});
      await AsyncStorage.removeItem('colearn_promo_config').catch(() => {});
      await AsyncStorage.removeItem('colearn_session_id').catch(() => {});
      try {
        clearUserProfileLocal();
      } catch (e) {
        console.log('Error clearing local user profile:', e);
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
    </AuthContext.Provider>
  );
}
