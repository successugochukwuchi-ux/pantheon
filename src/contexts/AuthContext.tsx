import React, { createContext, useContext, useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { UserProfile, SystemConfig, PromoConfig, Semester } from '../types';
import { getUserDeviceUUID, generateNewDeviceUUID, getWebDeviceName } from '../lib/device';
import { fetchAdminContactForUniversity, AdminContactInfo } from '../services/adminContactService';

const DeviceLimitModal = lazy(() =>
  import('../components/DeviceLimitModal').then((m) => ({ default: m.DeviceLimitModal }))
);

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  systemConfig: SystemConfig | null;
  promoConfig: PromoConfig | null;
  loading: boolean;
  isAuthReady: boolean;
  isSystemConfigReady: boolean;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_PREFIX = 'colearn_profile_cache_';

function readCachedProfile(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(uid: string, data: UserProfile | null) {
  try {
    if (data) {
      localStorage.setItem(`${PROFILE_CACHE_PREFIX}${uid}`, JSON.stringify(data));
    } else {
      localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    }
  } catch {}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    auth.currentUser ? readCachedProfile(auth.currentUser.uid) : null
  );

  // Try to load cached config from localStorage for instant offline access
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(() => {
    try {
      const cached = localStorage.getItem('colearn_system_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Failed to parse cached system config:", e);
      return null;
    }
  });

  const [promoConfig, setPromoConfig] = useState<PromoConfig | null>(() => {
    try {
      const cached = localStorage.getItem('colearn_promo_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Failed to parse cached promo config:", e);
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (!auth.currentUser) return true;
    return readCachedProfile(auth.currentUser.uid) === null;
  });
  const [isAuthReady, setIsAuthReady] = useState<boolean>(() => auth.currentUser !== null);
  const [isSystemConfigReady, setIsSystemConfigReady] = useState(() => {
    try {
      return localStorage.getItem('colearn_system_config') !== null;
    } catch {
      return false;
    }
  });
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [hasLiveSystemConfig, setHasLiveSystemConfig] = useState(false);

  const normalizeDeviceLimit = (val: unknown): number => {
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
  };

  const verifiedDeviceKeyRef = useRef<string | null>(null);
  const currentSemesterRef = useRef<string>(systemConfig?.currentSemester || '1st');

  useEffect(() => {
    if (systemConfig?.currentSemester) {
      currentSemesterRef.current = systemConfig.currentSemester;
    }
  }, [systemConfig?.currentSemester]);

  const [deviceLimitModal, setDeviceLimitModal] = useState<{
    isOpen: boolean;
    adminInfo: AdminContactInfo | null;
    accountEmail?: string;
    studentId?: string;
    semester?: string;
    deviceLimit?: number;
  }>({
    isOpen: false,
    adminInfo: null,
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Safety guard: never let auth readiness stall indefinitely on slow IndexedDB
    const authFallbackTimer = setTimeout(() => {
      setIsAuthReady((ready) => {
        if (!ready) {
          const fallbackUser = auth.currentUser;
          setUser(fallbackUser);
          if (!fallbackUser) {
            setProfile(null);
            setLoading(false);
          }
          return true;
        }
        return ready;
      });
    }, 2000);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(authFallbackTimer);
      setUser(firebaseUser);
      setIsAuthReady(true);

      if (!firebaseUser) {
        verifiedDeviceKeyRef.current = null;
        setProfile(null);
        setLoading(false);
      } else {
        const cached = readCachedProfile(firebaseUser.uid);
        if (cached) {
          setProfile(cached);
          setLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(authFallbackTimer);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const configTimer = setTimeout(() => {
      setIsSystemConfigReady(true);
      setHasLiveSystemConfig(true);
    }, 1500);

    const unsubscribeConfig = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      clearTimeout(configTimer);
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemConfig;
        setSystemConfig(data);
        try {
          localStorage.setItem('colearn_system_config', JSON.stringify(data));
        } catch {}
      } else {
        const defaultConfig: SystemConfig = {
          currentSemester: 'none',
          maintenanceMode: false,
          deviceLimit: 2,
          referralThresholdForLevel2: 5,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        setSystemConfig(defaultConfig);
        try {
          localStorage.setItem('colearn_system_config', JSON.stringify(defaultConfig));
        } catch {}
      }
      setIsSystemConfigReady(true);
      setHasLiveSystemConfig(true);
    }, (error) => {
      clearTimeout(configTimer);
      console.error("System config listener details:", error);
      if (!systemConfig) {
        const defaultConfig: SystemConfig = {
          currentSemester: 'none',
          maintenanceMode: false,
          deviceLimit: 2,
          referralThresholdForLevel2: 5,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        setSystemConfig(defaultConfig);
      }
      setIsSystemConfigReady(true);
      setHasLiveSystemConfig(true);
    });

    const unsubscribePromo = onSnapshot(doc(db, 'system', 'promo'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PromoConfig;
        setPromoConfig(data);
        try {
          localStorage.setItem('colearn_promo_config', JSON.stringify(data));
        } catch {}
      } else {
        const defaultPromo: PromoConfig = {
          isActive: false, quota: 0, count: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        };
        setPromoConfig(defaultPromo);
        try {
          localStorage.setItem('colearn_promo_config', JSON.stringify(defaultPromo));
        } catch {}
      }
    }, (error) => {
      console.error("Promo config listener details:", error);
      if (!promoConfig) {
        setPromoConfig({
          isActive: false, quota: 0, count: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        });
      }
    });

    return () => {
      clearTimeout(configTimer);
      unsubscribeConfig();
      unsubscribePromo();
    };
  }, []);

  const verifyDeviceInBackground = async (
    firebaseUser: User,
    userData: any,
    semester: string,
    deviceLimit: number
  ) => {
    const limitCount = normalizeDeviceLimit(deviceLimit);
    const checkKey = `${firebaseUser.uid}_${semester}_${limitCount}`;
    if (verifiedDeviceKeyRef.current === checkKey) return;
    verifiedDeviceKeyRef.current = checkKey;

    try {
      const isLevel5 =
        userData.level === '5' ||
        String(userData.level) === '5' ||
        firebaseUser.email === 'successugochukwuchi@gmail.com';
      const isVendor =
        userData.level === '3' ||
        String(userData.level) === '3' ||
        userData.academicLevel?.toLowerCase() === 'vendor' ||
        userData.department?.toLowerCase() === 'vendor';
      const isExemptFromDeviceLimit = isLevel5 || isVendor;

      // Vendors and Level 5 Overseers have unlimited devices and bypass device-limit enforcement
      if (isExemptFromDeviceLimit) {
        return;
      }

      const devices = userData.devices || [];
      const currentDevices = devices.filter((d: any) => d.semester === semester);
      const deviceWord = limitCount === 1 ? 'device' : 'devices';

      let deviceId = await getUserDeviceUUID(firebaseUser.uid);
      const deviceName = getWebDeviceName();

      if (deviceId) {
        const matched = currentDevices.find((d: any) => d.id === deviceId);
        if (!matched) {
          if (currentDevices.length >= limitCount) {
            const adminInfo = await fetchAdminContactForUniversity(userData.At || 'futo');
            setDeviceLimitModal({
              isOpen: true,
              adminInfo,
              accountEmail: firebaseUser.email || userData.email || '',
              studentId: userData.studentId || '',
              semester,
              deviceLimit: limitCount,
            });
            writeCachedProfile(firebaseUser.uid, null);
            setProfile(null);
            firebaseSignOut(auth).catch(() => {});
            toast.error(`Device Limit Reached: Max ${limitCount} ${deviceWord} for semester (${semester}). Please contact your campus administrator.`);
            return;
          } else {
            const newDevice = {
              id: deviceId,
              name: deviceName,
              semester,
              os: 'web',
              addedAt: new Date().toISOString()
            };
            currentDevices.push(newDevice);
            await updateDoc(doc(db, 'users', firebaseUser.uid), { devices: currentDevices }).catch(() => {});
          }
        } else if (matched.name !== deviceName) {
          matched.name = deviceName;
          await updateDoc(doc(db, 'users', firebaseUser.uid), { devices: currentDevices }).catch(() => {});
        }
      } else {
        if (currentDevices.length >= limitCount) {
          const adminInfo = await fetchAdminContactForUniversity(userData.At || 'futo');
          setDeviceLimitModal({
            isOpen: true,
            adminInfo,
            accountEmail: firebaseUser.email || userData.email || '',
            studentId: userData.studentId || '',
            semester,
            deviceLimit: limitCount,
          });
          writeCachedProfile(firebaseUser.uid, null);
          setProfile(null);
          firebaseSignOut(auth).catch(() => {});
          toast.error(`Device Limit Reached: Max ${limitCount} ${deviceWord} for semester (${semester}). Please contact your campus administrator.`);
          return;
        } else {
          deviceId = await generateNewDeviceUUID(firebaseUser.uid);
          const newDevice = {
            id: deviceId,
            name: deviceName,
            semester,
            os: 'web',
            addedAt: new Date().toISOString()
          };
          currentDevices.push(newDevice);
          await updateDoc(doc(db, 'users', firebaseUser.uid), { devices: currentDevices }).catch(() => {});
        }
      }
    } catch (err) {
      verifiedDeviceKeyRef.current = null;
      console.error("Device verification error:", err);
    }
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const loadingTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const path = `users/${user.uid}`;

    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      clearTimeout(loadingTimer);
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        writeCachedProfile(user.uid, data);

        if (user.email === 'successugochukwuchi@gmail.com' && data.level === '1') {
          updateDoc(doc(db, 'users', user.uid), {
            level: '4',
            isActivated: true
          }).catch(err => console.error("Failed to promote admin:", err));
        }
      } else {
        setProfile(null);
        writeCachedProfile(user.uid, null);
        if (user.email === 'successugochukwuchi@gmail.com') {
          const studentId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
          const adminData = {
            uid: user.uid,
            studentId: studentId,
            email: user.email,
            username: 'Admin',
            level: '4',
            isActivated: true,
            referralCount: 0,
            theme: 'light',
            createdAt: new Date().toISOString()
          };
          setDoc(doc(db, 'users', user.uid), adminData).catch(err => console.error("Failed to create admin profile:", err));
        }
      }
      setLoading(false);
    }, (error) => {
      clearTimeout(loadingTimer);
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      clearTimeout(loadingTimer);
      unsubscribeProfile();
    };
  }, [user]);

  useEffect(() => {
    if (user && profile && hasLiveSystemConfig) {
      const sem = systemConfig?.currentSemester || currentSemesterRef.current || '1st';
      const limit = normalizeDeviceLimit(systemConfig?.deviceLimit);
      verifyDeviceInBackground(user, profile, sem, limit);
    }
  }, [user, profile, hasLiveSystemConfig, systemConfig?.currentSemester, systemConfig?.deviceLimit]);

  const [uniSemester, setUniSemester] = useState<Semester | null>(null);

  useEffect(() => {
    if (profile?.At) {
      const normalizedAt = profile.At.toLowerCase().trim();
      const unsubUni = onSnapshot(doc(db, 'universities', normalizedAt), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUniSemester(data.currentSemester || null);
        } else {
          if (profile.At !== normalizedAt) {
            getDoc(doc(db, 'universities', profile.At)).then((s) => {
              if (s.exists()) {
                setUniSemester(s.data()?.currentSemester || null);
              } else {
                setUniSemester(null);
              }
            }).catch(() => setUniSemester(null));
          } else {
            setUniSemester(null);
          }
        }
      }, (error) => {
        console.error("Error listening to university:", error);
        setUniSemester(null);
      });
      return () => unsubUni();
    } else {
      setUniSemester(null);
    }
  }, [profile?.At]);

  const effectiveSystemConfig = useMemo(() => {
    if (!systemConfig) return null;
    const isL5 = profile?.level === '5' || String(profile?.level) === '5' || profile?.email?.toLowerCase() === 'successugochukwuchi@gmail.com' || user?.email?.toLowerCase() === 'successugochukwuchi@gmail.com';

    if (isL5) {
      return {
        ...systemConfig,
        currentSemester: systemConfig.currentSemester || uniSemester || 'none'
      };
    }

    if (profile?.At && uniSemester) {
      return {
        ...systemConfig,
        currentSemester: uniSemester
      };
    }
    return systemConfig;
  }, [systemConfig, profile?.At, profile?.level, profile?.email, user?.email, uniSemester]);

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig: effectiveSystemConfig, promoConfig, loading, isAuthReady, isSystemConfigReady, isOnline }}>
      {children}
      {deviceLimitModal.isOpen && (
        <Suspense fallback={null}>
          <DeviceLimitModal
            isOpen={deviceLimitModal.isOpen}
            onClose={() => setDeviceLimitModal(prev => ({ ...prev, isOpen: false }))}
            adminInfo={deviceLimitModal.adminInfo}
            accountEmail={deviceLimitModal.accountEmail}
            studentId={deviceLimitModal.studentId}
            semester={deviceLimitModal.semester}
            deviceLimit={deviceLimitModal.deviceLimit}
          />
        </Suspense>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
