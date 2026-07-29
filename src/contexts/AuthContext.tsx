const LOCAL_ACTIVE_SESSION_ID = Math.random().toString(36).substring(2, 15);
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { UserProfile, SystemConfig, PromoConfig, Semester } from '../types';
import { getDeviceUUID } from '../lib/device';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
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

  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSystemConfigReady, setIsSystemConfigReady] = useState(localStorage.getItem('colearn_system_config') !== null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);

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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Only fetch these once we have a basic connection, but they are public now
    const unsubscribeConfig = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemConfig;
        setSystemConfig(data);
        localStorage.setItem('colearn_system_config', JSON.stringify(data));
      } else {
        const defaultConfig: SystemConfig = {
          currentSemester: 'none',
          maintenanceMode: false,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        setSystemConfig(defaultConfig);
        localStorage.setItem('colearn_system_config', JSON.stringify(defaultConfig));
      }
      setIsSystemConfigReady(true);
    }, (error) => {
      // These are public, so failure usually means offline or quota
      console.error("System config listener details:", error);
      if (!systemConfig) {
        const defaultConfig: SystemConfig = {
          currentSemester: 'none',
          maintenanceMode: false,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        setSystemConfig(defaultConfig);
      }
      setIsSystemConfigReady(true);
    });

    const unsubscribePromo = onSnapshot(doc(db, 'system', 'promo'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PromoConfig;
        setPromoConfig(data);
        localStorage.setItem('colearn_promo_config', JSON.stringify(data));
      } else {
        const defaultPromo: PromoConfig = {
          isActive: false, quota: 0, count: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        };
        setPromoConfig(defaultPromo);
        localStorage.setItem('colearn_promo_config', JSON.stringify(defaultPromo));
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
      unsubscribeConfig();
      unsubscribePromo();
    };
  }, []);

  useEffect(() => {
    if (user) {
      const initSessionAndDevice = async () => {
        let activeSessionId = LOCAL_ACTIVE_SESSION_ID;
          await updateDoc(doc(db, 'users', user.uid), {
            currentSessionId: activeSessionId
          }).catch(err => console.error("Error setting session ID:", err));

        const deviceId = await getDeviceUUID();
        
        let currentSemester = '1st';
        if (systemConfig?.currentSemester) {
          currentSemester = systemConfig.currentSemester;
        }

        const path = `users/${user.uid}`;
        let isFirstLoad = true;
        const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            
            // Device limit check
            let devices = data.devices || [];
            const currentDevices = devices.filter((d: any) => d.semester === currentSemester);
            
            const deviceExists = currentDevices.find((d: any) => d.id === deviceId);
            
            if (!deviceExists) {
              if (!isFirstLoad) {
                setProfile(null);
                firebaseSignOut(auth).catch(err => console.error("Signout error:", err));
                toast.error("Your device has been forcefully disconnected by an administrator.");
                return;
              }

              if (currentDevices.length >= 2) {
                setProfile(null);
                firebaseSignOut(auth).catch(err => console.error("Signout error:", err));
                toast.error(`Device Limit Reached: Your account has reached the max of 2 devices for the current semester. Contact an admin for ${data.At || 'futo'} to resolve this.`);
                return;
              } else {
                const newDevice = {
                  id: deviceId,
                  semester: currentSemester,
                  os: 'web',
                  addedAt: new Date().toISOString()
                };
                currentDevices.push(newDevice);
                await updateDoc(doc(db, 'users', user.uid), { devices: currentDevices }).catch(() => {});
              }
            } else if (devices.length !== currentDevices.length) {
              await updateDoc(doc(db, 'users', user.uid), { devices: currentDevices }).catch(() => {});
            }

            if (data.currentSessionId && data.currentSessionId !== activeSessionId) {
              setProfile(null);
              firebaseSignOut(auth).catch(err => console.error("Signout error:", err));
              toast.error("Logged out: Your account is open on another device.");
              return;
            } else if (!data.currentSessionId) {
              updateDoc(doc(db, 'users', user.uid), {
                currentSessionId: activeSessionId
              }).catch(err => console.error("Error restoring session ID:", err));
            }

            setProfile(data);
            isFirstLoad = false;

            if (user.email === 'successugochukwuchi@gmail.com' && data.level === '1') {
              updateDoc(doc(db, 'users', user.uid), {
                level: '4',
                isActivated: true
              }).catch(err => console.error("Failed to promote admin:", err));
            }
          } else {
            setProfile(null);
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
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, path);
        });
        return unsubscribeProfile;
      };

      const unsubPromise = initSessionAndDevice();
      return () => {
        unsubPromise.then(unsub => unsub?.());
      };
    }
  }, [user, systemConfig, retryCount]);

  // Active session lock validation on visibility change (for web app) using local state to avoid database reads
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user) {
        try {
          const activeSessionId = LOCAL_ACTIVE_SESSION_ID;
          if (activeSessionId && profile) {
            if (profile.currentSessionId && profile.currentSessionId !== activeSessionId) {
              setProfile(null);
              await firebaseSignOut(auth);
              toast.error("Logged out: Your account is open on another device.");
            }
          }
        } catch (err) {
          console.error("Error verifying active session on visibility change:", err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, profile]);

  const [uniSemester, setUniSemester] = useState<Semester | null>(null);

  useEffect(() => {
    if (profile?.At) {
      const unsubUni = onSnapshot(doc(db, 'universities', profile.At), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUniSemester(data.currentSemester || null);
        } else {
          setUniSemester(null);
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
    if (profile?.At && uniSemester) {
      return {
        ...systemConfig,
        currentSemester: uniSemester
      };
    }
    return systemConfig;
  }, [systemConfig, profile?.At, uniSemester]);

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig: effectiveSystemConfig, promoConfig, loading, isAuthReady, isSystemConfigReady, isOnline }}>
      {children}
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
