import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserProfile } from '../types';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  syncOfflineData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSynced, setHasSynced] = useState(false);

  const syncOfflineData = useCallback(async () => {
    if (!user) return;
    try {
      // Sync courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await ReactNativeAsyncStorage.setItem('offline_courses', JSON.stringify(courses));

      // Sync notes
      const notesSnap = await getDocs(collection(db, 'notes'));
      const notes = notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await ReactNativeAsyncStorage.setItem('offline_notes', JSON.stringify(notes));

      // Sync question sheets
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      const sheets = sheetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await ReactNativeAsyncStorage.setItem('offline_sheets', JSON.stringify(sheets));

      // Sync questions
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await ReactNativeAsyncStorage.setItem('offline_questions', JSON.stringify(questions));

      console.log('Offline data synced successfully');
      setHasSynced(true);
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        setHasSynced(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    if (user) {
      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.data() as UserProfile;
          setProfile(profileData);
          ReactNativeAsyncStorage.setItem('offline_profile', JSON.stringify(profileData));

          // Only sync if we haven't synced this session
          if (!hasSynced) {
            syncOfflineData();
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error('Profile fetch error:', error);
        // Try to load profile from offline storage if firestore fails
        ReactNativeAsyncStorage.getItem('offline_profile').then(stored => {
            if (stored) setProfile(JSON.parse(stored));
            setLoading(false);
        });
      });
    } else {
      setProfile(null);
      setLoading(false);
      setHasSynced(false);
    }

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [user, syncOfflineData, hasSynced]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, syncOfflineData }}>
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
