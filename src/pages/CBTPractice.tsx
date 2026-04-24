import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Timer, HelpCircle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, RotateCcw, Play, X } from 'lucide-react';
import { Course, Question, CBTSession, QuestionSheet } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MathJax } from 'better-react-mathjax';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { useTitle } from '../hooks/useTitle';
import { ScientificCalculator } from '../components/ScientificCalculator';

export default function CBTPractice() {
  useTitle('CBT Practice');
  const { user, profile, systemConfig } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sheets, setSheets] = useState<QuestionSheet[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Setup State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([]);
  const [isTimed, setIsTimed] = useState(false);
  const [duration, setDuration] = useState(30);
  const [numQuestions, setNumQuestions] = useState(20);
  const [testStarted, setTestStarted] = useState(false);

  // Test State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [testCompleted, setTestCompleted] = useState(false);

  useEffect(() => {
    if (!profile || !systemConfig) return;

    const isAdmin = profile.level === '3' || profile.level === '4';
    
    if (!isAdmin && systemConfig.currentSemester === 'none') {
      setCourses([]);
      setLoading(false);
      return;
    }

    let q = query(collection(db, 'courses'));
    
    if (!isAdmin) {
      q = query(collection(db, 'courses'), where('semester', '==', systemConfig.currentSemester));
    }

    const unsubCourses = onSnapshot(q, (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      // Only show courses for student's level and current semester
      const filtered = allCourses.filter(c => 
        (isAdmin || c.semester === systemConfig.currentSemester) && 
        (isAdmin || c.level === profile.academicLevel)
      );
      setCourses(filtered);
      setLoading(false);
    }, (error) => {
      console.error("Courses fetch error:", error);
      setLoading(false);
    });

    return () => unsubCourses();
  }, [profile, systemConfig]);

  useEffect(() => {
    if (!selectedCourseId || !profile) {
      setSheets([]);
      setSelectedSheetIds([]);
      return;
    }
    const q = query(
      collection(db, 'questionSheets'), 
      where('courseId', '==', selectedCourseId),
      where('isAvailable', '==', true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setSheets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet)));
    }, (error) => {
      console.error("Sheets fetch error:", error);
    });
    return () => unsub();
  }, [selectedCourseId, profile]);

  const handleStartTest = async () => {
    if (!selectedCourseId) {
      toast.error('Please select a course');
      return;
    }

    setLoading(true);
    try {
      let pool: Question[] = [];
      
      // If no years selected, pull from ALL available years for this course
      const targetSheetIds = selectedSheetIds.length > 0 
        ? selectedSheetIds 
        : sheets.map(s => s.id);

      if (targetSheetIds.length === 0) {
        toast.error('No question sheets available for this course');
        setLoading(false);
        return;
      }

      // Divide questions evenly among selected years
      const questionsPerYear = Math.ceil(numQuestions / targetSheetIds.length);
      
      const allSheetQuestions = await Promise.all(
        targetSheetIds.map(async (sheetId) => {
          const q = query(collection(db, 'questions'), where('sheetId', '==', sheetId));
          const snap = await getDocs(q);
          const qs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          // Shuffle and pick
          return qs.sort(() => Math.random() - 0.5).slice(0, questionsPerYear);
        })
      );

      pool = allSheetQuestions.flat().sort(() => Math.random() - 0.5).slice(0, numQuestions);

      if (pool.length === 0) {
        toast.error('No questions available');
        setLoading(false);
        return;
      }

      setQuestions(pool);
      setTestStarted(true);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setTestCompleted(false);
      if (isTimed) setTimeLeft(duration * 60);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Timer logic
  useEffect(() => {
    if (testStarted && isTimed && timeLeft > 0 && !testCompleted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [testStarted, isTimed, timeLeft, testCompleted]);

  // Randomize options for each question
  const randomizedQuestionsList = useMemo(() => {
    return questions.map(q => {
      const allOptions = [q.correctAnswer, ...q.incorrectAnswers];
      return { ...q, options: allOptions.sort(() => Math.random() - 0.5) };
    });
  }, [questions, testStarted]);

  const handleAnswer = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFinishTest = async () => {
    setTestCompleted(true);
    let score = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) score++;
    });

    if (user) {
      try {
        await addDoc(collection(db, 'cbt_sessions'), {
          userId: user.uid,
          courseId: selectedCourseId,
          score,
          totalQuestions: questions.length,
          timeSpent: isTimed ? (duration * 60 - timeLeft) : 0,
          isTimed,
          duration: isTimed ? duration : 0,
          completedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !testStarted) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>;
  }

  if (!testStarted) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">CBT Practice</h1>
          <p className="text-muted-foreground">Master your courses with exam-standard simulation.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configure Simulation</CardTitle>
            <CardDescription>Select your preferences for this session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourseId && (
              <div className="space-y-3">
                <Label>Select Years (Optional - division will be even)</Label>
                <div className="flex flex-wrap gap-2">
                  {sheets.map(sheet => {
                    const isSelected = selectedSheetIds.includes(sheet.id);
                    return (
                      <Badge 
                        key={sheet.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5"
                        onClick={() => {
                          if (isSelected) setSelectedSheetIds(prev => prev.filter(id => id !== sheet.id));
                          else setSelectedSheetIds(prev => [...prev, sheet.id]);
                        }}
                      >
                        {sheet.year}
                        {isSelected && <X className="ml-2 h-3 w-3" />}
                      </Badge>
                    );
                  })}
                  {sheets.length === 0 && <p className="text-xs text-muted-foreground italic">No years available for this course</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of Questions</Label>
                <Input type="number" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value) || 1)} min="1" max="100" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label>Timed Mode</Label>
                  <Button variant="ghost" size="sm" onClick={() => setIsTimed(!isTimed)} className="h-6 px-2 text-[10px] uppercase">
                    {isTimed ? "On" : "Off"}
                  </Button>
                </div>
                {isTimed ? (
                  <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 1)} placeholder="Minutes" />
                ) : (
                  <Input disabled value="Unlimited" className="bg-muted" />
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 text-lg" onClick={handleStartTest} disabled={!selectedCourseId || (selectedSheetIds.length === 0 && sheets.length === 0)}>
              <Play className="mr-2 h-5 w-5" /> Start Simulation
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (testCompleted) {
    const score = questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0), 0);
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Simulation Results</CardTitle>
            <CardDescription>{percentage >= 50 ? 'Great job!' : 'Keep practicing!'} You scored {score} out of {questions.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex justify-center">
              <div className="relative h-48 w-48 flex items-center justify-center rounded-full border-8 border-primary/10 bg-primary/5">
                <div className="text-center">
                  <p className="text-5xl font-bold text-primary">{percentage}%</p>
                  <p className="text-sm text-muted-foreground font-medium">{score} / {questions.length}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <HelpCircle className="h-5 w-5" /> Detailed Review
              </h3>
              {randomizedQuestionsList.map((q, i) => (
                <Card key={q.id} className={userAnswers[q.id] === q.correctAnswer ? "border-green-500/20 shadow-sm" : "border-red-500/20 shadow-sm"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="prose dark:prose-invert font-medium">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {`${i + 1}. ${q.text}`}
                        </ReactMarkdown>
                      </div>
                      {userAnswers[q.id] === q.correctAnswer ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-500 shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="grid gap-2 text-sm">
                      <div className={`p-3 rounded-lg flex items-center gap-3 ${userAnswers[q.id] === q.correctAnswer ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                        <div className="font-bold">Your Choice:</div>
                        <div>{userAnswers[q.id] || 'Not answered'}</div>
                      </div>
                      {userAnswers[q.id] !== q.correctAnswer && (
                        <div className="p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 flex items-center gap-3">
                          <div className="font-bold">Correct:</div>
                          <div>{q.correctAnswer}</div>
                        </div>
                      )}
                    </div>
                    {q.explanation && (
                      <div className="mt-2 p-4 bg-muted/30 rounded-lg text-sm italic border-l-2 border-primary/30">
                        <p><span className="font-bold not-italic">Explanation:</span> {q.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          <Footer className="flex gap-4 p-8 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setTestStarted(false)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Simulation
            </Button>
            <Button className="flex-1" onClick={handleStartTest}>Retry</Button>
          </Footer>
        </Card>
      </div>
    );
  }

  const currentQuestion = randomizedQuestionsList[currentQuestionIndex];
  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      <ScientificCalculator />
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{courses.find(c => c.id === selectedCourseId)?.code} Simulation</h2>
          <p className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
        </div>
        {isTimed && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-mono font-bold ${timeLeft < 60 ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-muted'}`}>
            <Timer className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
        <motion.div 
          className="bg-primary h-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.15 }}
        >
          <Card className="min-h-[450px] flex flex-col shadow-lg border-2">
            <CardHeader className="pb-8">
              <div className="prose dark:prose-invert max-w-none text-2xl leading-relaxed">
                <div className="py-4">
                  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                    {currentQuestion.text}
                  </ReactMarkdown>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {(currentQuestion as any).options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left group ${
                    userAnswers[currentQuestion.id] === option 
                      ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/20' 
                      : 'border-muted hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  <span className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl font-bold text-lg transition-colors ${
                    userAnswers[currentQuestion.id] === option 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                  }`}>
                    {optionLabels[idx]}
                  </span>
                  <span className="font-semibold text-lg">{option}</span>
                </button>
              ))}
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6 bg-muted/5">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              
              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={handleFinishTest} className="bg-primary hover:bg-primary/90 px-8 text-lg h-12">
                  Submit Simulation
                </Button>
              ) : (
                <Button onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))} className="px-8 text-lg h-12">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 justify-center">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(i)}
            className={`w-10 h-10 rounded-xl text-xs font-bold transition-all border-2 ${
              currentQuestionIndex === i 
                ? 'border-primary shadow-md ring-1 ring-primary/20' 
                : 'border-transparent'
            } ${
              userAnswers[q.id] 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function Footer({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props}>{children}</div>;
}
