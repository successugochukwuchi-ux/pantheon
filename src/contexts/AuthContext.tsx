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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [promoConfig, setPromoConfig] = useState<PromoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

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
        setSystemConfig(snapshot.data() as SystemConfig);
      } else {
        // Initialize default config if missing
        setSystemConfig({
          currentSemester: 'none',
          maintenanceMode: false,
          updatedBy: 'system',
          updatedAt: new Date().toISOString()
        });
      }
    }, (error) => {
      console.error("System config listener failed:", error);
      // Fallback to default if we can't read it
      setSystemConfig({
        currentSemester: 'none',
        maintenanceMode: false,
        updatedBy: 'system',
        updatedAt: new Date().toISOString()
      });
    });

    const unsubscribePromo = onSnapshot(doc(db, 'system', 'promo'), (snapshot) => {
      if (snapshot.exists()) {
        setPromoConfig(snapshot.data() as PromoConfig);
      } else {
        setPromoConfig({
          isActive: false,
          quota: 0,
          count: 0,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        });
      }
    }, (error) => {
      if (auth.currentUser) {
        console.error("Promo config listener failed:", error);
      }
      // Set a safe fallback even on error to allow UI to render correctly
      setPromoConfig(prev => prev || {
        isActive: false,
        quota: 0,
        count: 0,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      });
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
    <AuthContext.Provider value={{ user, profile, systemConfig, promoConfig, loading, isAuthReady }}>
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
