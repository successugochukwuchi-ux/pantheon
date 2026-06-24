import { collection, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

/**
 * Filter courses for students according to CCMAS curriculum discipline rules and levels (Mobile Version).
 */
export async function getFilteredCoursesForStudent(
  allCourses: any[],
  profile: any,
  applyLevelFilter = true
): Promise<any[]> {
  if (!profile) return allCourses;

  // Level 3 (vendors) and Level 4 (admins) can see everything
  if (profile.level === '3' || profile.level === '4' || profile.permissionLevel === '3' || profile.permissionLevel === '4') {
    return allCourses;
  }

  try {
    let disciplines: any[] = [];
    try {
      const disciplineSnap = await getDocs(collection(db, 'disciplines'));
      disciplines = disciplineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Cache for offline use
      await AsyncStorage.setItem('colearn_disciplines_cache', JSON.stringify(disciplines));
    } catch (e) {
      // Fallback to offline cache
      const cached = await AsyncStorage.getItem('colearn_disciplines_cache');
      if (cached) {
        disciplines = JSON.parse(cached);
      } else {
        throw e; // Fallback to simple filtering if no cache exists
      }
    }

    const userDept = (profile.department || '').toLowerCase().trim();
    const userLevel = (profile.academicLevel || profile.level || '100').replace('LVL', '').trim();

    // Find disciplines that contain student's department
    const studentDisciplines = disciplines.filter(d => 
      (d.departments || []).some((dept: string) => dept.toLowerCase().trim() === userDept)
    );

    return allCourses.filter(course => {
      // 1) Level filter (optional, default true)
      if (applyLevelFilter) {
        const courseLevel = (course.level || '').replace('LVL', '').trim();
        const levelMatch = courseLevel === userLevel || 
                          (userLevel === '100' && courseLevel === '1') ||
                          (userLevel === '1' && courseLevel === '100');
        if (!levelMatch) return false;
      }

      const courseDept = (course.department || '').toLowerCase().trim();
      const isGeneral = !course.department || courseDept === 'general' || courseDept === 'college';

      // 2) Departmental course: student can see it if it matches their department
      if (!isGeneral) {
        if (courseDept === userDept) return true;
        // Token match
        const userTokens = userDept.split(/[\s()\-]+/).filter((t: string) => t.length > 2 && t !== 'engineering');
        const courseTokens = courseDept.split(/[\s()\-]+/).filter((t: string) => t.length > 2 && t !== 'engineering');
        if (userTokens.some((ut: string) => courseDept.includes(ut)) || courseTokens.some((ct: string) => userDept.includes(ct))) {
          return true;
        }
        return false;
      }

      // 3) General course:
      if (studentDisciplines.length > 0) {
        // Must be explicitly enabled (allow or lock) in at least one of their assigned disciplines
        return studentDisciplines.some(d => {
          const opt = d.courses?.[course.id];
          return opt === 'allow' || opt === 'lock';
        });
      } else {
        // If student department is not yet mapped to any discipline:
        // Show this general course unless it is locked by some other discipline.
        const isLockedElsewhere = disciplines.some(d => d.courses?.[course.id] === 'lock');
        return !isLockedElsewhere;
      }
    });

  } catch (error) {
    console.error("Error filtering courses by discipline:", error);
    // Fallback: simple department filter if firestore read/cache fails
    const userDept = (profile.department || '').toLowerCase().trim();
    return allCourses.filter(c => {
      const courseDept = (c.department || '').toLowerCase().trim();
      return !c.department || courseDept === 'general' || courseDept === 'college' || courseDept === userDept;
    });
  }
}
