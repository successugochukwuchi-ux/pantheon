import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, Discipline, UserProfile } from '../types';

/**
 * Filter courses for students according to CCMAS curriculum discipline rules and levels.
 */
export async function getFilteredCoursesForStudent(
  allCourses: Course[],
  profile: UserProfile | null | undefined,
  applyLevelFilter = true,
  currentSemester?: string
): Promise<Course[]> {
  const isLevel4 = profile?.level === '4' || profile?.level === '5';
  const visibleCourses = allCourses.filter(course => isLevel4 || !course.disabled);

  if (!profile) return [];

  // Level 4 (admins) and Level 5 can see everything
  if (profile.level === '4' || profile.level === '5') {
    return allCourses;
  }

  // Level 3 (vendors) can see all non-disabled courses
  if (profile.level === '3') {
    return visibleCourses;
  }

  try {
    const disciplineSnap = await getDocs(collection(db, 'disciplines'));
    const disciplines = disciplineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discipline));

    // Fetch currentSemester if not passed
    let activeSemester = currentSemester;
    if (!activeSemester) {
      try {
        const configSnap = await getDoc(doc(db, 'system', 'config'));
        if (configSnap.exists()) {
          activeSemester = configSnap.data().currentSemester || '1st';
        }
      } catch (err) {
        console.error("Error fetching system config in courseFilter:", err);
      }
    }
    if (!activeSemester) {
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
      if (course.disabled) {
        return false;
      }

      // B. The course is assigned to one or more disciplines.
      const courseDisciplines = disciplines.filter(d => {
        const opt = d.courses?.[course.id];
        return opt === 'allow' || opt === 'lock';
      });

      if (courseDisciplines.length === 0) {
        return false;
      }

      // C. The user's department is a part of the same discipline as the course
      const hasSharedDiscipline = courseDisciplines.some(d =>
        (d.departments || []).some(dept => dept.toLowerCase().trim() === userDept)
      );

      if (!hasSharedDiscipline) {
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
      if (course.At && profile.At && course.At.toLowerCase() !== profile.At.toLowerCase()) {
        return false;
      }

      return true;
    });

  } catch (error) {
    console.error("Error filtering courses by discipline:", error);
    return [];
  }
}
