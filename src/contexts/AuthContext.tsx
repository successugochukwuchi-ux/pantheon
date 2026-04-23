import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { UserProfile, SystemConfig, PromoConfig } from '../types';

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
      const cached = localStorage.getItem('pantheon_system_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Failed to parse cached system config:", e);
      return null;
    }
  });
  
  const [promoConfig, setPromoConfig] = useState<PromoConfig | null>(() => {
    try {
      const cached = localStorage.getItem('pantheon_promo_config');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error("Failed to parse cached promo config:", e);
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSystemConfigReady, setIsSystemConfigReady] = useState(localStorage.getItem('pantheon_system_config') !== null);
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
    const unsubscribeConfig = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemConfig;
        setSystemConfig(data);
        localStorage.setItem('pantheon_system_config', JSON.stringify(data));
      } else {
        const defaultConfig: SystemConfig = {
          currentSemester: 'none',
          maintenanceMode: false,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        };
        setSystemConfig(defaultConfig);
        localStorage.setItem('pantheon_system_config', JSON.stringify(defaultConfig));
      }
      setIsSystemConfigReady(true);
    }, (error) => {
      // Silently handle if not authenticated yet, otherwise log
      if (auth.currentUser) {
        console.error("System config listener failed:", error);
      }
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
        localStorage.setItem('pantheon_promo_config', JSON.stringify(data));
      } else {
        const defaultPromo: PromoConfig = {
          isActive: false, quota: 0, count: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        };
        setPromoConfig(defaultPromo);
        localStorage.setItem('pantheon_promo_config', JSON.stringify(defaultPromo));
      }
    }, (error) => {
      if (auth.currentUser) {
        console.error("Promo config listener failed:", error);
      }
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
      const path = `users/${user.uid}`;
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          setProfile(data);

          // Auto-promote bootstrap admin
          if (user.email === 'successugochukwuchi@gmail.com' && data.level === '1') {
            console.log("Promoting admin...");
            updateDoc(doc(db, 'users', user.uid), {
              level: '4',
              isActivated: true
            }).then(() => console.log("Admin promoted successfully"))
              .catch(err => {
                console.error("Failed to promote admin:", err);
              });
          }
        } else {
          setProfile(null);
          // Auto-create bootstrap admin profile if missing
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
            
            console.log("Attempting to create admin profile...");
            setDoc(doc(db, 'users', user.uid), adminData)
              .then(() => console.log("Admin profile created successfully"))
              .catch(err => {
                console.error("Failed to create admin profile:", err);
              });
          }
        }
        setLoading(false);
      }, (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      });

      return () => unsubscribeProfile();
    }
  }, [user, retryCount]);

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig, promoConfig, loading, isAuthReady, isSystemConfigReady, isOnline }}>
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
