import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

/**
 * Filter courses for students according to CCMAS curriculum discipline rules and levels (Mobile Version).
 */
export async function getFilteredCoursesForStudent(
  allCourses: any[],
  profile: any,
  applyLevelFilter = true,
  currentSemester?: string
): Promise<any[]> {
  const isLevel4 = profile?.level === '4' || profile?.permissionLevel === '4';
  const visibleCourses = allCourses.filter(course => isLevel4 || !(course.disabled === 1 || course.disabled === true));

  if (!profile) return [];

  // Level 3 (vendors) and Level 4 (admins) can see everything (Level 4 can see disabled too)
  if (profile.level === '4' || profile.permissionLevel === '4') {
    return allCourses;
  }

  if (profile.level === '3' || profile.permissionLevel === '3') {
    return visibleCourses;
  }

  try {
    let disciplines: any[] = [];
    try {
      const disciplineSnap = await Promise.race([
        getDocs(collection(db, 'disciplines')),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Network timeout")), 2000))
      ]);
      disciplines = (disciplineSnap as any).docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      // Cache for offline use
      await AsyncStorage.setItem('colearn_disciplines_cache', JSON.stringify(disciplines));
    } catch (e) {
      // Fallback to offline cache
      const cached = await AsyncStorage.getItem('colearn_disciplines_cache');
      if (cached) {
        disciplines = JSON.parse(cached);
      } else {
        console.log("No cached disciplines available, proceeding with loose fallback");
      }
    }

    // Fetch currentSemester if not passed
    let activeSemester = currentSemester;
    if (!activeSemester) {
      try {
        const configSnap = await Promise.race([
          getDoc(doc(db, 'system', 'config')),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Network timeout")), 2000))
        ]);
        if ((configSnap as any).exists()) {
          activeSemester = (configSnap as any).data().currentSemester || '1st';
          await AsyncStorage.setItem('colearn_system_config_cache', JSON.stringify({ currentSemester: activeSemester }));
        }
      } catch (err) {
        const cached = await AsyncStorage.getItem('colearn_system_config_cache');
        if (cached) {
          activeSemester = JSON.parse(cached).currentSemester || '1st';
        }
      }
    }
    if (!activeSemester || activeSemester === 'none') {
      activeSemester = '1st';
    }

    const userDept = (profile.department || '').toLowerCase().trim();

    // Normalization helper for level comparison
    const normalizeLvl = (lvl: string | number | undefined | null): string => {
      if (!lvl) return '';
      const s = String(lvl).toLowerCase().replace(/lvl|level/gi, '').trim();
      const m = s.match(/\d+/);
      return m ? m[0] : s;
    };

    const userLevelNorm = normalizeLvl(profile.academicLevel || profile.level || '100');

    // Normalization helper for semester comparison
    const normalizeSemester = (sem: string | undefined | null): string => {
      if (!sem) return '';
      const s = String(sem).toLowerCase().trim();
      if (s.includes('1') || s.includes('first') || s.includes('harmattan')) return '1st';
      if (s.includes('2') || s.includes('second') || s.includes('rain')) return '2nd';
      return s;
    };

    const activeSemesterNorm = normalizeSemester(activeSemester);

    return visibleCourses.filter(course => {
      // A. The course must be visible i.e the field "disabled" must be false
      if (course.disabled === 1 || course.disabled === true) {
        return false;
      }

      // If a course is already downloaded locally, we inherently trust that it is accessible 
      // to this user because it was already filtered online when they grabbed it.
      if (course.isDownloaded) {
        return true;
      }

      // B. The course is assigned to one or more disciplines.
      const courseDisciplines = disciplines.filter(d => {
        const opt = d.courses?.[course.id];
        return opt === 'allow' || opt === 'lock';
      });

      // C. The user's department is a part of the same discipline as the course, or matches the course department directly
      const isDirectDeptMatch = course.department && course.department.toLowerCase().trim() === userDept;
      
      let hasSharedDiscipline = false;
      if (disciplines.length > 0) {
        hasSharedDiscipline = courseDisciplines.some(d =>
          (d.departments || []).some((dept: string) => dept.toLowerCase().trim() === userDept)
        );
      } else {
        // Fallback when offline/cache-empty: allow direct department match
        hasSharedDiscipline = isDirectDeptMatch;
      }

      if (!hasSharedDiscipline && !isDirectDeptMatch) {
        return false;
      }

      // D. The user is of the same level as the course i.e user's academiclevel matches the course's level
      const courseLevelNorm = normalizeLvl(course.level);
      if (userLevelNorm !== courseLevelNorm) {
        return false;
      }

      // E. The currentSemester matches the course's semester.
      const courseSemesterNorm = normalizeSemester(course.semester);
      if (courseSemesterNorm !== activeSemesterNorm) {
        return false;
      }

      // F. The course must belong to the user's university (At)
      const userUni = (profile.At || 'futo').toLowerCase().trim();
      const courseUni = (course.At || 'futo').toLowerCase().trim();
      if (userUni !== courseUni) {
        return false;
      }

      return true;
    });

  } catch (error) {
    console.error("Error filtering courses by discipline:", error);
    return [];
  }
}
