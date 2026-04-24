import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PlayCircle, BookOpen, GraduationCap, ChevronRight, CheckCircle2, Calculator } from 'lucide-react';
import { Note, Course, VideoQuestion } from '../types';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { ScientificCalculator } from '../components/ScientificCalculator';

export default function VideoLibrary() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'courses');
    });
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    if (!selectedCourseId || !profile) {
      setNotes([]);
      return;
    }
    const q = query(collection(db, 'notes'), where('courseId', '==', selectedCourseId));
    const unsub = onSnapshot(q, (snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      // Filter notes that have a videoUrl
      setNotes(allNotes.filter(n => n.videoUrl));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notes');
    });
    return () => unsub();
  }, [selectedCourseId, profile]);

  useEffect(() => {
    if (!selectedNote || !profile) {
      setQuestions([]);
      return;
    }
    const q = query(collection(db, `notes/${selectedNote.id}/videoQuestions`));
    const unsub = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoQuestion)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `notes/${selectedNote.id}/videoQuestions`);
    });
    return () => unsub();
  }, [selectedNote, profile]);

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    setUserAnswers({});
    setShowResults(false);
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-2 mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight">Video Library</h1>
        <p className="text-muted-foreground">Interactive video lessons and quizzes for your courses.</p>
      </div>

      <ScientificCalculator />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm bg-muted/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Select Course
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-full bg-background border-none shadow-sm">
                  <SelectValue placeholder="Browse Courses" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedCourseId && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-2">Video Lessons</h3>
              <div className="grid gap-2">
                {notes.length > 0 ? (
                  notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => handleNoteSelect(note)}
                      className={`group flex items-center gap-3 p-4 rounded-xl text-left transition-all ${
                        selectedNote?.id === note.id 
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-2 ring-primary ring-offset-2' 
                          : 'bg-background hover:bg-muted border border-border shadow-sm'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        selectedNote?.id === note.id ? 'bg-primary-foreground/20' : 'bg-muted group-hover:bg-background'
                      }`}>
                        <PlayCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${selectedNote?.id === note.id ? '' : 'text-foreground'}`}>
                          {note.title}
                        </p>
                        <p className={`text-xs truncate ${selectedNote?.id === note.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {note.type.toUpperCase()}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
                        selectedNote?.id === note.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'
                      }`} />
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center bg-background rounded-xl border border-dashed border-border">
                    <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No video lessons available for this course yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Video & Quiz Area */}
        <div className="lg:col-span-8 space-y-6">
          {selectedNote ? (
            <>
              <Card className="overflow-hidden border-none shadow-xl bg-background ring-1 ring-border">
                <div className="aspect-video bg-black relative">
                  {selectedNote.videoUrl ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${getYouTubeId(selectedNote.videoUrl)}`}
                      title={selectedNote.title}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-4">
                      <PlayCircle className="h-16 w-16 opacity-20" />
                      <p>Video not available</p>
                    </div>
                  )}
                </div>
                <CardHeader className="bg-muted/30">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-2xl font-bold">{selectedNote.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="rounded-full">
                          {courses.find(c => c.id === selectedNote.courseId)?.code}
                        </Badge>
                        <span className="text-xs">•</span>
                        <span>{selectedNote.type.toUpperCase()}</span>
                      </CardDescription>
                    </div>
                    {questions.length > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 border-none px-4 py-1.5 rounded-full">
                        {questions.length} Video Questions
                      </Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {questions.length > 0 && (
                <div className="space-y-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h2 className="text-xl font-bold">Concept Check Video Quiz</h2>
                  </div>
                  
                  <div className="grid gap-6">
                    {questions.map((q, idx) => {
                      const options = [...q.incorrectAnswers, q.correctAnswer].sort();
                      return (
                        <Card key={q.id} className="border-none shadow-sm ring-1 ring-border overflow-hidden">
                          <CardHeader className="bg-muted/20 pb-4">
                            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">Question {idx + 1}</span>
                            <CardTitle className="text-lg leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {q.text}
                              </ReactMarkdown>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-6">
                            <div className="grid gap-3">
                              {options.map((opt, i) => {
                                const isSelected = userAnswers[q.id] === opt;
                                const isCorrect = opt === q.correctAnswer;
                                
                                let buttonClass = "w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ";
                                
                                if (showResults) {
                                  if (isCorrect) buttonClass += "bg-green-500/10 border-green-500 text-green-700 font-medium ";
                                  else if (isSelected) buttonClass += "bg-red-500/10 border-red-500 text-red-700 ";
                                  else buttonClass += "opacity-50 border-transparent ";
                                } else {
                                  if (isSelected) buttonClass += "bg-primary/5 border-primary text-primary font-medium ring-1 ring-primary ";
                                  else buttonClass += "hover:bg-muted border-border ";
                                }

                                return (
                                  <button
                                    key={i}
                                    disabled={showResults}
                                    onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                    className={buttonClass}
                                  >
                                    <span className="flex-1">
                                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                        {opt}
                                      </ReactMarkdown>
                                    </span>
                                    {showResults && isCorrect && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {!showResults ? (
                    <Button 
                      className="w-full h-14 text-lg rounded-2xl shadow-lg shadow-primary/20"
                      size="lg"
                      onClick={() => {
                        if (Object.keys(userAnswers).length < questions.length) {
                          toast.error("Please answer all questions before submitting.");
                          return;
                        }
                        setShowResults(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Submit Video Quiz Answers
                    </Button>
                  ) : (
                    <Card className="bg-primary text-primary-foreground border-none rounded-2xl shadow-xl overflow-hidden p-8 text-center flex flex-col items-center gap-4">
                      <div className="h-20 w-20 rounded-full bg-primary-foreground/20 flex items-center justify-center text-3xl font-bold">
                        {Math.round((calculateScore() / questions.length) * 100)}%
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Quiz Performance</h3>
                        <p className="opacity-80">You got {calculateScore()} out of {questions.length} questions correct!</p>
                      </div>
                      <Button 
                        variant="secondary" 
                        className="rounded-xl px-8"
                        onClick={() => {
                          setShowResults(false);
                          setUserAnswers({});
                        }}
                      >
                        Try Again
                      </Button>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-12 bg-muted/20 border-2 border-dashed border-border rounded-3xl">
              <div className="bg-background p-6 rounded-full shadow-lg mb-6 ring-1 ring-border">
                <PlayCircle className="h-16 w-16 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to start?</h2>
              <p className="text-muted-foreground max-w-sm mb-8">Select a course and lesson from the sidebar to begin your interactive video session.</p>
              <div className="flex gap-4">
                <Badge variant="outline" className="px-4 py-1">Video Lessons</Badge>
                <Badge variant="outline" className="px-4 py-1">Concept Quizzes</Badge>
                <Badge variant="outline" className="px-4 py-1">Score Tracking</Badge>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
