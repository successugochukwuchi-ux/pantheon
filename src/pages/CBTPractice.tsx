import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Timer, HelpCircle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, RotateCcw, Play } from 'lucide-react';
import { Course, Question, CBTSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function CBTPractice() {
  const { user, profile, systemConfig } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Setup State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isTimed, setIsTimed] = useState(false);
  const [duration, setDuration] = useState(30); // minutes
  const [testStarted, setTestStarted] = useState(false);

  // Test State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [testCompleted, setTestCompleted] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      // Filter by current semester
      const activeCourses = allCourses.filter(c => c.semester === systemConfig?.currentSemester);
      setCourses(activeCourses);
      setLoading(false);
    });

    return () => unsubCourses();
  }, [profile, systemConfig]);

  const fetchQuestions = async (courseId: string) => {
    setLoading(true);
    const q = query(collection(db, 'questions'), where('courseId', '==', courseId));
    onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions(fetched);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (selectedCourseId) {
      fetchQuestions(selectedCourseId);
    }
  }, [selectedCourseId]);

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
  const randomizedQuestions = useMemo(() => {
    return questions.map(q => {
      const allOptions = [q.correctAnswer, ...q.incorrectAnswers];
      // Fisher-Yates shuffle
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }
      return { ...q, options: allOptions };
    });
  }, [questions, testStarted]);

  const handleStartTest = () => {
    if (!selectedCourseId) {
      toast.error('Please select a course');
      return;
    }
    if (questions.length === 0) {
      toast.error('No questions available for this course');
      return;
    }
    setTestStarted(true);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setTestCompleted(false);
    if (isTimed) {
      setTimeLeft(duration * 60);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFinishTest = async () => {
    setTestCompleted(true);
    
    // Calculate score
    let score = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        score++;
      }
    });

    // Save session
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
        toast.success('Test results saved!');
      } catch (error: any) {
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
          <p className="text-muted-foreground">Test your knowledge with randomized questions.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configure Your Test</CardTitle>
            <CardDescription>Select a course and set your preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Select Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base">Timed Mode</Label>
                <p className="text-sm text-muted-foreground">Set a time limit for your test.</p>
              </div>
              <Button 
                variant={isTimed ? "default" : "outline"}
                onClick={() => setIsTimed(!isTimed)}
              >
                {isTimed ? "Timer ON" : "Timer OFF"}
              </Button>
            </div>

            {isTimed && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Label>Duration (Minutes)</Label>
                <Input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  min="1"
                  max="180"
                />
              </motion.div>
            )}

            {selectedCourseId && questions.length > 0 && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">
                  {questions.length} questions available for this course.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleStartTest}
              disabled={!selectedCourseId || questions.length === 0}
            >
              <Play className="mr-2 h-5 w-5" /> Start Test
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
            <CardTitle className="text-3xl">Test Results</CardTitle>
            <CardDescription>You've completed the {courses.find(c => c.id === selectedCourseId)?.code} practice test.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex justify-center">
              <div className="relative h-48 w-48 flex items-center justify-center rounded-full border-8 border-primary/20">
                <div className="text-center">
                  <p className="text-5xl font-bold text-primary">{percentage}%</p>
                  <p className="text-sm text-muted-foreground font-medium">{score} / {questions.length}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <h3 className="font-semibold text-lg">Review Questions</h3>
              {randomizedQuestions.map((q, i) => (
                <Card key={q.id} className={userAnswers[q.id] === q.correctAnswer ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}>
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium">Q{i + 1}: {q.text}</p>
                      {userAnswers[q.id] === q.correctAnswer ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-sm">
                    <p><span className="font-bold">Your Answer:</span> {userAnswers[q.id] || 'Not answered'}</p>
                    {userAnswers[q.id] !== q.correctAnswer && (
                      <p><span className="font-bold text-green-600">Correct Answer:</span> {q.correctAnswer}</p>
                    )}
                    {q.explanation && (
                      <div className="mt-2 p-2 bg-background/50 rounded border text-xs italic">
                        <p><span className="font-bold not-italic">Explanation:</span> {q.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setTestStarted(false)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Back to Setup
            </Button>
            <Button className="flex-1" onClick={handleStartTest}>
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentQuestion = randomizedQuestions[currentQuestionIndex];
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{courses.find(c => c.id === selectedCourseId)?.code} Practice</h2>
          <p className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
        </div>
        {isTimed && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-mono font-bold ${timeLeft < 60 ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-muted'}`}>
            <Timer className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
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
          transition={{ duration: 0.2 }}
        >
          <Card className="min-h-[400px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl leading-relaxed">
                {currentQuestion.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {(currentQuestion as any).options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left hover:border-primary/50 hover:bg-primary/5 ${
                    userAnswers[currentQuestion.id] === option 
                      ? 'border-primary bg-primary/10' 
                      : 'border-transparent bg-muted/50'
                  }`}
                >
                  <span className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg font-bold ${
                    userAnswers[currentQuestion.id] === option 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-background text-muted-foreground'
                  }`}>
                    {optionLabels[idx]}
                  </span>
                  <span className="font-medium">{option}</span>
                </button>
              ))}
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <Button 
                variant="ghost" 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              
              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={handleFinishTest} className="bg-green-600 hover:bg-green-700">
                  Finish Test
                </Button>
              ) : (
                <Button onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-10 gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(i)}
            className={`h-8 rounded-md text-xs font-bold transition-all ${
              currentQuestionIndex === i 
                ? 'ring-2 ring-primary ring-offset-2' 
                : ''
            } ${
              userAnswers[q.id] 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
