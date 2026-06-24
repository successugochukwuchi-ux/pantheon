import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, BookOpen, ChevronRight, ArrowLeft, AlertCircle, History, HelpCircle, MessageSquare, Maximize2, CheckCircle2, XCircle, Wand2, Lock } from 'lucide-react';
import { Course, Note } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { MathJax } from 'better-react-mathjax';
import { NoteBlock } from '../components/NoteBuilder';
import { SafeMathRenderer, prepareMarkdownMath } from '../components/SafeMathRenderer';
import { NoteProgressTracker } from '../components/NoteProgressTracker';
import { ScientificCalculator } from '../components/ScientificCalculator';
import { AIAssistant } from '../components/AIAssistant';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { toast } from 'sonner';

import { getFilteredCoursesForStudent } from '../lib/courseFilter';

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
  const showAllSemesters = profile?.level === '4';
  const isHoliday = systemConfig && systemConfig.currentSemester === 'none' && !showAllSemesters;
  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  const typeLabels: Record<string, string> = {
    'lecture': 'Lecture Notes',
    'past_question': 'Past Questions',
    'cbt': 'CBT Materials'
  };

  useTitle(selectedNote ? selectedNote.title : (selectedCourse ? `${selectedCourse.code} ${typeLabels[type]}` : typeLabels[type]));

  const typeIcons: Record<string, any> = {
    'lecture': BookOpen,
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

    // Students/Vendors MUST wait for systemConfig to have a defined semester to avoid unfiltered query Permission Denied
    const isStudent = profile.level === '1' || profile.level === '2';
    if (!showAllSemesters && (!systemConfig || systemConfig.currentSemester === 'none')) {
      return;
    }

    let q = query(collection(db, 'courses'));
    
    // Only level 4 sees all semesters, level 3 & students see by semester
    if (!showAllSemesters) {
      if (systemConfig?.currentSemester && systemConfig.currentSemester !== 'none') {
        q = query(
          collection(db, 'courses'),
          where('semester', '==', systemConfig.currentSemester)
        );
      } else {
        // If not level 4 and no semester, don't query at all to prevent rules rejection
        setCourses([]);
        return;
      }
    }

    getDocs(q).then(async (snapshot) => {
      let loadedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      // Secondary filter by level and department ONLY for actual student accounts (level 1 or 2)
      // Level 3 vendors can see all departments/levels but restricted to current semester
      if (isStudent) {
        loadedCourses = await getFilteredCoursesForStudent(loadedCourses, profile, true);
      }
      
      loadedCourses.sort((a, b) => a.code.localeCompare(b.code));
      setCourses(loadedCourses);
    }).catch((error) => {
      console.error("Courses fetch error in StudyMaterials:", error);
    });
  }, [systemConfig, isHoliday, showAllSemesters]);

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

    getDocs(q).then((snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      // Filter by type in memory
      const filtered = allNotes
        .filter(n => n.type === type)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setNotes(filtered);
    }).catch((error) => {
      console.error("Notes fetch error in StudyMaterials:", error);
    });
  }, [selectedCourse, type, profile]);

  const filteredCourses = courses.filter(course => 
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedNote) {
    const noteIndex = notes.findIndex(n => n.id === selectedNote.id);
    if (isUnactivatedStudent && noteIndex > 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 max-w-2xl mx-auto">
          <Lock className="h-16 w-16 text-amber-500 animate-bounce" />
          <h1 className="text-3xl font-bold tracking-tight">Academic Trial Limit</h1>
          <p className="text-muted-foreground">
            Standard accounts only have access to the oldest study guide/lecture note of each course. Activate your account using an activation pin to unlock all notes, past questions, and full study materials.
          </p>
          <div className="pt-4 flex gap-4">
            <Button variant="outline" onClick={() => setSelectedNote(null)}>Back to Materials</Button>
            <Button onClick={() => navigate('/activate')}>Activate Account</Button>
          </div>
        </div>
      );
    }

    let blocks: NoteBlock[] = [];
    try {
      blocks = JSON.parse(selectedNote.content);
    } catch (e) {
      blocks = [{ id: '1', type: 'text', content: selectedNote.content }];
    }

    return (
      <div className="relative min-h-screen pb-20">
        <NoteProgressTracker noteId={selectedNote.id} courseId={selectedNote.courseId} />
        <ScientificCalculator />

        <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setSelectedNote(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to {typeLabels[type]}
          </Button>

          <Card className="border-primary/20 shadow-xl overflow-hidden">
            <div className="h-2 bg-primary/10 w-full" />
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold tracking-tight">{selectedNote.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedCourse?.code}</Badge>
                    <span className="text-muted-foreground">•</span>
                    <span>{selectedCourse?.title}</span>
                  </CardDescription>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20">{selectedNote.type.replace('_', ' ').toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-6 md:p-10">
            {blocks.map((block) => (
              <div key={block.id}>
                {block.type === 'h1' && (
                  <h1 className="text-3xl font-bold mb-4">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {prepareMarkdownMath(block.content)}
                    </ReactMarkdown>
                  </h1>
                )}
                {block.type === 'h2' && (
                  <h2 className="text-2xl font-bold mb-3">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {prepareMarkdownMath(block.content)}
                    </ReactMarkdown>
                  </h2>
                )}
                {block.type === 'text' && (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {prepareMarkdownMath(block.content)}
                    </ReactMarkdown>
                  </div>
                )}
                {block.type === 'math' && (
                  <div className="py-4 overflow-x-auto flex justify-center bg-muted/30 rounded-lg">
                    <SafeMathRenderer math={block.content} block={true} />
                  </div>
                )}
                {block.type === 'table' && block.content && (
                  <div className="overflow-x-auto my-4 border rounded-lg">
                    <table className="w-full border-collapse">
                      <tbody>
                        {(() => {
                          try {
                            const data = JSON.parse(block.content);
                            return data.map((row: string[], rowIndex: number) => (
                              <tr key={rowIndex}>
                                {row.map((cell, colIndex) => (
                                  <td key={colIndex} className="border p-4 text-sm min-w-[120px]">
                                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                      {prepareMarkdownMath(cell)}
                                    </ReactMarkdown>
                                  </td>
                                ))}
                              </tr>
                            ));
                          } catch (e) {
                            return <tr><td className="p-4 text-destructive">Invalid table data</td></tr>;
                          }
                        })()}
                      </tbody>
                    </table>
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
                {block.type === 'question' && (() => {
                  try {
                    const data = JSON.parse(block.content || '{"question":"","correct":"","incorrect":[]}');
                    return (
                      <Card className="my-6 border-primary/20 bg-primary/5 overflow-hidden ring-1 ring-primary/10">
                        <CardHeader className="bg-primary/10 pb-4">
                          <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                            <HelpCircle className="h-4 w-4" /> Concept Check
                          </div>
                          <CardTitle className="text-lg mt-2">
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                              {prepareMarkdownMath(data.question)}
                            </ReactMarkdown>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid gap-3">
                            {[
                              { text: data.correct || '', isCorrect: true },
                              ...(data.incorrect || []).map((a: string) => ({ text: a, isCorrect: false }))
                            ].sort(() => Math.random() - 0.5).map((opt, i) => (
                              <div key={i} className="group relative">
                                <div className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-muted transition-all cursor-help">
                                  <span className="flex-1 text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                      {prepareMarkdownMath(opt.text)}
                                    </ReactMarkdown>
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                    {opt.isCorrect ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-400" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {data.explanation && (
                            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
                              <div className="text-[10px] uppercase font-bold text-primary mb-1 tracking-widest flex items-center gap-2">
                                <Wand2 className="h-3 w-3" /> Explanation
                              </div>
                              <div className="text-sm text-muted-foreground italic">
                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                  {prepareMarkdownMath(data.explanation)}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  } catch (e) {
                    return <p className="text-destructive text-sm p-4">Invalid question structure</p>;
                  }
                })()}
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
        
        {selectedNote && (
          <AIAssistant noteContent={selectedNote.content} noteTitle={selectedNote.title} />
        )}
      </div>
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
            notes.map((note, idx) => {
              const isLocked = isUnactivatedStudent && idx > 0;
              return (
                <Card 
                  key={note.id} 
                  className={`transition-all relative overflow-hidden ${isLocked ? 'opacity-70 border-amber-500/10 hover:border-amber-500/30' : 'hover:bg-accent cursor-pointer'}`}
                  onClick={() => {
                    if (isLocked) {
                      toast.error("This study guide is locked. Please activate your account to gain full access.");
                      navigate('/activate');
                      return;
                    }
                    setSelectedNote(note);
                  }}
                >
                  {isLocked && (
                    <div className="absolute top-2 right-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full p-1.5 z-10 animate-pulse">
                      <Lock className="h-4 w-4" />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className={`text-lg ${isLocked ? 'text-muted-foreground pr-8' : ''}`}>{note.title}</CardTitle>
                    <CardDescription>Added on {new Date(note.createdAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 font-sans">
                      {isLocked ? (
                        <span className="italic">Unlock this study guide and get everything else by buying an activation pin.</span>
                      ) : (() => {
                        try {
                          const blocks = JSON.parse(note.content);
                          return blocks.find((b: any) => b.type === 'text')?.content.substring(0, 150) || 'Academic material';
                        } catch (e) {
                          return note.content.substring(0, 150);
                        }
                      })()}
                    </p>
                  </CardContent>
                </Card>
              );
            })
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
