/**
 * Academic Update synchronization service.
 * Compares user's local SQLite database with Firestore academic records (courses, notes, past questions, question sheets)
 * and pulls any new or updated academic materials.
 */
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { getFilteredCoursesForStudent } from './courseFilter';
import {
  saveCourseLocal,
  saveNotesBatchLocal,
  saveQuestionsBatchLocal,
  saveQuestionSheetsBatchLocal,
  getLocalNotes,
  getLocalQuestions,
  getLocalQuestionSheets,
  getAllDownloadedCourseIdsLocal,
} from './db';

export interface AcademicUpdateResult {
  hasUpdates: boolean;
  totalCoursesChecked: number;
  coursesWithUpdates: number;
  notesUpdated: number;
  questionsUpdated: number;
  sheetsUpdated: number;
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

  let coursesWithUpdates = 0;
  let notesUpdated = 0;
  let questionsUpdated = 0;
  let sheetsUpdated = 0;

  const localDownloadedIds = getAllDownloadedCourseIdsLocal();

  for (let i = 0; i < studentCourses.length; i++) {
    const course = studentCourses[i];
    if (onProgress) onProgress(`Checking ${course.code} (${i + 1}/${studentCourses.length})...`);

    // Fetch notes, questions, and sheets for this course from Firestore
    const notesQ = query(collection(db, 'notes'), where('courseId', '==', course.id));
    const questionsQ = query(collection(db, 'questions'), where('courseId', '==', course.id));
    const sheetsQ = query(collection(db, 'questionSheets'), where('courseId', '==', course.id));

    const [notesSnap, questionsSnap, sheetsSnap] = await Promise.all([
      getDocs(notesQ),
      getDocs(questionsQ),
      getDocs(sheetsQ),
    ]);

    const fsNotes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsQuestions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsSheets = sheetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get local SQLite items
    const localNotes = getLocalNotes(course.id) || [];
    const localQuestions = getLocalQuestions(course.id) || [];
    const localSheets = getLocalQuestionSheets(course.id) || [];

    const isCourseMissingLocally = !localDownloadedIds.includes(course.id);

    // Check notes diff: count mismatch or missing ids or content differences
    const localNoteIdSet = new Set(localNotes.map(n => n.id));
    const newOrChangedNotes = fsNotes.filter(fn => {
      if (!localNoteIdSet.has(fn.id)) return true;
      const ln = localNotes.find(n => n.id === fn.id);
      return ln && (ln.content?.length !== fn.content?.length || ln.title !== fn.title);
    });

    // Check question sheets diff
    const localSheetIdSet = new Set(localSheets.map(s => s.id));
    const newSheets = fsSheets.filter(fs => !localSheetIdSet.has(fs.id));

    // Check questions diff
    const localQuestionIdSet = new Set(localQuestions.map(q => q.id));
    const newQuestions = fsQuestions.filter(fq => !localQuestionIdSet.has(fq.id));

    const hasCourseDiff =
      isCourseMissingLocally ||
      newOrChangedNotes.length > 0 ||
      newSheets.length > 0 ||
      newQuestions.length > 0;

    if (hasCourseDiff) {
      coursesWithUpdates++;
      notesUpdated += newOrChangedNotes.length;
      questionsUpdated += newQuestions.length;
      sheetsUpdated += newSheets.length;

      // Persist changes directly to SQLite
      saveCourseLocal(course);
      if (fsNotes.length > 0) saveNotesBatchLocal(fsNotes);
      if (fsSheets.length > 0) saveQuestionSheetsBatchLocal(fsSheets);
      if (fsQuestions.length > 0) saveQuestionsBatchLocal(fsQuestions);
    }
  }

  const hasUpdates = coursesWithUpdates > 0;
  const summaryMessage = hasUpdates
    ? `Successfully updated ${coursesWithUpdates} course(s): synced ${notesUpdated} note(s), ${questionsUpdated} past question(s), and ${sheetsUpdated} question sheet(s).`
    : 'Your academic notes and past questions are already up to date!';

  return {
    hasUpdates,
    totalCoursesChecked: studentCourses.length,
    coursesWithUpdates,
    notesUpdated,
    questionsUpdated,
    sheetsUpdated,
    summaryMessage,
  };
}
