import * as SQLite from 'expo-sqlite';
import { APP_BUILD_VERSION, APP_HARDCODED_AVUUID } from '../constants/versionConfig';

let dbInstance: any = null;

export function getDatabase() {
  if (!dbInstance) {
    try {
      if (typeof SQLite.openDatabaseSync === 'function') {
        dbInstance = SQLite.openDatabaseSync('colearn.db');
      } else {
        dbInstance = (SQLite as any).openDatabase('colearn.db');
      }
    } catch (e) {
      console.error('Failed to open SQLite database:', e);
    }
  }
  return dbInstance;
}

export async function initDatabase() {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.execSync) {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS system_config (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS user_profile (
          uid TEXT PRIMARY KEY,
          studentId TEXT,
          email TEXT,
          username TEXT,
          department TEXT,
          mobileNumber TEXT,
          academicLevel TEXT,
          level TEXT,
          isActivated INTEGER
        );
        CREATE TABLE IF NOT EXISTS courses (
          id TEXT PRIMARY KEY,
          code TEXT,
          title TEXT,
          semester TEXT,
          level TEXT,
          department TEXT,
          progress INTEGER,
          isDownloaded INTEGER DEFAULT 0,
          disabled INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          courseId TEXT,
          title TEXT,
          content TEXT,
          "order" INTEGER,
          duration TEXT,
          tag TEXT
        );
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          courseId TEXT,
          q TEXT,
          options TEXT,
          answer INTEGER,
          sheetId TEXT
        );
        CREATE TABLE IF NOT EXISTS question_sheets (
          id TEXT PRIMARY KEY,
          courseId TEXT,
          year TEXT,
          semester TEXT,
          academicLevel TEXT
        );
      `);
      try {
        db.execSync("ALTER TABLE courses ADD COLUMN disabled INTEGER DEFAULT 0;");
      } catch (e) {
        // column already exists
      }
      console.log('Local SQLite Database: Initialized.');
    } else {
      db.transaction((tx: any) => {
        tx.executeSql('CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT);');
        tx.executeSql('CREATE TABLE IF NOT EXISTS user_profile (uid TEXT PRIMARY KEY, studentId TEXT, email TEXT, username TEXT, department TEXT, mobileNumber TEXT, academicLevel TEXT, level TEXT, isActivated INTEGER);');
        tx.executeSql('CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, code TEXT, title TEXT, semester TEXT, level TEXT, department TEXT, progress INTEGER, isDownloaded INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0);');
        tx.executeSql('CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, courseId TEXT, title TEXT, content TEXT, "order" INTEGER, duration TEXT, tag TEXT);');
        tx.executeSql('CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, courseId TEXT, q TEXT, options TEXT, answer INTEGER, sheetId TEXT);');
        tx.executeSql('CREATE TABLE IF NOT EXISTS question_sheets (id TEXT PRIMARY KEY, courseId TEXT, year TEXT, semester TEXT, academicLevel TEXT);');
        tx.executeSql('ALTER TABLE courses ADD COLUMN disabled INTEGER DEFAULT 0;', [], () => {}, () => {});
      }, (e: any) => {
        console.error('Legacy SQLite transaction error:', e);
      });
      console.log('Local SQLite Database (Legacy): Initialized.');
    }
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
  }
}

// Save last logged in studentId to SQLite
export function saveLastLoggedInStudentId(studentId: string) {
  const db = getDatabase();
  if (!db || !studentId) return;
  try {
    if (db.runSync) {
      db.runSync('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)', ['lastLoggedInStudentId', String(studentId).trim()]);
    }
  } catch (e) {
    console.error('Error saving last logged in studentId to SQLite:', e);
  }
}

// Get last logged in studentId from SQLite
export function getLastLoggedInStudentId(): string | null {
  const db = getDatabase();
  if (!db || !db.getFirstSync) return null;
  try {
    const res = db.getFirstSync('SELECT value FROM system_config WHERE key = ?', ['lastLoggedInStudentId']) as any;
    return res?.value || null;
  } catch (e) {
    console.error('Error getting last logged in studentId from SQLite:', e);
    return null;
  }
}

// Helper to check if a course is downloaded
export function isCourseDownloadedLocal(courseId: string): boolean {
  const db = getDatabase();
  if (!db) return false;
  try {
    if (db.getFirstSync) {
      const res = db.getFirstSync('SELECT isDownloaded FROM courses WHERE id = ?', [courseId]) as any;
      return res?.isDownloaded === 1;
    }
  } catch (e) {
    console.error('Error checking local course download:', e);
  }
  return false;
}

// Helper to get all downloaded course IDs
export function getAllDownloadedCourseIdsLocal(): string[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    const courses = db.getAllSync('SELECT id FROM courses WHERE isDownloaded = 1') || [];
    return courses.map((c: any) => c.id);
  } catch (e) {
    console.error('Error fetching downloaded course IDs:', e);
    return [];
  }
}

// Helper to get all local course IDs
export function getAllLocalCourseIds(): string[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    const courses = db.getAllSync('SELECT id FROM courses') || [];
    return courses.map((c: any) => c.id);
  } catch (e) {
    console.error('Error fetching all local course IDs:', e);
    return [];
  }
}

// Helper to get all downloaded courses
export function getDownloadedCoursesLocal(): any[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    const courses = db.getAllSync('SELECT * FROM courses WHERE isDownloaded = 1') || [];
    return courses.map((c: any) => ({
      ...c,
      isDownloaded: c.isDownloaded === 1 || c.isDownloaded === true
    }));
  } catch (e) {
    console.error('Error fetching downloaded courses:', e);
    return [];
  }
}

// Save courses from server during background synchronization without overwriting isDownloaded
export function saveCoursesFromServer(courses: any[]) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      for (const course of courses) {
        db.runSync(
          `INSERT INTO courses (id, code, title, semester, level, department, progress, isDownloaded, disabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
          ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            title = excluded.title,
            semester = excluded.semester,
            level = excluded.level,
            department = excluded.department,
            progress = excluded.progress,
            disabled = excluded.disabled`,
          [
            course.id,
            course.code || '',
            course.title || '',
            course.semester || '',
            course.level || '',
            course.department || '',
            course.progress || 0,
            course.disabled ? 1 : 0
          ]
        );
      }
      console.log(`[SQLite sync] Synchronized ${courses.length} courses with local database.`);
    }
  } catch (e) {
    console.error('Error saving courses from server:', e);
  }
}

// Sync course detail to SQLite
export function saveCourseLocal(course: any) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync(
        `INSERT OR REPLACE INTO courses (id, code, title, semester, level, department, progress, isDownloaded, disabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          course.id, 
          course.code, 
          course.title, 
          course.semester, 
          course.level, 
          course.department || '', 
          course.progress || 0,
          course.disabled ? 1 : 0
        ]
      );
    }
  } catch (e) {
    console.error('Error saving local course:', e);
  }
}

// Sync note detail to SQLite
export function saveNoteLocal(note: any) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync(
        `INSERT OR REPLACE INTO notes (id, courseId, title, content, "order", duration, tag) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [note.id, note.courseId, note.title, note.content || '', note.order || 0, note.duration || '', note.tag || 'CORE']
      );
    }
  } catch (e) {
    console.error('Error saving local note:', e);
  }
}

// Fast batch save for notes (uses single transaction if available)
export function saveNotesBatchLocal(notes: any[]) {
  const db = getDatabase();
  if (!db || !notes || notes.length === 0) return;
  try {
    const doBatch = () => {
      for (const note of notes) {
        db.runSync(
          `INSERT OR REPLACE INTO notes (id, courseId, title, content, "order", duration, tag) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [note.id, note.courseId, note.title, note.content || '', note.order || 0, note.duration || '', note.tag || 'CORE']
        );
      }
    };
    if (typeof db.withTransactionSync === 'function') {
      db.withTransactionSync(doBatch);
    } else {
      doBatch();
    }
  } catch (e) {
    console.error('Error batch saving notes to SQLite:', e);
  }
}

// Utility to parse Firestore questions into unified mobile standard schema
export function parseFirestoreQuestion(id: string, data: any): any {
  let optsArray: string[] = [];
  let correctIdx = 0;
  
  if (data.correctAnswer && Array.isArray(data.incorrectAnswers)) {
    // Collect all options and sort them alphabetically to be deterministic
    optsArray = [data.correctAnswer, ...data.incorrectAnswers].sort();
    correctIdx = optsArray.indexOf(data.correctAnswer);
  } else {
    optsArray = data.opts || data.options || [];
    correctIdx = data.answer ?? 0;
  }

  return {
    id: id,
    courseId: data.courseId || '',
    q: data.text || data.q || data.question || '',
    opts: optsArray,
    answer: correctIdx,
    sheetId: data.sheetId || '',
    explanation: data.explanation || ''
  };
}

// Sync question to SQLite
export function saveQuestionLocal(q: any) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      // Parse question fields first (handles Firestore data format vs already-parsed format)
      const parsed = parseFirestoreQuestion(q.id, q);
      const optionsJSON = JSON.stringify(parsed.opts);
      db.runSync(
        `INSERT OR REPLACE INTO questions (id, courseId, q, options, answer, sheetId) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [parsed.id || '', parsed.courseId || q.courseId || '', parsed.q || '', optionsJSON || '[]', parsed.answer || 0, parsed.sheetId || '']
      );
    }
  } catch (e) {
    console.error('Error saving local question:', e);
  }
}

// Fast batch save for questions
export function saveQuestionsBatchLocal(questions: any[]) {
  const db = getDatabase();
  if (!db || !questions || questions.length === 0) return;
  try {
    const doBatch = () => {
      for (const q of questions) {
        const parsed = parseFirestoreQuestion(q.id, q);
        const optionsJSON = JSON.stringify(parsed.opts);
        db.runSync(
          `INSERT OR REPLACE INTO questions (id, courseId, q, options, answer, sheetId) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [parsed.id || '', parsed.courseId || q.courseId || '', parsed.q || '', optionsJSON || '[]', parsed.answer || 0, parsed.sheetId || '']
        );
      }
    };
    if (typeof db.withTransactionSync === 'function') {
      db.withTransactionSync(doBatch);
    } else {
      doBatch();
    }
  } catch (e) {
    console.error('Error batch saving questions to SQLite:', e);
  }
}

// Sync question sheet to SQLite
export function saveQuestionSheetLocal(sheet: any) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync(
        `INSERT OR REPLACE INTO question_sheets (id, courseId, year, semester, academicLevel) 
         VALUES (?, ?, ?, ?, ?)`,
        [sheet.id || '', sheet.courseId || '', sheet.year || '', sheet.semester || '', sheet.academicLevel || '']
      );
    }
  } catch (e) {
    console.error('Error saving local question sheet:', e);
  }
}

// Fast batch save for question sheets
export function saveQuestionSheetsBatchLocal(sheets: any[]) {
  const db = getDatabase();
  if (!db || !sheets || sheets.length === 0) return;
  try {
    const doBatch = () => {
      for (const sheet of sheets) {
        db.runSync(
          `INSERT OR REPLACE INTO question_sheets (id, courseId, year, semester, academicLevel) 
           VALUES (?, ?, ?, ?, ?)`,
          [sheet.id || '', sheet.courseId || '', sheet.year || '', sheet.semester || '', sheet.academicLevel || '']
        );
      }
    };
    if (typeof db.withTransactionSync === 'function') {
      db.withTransactionSync(doBatch);
    } else {
      doBatch();
    }
  } catch (e) {
    console.error('Error batch saving question sheets to SQLite:', e);
  }
}

// Save config
export function saveConfigLocal(semester: string) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)', ['currentSemester', semester]);
    }
  } catch (e) {
    console.error('Error saving system config locally:', e);
  }
}

// Save profile info
export function saveProfileLocal(profile: any) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync(
        `INSERT OR REPLACE INTO user_profile (uid, studentId, email, username, department, mobileNumber, academicLevel, level, isActivated) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profile.uid,
          profile.studentId || '',
          profile.email || '',
          profile.username || '',
          profile.department || '',
          profile.mobileNumber || '',
          profile.academicLevel || '',
          profile.level || '1',
          profile.isActivated ? 1 : 0
        ]
      );
    }
  } catch (e) {
    console.error('Error saving user profile locally:', e);
  }
}

// Clear user profile and config local (logout helper)
export function clearUserProfileLocal() {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync('DELETE FROM user_profile');
      // Preserve lastLoggedInStudentId and app settings across user sessions
      db.runSync("DELETE FROM system_config WHERE key NOT IN ('lastLoggedInStudentId', 'appVersionNumber', 'appAvuuid')");
      console.log('Cleared user_profile local database table while preserving lastLoggedInStudentId.');
    }
  } catch (e) {
    console.error('Error clearing local user profile in SQLite:', e);
  }
}

// Delete a course and all its associated materials locally
export function deleteCourseLocal(courseId: string) {
  const db = getDatabase();
  if (!db || !courseId) return;
  try {
    const doDelete = () => {
      db.runSync('DELETE FROM courses WHERE id = ?', [courseId]);
      db.runSync('DELETE FROM notes WHERE courseId = ?', [courseId]);
      db.runSync('DELETE FROM questions WHERE courseId = ?', [courseId]);
      db.runSync('DELETE FROM question_sheets WHERE courseId = ?', [courseId]);
    };
    if (typeof db.withTransactionSync === 'function') {
      db.withTransactionSync(doDelete);
    } else {
      doDelete();
    }
  } catch (e) {
    console.error('Error deleting course locally:', e);
  }
}

// Atomic transaction save for complete course with notes, questions, and sheets
export function saveCompleteCourseLocal(course: any, notes: any[], questions: any[], questionSheets: any[]) {
  const db = getDatabase();
  if (!db || !course || !course.id) return;
  try {
    const doBatch = () => {
      // 1. Insert/Update Course
      db.runSync(
        `INSERT OR REPLACE INTO courses (id, code, title, semester, level, department, progress, isDownloaded, disabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          course.id, 
          course.code || '', 
          course.title || '', 
          course.semester || '', 
          course.level || '', 
          course.department || '', 
          course.progress || 0,
          course.disabled ? 1 : 0
        ]
      );

      // 2. Clear existing items for this course to prevent duplicates
      db.runSync('DELETE FROM notes WHERE courseId = ?', [course.id]);
      db.runSync('DELETE FROM questions WHERE courseId = ?', [course.id]);
      db.runSync('DELETE FROM question_sheets WHERE courseId = ?', [course.id]);

      // 3. Batch insert notes
      if (Array.isArray(notes) && notes.length > 0) {
        for (const note of notes) {
          db.runSync(
            `INSERT OR REPLACE INTO notes (id, courseId, title, content, "order", duration, tag) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [note.id, course.id, note.title || '', note.content || '', note.order || 0, note.duration || '', note.tag || 'CORE']
          );
        }
      }

      // 4. Batch insert questions
      if (Array.isArray(questions) && questions.length > 0) {
        for (const q of questions) {
          const parsed = parseFirestoreQuestion(q.id, q);
          const optionsJSON = JSON.stringify(parsed.opts || []);
          db.runSync(
            `INSERT OR REPLACE INTO questions (id, courseId, q, options, answer, sheetId) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [parsed.id || '', course.id, parsed.q || '', optionsJSON, parsed.answer || 0, parsed.sheetId || '']
          );
        }
      }

      // 5. Batch insert question sheets
      if (Array.isArray(questionSheets) && questionSheets.length > 0) {
        for (const sheet of questionSheets) {
          db.runSync(
            `INSERT OR REPLACE INTO question_sheets (id, courseId, year, semester, academicLevel) 
             VALUES (?, ?, ?, ?, ?)`,
            [sheet.id || '', course.id, sheet.year || '', sheet.semester || '', sheet.academicLevel || '']
          );
        }
      }
    };

    if (typeof db.withTransactionSync === 'function') {
      db.withTransactionSync(doBatch);
    } else {
      doBatch();
    }
  } catch (e) {
    console.error('Error saving complete course batch to SQLite:', e);
  }
}

// Retrieve local notes for a course
export function getLocalNotes(courseId: string): any[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    return db.getAllSync('SELECT * FROM notes WHERE courseId = ? ORDER BY "order" ASC', [courseId]) || [];
  } catch (e) {
    console.error('Error loading offline notes:', e);
    return [];
  }
}

// Retrieve local questions for a course
export function getLocalQuestions(courseId: string): any[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    const questions = db.getAllSync('SELECT * FROM questions WHERE courseId = ?', [courseId]) || [];
    return questions.map((q: any) => ({
      id: q.id,
      courseId: q.courseId,
      q: q.q,
      opts: JSON.parse(q.options || '[]'),
      answer: q.answer,
      sheetId: q.sheetId
    }));
  } catch (e) {
    console.error('Error loading offline questions:', e);
    return [];
  }
}

// Retrieve local question sheets for a course
export function getLocalQuestionSheets(courseId: string): any[] {
  const db = getDatabase();
  if (!db || !db.getAllSync) return [];
  try {
    return db.getAllSync('SELECT * FROM question_sheets WHERE courseId = ?', [courseId]) || [];
  } catch (e) {
    console.error('Error loading offline question sheets:', e);
    return [];
  }
}

// Delete local course data (Free space)
export function getLocalCourse(courseId: string): any | null {
  const db = getDatabase();
  if (!db || !db.getFirstSync) return null;
  try {
    return db.getFirstSync('SELECT * FROM courses WHERE id = ?', [courseId]) || null;
  } catch (e) {
    console.error('Error fetching course from sqlite:', e);
    return null;
  }
}

export function removeCourseLocal(courseId: string) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync('DELETE FROM courses WHERE id = ?', [courseId]);
      db.runSync('DELETE FROM notes WHERE courseId = ?', [courseId]);
      db.runSync('DELETE FROM questions WHERE courseId = ?', [courseId]);
      db.runSync('DELETE FROM question_sheets WHERE courseId = ?', [courseId]);
      console.log('Removed course and associated assets locally from SQLite:', courseId);
    }
  } catch (e) {
    console.error('Error removing local course:', e);
  }
}

export function clearAllCoursesLocal() {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync('DELETE FROM courses');
      db.runSync('DELETE FROM notes');
      db.runSync('DELETE FROM questions');
      db.runSync('DELETE FROM question_sheets');
      console.log('Cleared all downloaded courses and notes/questions locally from SQLite due to semester change/end.');
    }
  } catch (e) {
    console.error('Error clearing local courses:', e);
  }
}

export function saveAppVersionLocal(versionNumber: string, avuuid: string) {
  const db = getDatabase();
  if (!db) return;
  try {
    if (db.runSync) {
      db.runSync('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)', ['appVersionNumber', versionNumber]);
      db.runSync('INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)', ['appAvuuid', avuuid]);
    }
  } catch (e) {
    console.error('Error saving app version to SQLite:', e);
  }
}

export function getAppVersionLocal(): { versionNumber: string; avuuid: string } {
  const db = getDatabase();
  if (!db || !db.getFirstSync) return { versionNumber: APP_BUILD_VERSION, avuuid: APP_HARDCODED_AVUUID };
  try {
    const vRes = db.getFirstSync('SELECT value FROM system_config WHERE key = ?', ['appVersionNumber']) as any;
    const aRes = db.getFirstSync('SELECT value FROM system_config WHERE key = ?', ['appAvuuid']) as any;
    return {
      versionNumber: vRes?.value || APP_BUILD_VERSION,
      avuuid: aRes?.value || APP_HARDCODED_AVUUID,
    };
  } catch (e) {
    console.error('Error fetching app version from SQLite:', e);
    return { versionNumber: APP_BUILD_VERSION, avuuid: APP_HARDCODED_AVUUID };
  }
}

