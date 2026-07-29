import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import {
  isCourseDownloadedLocal,
  saveCourseLocal,
  saveNoteLocal,
  saveQuestionLocal,
  saveQuestionSheetLocal,
  getDatabase,
  parseFirestoreQuestion
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

// Duplicated here to avoid circular imports or messy refactoring if it's only in note-grabber
async function processDiagramsForOffline(content: string): Promise<string> {
  if (!content) return content;
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return content;

    const processedBlocks = await Promise.all(
      blocks.map(async (block: any) => {
        if (block.type === 'diagram' && block.content && block.content.startsWith('http')) {
          try {
            console.log('Downloading diagram for offline storage:', block.content);
            const response = await fetch(block.content);
            const blob = await response.blob();
            
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            
            return {
              ...block,
              content: base64Data,
            };
          } catch (err) {
            console.error('Failed to convert diagram to base64 for offline study:', err);
            return block;
          }
        }
        return block;
      })
    );
    return JSON.stringify(processedBlocks);
  } catch (e) {
    return content;
  }
}

export function AutoDownloader() {
  const { user, profile, systemConfig, isOffline } = useAuth();
  const { colors: C } = useTheme();
  
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [courseName, setCourseName] = useState('');

  const downloadingRef = React.useRef(false);

  useEffect(() => {
    // Only proceed if user is logged in, activated, not offline, and profile/config loaded
    if (!user || !profile || !profile.isActivated || !systemConfig || isOffline) {
      return;
    }
    
    if (downloadingRef.current) return;

    const checkAndDownload = async () => {
      try {
        const lastDownloadedUid = await AsyncStorage.getItem('colearn_last_downloaded_uid');
        const lastDownloadedSemester = await AsyncStorage.getItem('colearn_last_downloaded_semester');

        if (lastDownloadedUid === user.uid && lastDownloadedSemester === systemConfig.currentSemester) {
          // Already downloaded for this user and semester
          return;
        }

        downloadingRef.current = true;
        setDownloading(true);

        // Fetch user's courses
        const q = query(
          collection(db, 'courses'),
          where('semester', '==', systemConfig.currentSemester)
        );
        const snapshot = await getDocs(q);
        const fsCourses: Course[] = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            code: d.code,
            title: d.title,
            semester: d.semester,
            level: d.level,
            department: d.department,
            progress: 0,
            isDownloaded: false
          };
        });

        const myCourses = await getFilteredCoursesForStudent(fsCourses, profile, true, systemConfig.currentSemester);
        
        // Filter out courses already downloaded
        const toDownload = myCourses.filter(c => !isCourseDownloadedLocal(c.id));

        if (toDownload.length === 0) {
          await AsyncStorage.setItem('colearn_last_downloaded_uid', user.uid);
          await AsyncStorage.setItem('colearn_last_downloaded_semester', systemConfig.currentSemester);
          setDownloading(false);
          downloadingRef.current = false;
          return;
        }

        let currentCourseIndex = 0;
        for (const course of toDownload) {
          currentCourseIndex++;
          setCourseName(`[${currentCourseIndex}/${toDownload.length}] ${course.code}`);
          setDownloadPercent(0);
          setDownloadStatus('Connecting to server...');

          // 1. Download snapshots
          const notesQ = query(collection(db, 'notes'), where('courseId', '==', course.id));
          const notesSnap = await getDocs(notesQ);
          setDownloadPercent(15);
          setDownloadStatus('Fetching questions sheets...');

          const qQ = query(collection(db, 'questions'), where('courseId', '==', course.id));
          const qSnap = await getDocs(qQ);
          setDownloadPercent(25);
          setDownloadStatus('Fetching questions...');

          const sheetsQ = query(collection(db, 'questionSheets'), where('courseId', '==', course.id));
          const sheetsSnap = await getDocs(sheetsQ);
          setDownloadPercent(35);
          setDownloadStatus(`Saving course metadata...`);

          // 3. Save to local SQLite relational schema
          saveCourseLocal(course);

          const totalNotes = notesSnap.docs.length;
          const totalQuestions = qSnap.docs.length;
          const totalSheets = sheetsSnap.docs.length;

          const updateProgress = (completedStepWeightPercent: number) => {
            setDownloadPercent(Math.round(completedStepWeightPercent));
          };

          // Save question sheets (weight from 35% to 45%)
          setDownloadStatus('Saving exam schedules...');
          sheetsSnap.docs.forEach((doc, idx) => {
            saveQuestionSheetLocal({ id: doc.id, courseId: course.id, ...doc.data() });
            const p = 35 + ((idx + 1) / (totalSheets || 1)) * 10;
            updateProgress(p);
          });

          // Save each note after ensuring its internal diagrams are downloaded offline (weight from 45% to 85%)
          for (let i = 0; i < totalNotes; i++) {
            const doc = notesSnap.docs[i];
            setDownloadStatus(`Pruning diagrams offline... [${i + 1}/${totalNotes}]`);
            const noteData = doc.data();
            let content = noteData.content || '';
            try {
              content = await processDiagramsForOffline(content);
            } catch (err) {
              console.error('Error preprocessing diagrams for local index:', err);
            }
            
            saveNoteLocal({
              id: doc.id,
              courseId: course.id,
              title: noteData.title || '',
              content,
              order: noteData.order || 0,
              duration: noteData.duration || '',
              tag: noteData.tag || 'CORE'
            });

            const p = 45 + ((i + 1) / (totalNotes || 1)) * 40;
            updateProgress(p);
          }

          // Save questions (weight from 85% to 98%)
          setDownloadStatus('Saving CBT offline materials...');
          qSnap.docs.forEach((doc, idx) => {
            saveQuestionLocal({ id: doc.id, courseId: course.id, ...doc.data() });
            const p = 85 + ((idx + 1) / (totalQuestions || 1)) * 13;
            updateProgress(p);
          });
        }

        // Mark as fully downloaded
        await AsyncStorage.setItem('colearn_last_downloaded_uid', user.uid);
        await AsyncStorage.setItem('colearn_last_downloaded_semester', systemConfig.currentSemester);
        setDownloading(false);
        downloadingRef.current = false;

      } catch (e) {
        console.error('Error in auto downloader:', e);
        setDownloading(false);
        downloadingRef.current = false;
      }
    };

    checkAndDownload();
  }, [user, profile, systemConfig, isOffline]);

  if (!downloading) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
      <View style={[styles.modal, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: C.ink }]}>Syncing Courses</Text>
        <Text style={[styles.subtitle, { color: C.dim }]}>{courseName}</Text>
        <Text style={[styles.status, { color: C.dim }]}>{downloadStatus}</Text>
        
        <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: C.primary, width: `${downloadPercent}%` }]} />
        </View>
        <Text style={[styles.percent, { color: C.primary }]}>{downloadPercent}%</Text>
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
});
