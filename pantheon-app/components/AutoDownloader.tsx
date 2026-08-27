import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import {
  isCourseDownloadedLocal,
  getAllDownloadedCourseIdsLocal,
  saveCourseLocal,
  saveNotesBatchLocal,
  saveQuestionsBatchLocal,
  saveQuestionSheetsBatchLocal,
  saveCompleteCourseLocal,
  deleteCourseLocal,
  saveLastLoggedInStudentId,
  getLastLoggedInStudentId,
} from '../lib/db';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
  department: string;
  progress?: number;
  isDownloaded?: boolean;
}

const { width } = Dimensions.get('window');

// Timeout helper to avoid infinite hanging on mobile network calls
function withTimeout<T>(promise: Promise<T>, ms = 8000, fallbackVal?: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackVal !== undefined) resolve(fallbackVal);
      else reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

// Diagram base64 conversion with ultra-fast timeout (1.5s) to guarantee course sync NEVER stalls
async function processDiagramsForOffline(content: string): Promise<string> {
  if (!content) return content;
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return content;

    const blockPromises = blocks.map(async (block: any) => {
      if (block.type === 'diagram' && block.content && typeof block.content === 'string' && block.content.startsWith('http')) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);

          const response = await fetch(block.content, { signal: controller.signal });
          clearTimeout(timer);

          if (!response.ok) return block;

          const blob = await response.blob();
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(block.content); // fallback to original on error
            reader.readAsDataURL(blob);
          });

          return {
            ...block,
            content: base64Data || block.content,
          };
        } catch {
          // Guaranteed fallback: Never block note sync on image fetch error
          return block;
        }
      }
      return block;
    });

    const settled = await Promise.allSettled(blockPromises);
    const processedBlocks = settled.map((res, i) => res.status === 'fulfilled' ? res.value : blocks[i]);
    return JSON.stringify(processedBlocks);
  } catch (e) {
    return content;
  }
}

export function AutoDownloader() {
  const { user, profile, systemConfig, isOffline } = useAuth();
  const { colors: C } = useTheme();

  const [downloading, setDownloading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [courseName, setCourseName] = useState('');

  const syncingRef = useRef(false);

  useEffect(() => {
    // Only proceed if user is logged in, activated, not offline, and profile/config loaded
    if (!user || !profile || !profile.isActivated || !systemConfig || isOffline) {
      return;
    }

    if (syncingRef.current) return;

    const checkAndSyncCourses = async () => {
      try {
        const currentStudentId = (profile.studentId || profile.uid || '').trim();
        const lastStudentId = (getLastLoggedInStudentId() || '').trim();
        const activeSemester = (!systemConfig.currentSemester || systemConfig.currentSemester === 'none') ? '1st' : systemConfig.currentSemester;

        // 1. Fetch available Firestore courses for the active semester with a strict timeout
        const q = query(
          collection(db, 'courses'),
          where('semester', '==', activeSemester)
        );
        const snapshot = await withTimeout(
          getDocs(q),
          8000,
          { docs: [] } as any
        );

        const fsCourses: Course[] = (snapshot.docs || []).map((doc: any) => {
          const d = doc.data();
          return {
            id: doc.id,
            code: d.code || '',
            title: d.title || '',
            semester: d.semester || '',
            level: d.level || '',
            department: d.department || '',
            progress: 0,
            isDownloaded: false,
            disabled: d.disabled
          };
        });

        // 2. Filter courses specifically needed for this student's department, level & semester
        const myCourses = await getFilteredCoursesForStudent(fsCourses, profile, true, activeSemester);
        const requiredCourseIds = myCourses.map(c => c.id);

        // 3. Retrieve local downloaded course IDs in SQLite
        const localDownloadedIds = getAllDownloadedCourseIdsLocal();
        const missingCourses = myCourses.filter(c => !localDownloadedIds.includes(c.id));
        const obsoleteCourseIds = localDownloadedIds.filter(id => !requiredCourseIds.includes(id));

        // Sync Conditions:
        // Case B: User switched accounts (last logged in student ID differs from current student ID)
        // Case A: Same account (compare Firestore courses with app courses)
        const isDifferentUser = lastStudentId !== '' && lastStudentId !== currentStudentId;
        const hasCourseDifference = missingCourses.length > 0 || obsoleteCourseIds.length > 0;

        if (isDifferentUser) {
          // B: User logged out and a different account logged in.
          // Check if courses for the new user and old user are different:
          if (!hasCourseDifference) {
            // Courses are identical for both accounts (e.g. classmates in same department/level).
            // Do NOT sync!
            saveLastLoggedInStudentId(currentStudentId);
            await AsyncStorage.setItem('colearn_last_downloaded_uid', user.uid).catch(() => {});
            await AsyncStorage.setItem('colearn_last_downloaded_semester', activeSemester).catch(() => {});
            return;
          }

          // Courses are different: clean up obsolete courses from old user
          for (const obsId of obsoleteCourseIds) {
            deleteCourseLocal(obsId);
          }
        } else {
          // A: Same user logged in / reopened app.
          // Only sync if courses in Firestore are different from the ones on the app (Silent Sync)
          if (missingCourses.length === 0) {
            // No course changes in Firestore. Do NOT sync!
            saveLastLoggedInStudentId(currentStudentId);
            await AsyncStorage.setItem('colearn_last_downloaded_uid', user.uid).catch(() => {});
            await AsyncStorage.setItem('colearn_last_downloaded_semester', activeSemester).catch(() => {});
            return;
          }
        }

        if (missingCourses.length === 0) {
          saveLastLoggedInStudentId(currentStudentId);
          return;
        }

        // Silent sync when it's the same user updating course diffs in background
        const isSilentSync = !isDifferentUser;

        syncingRef.current = true;
        setDownloading(true);
        if (isSilentSync) {
          setIsMinimized(true);
        }

        const totalCourses = missingCourses.length;
        for (let idx = 0; idx < totalCourses; idx++) {
          const course = missingCourses[idx];
          setCourseName(`[${idx + 1}/${totalCourses}] ${course.code}`);

          const updateProgress = (stepPercent: number) => {
            const overallPercent = Math.min(
              100,
              Math.max(0, Math.round(((idx + (stepPercent / 100)) / totalCourses) * 100))
            );
            setDownloadPercent(overallPercent);
          };

          updateProgress(10);
          setDownloadStatus('Fetching course contents...');

          // Fast parallel Firestore fetch for notes, questions, and questionSheets with timeouts
          const notesQ = query(collection(db, 'notes'), where('courseId', '==', course.id));
          const qQ = query(collection(db, 'questions'), where('courseId', '==', course.id));
          const sheetsQ = query(collection(db, 'questionSheets'), where('courseId', '==', course.id));

          const [notesSnap, qSnap, sheetsSnap] = await Promise.all([
            withTimeout(getDocs(notesQ), 8000, { docs: [] } as any),
            withTimeout(getDocs(qQ), 8000, { docs: [] } as any),
            withTimeout(getDocs(sheetsQ), 8000, { docs: [] } as any),
          ]);

          updateProgress(40);
          setDownloadStatus('Processing materials...');

          // Question sheets
          const sheetsData = (sheetsSnap.docs || []).map((doc: any) => ({
            id: doc.id,
            courseId: course.id,
            ...doc.data()
          }));

          // Questions
          const questionsData = (qSnap.docs || []).map((doc: any) => ({
            id: doc.id,
            courseId: course.id,
            ...doc.data()
          }));

          // Process diagram blocks with fast timeout
          const rawNotes = notesSnap.docs || [];
          const notesData = await Promise.all(
            rawNotes.map(async (doc: any) => {
              const noteData = doc.data();
              let content = noteData.content || '';
              try {
                content = await processDiagramsForOffline(content);
              } catch (e) {}
              return {
                id: doc.id,
                courseId: course.id,
                title: noteData.title || '',
                content,
                order: noteData.order || 0,
                duration: noteData.duration || '',
                tag: noteData.tag || 'CORE'
              };
            })
          );

          updateProgress(75);
          setDownloadStatus('Saving to offline database...');

          // Atomic single-transaction save for entire course
          saveCompleteCourseLocal(course, notesData, questionsData, sheetsData);

          updateProgress(100);
        }

        // Successfully synced and updated student record in SQLite
        saveLastLoggedInStudentId(currentStudentId);
        await AsyncStorage.setItem('colearn_last_downloaded_uid', user.uid).catch(() => {});
        await AsyncStorage.setItem('colearn_last_downloaded_semester', activeSemester).catch(() => {});

      } catch (err) {
        console.error('[AutoDownloader] Course sync error:', err);
      } finally {
        setDownloading(false);
        setIsMinimized(false);
        syncingRef.current = false;
      }
    };

    checkAndSyncCourses();
  }, [user, profile, systemConfig, isOffline]);

  if (!downloading) return null;

  if (isMinimized) {
    return (
      <TouchableOpacity
        style={[styles.minimizedPill, { backgroundColor: C.ink }]}
        onPress={() => setIsMinimized(false)}
        activeOpacity={0.8}
      >
        <ActivityIndicator size="small" color={C.surface} style={{ marginRight: 8 }} />
        <Text style={[styles.minimizedText, { color: C.surface }]}>Syncing {downloadPercent}%</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
      <View style={[styles.modal, { backgroundColor: C.surface }]}>
        <ActivityIndicator size="large" color={C.ink} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: C.ink }]}>Syncing Courses</Text>
        <Text style={[styles.subtitle, { color: C.inkMid }]}>{courseName}</Text>
        <Text style={[styles.status, { color: C.inkLight }]}>{downloadStatus}</Text>

        <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
          <View style={[styles.progressFill, { backgroundColor: C.ink, width: `${downloadPercent}%` }]} />
        </View>
        <Text style={[styles.percent, { color: C.ink }]}>{downloadPercent}%</Text>

        <TouchableOpacity
          style={[styles.hideButton, { backgroundColor: C.bgAlt }]}
          onPress={() => setIsMinimized(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.hideButtonText, { color: C.ink }]}>Hide to Background</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    width: width * 0.85,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  status: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
  },
  percent: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  minimizedPill: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 9999,
  },
  minimizedText: {
    color: '#FFF',
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  hideButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  hideButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
});
