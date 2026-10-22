import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { sortCoursesAlphabetically } from './noteCache';

let memoryDisciplines: any[] | null = null;
let memoryDisciplinesTime = 0;
let memorySemester: string | null = null;
const MEMORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getDisciplinesCached(): Promise<any[]> {
  const now = Date.now();
  if (memoryDisciplines && now - memoryDisciplinesTime < MEMORY_CACHE_TTL_MS) {
    return memoryDisciplines;
  }

  // Try AsyncStorage first so we never block on slow network or consume quota
  if (!memoryDisciplines) {
    try {
      const cached = await AsyncStorage.getItem('colearn_disciplines_cache');
      if (cached) {
        memoryDisciplines = JSON.parse(cached);
        memoryDisciplinesTime = now;
        return memoryDisciplines;
      }
    } catch {}
  }

  const fetchFresh = async () => {
    try {
      const disciplineSnap = await Promise.race([
        getDocs(collection(db, 'disciplines')),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 2000)),
      ]);
      const fresh = (disciplineSnap as any).docs.map((d: any) => ({ id: d.id, ...d.data() }));
      memoryDisciplines = fresh;
      memoryDisciplinesTime = Date.now();
      AsyncStorage.setItem('colearn_disciplines_cache', JSON.stringify(fresh)).catch(() => {});
      return fresh;
    } catch {
      return memoryDisciplines || [];
    }
  };

  if (memoryDisciplines && memoryDisciplines.length > 0) {
    // Refresh in background without blocking UI
    fetchFresh();
    return memoryDisciplines;
  }

  return await fetchFresh();
}

/**
 * Filter courses for students according to CCMAS curriculum discipline rules and levels (Mobile Version).
 * Always returns courses sorted alphabetically by course code.
 */
export async function getFilteredCoursesForStudent(
  allCourses: any[],
  profile: any,
  applyLevelFilter = true,
  currentSemester?: string
): Promise<any[]> {
  const isLevel5 = profile?.level === '5' || profile?.permissionLevel === '5' || profile?.email?.toLowerCase() === 'successugochukwuchi@gmail.com';
  const isLevel4 = profile?.level === '4' || profile?.permissionLevel === '4' || isLevel5;
  const userUni = (profile?.At || 'futo').toLowerCase().trim();

  // If not Level 5 superadmin, restrict courses to user's university
  const uniCourses = isLevel5
    ? allCourses
    : allCourses.filter(course => (course.At || 'futo').toLowerCase().trim() === userUni);

  const visibleCourses = uniCourses.filter(course => isLevel4 || !(course.disabled === 1 || course.disabled === true));

  if (!profile) return [];

  if (isLevel5) {
    return sortCoursesAlphabetically(allCourses);
  }

  if (profile.level === '4' || profile.permissionLevel === '4') {
    return sortCoursesAlphabetically(visibleCourses);
  }

  if (profile.level === '3' || profile.permissionLevel === '3') {
    return sortCoursesAlphabetically(visibleCourses);
  }

  try {
    const disciplines = await getDisciplinesCached();

    let activeSemester = currentSemester || memorySemester || undefined;
    if (!activeSemester) {
      try {
        const cached = await AsyncStorage.getItem('colearn_system_config_cache');
        if (cached) {
          activeSemester = JSON.parse(cached).currentSemester || '1st';
          memorySemester = activeSemester || null;
        }
      } catch {}

      if (!activeSemester) {
        try {
          const configSnap = await Promise.race([
            getDoc(doc(db, 'system', 'config')),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 2000)),
          ]);
          if ((configSnap as any).exists()) {
            activeSemester = (configSnap as any).data().currentSemester || '1st';
            memorySemester = activeSemester || null;
            AsyncStorage.setItem('colearn_system_config_cache', JSON.stringify({ currentSemester: activeSemester })).catch(() => {});
          }
        } catch {}
      }
    } else {
      memorySemester = activeSemester;
    }

    if (!activeSemester || activeSemester === 'none') {
      activeSemester = '1st';
    }

    const userDept = (profile.department || '').toLowerCase().trim();

    const normalizeLvl = (lvl: string | number | undefined | null): string => {
      if (!lvl) return '';
      const s = String(lvl).toLowerCase().replace(/lvl|level/gi, '').trim();
      const m = s.match(/\d+/);
      return m ? m[0] : s;
    };

    const userLevelNorm = normalizeLvl(profile.academicLevel || profile.level || '100');

    const normalizeSemester = (sem: string | undefined | null): string => {
      if (!sem) return '';
      const s = String(sem).toLowerCase().trim();
      if (s.includes('1') || s.includes('first') || s.includes('harmattan')) return '1st';
      if (s.includes('2') || s.includes('second') || s.includes('rain')) return '2nd';
      return s;
    };

    const activeSemesterNorm = normalizeSemester(activeSemester);

    const filtered = visibleCourses.filter(course => {
      if (course.disabled === 1 || course.disabled === true) {
        return false;
      }

      if (course.isDownloaded) {
        return true;
      }

      const courseDisciplines = disciplines.filter(d => {
        const opt = d.courses?.[course.id];
        return opt === 'allow' || opt === 'lock';
      });

      const isDirectDeptMatch = course.department && course.department.toLowerCase().trim() === userDept;

      let hasSharedDiscipline = false;
      if (disciplines.length > 0) {
        hasSharedDiscipline = courseDisciplines.some(d =>
          (d.departments || []).some((dept: string) => dept.toLowerCase().trim() === userDept)
        );
      } else {
        hasSharedDiscipline = isDirectDeptMatch;
      }

      if (!hasSharedDiscipline && !isDirectDeptMatch) {
        return false;
      }

      if (applyLevelFilter) {
        const courseLevelNorm = normalizeLvl(course.level);
        if (userLevelNorm !== courseLevelNorm) {
          return false;
        }
      }

      const courseSemesterNorm = normalizeSemester(course.semester);
      if (courseSemesterNorm !== activeSemesterNorm) {
        return false;
      }

      const userUni = (profile.At || 'futo').toLowerCase().trim();
      const courseUni = (course.At || 'futo').toLowerCase().trim();
      if (userUni !== courseUni) {
        return false;
      }

      return true;
    });

    return sortCoursesAlphabetically(filtered);
  } catch (error) {
    console.error('Error filtering courses by discipline:', error);
    return [];
  }
}
