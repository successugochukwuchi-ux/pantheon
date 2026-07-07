import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, BookOpen, ChevronRight, ArrowLeft, AlertCircle, Maximize2, HelpCircle, CheckCircle2, XCircle, Wand2 } from 'lucide-react';
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
import { VideoPlayer } from '../components/VideoPlayer';

import { getFilteredCoursesForStudent } from '../lib/courseFilter';

export default function LectureNotes() {
  const { systemConfig, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const isHoliday = !systemConfig || systemConfig.currentSemester === 'none';

  useEffect(() => {
    if (isHoliday) return;

    const q = query(
      collection(db, 'courses'),
      where('semester', '==', systemConfig.currentSemester)
    );

    getDocs(q).then(async (snapshot) => {
      const fetchedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      const filtered = await getFilteredCoursesForStudent(fetchedCourses, profile, true);
      filtered.sort((a, b) => a.code.localeCompare(b.code));
      setCourses(filtered);
    }).catch((error) => {
      console.error("Courses fetch error:", error);
    });
  }, [systemConfig, isHoliday, profile]);

  useEffect(() => {
    if (!selectedCourse || !profile) {
      setNotes([]);
      return;
    }

    const q = query(
      collection(db, 'notes'),
      where('courseId', '==', selectedCourse.id),
      where('type', '==', 'lecture')
    );

    getDocs(q).then((snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      const sorted = allNotes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
      if (isUnactivatedStudent) {
        setNotes(sorted.slice(0, 1));
      } else {
        setNotes(sorted);
      }
    }).catch((error) => {
      console.error("Notes fetch error:", error);
    });
  }, [selectedCourse, profile]);

  const filteredCourses = courses.filter(course => 
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedNote) {
    let blocks: NoteBlock[] = [];
    try {
      blocks = JSON.parse(selectedNote.content);
    } catch (e) {
      // Fallback for old markdown notes
      blocks = [{ id: '1', type: 'text', content: selectedNote.content }];
    }

    return (
      <div className="relative min-h-screen pb-20">
        <NoteProgressTracker noteId={selectedNote.id} courseId={selectedNote.courseId} />
        <ScientificCalculator />
        
        <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setSelectedNote(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Notes
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
                <Badge className="bg-primary/10 text-primary border-primary/20">{selectedNote.type.toUpperCase()}</Badge>
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
                {block.type === 'video' && block.content && (
                  <div className="w-full my-4 rounded-xl overflow-hidden shadow-lg border border-white/5">
                    <VideoPlayer 
                      url={block.content} 
                      title={selectedNote?.title || "Lecture Video"} 
                    />
                  </div>
                )}
                {(block.type === 'bullet-list' || block.type === 'numbered-list') && (
                  <div className="prose dark:prose-invert max-w-none my-6">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {block.content}
                    </ReactMarkdown>
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
                              {data.question}
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
                                      {opt.text}
                                    </ReactMarkdown>
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                                  {data.explanation}
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
    const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </Button>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{selectedCourse.code} Notes</h1>
          <p className="text-muted-foreground">{selectedCourse.title}</p>
        </div>

        {isUnactivatedStudent && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold">Free Preview Mode</p>
              <p className="text-muted-foreground text-xs mt-0.5">You are only seeing the oldest topic. Activate your account to unlock all lectures and study materials.</p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/20 shrink-0" onClick={() => window.location.href = '/activate'}>
              Unlock All
            </Button>
          </div>
        )}

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
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">No notes found</h3>
              <p className="text-muted-foreground">No lecture notes have been uploaded for this course yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Lecture Notes</h1>
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
                <CardContent>
                  <Badge variant="secondary">{course.level} Level</Badge>
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
