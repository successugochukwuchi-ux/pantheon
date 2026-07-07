import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { History, Play, CheckCircle2, XCircle, ArrowRight, ArrowLeft, RotateCcw, Lock } from 'lucide-react';
import { Course, Question, QuestionSheet } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MathJax } from 'better-react-mathjax';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { useTitle } from '../hooks/useTitle';
import { AIAssistant } from '../components/AIAssistant';
import { SafeMathRenderer, prepareMarkdownMath } from '../components/SafeMathRenderer';

import { getFilteredCoursesForStudent } from '../lib/courseFilter';

export default function PastQuestions() {
  useTitle('Past Questions');
  const { profile, systemConfig } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sheets, setSheets] = useState<QuestionSheet[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<QuestionSheet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Exam State
  const [examStarted, setExamStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile || !systemConfig) return;

    const showAllSemesters = profile.level === '4';
    const isStudent = profile.level === '1' || profile.level === '2';
    
    if (!showAllSemesters && systemConfig.currentSemester === 'none') {
      setCourses([]);
      setLoading(false);
      return;
    }

    let q = query(collection(db, 'courses'));
    
    if (!showAllSemesters) {
      q = query(collection(db, 'courses'), where('semester', '==', systemConfig.currentSemester));
    }

    getDocs(q).then(async (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      let filtered = allCourses;
      if (isStudent) {
        filtered = await getFilteredCoursesForStudent(allCourses, profile, true);
      } else {
        filtered = allCourses.filter(c => showAllSemesters || c.semester === systemConfig.currentSemester);
      }
      
      filtered.sort((a, b) => a.code.localeCompare(b.code));
      setCourses(filtered);
      setLoading(false);
    }).catch((err) => {
      console.error("Error fetching courses in PastQuestions:", err);
      setLoading(false);
    });
  }, [profile, systemConfig]);

  useEffect(() => {
    if (!selectedCourseId) {
      setSheets([]);
      return;
    }
    const q = query(
      collection(db, 'questionSheets'), 
      where('courseId', '==', selectedCourseId),
      where('isAvailable', '==', true)
    );
    getDocs(q).then((snapshot) => {
      const loadedSheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet));
      
      const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
      if (isUnactivatedStudent) {
        // Sort oldest first (ascending)
        const sortedByYearAsc = [...loadedSheets].sort((a, b) => a.year.localeCompare(b.year));
        setSheets(sortedByYearAsc.slice(0, 1));
      } else {
        loadedSheets.sort((a, b) => b.year.localeCompare(a.year));
        setSheets(loadedSheets);
      }
    }).catch((err) => {
      console.error("Error fetching question sheets in PastQuestions:", err);
    });
  }, [selectedCourseId, profile]);

  const handleStartExam = async (sheet: QuestionSheet) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'questions'), where('sheetId', '==', sheet.id));
      const snap = await getDocs(q);
      const fetched = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Question))
        .sort((a, b) => a.order - b.order);
      
      if (fetched.length === 0) {
        toast.error('No questions found for this sheet');
        setLoading(false);
        return;
      }

      setQuestions(fetched);
      setSelectedSheet(sheet);
      setExamStarted(true);
      setCurrentIndex(0);
      setUserAnswers({});
      setShowFeedback({});
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const randomizedOptions = useMemo(() => {
    if (!currentQuestion) return [];
    const options = [currentQuestion.correctAnswer, ...currentQuestion.incorrectAnswers];
    // Custom seed-based shuffle would be better, but simple math random for now
    return options.sort(() => Math.random() - 0.5);
  }, [currentQuestion?.id]);

  const handleAnswer = (answer: string) => {
    if (showFeedback[currentQuestion.id]) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    setShowFeedback(prev => ({ ...prev, [currentQuestion.id]: true }));
  };

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (loading && !examStarted) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  if (!examStarted) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Past Questions</h1>
          <p className="text-muted-foreground">Select a course to view available examination years.</p>
        </div>

        {!selectedCourseId ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.length > 0 ? courses.map(course => (
              <Card key={course.id} className="hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedCourseId(course.id)}>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <History className="h-5 w-5" />
                  </div>
                  <CardTitle>{course.code}</CardTitle>
                  <CardDescription>{course.title}</CardDescription>
                </CardHeader>
              </Card>
            )) : (
              <div className="col-span-full py-20 text-center bg-muted/30 rounded-3xl border-2 border-dashed">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-semibold">No Courses Available</h3>
                <p className="text-muted-foreground">No courses found for your level in this semester.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setSelectedCourseId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold">{courses.find(c => c.id === selectedCourseId)?.code} - Available Years</h2>
            </div>
            
            {isUnactivatedStudent && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold">Free Preview Mode</p>
                  <p className="text-muted-foreground text-xs mt-0.5">You are only seeing the oldest past question sheet. Activate your account to unlock all years and take part in CBT practice.</p>
                </div>
                <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/20 shrink-0" onClick={() => window.location.href = '/activate'}>
                  Unlock All
                </Button>
              </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sheets.length > 0 ? sheets.map(sheet => (
                <Card key={sheet.id} className="hover:shadow-md transition-all">
                  <CardHeader>
                    <CardTitle>{sheet.year}</CardTitle>
                    <CardDescription>{sheet.semester} Semester • {sheet.academicLevel}L</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button className="w-full" onClick={() => handleStartExam(sheet)}>
                      <Play className="h-4 w-4 mr-2" /> Start Year
                    </Button>
                  </CardFooter>
                </Card>
              )) : (
                <div className="col-span-full py-20 text-center bg-muted/30 rounded-3xl border-2 border-dashed">
                  <p className="text-muted-foreground">No question sheets available for this course yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{courses.find(c => c.id === selectedCourseId)?.code} ({selectedSheet?.year})</h2>
          <p className="text-sm text-muted-foreground font-medium">Question {currentIndex + 1} of {questions.length}</p>
        </div>
        <Button variant="ghost" onClick={() => setExamStarted(false)}>Exit</Button>
      </div>

      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
        <motion.div 
          className="bg-primary h-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Card className="min-h-[400px] flex flex-col border-2">
            <CardHeader>
              <div className="prose dark:prose-invert max-w-none text-xl leading-relaxed">
                <div className="py-4">
                  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                    {prepareMarkdownMath(currentQuestion.text)}
                  </ReactMarkdown>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="grid gap-3">
                {randomizedOptions.map((option, idx) => {
                  const isSelected = userAnswers[currentQuestion.id] === option;
                  const isCorrect = option === currentQuestion.correctAnswer;
                  const answered = showFeedback[currentQuestion.id];
                  
                  let variantClass = "bg-muted/50 border-transparent";
                  if (isSelected && !answered) variantClass = "border-primary bg-primary/10";
                  if (answered) {
                    if (isCorrect) variantClass = "border-green-500 bg-green-500/10";
                    else if (isSelected) variantClass = "border-red-500 bg-red-500/10";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      disabled={answered}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${variantClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="font-medium">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {prepareMarkdownMath(option)}
                          </ReactMarkdown>
                        </span>
                      </div>
                      {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      {answered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500" />}
                    </button>
                  );
                })}
              </div>

              {showFeedback[currentQuestion.id] && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-4 bg-muted/50 rounded-xl border-l-4 border-primary space-y-2"
                >
                  <p className="font-bold text-sm uppercase tracking-wider text-primary">Explanation</p>
                  <div className="text-muted-foreground prose dark:prose-invert max-w-none text-sm font-medium">
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                      {prepareMarkdownMath(currentQuestion.explanation || "No explanation provided for this question.")}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </CardContent>
            <CardFooter className="border-t p-6 flex justify-between">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setCurrentIndex(prev => Math.max(0, prev - 1));
                }}
                disabled={currentIndex === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>

              {showFeedback[currentQuestion.id] && (
                currentIndex === questions.length - 1 ? (
                  <Button onClick={() => setExamStarted(false)} variant="secondary">
                    <RotateCcw className="mr-2 h-4 w-4" /> Finish Review
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentIndex(prev => prev + 1)}>
                    Next Question <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>

      {examStarted && currentQuestion && (
        <AIAssistant 
          noteContent={`Question: ${currentQuestion.text}\nExplanation: ${currentQuestion.explanation || 'None'}\nCorrect Answer: ${currentQuestion.correctAnswer}`} 
          noteTitle={`Question ${currentIndex + 1}`}
        />
      )}
    </div>
  );
}
