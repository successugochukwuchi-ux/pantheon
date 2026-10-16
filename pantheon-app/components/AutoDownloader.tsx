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
import { checkAndApplyAcademicUpdates } from '../lib/academicSync';
import { processAndCompressNoteDiagrams } from '../lib/diagramManager';
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

// Compress and convert diagrams for offline storage
async function processDiagramsForOffline(content: string): Promise<string> {
  return processAndCompressNoteDiagrams(content);
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

        // Retrieve local downloaded course IDs in SQLite first
        const localDownloadedIds = getAllDownloadedCourseIdsLocal();
        const lastDownloadedSemester = await AsyncStorage.getItem('colearn_last_downloaded_semester').catch(() => null);
        const isDifferentUser = lastStudentId !== '' && lastStudentId !== currentStudentId;

        // Quota safeguard: If same user, on same semester, and courses already downloaded locally:
        // Check if there is an unapplied academic update stamp from admin
        const lastAcademicUpdateStamp = systemConfig?.lastAcademicUpdate ? Number(systemConfig.lastAcademicUpdate) : 0;
        const lastSeenUpdateStampRaw = await AsyncStorage.getItem('colearn_last_academic_update_stamp').catch(() => null);
        const lastSeenUpdateStamp = lastSeenUpdateStampRaw ? Number(lastSeenUpdateStampRaw) : 0;
        const hasPendingAcademicUpdate = lastAcademicUpdateStamp > 0 && lastAcademicUpdateStamp > lastSeenUpdateStamp;

        if (!isDifferentUser && localDownloadedIds.length > 0 && lastDownloadedSemester === activeSemester && !hasPendingAcademicUpdate) {
          saveLastLoggedInStudentId(currentStudentId);
          return;
        }

        if (hasPendingAcademicUpdate && !isDifferentUser && localDownloadedIds.length > 0) {
          // Admin updated/deleted academic notes or questions in Firestore!
          // Silently reconcile SQLite with Firestore differences:
          try {
            await checkAndApplyAcademicUpdates(profile, systemConfig);
            await AsyncStorage.setItem('colearn_last_academic_update_stamp', String(lastAcademicUpdateStamp)).catch(() => {});
          } catch (e) {
            console.error('Silent academic reconciliation error:', e);
          }
          saveLastLoggedInStudentId(currentStudentId);
          return;
        }

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

        const missingCourses = myCourses.filter(c => !localDownloadedIds.includes(c.id));
        const obsoleteCourseIds = localDownloadedIds.filter(id => !requiredCourseIds.includes(id));

        // Sync Conditions:
        // Case B: User switched accounts (last logged in student ID differs from current student ID)
        // Case A: Same account (compare Firestore courses with app courses)
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

          // Fast parallel Firestore fetch for notes and questionSheets with timeouts (saves thousands of reads)
          const notesQ = query(collection(db, 'notes'), where('courseId', '==', course.id));
          const sheetsQ = query(collection(db, 'questionSheets'), where('courseId', '==', course.id));

          const [notesSnap, sheetsSnap] = await Promise.all([
            withTimeout(getDocs(notesQ), 8000, { docs: [] } as any),
            withTimeout(getDocs(sheetsQ), 8000, { docs: [] } as any),
          ]);

          updateProgress(40);
          setDownloadStatus('Processing materials...');

          // Question sheets metadata & embedded questions
          const sheetsData = (sheetsSnap.docs || []).map((doc: any) => ({
            id: doc.id,
            courseId: course.id,
            ...doc.data()
          }));

          // Extract questions from embedded sheet documents (or fallback to questions collection)
          const questionsData: any[] = [];
          for (const s of sheetsData) {
            if (Array.isArray(s.questions) && s.questions.length > 0) {
              for (const q of s.questions) {
                questionsData.push({
                  ...q,
                  sheetId: s.id,
                  courseId: course.id,
                });
              }
            } else {
              try {
                const qQuery = query(collection(db, 'questions'), where('sheetId', '==', s.id));
                const qSnap = await withTimeout(getDocs(qQuery), 5000, { docs: [] } as any);
                for (const qDoc of (qSnap.docs || [])) {
                  questionsData.push({
                    id: qDoc.id,
                    ...qDoc.data(),
                    sheetId: s.id,
                    courseId: course.id,
                  });
                }
              } catch (e) {}
            }
          }

          // Process diagram blocks with native download and compression
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

          // Compress diagrams in questions
          for (const q of questionsData) {
            if (q.q && (q.q.includes('<DIAGRAM>') || q.q.includes('<diagram>') || q.q.includes('http') || q.q.includes('cloudinary'))) {
              try {
                q.q = await processDiagramsForOffline(q.q);
              } catch (e) {}
            }
          }

          updateProgress(75);
          setDownloadStatus('Saving to offline database...');

          // Atomic single-transaction save for course notes, embedded questions, and question sheets
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
