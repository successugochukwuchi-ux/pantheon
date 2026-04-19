import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, BookOpen, ChevronRight, ArrowLeft, AlertCircle, History, Calculator, HelpCircle, MessageSquare, Maximize2 } from 'lucide-react';
import { Course, Note } from '../types';
import ReactMarkdown from 'react-markdown';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { MathJax } from 'better-react-mathjax';
import { NoteBlock } from '../components/NoteBuilder';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';

export default function StudyMaterials() {
  const { user, profile, systemConfig } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'lecture';
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const isAdmin = profile?.level === '3' || profile?.level === '4';
  const isHoliday = systemConfig && systemConfig.currentSemester === 'none' && !isAdmin;

  const typeLabels: Record<string, string> = {
    'lecture': 'Lecture Notes',
    'punch': 'Punch Notes',
    'past_question': 'Past Questions',
    'cbt': 'CBT Materials'
  };

  useTitle(selectedNote ? selectedNote.title : (selectedCourse ? `${selectedCourse.code} ${typeLabels[type]}` : typeLabels[type]));

  const typeIcons: Record<string, any> = {
    'lecture': BookOpen,
    'punch': Calculator,
    'past_question': History,
    'cbt': HelpCircle
  };

  const Icon = typeIcons[type] || BookOpen;

  useEffect(() => {
    const noteId = searchParams.get('id');
    if (!noteId || courses.length === 0) return;

    const loadNote = async () => {
      try {
        const noteDoc = await getDoc(doc(db, 'notes', noteId));
        if (noteDoc.exists()) {
          const noteData = { id: noteDoc.id, ...noteDoc.data() } as Note;
          const course = courses.find(c => c.id === noteData.courseId);
          if (course) {
            setSelectedCourse(course);
            setSelectedNote(noteData);
            // If the note type is different from current view, update it
            if (noteData.type !== type) {
              setSearchParams({ type: noteData.type, id: noteId });
            }
          }
        }
      } catch (error) {
        console.error("Error loading referenced note:", error);
      }
    };

    loadNote();
  }, [searchParams, courses, type, setSearchParams]);

  useEffect(() => {
    if (isHoliday) return;
    if (!profile) return;

    // Students MUST wait for systemConfig to have a defined semester to avoid unfiltered query Permission Denied
    const isStudent = profile.level === '1' || profile.level === '2';
    if (isStudent && (!systemConfig || systemConfig.currentSemester === 'none')) {
      return;
    }

    let q = query(collection(db, 'courses'));
    
    // Admin sees all, but students see by semester
    if (!isAdmin) {
      if (systemConfig?.currentSemester && systemConfig.currentSemester !== 'none') {
        q = query(
          collection(db, 'courses'),
          where('semester', '==', systemConfig.currentSemester)
        );
      } else {
        // If not admin and no semester, don't query at all to prevent rules rejection
        setCourses([]);
        return;
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let loadedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      // Secondary filter by level and department for non-admins
      if (!isAdmin) {
        loadedCourses = loadedCourses.filter(course => {
          const userAcademicLevel = profile.academicLevel || profile.level; // Fallback for old accounts
          const isCorrectLevel = String(course.level) === String(userAcademicLevel);
          const isCorrectDepartment = !course.department || course.department === 'general' || course.department === profile.department;
          return isCorrectLevel && isCorrectDepartment;
        });
      }
      
      setCourses(loadedCourses);
    }, (error) => {
      console.error("Courses fetch error in StudyMaterials:", error);
    });

    return () => unsubscribe();
  }, [systemConfig, isHoliday, isAdmin]);

  useEffect(() => {
    if (!selectedCourse) {
      setNotes([]);
      return;
    }

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'notes'),
      where('courseId', '==', selectedCourse.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      // Filter by type in memory
      const filtered = allNotes
        .filter(n => n.type === type)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(filtered);
    });

    return () => unsubscribe();
  }, [selectedCourse, type]);

  const filteredCourses = courses.filter(course => 
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedNote) {
    let blocks: NoteBlock[] = [];
    try {
      blocks = JSON.parse(selectedNote.content);
    } catch (e) {
      blocks = [{ id: '1', type: 'text', content: selectedNote.content }];
    }

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedNote(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to {typeLabels[type]}
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{selectedNote.title}</CardTitle>
                <CardDescription>{selectedCourse?.code} - {selectedCourse?.title}</CardDescription>
              </div>
              <Badge variant="outline">{selectedNote.type.replace('_', ' ').toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {blocks.map((block) => (
              <div key={block.id}>
                {block.type === 'h1' && <h1 className="text-3xl font-bold mb-4">{block.content}</h1>}
                {block.type === 'h2' && <h2 className="text-2xl font-bold mb-3">{block.content}</h2>}
                {block.type === 'text' && (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{block.content}</ReactMarkdown>
                  </div>
                )}
                {block.type === 'math' && (
                  <div className="py-4 overflow-x-auto flex justify-center bg-muted/30 rounded-lg">
                    <MathJax>{`$$${block.content}$$`}</MathJax>
                  </div>
                )}
                {block.type === 'diagram' && block.content && (
                  <div className="flex justify-center py-4">
                    <div className="relative group cursor-zoom-in" onClick={() => setViewingImage(block.content)}>
                      <img 
                        src={block.content} 
                        alt="Diagram" 
                        className="max-w-full h-auto rounded-lg shadow-md transition-all group-hover:ring-4 group-hover:ring-primary/20"
                        referrerPolicy="no-referrer"
                        style={{
                          width: block.settings?.width || 'auto',
                          height: block.settings?.height || 'auto',
                          transform: `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`,
                        }}
                      />
                      <div className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
          <DialogContent className="max-w-[95vw] w-fit p-1 bg-transparent border-none shadow-none">
            <DialogHeader className="sr-only">
              <DialogTitle>View Image</DialogTitle>
            </DialogHeader>
            <div className="relative flex items-center justify-center min-h-[50vh]">
              {viewingImage && (
                <img 
                  src={viewingImage} 
                  alt="Enlarged diagram" 
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-background"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Courses
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/discussions/${selectedCourse.id}`)}>
            <MessageSquare className="h-4 w-4" /> Discussion Board
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{selectedCourse.code} {typeLabels[type]}</h1>
          <p className="text-muted-foreground">{selectedCourse.title}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.length > 0 ? (
            notes.map(note => (
              <Card 
                key={note.id} 
                className="hover:bg-accent transition-colors cursor-pointer"
                onClick={() => setSelectedNote(note)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{note.title}</CardTitle>
                  <CardDescription>Added on {new Date(note.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {(() => {
                      try {
                        const blocks = JSON.parse(note.content);
                        return blocks.find((b: any) => b.type === 'text')?.content.substring(0, 150) || 'Academic material';
                      } catch (e) {
                        return note.content.substring(0, 150);
                      }
                    })()}...
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border rounded-lg bg-muted/50">
              <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">No {typeLabels[type].toLowerCase()} found</h3>
              <p className="text-muted-foreground">No materials of this type have been uploaded for this course yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{typeLabels[type]}</h1>
        <p className="text-muted-foreground">Browse study materials for your current semester courses.</p>
      </div>

      {isHoliday && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Semester Ended</AlertTitle>
          <AlertDescription>
            The academic semester has ended. Access to course materials is restricted until the next semester starts.
          </AlertDescription>
        </Alert>
      )}

      {!isHoliday && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search courses by code or title..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map(course => (
              <Card 
                key={course.id} 
                className="hover:bg-accent transition-colors cursor-pointer group"
                onClick={() => setSelectedCourse(course)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold">{course.code}</CardTitle>
                    <CardDescription>{course.title}</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <Badge variant="secondary">{course.level} Level</Badge>
                  <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/discussions/${course.id}`);
                  }}>
                    <MessageSquare className="h-3 w-3" /> Discuss
                  </Button>
                </CardContent>
              </Card>
            ))}

            {filteredCourses.length === 0 && (
              <div className="col-span-full py-12 text-center border rounded-lg bg-muted/50">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium">No courses found</h3>
                <p className="text-muted-foreground">Try searching for a different course code or title.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
