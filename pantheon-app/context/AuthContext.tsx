import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  systemConfig: SystemConfig | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  systemConfig: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch system config
    const unsubscribeConfig = onSnapshot(doc(db, 'system', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemConfig(snapshot.data() as SystemConfig);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeConfig();
    };
  }, []);

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    if (user) {
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
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
             normalizedProfile.studentId = `PNT-${user.uid.slice(0, 4).toUpperCase()}-${user.uid.slice(-4).toUpperCase()}`;
          }

          setProfile(normalizedProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error('Error fetching profile:', error);
        setLoading(false);
      });
    }

    return () => unsubscribeProfile();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
