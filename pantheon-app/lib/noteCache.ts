import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedNote {
  id: string;
  courseId: string;
  title: string;
  content?: string;
  duration?: string;
  tag?: 'CORE' | 'ADVANCED';
  order?: number;
  date?: string;
  summary?: string;
  completed?: boolean;
  progress?: number;
}

export interface CachedCourse {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
  department?: string;
  icon?: string;
  subject?: string;
  progress?: number;
  isRecommended?: boolean;
  isDownloaded?: boolean;
}

// Fast in-memory caches for instant 0ms synchronous access across screens
const courseListMemoryCache = new Map<string, CachedCourse[]>();
const courseByIdMemoryCache = new Map<string, CachedCourse>();
const notesByCourseMemoryCache = new Map<string, CachedNote[]>();
const noteByIdMemoryCache = new Map<string, CachedNote>();

export function sortCoursesAlphabetically<T extends { code?: string; title?: string; id?: string }>(courses: T[]): T[] {
  return [...courses].sort((a, b) => {
    const codeA = (a.code || '').trim();
    const codeB = (b.code || '').trim();
    const cmpCode = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmpCode !== 0) return cmpCode;
    const titleA = (a.title || '').trim();
    const titleB = (b.title || '').trim();
    const cmpTitle = titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
    if (cmpTitle !== 0) return cmpTitle;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

export function sortNotesAlphabetically<T extends { title?: string; id?: string }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const titleA = (a.title || '').trim();
    const titleB = (b.title || '').trim();
    const cmp = titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

export function getCachedCoursesSync(cacheKey: string): CachedCourse[] | null {
  return courseListMemoryCache.get(cacheKey) || null;
}

export async function getCachedCoursesAsync(cacheKey: string): Promise<CachedCourse[] | null> {
  const mem = courseListMemoryCache.get(cacheKey);
  if (mem && mem.length > 0) return mem;
  try {
    const raw = await AsyncStorage.getItem(`colearn_courses_cache_${cacheKey}`);
    if (raw) {
      const parsed = sortCoursesAlphabetically(JSON.parse(raw) as CachedCourse[]);
      courseListMemoryCache.set(cacheKey, parsed);
      parsed.forEach((c) => courseByIdMemoryCache.set(c.id, c));
      return parsed;
    }
  } catch {}
  return null;
}

export function setCachedCourses(cacheKey: string, courses: CachedCourse[]): CachedCourse[] {
  const sorted = sortCoursesAlphabetically(courses);
  courseListMemoryCache.set(cacheKey, sorted);
  sorted.forEach((c) => courseByIdMemoryCache.set(c.id, c));
  AsyncStorage.setItem(`colearn_courses_cache_${cacheKey}`, JSON.stringify(sorted)).catch(() => {});
  return sorted;
}

export function getCachedCourseById(courseId: string | undefined | null): CachedCourse | null {
  if (!courseId) return null;
  return courseByIdMemoryCache.get(courseId) || null;
}

export function setCachedCourseById(course: CachedCourse): void {
  if (!course?.id) return;
  courseByIdMemoryCache.set(course.id, course);
}

export function getCachedCourseNotesSync(courseId: string | undefined | null): CachedNote[] | null {
  if (!courseId) return null;
  return notesByCourseMemoryCache.get(courseId) || null;
}

export async function getCachedCourseNotesAsync(courseId: string | undefined | null): Promise<CachedNote[] | null> {
  if (!courseId) return null;
  const mem = notesByCourseMemoryCache.get(courseId);
  if (mem && mem.length > 0) return mem;
  try {
    const raw = await AsyncStorage.getItem(`colearn_course_notes_${courseId}`);
    if (raw) {
      const parsed = sortNotesAlphabetically(JSON.parse(raw) as CachedNote[]);
      notesByCourseMemoryCache.set(courseId, parsed);
      parsed.forEach((n) => {
        if (n?.id) noteByIdMemoryCache.set(n.id, n);
      });
      return parsed;
    }
  } catch {}
  return null;
}

export function setCachedCourseNotes(courseId: string | undefined | null, notes: CachedNote[]): CachedNote[] {
  const sorted = sortNotesAlphabetically(notes);
  if (!courseId) return sorted;
  notesByCourseMemoryCache.set(courseId, sorted);
  sorted.forEach((n) => {
    if (n?.id) {
      const existing = noteByIdMemoryCache.get(n.id);
      noteByIdMemoryCache.set(n.id, {
        ...existing,
        ...n,
        courseId: n.courseId || courseId,
        content: n.content !== undefined ? n.content : existing?.content,
      });
    }
  });
  AsyncStorage.setItem(`colearn_course_notes_${courseId}`, JSON.stringify(sorted)).catch(() => {});
  return sorted;
}

export function getCachedNoteById(noteId: string | undefined | null): CachedNote | null {
  if (!noteId) return null;
  return noteByIdMemoryCache.get(noteId) || null;
}

export const getCachedNoteByIdSync = getCachedNoteById;

export async function getCachedNoteByIdAsync(noteId: string | undefined | null): Promise<CachedNote | null> {
  if (!noteId) return null;
  const mem = noteByIdMemoryCache.get(noteId);
  if (mem && mem.content) return mem;
  try {
    const raw = await AsyncStorage.getItem(`colearn_note_item_${noteId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedNote;
      noteByIdMemoryCache.set(noteId, parsed);
      return parsed;
    }
  } catch {}
  return mem || null;
}

export function setCachedNoteById(note: CachedNote): void {
  if (!note?.id) return;
  const existing = noteByIdMemoryCache.get(note.id);
  const merged = { ...existing, ...note };
  noteByIdMemoryCache.set(note.id, merged);
  if (merged.content) {
    AsyncStorage.setItem(`colearn_note_item_${note.id}`, JSON.stringify(merged)).catch(() => {});
  }
}

export function clearCourseNotesCache(courseId: string): void {
  if (!courseId) return;
  notesByCourseMemoryCache.delete(courseId);
  AsyncStorage.removeItem(`colearn_course_notes_${courseId}`).catch(() => {});
}

export function clearNoteCache(noteId: string): void {
  if (!noteId) return;
  noteByIdMemoryCache.delete(noteId);
  AsyncStorage.removeItem(`colearn_note_item_${noteId}`).catch(() => {});
}

export function clearAllCourseCaches(): void {
  courseListMemoryCache.clear();
  courseByIdMemoryCache.clear();
  notesByCourseMemoryCache.clear();
  noteByIdMemoryCache.clear();
}
