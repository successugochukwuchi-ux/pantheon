/**
 * Academic Update synchronization service.
 * Performs comprehensive bidirectional reconciliation between user's local SQLite database
 * and Firestore academic records (courses, notes, past questions, question sheets).
 * Accurately detects and applies:
 * - Content modifications and mistake corrections (notes and questions down to individual letters)
 * - Deletions by administrators (notes, questions, sheets, or courses)
 * - Newly added materials
 * - Diagram downloading & compression for offline notes & questions
 */
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { getFilteredCoursesForStudent } from './courseFilter';
import {
  saveCompleteCourseLocal,
  deleteCourseLocal,
  getLocalNotes,
  getLocalQuestions,
  getLocalQuestionSheets,
  getAllDownloadedCourseIdsLocal,
  parseFirestoreQuestion,
  getDatabase,
} from './db';
import { clearCourseNotesCache, clearNoteCache } from './noteCache';
import { processAndCompressNoteDiagrams, processAndCompressQuestionDiagrams } from './diagramManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AcademicUpdateResult {
  hasUpdates: boolean;
  totalCoursesChecked: number;
  coursesWithUpdates: number;
  coursesRemoved: number;
  notesUpdated: number;
  notesDeleted: number;
  questionsUpdated: number;
  questionsDeleted: number;
  sheetsUpdated: number;
  sheetsDeleted: number;
  summaryMessage: string;
}

export async function checkAndApplyAcademicUpdates(
  profile: any,
  systemConfig: any,
  onProgress?: (msg: string) => void
): Promise<AcademicUpdateResult> {
  if (!profile || !profile.isActivated) {
    throw new Error('Account must be active to check for academic updates.');
  }

  const activeSemester = (!systemConfig?.currentSemester || systemConfig.currentSemester === 'none')
    ? '1st'
    : systemConfig.currentSemester;

  if (onProgress) onProgress('Fetching academic course catalog...');

  // 1. Fetch available Firestore courses for the active semester
  const coursesQuery = query(collection(db, 'courses'), where('semester', '==', activeSemester));
  const coursesSnapshot = await getDocs(coursesQuery);

  const fsCourses: any[] = coursesSnapshot.docs.map((d: any) => ({
    id: d.id,
    ...d.data(),
  }));

  // 2. Filter courses for this student's department, level, and active semester
  const studentCourses = await getFilteredCoursesForStudent(fsCourses, profile, true, activeSemester);
  const localDownloadedIds = getAllDownloadedCourseIdsLocal();

  // Also include any locally downloaded courses that might not be in the active semester filter
  // so their mistakes or deletions are always reconciled!
  const coursesToCheckMap = new Map<string, any>();
  for (const c of studentCourses) {
    coursesToCheckMap.set(c.id, c);
  }
  for (const localId of localDownloadedIds) {
    if (!coursesToCheckMap.has(localId)) {
      const matchInFs = fsCourses.find(c => c.id === localId);
      if (matchInFs) {
        coursesToCheckMap.set(localId, matchInFs);
      } else {
        // Obsolete or deleted from Firestore completely
        deleteCourseLocal(localId);
        clearCourseNotesCache(localId);
      }
    }
  }

  const allCoursesToCheck = Array.from(coursesToCheckMap.values());
  const activeCourseIdSet = new Set(allCoursesToCheck.map(c => c.id));

  // 3. Detect and remove obsolete/deleted courses from SQLite
  let coursesRemoved = 0;
  for (const localId of localDownloadedIds) {
    if (!activeCourseIdSet.has(localId)) {
      deleteCourseLocal(localId);
      clearCourseNotesCache(localId);
      coursesRemoved++;
    }
  }

  let coursesWithUpdates = 0;
  let notesUpdated = 0;
  let notesDeleted = 0;
  let questionsUpdated = 0;
  let questionsDeleted = 0;
  let sheetsUpdated = 0;
  let sheetsDeleted = 0;

  for (let i = 0; i < allCoursesToCheck.length; i++) {
    const course = allCoursesToCheck[i];
    if (onProgress) onProgress(`Checking ${course.code || 'Course'} (${i + 1}/${allCoursesToCheck.length})...`);

    // Fetch notes and sheets for this course from Firestore
    const notesQ = query(collection(db, 'notes'), where('courseId', '==', course.id));
    const sheetsQ = query(collection(db, 'questionSheets'), where('courseId', '==', course.id));

    const [notesSnap, sheetsSnap] = await Promise.all([
      getDocs(notesQ),
      getDocs(sheetsQ),
    ]);

    const fsNotes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const fsSheets = sheetsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    // Get current local SQLite items for this course
    const localNotes = getLocalNotes(course.id) || [];
    const localSheets = getLocalQuestionSheets(course.id) || [];
    const localQuestions = getLocalQuestions(course.id) || [];

    const isCourseMissingLocally = !localDownloadedIds.includes(course.id);

    // ── 1. NOTES DIFF: additions, edits, and deletions ──
    const fsNoteIdSet = new Set(fsNotes.map(n => n.id));
    const localNotesMap = new Map<string, any>(localNotes.map(n => [n.id, n]));

    const courseNotesDeleted = localNotes.filter(ln => !fsNoteIdSet.has(ln.id));
    const courseNotesNewOrChanged = fsNotes.filter(fn => {
      const ln = localNotesMap.get(fn.id);
      if (!ln) return true; // Added
      // Check for content edits down to every character
      if ((ln.title || '').trim() !== (fn.title || '').trim()) return true;
      if (ln.content !== fn.content) return true;
      if ((ln.order || 0) !== (fn.order || 0)) return true;
      if ((ln.tag || 'CORE') !== (fn.tag || 'CORE')) return true;
      if ((ln.duration || '') !== (fn.duration || '')) return true;
      return false;
    });

    // ── 2. QUESTION SHEETS DIFF: additions, edits, and deletions ──
    const fsSheetIdSet = new Set(fsSheets.map(s => s.id));
    const localSheetsMap = new Map<string, any>(localSheets.map(s => [s.id, s]));

    const courseSheetsDeleted = localSheets.filter(ls => !fsSheetIdSet.has(ls.id));
    const courseSheetsNewOrChanged = fsSheets.filter(fs => {
      const ls = localSheetsMap.get(fs.id);
      if (!ls) return true; // Added
      if ((ls.year || '') !== (fs.year || '')) return true;
      if ((ls.semester || '') !== (fs.semester || '')) return true;
      if ((ls.academicLevel || '') !== (fs.academicLevel || '')) return true;
      return false;
    });

    // ── 3. QUESTIONS DIFF: additions, corrections, and deletions down to individual letters ──
    // Extract and parse all Firestore questions from embedded sheets or questions collection
    const fsQuestions: any[] = [];
    for (const s of fsSheets) {
      if (Array.isArray(s.questions) && s.questions.length > 0) {
        s.questions.forEach((q: any, idx: number) => {
          const qId = q.id || `${s.id}_q_${idx}`;
          fsQuestions.push(parseFirestoreQuestion(qId, {
            ...q,
            sheetId: s.id,
            courseId: course.id,
          }));
        });
      } else {
        // Fallback: If sheet has no embedded questions, check separate questions collection
        try {
          const qQuestions = query(collection(db, 'questions'), where('sheetId', '==', s.id));
          const qSnap = await getDocs(qQuestions);
          for (const qDoc of qSnap.docs) {
            fsQuestions.push(parseFirestoreQuestion(qDoc.id, {
              ...qDoc.data(),
              sheetId: s.id,
              courseId: course.id,
            }));
          }
        } catch (e) {}
      }
    }

    // Also check direct course-level questions if none found in sheets
    if (fsQuestions.length === 0) {
      try {
        const directQQuery = query(collection(db, 'questions'), where('courseId', '==', course.id));
        const directQSnap = await getDocs(directQQuery);
        for (const qDoc of directQSnap.docs) {
          fsQuestions.push(parseFirestoreQuestion(qDoc.id, {
            ...qDoc.data(),
            courseId: course.id,
          }));
        }
      } catch (e) {}
    }

    const fsQuestionIdSet = new Set(fsQuestions.map(q => q.id));
    const localQuestionsMap = new Map<string, any>(localQuestions.map(q => [q.id, q]));

    // Detect deleted questions: present in local SQLite but removed from Firestore
    const courseQuestionsDeleted = localQuestions.filter(lq => !fsQuestionIdSet.has(lq.id));

    // Detect added or modified questions: text, options, answer, explanation down to individual characters
    const courseQuestionsNewOrChanged = fsQuestions.filter(fq => {
      const lq = localQuestionsMap.get(fq.id);
      if (!lq) return true; // Newly added
      // Check question text down to individual characters
      if ((lq.q || '').trim() !== (fq.q || '').trim()) return true;
      // Check correct answer index
      if (lq.answer !== fq.answer) return true;
      // Check options array
      if (JSON.stringify(lq.opts || []) !== JSON.stringify(fq.opts || [])) return true;
      // Check explanation
      if ((lq.explanation || '').trim() !== (fq.explanation || '').trim()) return true;
      // Check sheetId association
      if (lq.sheetId !== fq.sheetId) return true;
      return false;
    });

    const hasCourseDiff =
      isCourseMissingLocally ||
      courseNotesNewOrChanged.length > 0 ||
      courseNotesDeleted.length > 0 ||
      courseSheetsNewOrChanged.length > 0 ||
      courseSheetsDeleted.length > 0 ||
      courseQuestionsNewOrChanged.length > 0 ||
      courseQuestionsDeleted.length > 0;

    if (hasCourseDiff) {
      coursesWithUpdates++;
      notesUpdated += courseNotesNewOrChanged.length;
      notesDeleted += courseNotesDeleted.length;
      sheetsUpdated += courseSheetsNewOrChanged.length;
      sheetsDeleted += courseSheetsDeleted.length;
      questionsUpdated += courseQuestionsNewOrChanged.length;
      questionsDeleted += courseQuestionsDeleted.length;

      // 1. Download and compress diagrams for all notes
      if (onProgress) onProgress(`Compressing diagrams for ${course.code}...`);
      for (const fn of fsNotes) {
        if (fn.content) {
          try {
            fn.content = await processAndCompressNoteDiagrams(fn.content);
          } catch (e) {}
        }
      }

      // 2. Download and compress diagrams in questions (question text, explanation, and options)
      for (const fq of fsQuestions) {
        if (fq.q && (fq.q.includes('<DIAGRAM>') || fq.q.includes('<diagram>') || fq.q.includes('http') || fq.q.includes('cloudinary'))) {
          try {
            fq.q = await processAndCompressQuestionDiagrams(fq.q);
          } catch (e) {}
        }
        if (fq.explanation && (fq.explanation.includes('<DIAGRAM>') || fq.explanation.includes('<diagram>') || fq.explanation.includes('http') || fq.explanation.includes('cloudinary'))) {
          try {
            fq.explanation = await processAndCompressQuestionDiagrams(fq.explanation);
          } catch (e) {}
        }
        if (Array.isArray(fq.opts)) {
          for (let optIdx = 0; optIdx < fq.opts.length; optIdx++) {
            const optVal = fq.opts[optIdx];
            if (typeof optVal === 'string' && (optVal.includes('http') || optVal.includes('cloudinary') || optVal.includes('<DIAGRAM>'))) {
              try {
                fq.opts[optIdx] = await processAndCompressQuestionDiagrams(optVal);
              } catch (e) {}
            }
          }
        }
      }

      // 3. Atomically overwrite course in SQLite: deletes all obsolete/deleted notes, questions, sheets
      // and inserts the exact Firestore content down to the letter!
      saveCompleteCourseLocal(course, fsNotes, fsQuestions, fsSheets);

      // 4. Invalidate memory & storage caches so UI updates immediately
      clearCourseNotesCache(course.id);
      courseNotesDeleted.forEach(n => clearNoteCache(n.id));
      courseNotesNewOrChanged.forEach(n => clearNoteCache(n.id));
    }
  }

  // Update sync timestamp and academic update stamp in AsyncStorage
  if (systemConfig?.lastAcademicUpdate) {
    await AsyncStorage.setItem('colearn_last_academic_update_stamp', String(systemConfig.lastAcademicUpdate)).catch(() => {});
  }
  await AsyncStorage.setItem('colearn_last_academic_sync_timestamp', String(Date.now())).catch(() => {});

  const hasUpdates =
    coursesWithUpdates > 0 ||
    coursesRemoved > 0 ||
    notesUpdated > 0 ||
    notesDeleted > 0 ||
    questionsUpdated > 0 ||
    questionsDeleted > 0 ||
    sheetsUpdated > 0 ||
    sheetsDeleted > 0;

  const summaryParts: string[] = [];
  if (coursesWithUpdates > 0) summaryParts.push(`${coursesWithUpdates} course(s) updated`);
  if (coursesRemoved > 0) summaryParts.push(`${coursesRemoved} obsolete course(s) removed`);
  if (notesUpdated > 0) summaryParts.push(`${notesUpdated} note(s) added/updated`);
  if (notesDeleted > 0) summaryParts.push(`${notesDeleted} note(s) deleted`);
  if (questionsUpdated > 0) summaryParts.push(`${questionsUpdated} question(s) corrected/added`);
  if (questionsDeleted > 0) summaryParts.push(`${questionsDeleted} question(s) deleted`);
  if (sheetsUpdated > 0) summaryParts.push(`${sheetsUpdated} question sheet(s) updated`);
  if (sheetsDeleted > 0) summaryParts.push(`${sheetsDeleted} question sheet(s) deleted`);

  const summaryMessage = hasUpdates
    ? `Academic updates synced:\n• ${summaryParts.join('\n• ')}`
    : 'Your academic notes and past questions are already up to date!';

  return {
    hasUpdates,
    totalCoursesChecked: studentCourses.length,
    coursesWithUpdates,
    coursesRemoved,
    notesUpdated,
    notesDeleted,
    questionsUpdated,
    questionsDeleted,
    sheetsUpdated,
    sheetsDeleted,
    summaryMessage,
  };
}
