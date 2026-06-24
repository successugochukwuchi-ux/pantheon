import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, Discipline, UserProfile } from '../types';

/**
 * Filter courses for students according to CCMAS curriculum discipline rules and levels.
 */
export async function getFilteredCoursesForStudent(
  allCourses: Course[],
  profile: UserProfile | null | undefined,
  applyLevelFilter = true
): Promise<Course[]> {
  const isLevel4 = profile?.level === '4';
  const visibleCourses = allCourses.filter(course => isLevel4 || !course.disabled);

  if (!profile) return visibleCourses;

  // Level 4 (admins) can see everything
  if (profile.level === '4') {
    return allCourses;
  }

  // Level 3 (vendors) can see all non-disabled courses
  if (profile.level === '3') {
    return visibleCourses;
  }

  try {
    const disciplineSnap = await getDocs(collection(db, 'disciplines'));
    const disciplines = disciplineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discipline));

    const userDept = (profile.department || '').toLowerCase().trim();
    const userLevel = (profile.academicLevel || profile.level || '100').replace('LVL', '').trim();

    // Find disciplines that contain student's department
    const studentDisciplines = disciplines.filter(d => 
      (d.departments || []).some(dept => dept.toLowerCase().trim() === userDept)
    );

    return visibleCourses.filter(course => {
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
        // Token match as in Dashboard.tsx
        const userTokens = userDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
        const courseTokens = courseDept.split(/[\s()\-]+/).filter(t => t.length > 2 && t !== 'engineering');
        if (userTokens.some(ut => courseDept.includes(ut)) || courseTokens.some(ct => userDept.includes(ct))) {
          return true;
        }
        return false;
      }

      // 3) General course:
      // "and courses that are marked as general but are allowed or locked within their discipline. there should be no indication of discipline locking for students it should be a backend affair"
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
    // Fallback: simple department filter if firestore read fails
    const userDept = (profile.department || '').toLowerCase().trim();
    return visibleCourses.filter(c => {
      const courseDept = (c.department || '').toLowerCase().trim();
      return !c.department || courseDept === 'general' || courseDept === 'college' || courseDept === userDept;
    });
  }
}
