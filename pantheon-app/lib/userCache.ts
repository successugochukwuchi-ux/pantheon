import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CachedUserProfile {
  uid: string;
  name: string;
  username?: string;
  dept?: string;
  department?: string;
  level?: string;
  academicLevel?: string;
  photoURL?: string | null;
  image?: string;
}

// In-memory cache for instant synchronous access
const memoryCache = new Map<string, CachedUserProfile>();

export function getCachedUserProfileSync(uid: string): CachedUserProfile | null {
  if (!uid) return null;
  return memoryCache.get(uid) || null;
}

export async function getOrFetchUserProfile(uid: string): Promise<CachedUserProfile | null> {
  if (!uid) return null;

  // 1. Check memory cache (0ms)
  const inMem = memoryCache.get(uid);
  if (inMem) return inMem;

  // 2. Check AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(`colearn_user_profile_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.set(uid, parsed);
      return parsed;
    }
  } catch {}

  // 3. Only fetch from Firestore if completely uncached
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const profile: CachedUserProfile = {
        uid,
        name: data.username || data.name || 'Student',
        username: data.username || data.name || 'Student',
        dept: data.department || 'General Science',
        department: data.department || 'General Science',
        level: data.academicLevel || '100 Level',
        academicLevel: data.academicLevel || '100 Level',
        photoURL: data.photoURL || null,
        image: data.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
      };

      memoryCache.set(uid, profile);
      AsyncStorage.setItem(`colearn_user_profile_${uid}`, JSON.stringify(profile)).catch(() => {});
      return profile;
    }
  } catch (e) {
    console.error(`Failed to fetch user profile for ${uid}:`, e);
  }

  // Fallback
  const fallback: CachedUserProfile = {
    uid,
    name: 'Classmate',
    username: 'Classmate',
    dept: 'CoLearn Student',
    department: 'CoLearn Student',
    level: '100 Level',
    academicLevel: '100 Level',
    photoURL: null,
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  };
  memoryCache.set(uid, fallback);
  return fallback;
}

export function cacheUserProfile(profile: CachedUserProfile): void {
  if (!profile?.uid) return;
  memoryCache.set(profile.uid, profile);
  AsyncStorage.setItem(`colearn_user_profile_${profile.uid}`, JSON.stringify(profile)).catch(() => {});
}
