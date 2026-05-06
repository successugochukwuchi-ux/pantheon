import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserProfile } from '../types';
import { OfflineService } from '../services/offlineService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    if (user) {
      // Load from cache immediately for instant UI response
      const loadFromStorage = async () => {
        try {
          const cached = await OfflineService.getCachedProfile(user.uid);
          if (cached) {
            setProfile(cached);
          }
        } catch (e) {
          console.log('Error loading initial profile cache');
        } finally {
          setLoading(false);
        }
      };
      loadFromStorage();

      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          setProfile(data);
          await OfflineService.cacheProfile(user.uid, data);
        }
        setLoading(false);
      }, async (error) => {
        console.error('Profile fetch error, checking cache fallback:', error);
        const cached = await OfflineService.getCachedProfile(user.uid);
        if (cached) setProfile(cached);
        setLoading(false);
      });
    } else {
      setProfile(null);
      setLoading(false);
    }

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
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
