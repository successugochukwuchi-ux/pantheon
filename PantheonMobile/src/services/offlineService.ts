import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface OfflineCourse {
  id: string;
  code: string;
  title: string;
  lastUpdated: string;
  size: number; // In bytes
  hasUpdate?: boolean;
}

export interface CourseContent {
  notes: any[];
  questions: any[];
  sheets: any[];
  diagrams: Record<string, string>; // Map of URL to base64 data
}

const OFFLINE_COURSES_KEY = 'offline_courses';
const ACTIVE_SEMESTER_KEY = 'active_semester';
const PROFILE_CACHE_KEY = 'profile_cache';
const CBT_RESULTS_KEY = 'cbt_results_cache';
const DIAGRAM_CACHE_PREFIX = 'diagram_';

export const OfflineService = {
  getUserIdPrefix(userId: string): string {
    return `user_${userId}_`;
  },

  async cacheCBTResults(userId: string, results: any[]): Promise<void> {
    await AsyncStorage.setItem(this.getUserIdPrefix(userId) + CBT_RESULTS_KEY, JSON.stringify(results));
  },

  async getCachedCBTResults(userId: string): Promise<any[]> {
    const data = await AsyncStorage.getItem(this.getUserIdPrefix(userId) + CBT_RESULTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async getDownloadedCourses(userId: string): Promise<OfflineCourse[]> {
    const data = await AsyncStorage.getItem(this.getUserIdPrefix(userId) + OFFLINE_COURSES_KEY);
    return data ? JSON.parse(data) : [];
  },

  async clearAllOfflineData(userId: string): Promise<void> {
    const downloaded = await this.getDownloadedCourses(userId);
    for (const course of downloaded) {
      await AsyncStorage.removeItem(this.getUserIdPrefix(userId) + `course_content_${course.id}`);
    }
    await AsyncStorage.removeItem(this.getUserIdPrefix(userId) + OFFLINE_COURSES_KEY);
  },

  async syncSemester(userId: string, currentSemester: string): Promise<boolean> {
    const key = this.getUserIdPrefix(userId) + ACTIVE_SEMESTER_KEY;
    const storedSemester = await AsyncStorage.getItem(key);
    if (storedSemester && storedSemester !== currentSemester) {
      await this.clearAllOfflineData(userId);
      await AsyncStorage.setItem(key, currentSemester);
      return true;
    }
    await AsyncStorage.setItem(key, currentSemester);
    return false;
  },

  async getCachedSemester(userId: string): Promise<string | null> {
    return AsyncStorage.getItem(this.getUserIdPrefix(userId) + ACTIVE_SEMESTER_KEY);
  },

  async cacheProfile(userId: string, profile: any): Promise<void> {
    await AsyncStorage.setItem(this.getUserIdPrefix(userId) + PROFILE_CACHE_KEY, JSON.stringify(profile));
  },

  async getCachedProfile(userId: string): Promise<any | null> {
    const data = await AsyncStorage.getItem(this.getUserIdPrefix(userId) + PROFILE_CACHE_KEY);
    return data ? JSON.parse(data) : null;
  },

  async downloadImageAsBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.log('Error downloading image:', url, e);
      return null;
    }
  },

  async downloadCourse(userId: string, courseId: string): Promise<void> {
    const prefix = this.getUserIdPrefix(userId);
    // 1. Fetch course metadata
    const courseDoc = await getDoc(doc(db, 'courses', courseId));
    if (!courseDoc.exists()) throw new Error('Course not found');
    const courseData = courseDoc.data();

    // 2. Fetch notes
    const normalizedCode = (courseData.code || '').replace(/\s+/g, '').toUpperCase();
    const notesSnap = await getDocs(query(collection(db, 'notes')));
    const notes = notesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(n => {
        const nCode = (n.courseCode || '').replace(/\s+/g, '').toUpperCase();
        return n.courseId === courseId || nCode === normalizedCode;
      });

    // 3. Fetch past questions
    const questionsSnap = await getDocs(query(collection(db, 'questions')));
    const questions = questionsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(q => {
        const qCode = (q.courseCode || '').replace(/\s+/g, '').toUpperCase();
        return q.courseId === courseId || qCode === normalizedCode;
      });

    // 3b. Fetch question sheets related to this course
    const sheetsSnap = await getDocs(query(collection(db, 'questionSheets')));
    const sheets = sheetsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(s => {
        const sCode = (s.courseCode || '').replace(/\s+/g, '').toUpperCase();
        return sCode === normalizedCode || s.courseId === courseId;
      });

    // 4. Extract and download diagrams
    const diagrams: Record<string, string> = {};
    const imageUrls = new Set<string>();

    // Extract from notes
    notes.forEach((note: any) => {
      try {
        const blocks = JSON.parse(note.content);
        if (Array.isArray(blocks)) {
          blocks.forEach((block: any) => {
            if (block.type === 'diagram' && block.content) {
              imageUrls.add(block.content);
            }
            // Also check for markdown images in text blocks
            if (block.type === 'text' && block.content) {
              const matches = block.content.match(/!\[.*?\]\((.*?)\)/g);
              if (matches) {
                matches.forEach((m: string) => {
                  const urlMatch = m.match(/\((.*?)\)/);
                  if (urlMatch && urlMatch[1]) imageUrls.add(urlMatch[1]);
                });
              }
            }
          });
        }
      } catch (e) {}
    });

    // Extract from questions
    questions.forEach((q: any) => {
      if (q.imageUrl) imageUrls.add(q.imageUrl);
      if (q.explanationImageUrl) imageUrls.add(q.explanationImageUrl);
    });

    // Download each image
    for (const url of Array.from(imageUrls)) {
      const base64 = await this.downloadImageAsBase64(url);
      if (base64) {
        diagrams[url] = base64;
      }
    }

    const content: CourseContent = {
      notes,
      questions,
      sheets,
      diagrams
    };

    const contentStr = JSON.stringify(content);
    const size = contentStr.length;

    // 5. Save content
    await AsyncStorage.setItem(prefix + `course_content_${courseId}`, contentStr);

    // 6. Update manifest
    const downloaded = await this.getDownloadedCourses(userId);
    const updated = downloaded.filter(c => c.id !== courseId);
    updated.push({
      id: courseId,
      code: courseData.code,
      title: courseData.title,
      lastUpdated: courseData.updatedAt || new Date().toISOString(),
      size: Number(size) || 0,
      hasUpdate: false
    });

    await AsyncStorage.setItem(prefix + OFFLINE_COURSES_KEY, JSON.stringify(updated));
  },

  async deleteCourse(userId: string, courseId: string): Promise<void> {
    const prefix = this.getUserIdPrefix(userId);
    await AsyncStorage.removeItem(prefix + `course_content_${courseId}`);
    const downloaded = await this.getDownloadedCourses(userId);
    const updated = downloaded.filter(c => c.id !== courseId);
    await AsyncStorage.setItem(prefix + OFFLINE_COURSES_KEY, JSON.stringify(updated));
  },

  async getCourseContent(userId: string, courseId: string): Promise<CourseContent | null> {
    const data = await AsyncStorage.getItem(this.getUserIdPrefix(userId) + `course_content_${courseId}`);
    return data ? JSON.parse(data) : null;
  },

  async checkForUpdates(userId: string, availableCourses: any[]): Promise<OfflineCourse[]> {
    const downloaded = await this.getDownloadedCourses(userId);
    return downloaded.map(d => {
      const live = availableCourses.find(c => c.id === d.id);
      if (live && live.updatedAt && live.updatedAt > d.lastUpdated) {
        return { ...d, hasUpdate: true };
      }
      return d;
    });
  },

  formatSize(bytes: number): string {
    const val = Number(bytes);
    if (isNaN(val) || val <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(val) / Math.log(k));
    return parseFloat((val / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};
