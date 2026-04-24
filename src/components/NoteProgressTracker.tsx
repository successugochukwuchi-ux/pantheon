import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface NoteProgressTrackerProps {
  noteId: string;
  courseId: string;
}

export const NoteProgressTracker: React.FC<NoteProgressTrackerProps> = ({ noteId, courseId }) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [lastSavedProgress, setLastSavedProgress] = useState(0);
  const hasCompleted = useRef(false);

  useEffect(() => {
    if (!user || !noteId) return;

    // Load initial progress
    const loadProgress = async () => {
      const progDoc = await getDoc(doc(db, 'progress', `${user.uid}_${noteId}`));
      if (progDoc.exists()) {
        const data = progDoc.data();
        setProgress(data.percentage || 0);
        setLastSavedProgress(data.percentage || 0);
        if (data.completed) hasCompleted.current = true;
      }
    };
    loadProgress();

    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = Math.round((winScroll / height) * 100);
      
      if (scrolled > progress) {
        setProgress(scrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user, noteId]);

  useEffect(() => {
    if (!user || !noteId || !courseId) return;

    const saveProgress = async () => {
      // Only save if progress has increased significantly or reached 100
      if (progress > lastSavedProgress + 5 || (progress === 100 && !hasCompleted.current)) {
        const isCompleted = progress >= 95; // Consider 95% as completed for UX
        const finalProgress = isCompleted ? 100 : progress;

        await setDoc(doc(db, 'progress', `${user.uid}_${noteId}`), {
          uid: user.uid,
          targetId: noteId,
          type: 'note',
          percentage: finalProgress,
          completed: isCompleted,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setLastSavedProgress(finalProgress);

        if (isCompleted && !hasCompleted.current) {
          hasCompleted.current = true;
          toast.success('Note completed! Course progress updated.');
          updateCourseProgress();
        }
      }
    };

    const updateCourseProgress = async () => {
      // 1. Get all notes for this course
      const notesSnap = await getDocs(query(collection(db, 'notes'), where('courseId', '==', courseId)));
      const totalNotes = notesSnap.size;
      if (totalNotes === 0) return;

      // 2. Get completed notes for this user in this course
      const progressSnap = await getDocs(query(
        collection(db, 'progress'), 
        where('uid', '==', user.uid),
        where('type', '==', 'note'),
        where('completed', '==', true)
      ));
      
      // Filter manually because we don't have a direct relational mapping in Firestore at this depth without complex indexing
      // We check if the noteId in progress corresponds to one of the course notes
      const courseNoteIds = notesSnap.docs.map(d => d.id);
      const completedCount = progressSnap.docs.filter(d => courseNoteIds.includes(d.data().targetId)).length;

      const coursePercentage = Math.round((completedCount / totalNotes) * 100);

      await setDoc(doc(db, 'progress', `${user.uid}_${courseId}`), {
        uid: user.uid,
        targetId: courseId,
        type: 'course',
        percentage: coursePercentage,
        completed: coursePercentage === 100,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    };

    const timer = setTimeout(saveProgress, 2000); // Debounce saves
    return () => clearTimeout(timer);
  }, [progress, user, noteId, courseId]);

  return (
    <div className="fixed top-0 left-0 w-full z-[100] h-1.5 bg-muted">
       <Progress value={progress} className="h-full rounded-none bg-transparent" />
    </div>
  );
};
