import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, where, Timestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { 
  Zap, 
  Map, 
  ChevronRight, 
  Clock, 
  Star,
  CheckCircle2,
  ArrowRight,
  PlayCircle,
  BookOpen,
  ArrowLeft,
  Trophy,
  Video,
  FileText,
  Check,
  X,
  AlertCircle,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { NoteRenderer } from '../../components/NoteBuilder';
import { cn } from '../../lib/utils';

interface FluxMilestone {
  id: string;
  title: string;
  type: 'video' | 'note';
  videoUrl?: string;
  noteContent?: string;
  hasTest: boolean;
  testContent?: string;
}

interface FluxModule {
  id: string;
  title: string;
  milestones: FluxMilestone[];
  exam?: {
    id: string;
    title: string;
    content: string;
  };
}

interface EnrolledTrack {
  id: string; // enrollmentId
  trackId: string;
  status: 'enrolled' | 'completed';
  progress: number;
  completedItems?: Record<string, boolean>; // map of milestoneId or examId to boolean
  trackData: {
    title: string;
    category: string;
    modules?: FluxModule[];
  };
}

const parsePlxQuestions = (text: string) => {
  const questionsList: any[] = [];
  const qRegex = /<QUES[^>]*>([\s\S]*?)<\/QUES>/gi;
  let match;
  while ((match = qRegex.exec(text)) !== null) {
    const block = match[1];
    
    const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(block);
    const incMatches = [...block.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
    const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(block);
    
    const firstSubTag = block.search(/<(COR|INC|EXP)/i);
    const questionText = firstSubTag === -1 ? block.trim() : block.substring(0, firstSubTag).trim();
    
    const correctVal = corMatch ? (corMatch[1] || corMatch[2] || '').trim() : '';
    const incorrectVals = incMatches.map(m => (m[1] || m[2] || '').trim()).filter(Boolean);
    const explanationVal = expMatch ? (expMatch[1] || expMatch[2] || '').trim() : '';
    
    if (questionText && correctVal) {
      questionsList.push({
        question: questionText,
        correct: correctVal,
        options: [correctVal, ...incorrectVals].sort(() => 0.5 - Math.random()),
        explanation: explanationVal
      });
    }
  }
  return questionsList;
};

const FluxTracks: React.FC = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrolledTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Active Track Study State
  const [activeTrack, setActiveTrack] = useState<EnrolledTrack | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState<number | null>(0); // null indicates we are taking Module Exam
  const [showModuleExam, setShowModuleExam] = useState(false);

  // Quiz Taker Interactivity State
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  const fetchEnrollments = async () => {
    try {
      const q = query(
        collection(db, 'flux_enrollments'), 
        where('userId', '==', user?.uid),
        where('status', '==', 'enrolled')
      );
      const snapshot = await getDocs(q);
      
      const enrolledTracks: EnrolledTrack[] = [];
      
      for (const enrollmentDoc of snapshot.docs) {
        const data = enrollmentDoc.data();
        const trackRef = doc(db, 'flux_tracks', data.trackId);
        const trackSnap = await getDoc(trackRef);
        
        if (trackSnap.exists()) {
          enrolledTracks.push({
            id: enrollmentDoc.id,
            trackId: data.trackId,
            status: data.status,
            progress: data.progress || 0,
            completedItems: data.completedItems || {},
            trackData: trackSnap.data() as any
          });
        }
      }
      
      setEnrollments(enrolledTracks);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load your enrolled CoLearn Flux tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTrack = (enrollment: EnrolledTrack) => {
    setActiveTrack(enrollment);
    setActiveModuleIndex(0);
    setActiveMilestoneIndex(0);
    setShowModuleExam(false);
    resetQuiz();
    
    // Parse questions if first milestone has test
    const modules = enrollment.trackData.modules || [];
    if (modules[0]?.milestones?.[0]?.hasTest && modules[0]?.milestones?.[0]?.testContent) {
      setParsedQuestions(parsePlxQuestions(modules[0].milestones[0].testContent));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseTrack = () => {
    setActiveTrack(null);
    resetQuiz();
  };

  const resetQuiz = () => {
    setUserAnswers({});
    setQuizSubmitted(false);
    setQuizPassed(false);
    setParsedQuestions([]);
  };

  // Change selected milestone or exam
  const handleSelectMilestone = (mIdx: number, msIdx: number | null, isExam: boolean) => {
    setActiveModuleIndex(mIdx);
    setActiveMilestoneIndex(msIdx);
    setShowModuleExam(isExam);
    resetQuiz();

    const modules = activeTrack?.trackData.modules || [];
    const targetModule = modules[mIdx];

    if (isExam) {
      if (targetModule?.exam?.content) {
        setParsedQuestions(parsePlxQuestions(targetModule.exam.content));
      }
    } else if (msIdx !== null) {
      const targetMilestone = targetModule?.milestones?.[msIdx];
      if (targetMilestone?.hasTest && targetMilestone.testContent) {
        setParsedQuestions(parsePlxQuestions(targetMilestone.testContent));
      }
    }
  };

  // Evaluate user quiz answers
  const handleSubmitQuiz = async () => {
    if (parsedQuestions.length === 0) return;

    let correctCount = 0;
    parsedQuestions.forEach((q, idx) => {
      if (userAnswers[idx]?.trim().toLowerCase() === q.correct.trim().toLowerCase()) {
        correctCount++;
      }
    });

    setQuizSubmitted(true);
    const passed = correctCount === parsedQuestions.length;
    setQuizPassed(passed);

    if (passed) {
      toast.success('Congratulations! You passed the Concept Evaluation perfectly!');
      await handleCompleteStep();
    } else {
      toast.error(`Verification Failed. You got ${correctCount}/${parsedQuestions.length} correct. Please review incorrect responses and try again.`);
    }
  };

  // Save progress step in Firebase and update index
  const handleCompleteStep = async () => {
    if (!activeTrack) return;

    const modules = activeTrack.trackData.modules || [];
    const module = modules[activeModuleIndex];
    if (!module) return;

    let itemKey = '';
    if (showModuleExam) {
      itemKey = `exam_${module.id}`;
    } else if (activeMilestoneIndex !== null) {
      const ms = module.milestones[activeMilestoneIndex];
      if (ms) itemKey = `milestone_${ms.id}`;
    }

    if (!itemKey) return;

    const updatedCompletedItems = {
      ...(activeTrack.completedItems || {}),
      [itemKey]: true
    };

    // Calculate progress based on milestones and exams in modules
    let totalItems = 0;
    modules.forEach(m => {
      totalItems += (m.milestones?.length || 0);
      if (m.exam?.content) totalItems += 1; // plus the concluding exam
    });

    const completedItemsCount = Object.keys(updatedCompletedItems).length;
    const progressPercent = totalItems > 0 ? Math.round((completedItemsCount / totalItems) * 100) : 0;

    try {
      await updateDoc(doc(db, 'flux_enrollments', activeTrack.id), {
        completedItems: updatedCompletedItems,
        progress: Math.min(progressPercent, 99) // Reserve 100% for overall Claim Mastery click
      });

      // Update active state
      const updatedActiveTrack = {
        ...activeTrack,
        completedItems: updatedCompletedItems,
        progress: Math.min(progressPercent, 99)
      };
      setActiveTrack(updatedActiveTrack);

      // Refresh listings
      setEnrollments(prev => prev.map(e => e.id === activeTrack.id ? updatedActiveTrack : e));
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  };

  // Skip step if no test
  const handleNextStep = async () => {
    if (!activeTrack) return;

    // Mark current completed silently even if no test
    await handleCompleteStep();

    const modules = activeTrack.trackData.modules || [];
    const currentModule = modules[activeModuleIndex];

    if (!currentModule) return;

    if (!showModuleExam && activeMilestoneIndex !== null) {
      // Move to next milestone inside same module
      if (activeMilestoneIndex < currentModule.milestones.length - 1) {
        handleSelectMilestone(activeModuleIndex, activeMilestoneIndex + 1, false);
      } else {
        // Module milestones completed! Take concluding exam
        handleSelectMilestone(activeModuleIndex, null, true);
      }
    } else {
      // Concluding exam completed! Move to next module
      if (activeModuleIndex < modules.length - 1) {
        handleSelectMilestone(activeModuleIndex + 1, 0, false);
      } else {
        // Last module concluding exam done! Ready to claim track complete
        toast.success("All module curricula completed! Claim your smart certificate now!");
      }
    }
  };

  const handleCompleteTrack = async (enrollmentId: string, trackId: string) => {
    try {
      await updateDoc(doc(db, 'flux_enrollments', enrollmentId), {
        status: 'completed',
        completedAt: Timestamp.now(),
        progress: 100
      });

      await updateDoc(doc(db, 'flux_tracks', trackId), {
        completedCount: increment(1)
      });

      toast.success('Course Completed! Concluding token dispatched to your Smart Portfolio!');
      handleCloseTrack();
      fetchEnrollments();
    } catch (error) {
       console.error('Error completing track:', error);
       toast.error('Failed to complete track');
    }
  };

  if (activeTrack) {
    const modules = activeTrack.trackData.modules || [];
    const currentModule = modules[activeModuleIndex];
    const currentMilestone = (activeMilestoneIndex !== null && currentModule) ? currentModule.milestones[activeMilestoneIndex] : null;

    // Is active milestone or active exam completed?
    let isCurrentItemCompleted = false;
    if (activeTrack.completedItems) {
      if (showModuleExam && currentModule) {
        isCurrentItemCompleted = !!activeTrack.completedItems[`exam_${currentModule.id}`];
      } else if (currentMilestone) {
        isCurrentItemCompleted = !!activeTrack.completedItems[`milestone_${currentMilestone.id}`];
      }
    }

    const testPending = showModuleExam || (currentMilestone?.hasTest);

    return (
      <div className="min-h-screen bg-stone-950 -mt-8 -mx-4 md:-mx-8 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCloseTrack}
                className="text-stone-500 hover:text-white rounded-xl h-11 w-11 hover:bg-white/5"
              >
                <ArrowLeft size={24} />
              </Button>
              <div className="space-y-1 text-left">
                <Badge className="bg-pink-500 text-white font-black uppercase text-[9px] tracking-widest">
                  {activeTrack.trackData.category}
                </Badge>
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic text-white leading-tight">
                  {activeTrack.trackData.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-1">Track Progress</div>
                <div className="text-lg font-black text-pink-500 italic">{activeTrack.progress}%</div>
              </div>
              <div className="w-32 h-2 bg-stone-900 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-pink-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${activeTrack.progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Hierarchical Syllabus Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-stone-900 border border-white/5 rounded-[2rem] p-6 text-left">
                <h3 className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-6 px-1 flex items-center justify-between">
                  <span>Track Syllabus</span>
                  <Sparkles size={11} className="text-pink-500" />
                </h3>
                
                <div className="space-y-6">
                  {modules.length === 0 ? (
                    <div className="p-4 text-center text-stone-600 italic text-xs">No modules defined.</div>
                  ) : (
                    modules.map((mod, modIdx) => {
                      const isModuleActive = activeModuleIndex === modIdx;
                      return (
                        <div key={mod.id} className="space-y-2">
                          <h4 className="text-[11px] font-black text-stone-300 uppercase leading-none tracking-tight flex items-center gap-2">
                            <span className="p-1 rounded bg-white/5 text-stone-500 font-bold text-[8px]">MOD {modIdx + 1}</span>
                            {mod.title}
                          </h4>

                          <div className="space-y-1 pl-2 border-l border-white/5 ml-3">
                            {mod.milestones.map((ms, msIdx) => {
                              const isMsActive = isModuleActive && activeMilestoneIndex === msIdx && !showModuleExam;
                              const isCompleted = activeTrack.completedItems?.[`milestone_${ms.id}`];
                              return (
                                <button
                                  key={ms.id}
                                  onClick={() => handleSelectMilestone(modIdx, msIdx, false)}
                                  className={cn(
                                    "w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1",
                                    isMsActive 
                                      ? "bg-pink-500 text-white font-black shadow-lg shadow-pink-500/10" 
                                      : "hover:bg-white/5 text-stone-500 hover:text-stone-300"
                                  )}
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    {ms.type === 'video' ? <Video size={10} /> : <BookOpen size={10} />}
                                    {ms.title}
                                  </span>
                                  {isCompleted && (
                                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                  )}
                                </button>
                              );
                            })}

                            {mod.exam && (
                              <button
                                onClick={() => handleSelectMilestone(modIdx, null, true)}
                                className={cn(
                                  "w-full text-left p-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-between mt-2",
                                  isModuleActive && showModuleExam
                                    ? "bg-amber-500 text-black font-black shadow-lg shadow-amber-500/15"
                                    : "bg-stone-950/20 hover:bg-stone-950/40 text-amber-500/70 hover:text-amber-500"
                                )}
                              >
                                <span className="flex items-center gap-1">
                                  <FileText size={11} />
                                  Conclude Exam
                                </span>
                                {activeTrack.completedItems?.[`exam_${mod.id}`] && (
                                  <CheckCircle2 size={11} className={cn(
                                    isModuleActive && showModuleExam ? "text-stone-950" : "text-emerald-500"
                                  )} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Claim Mastery button at the ultimate end */}
                <div className="pt-6 mt-6 border-t border-white/5">
                  <Button
                    onClick={() => handleCompleteTrack(activeTrack.id, activeTrack.trackId)}
                    className="w-full bg-white text-black hover:bg-stone-200 font-black rounded-xl py-5 text-[10px] uppercase tracking-wider block"
                  >
                    <Trophy className="inline-block mr-2 h-4 w-4 text-yellow-500 fill-yellow-500" />
                    Claim Mastery Track
                  </Button>
                </div>
              </div>
            </div>

            {/* Step & Milestone Action Workspace */}
            <div className="lg:col-span-3">
              <motion.div
                key={`${activeModuleIndex}_${activeMilestoneIndex}_${showModuleExam}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-stone-900 border border-white/5 rounded-[2.5rem] p-8 md:p-12 min-h-[600px] text-left relative"
              >
                {showModuleExam && currentModule ? (
                  /* EXAM INTERACTIVE VIEW */
                  <div className="max-w-2xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                        Module Conclude Examination (PLX Validator)
                      </div>
                      <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">
                        {currentModule.title} Final Test
                      </h1>
                      <div className="h-1 w-20 bg-amber-500 rounded-full" />
                    </div>

                    <div className="p-4 bg-amber-500/5 text-amber-500 border border-amber-500/10 rounded-2xl text-xs leading-relaxed">
                      You must answer all multiple choice questions below and obtain 100% score to clear this module and unlock subsequent curricula.
                    </div>

                    {parsedQuestions.length === 0 ? (
                      <div className="py-20 text-center text-stone-600 italic">
                        No exam questions declared for this module concluding exam.
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {parsedQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="bg-stone-950/40 p-6 rounded-2xl border border-white/5 space-y-4">
                            <h4 className="font-black text-sm text-white flex gap-2">
                              <span className="text-amber-500">{qIdx+1}.</span>
                              {q.question}
                            </h4>

                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt: string, oIdx: number) => {
                                const isSelected = userAnswers[qIdx] === opt;
                                return (
                                  <button
                                    key={oIdx}
                                    disabled={quizSubmitted && quizPassed}
                                    onClick={() => setUserAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                                    className={cn(
                                      "w-full text-left p-3.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between",
                                      isSelected
                                        ? "bg-amber-500 text-black border-amber-500"
                                        : "bg-stone-900 border-white/5 text-stone-400 hover:border-white/10"
                                    )}
                                  >
                                    <span>{opt}</span>
                                    {isSelected && <Check size={14} className="shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Show correction / comments on wrong options */}
                            {quizSubmitted && !quizPassed && (
                              <div className="p-3.5 rounded-xl text-xs bg-stone-950 border border-white/5 space-y-1.5 animate-fadeIn">
                                {userAnswers[qIdx] === q.correct ? (
                                  <p className="text-emerald-500 font-black uppercase tracking-wider text-[9px] flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Response validated perfectly.
                                  </p>
                                ) : (
                                  <p className="text-red-500 font-black uppercase tracking-wider text-[9px] flex items-center gap-1">
                                    <X size={11} /> Incorrect Choice. Correct option: <span className="underline italic">{q.correct}</span>
                                  </p>
                                )}
                                {q.explanation && (
                                  <p className="text-stone-500 leading-relaxed italic mt-1 font-medium">{q.explanation}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                          <Button
                            variant="ghost"
                            onClick={() => setUserAnswers({})}
                            className="text-stone-500 hover:text-white text-xs font-bold uppercase tracking-wider"
                          >
                            RESTORE RESPONSES
                          </Button>

                          {!quizPassed ? (
                            <Button
                              onClick={handleSubmitQuiz}
                              className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider px-8 py-5 rounded-xl shadow-lg shadow-amber-500/10"
                            >
                              SUBMIT ANSWERS FOR EVALUATION
                            </Button>
                          ) : (
                            <Button
                              onClick={handleNextStep}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider px-8 py-5 rounded-xl shadow-lg shadow-emerald-500/10"
                            >
                              CONTINUE COURSE <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : currentMilestone ? (
                  /* MILESTONE CORE VIEW (VIDEO OR NOTE) */
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-pink-500 text-[10px] font-black uppercase tracking-widest">
                        Module {activeModuleIndex + 1} ➔ Milestone {activeMilestoneIndex !== null ? activeMilestoneIndex + 1 : 1}
                      </div>
                      <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tight text-white leading-tight">
                        {currentMilestone.title}
                      </h1>
                      <div className="h-1 w-20 bg-pink-500 rounded-full" />
                    </div>

                    {/* Step Video embed OR notes display */}
                    {currentMilestone.type === 'video' ? (
                      <div className="space-y-4 text-left">
                        {currentMilestone.videoUrl ? (
                          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-stone-950 border border-white/5 relative shadow-2xl">
                            {currentMilestone.videoUrl.includes('youtube.com') || currentMilestone.videoUrl.includes('youtu.be') ? (
                              (() => {
                                // Extract youtube ID safely
                                let id = '';
                                const match = currentMilestone.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                                id = match ? match[1] : '';
                                return id ? (
                                  <iframe 
                                    src={`https://www.youtube.com/embed/${id}`}
                                    title="Milestone Lecture Video"
                                    className="w-full h-full border-0 absolute inset-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full p-6 text-stone-500 text-xs">
                                     YouTube link matched but ID was unparseable. Click link below to view.
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full gap-4 text-stone-500">
                                <Video size={48} className="opacity-20 animate-pulse" />
                                <div className="text-xs font-bold uppercase tracking-widest">External Video Source</div>
                                <a 
                                  href={currentMilestone.videoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-black uppercase bg-white/5 border border-white/10 px-4 py-2 hover:bg-white/10 rounded-lg text-white"
                                >
                                  Open Lecture Video Link
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video w-full rounded-2xl flex flex-col items-center justify-center bg-stone-950 border border-white/5 text-stone-700 font-bold">
                            No video URL configured.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-stone max-w-none text-stone-200">
                        <NoteRenderer content={currentMilestone.noteContent || ''} />
                      </div>
                    )}

                    {/* Milestone check test if configured */}
                    {currentMilestone.hasTest && (
                      <div className="p-8 border border-white/5 rounded-[2rem] bg-stone-950/20 space-y-6 text-left mt-12">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500 text-black font-black uppercase text-[8px] tracking-wider shrink-0">CONCEPT EVALUATION</Badge>
                          <h4 className="text-sm font-black uppercase text-white tracking-tight">Milestone Concept Quiz</h4>
                        </div>

                        {parsedQuestions.length === 0 ? (
                          <div className="p-4 text-center italic text-stone-600 text-xs">No questions configured. Click Next to continue.</div>
                        ) : (
                          <div className="space-y-6">
                            {parsedQuestions.map((q, qIdx) => (
                              <div key={qIdx} className="space-y-3">
                                <h5 className="font-bold text-xs text-stone-300 flex gap-2">
                                  <span>{qIdx + 1}.</span>
                                  {q.question}
                                </h5>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {q.options.map((opt: string, oIdx: number) => {
                                    const isSelected = userAnswers[qIdx] === opt;
                                    return (
                                      <button
                                        key={oIdx}
                                        disabled={quizSubmitted && quizPassed}
                                        onClick={() => setUserAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                                        className={cn(
                                          "w-full text-left p-3 rounded-lg border text-[11px] font-semibold transition-all flex items-center justify-between",
                                          isSelected
                                            ? "bg-amber-500 text-black border-amber-500"
                                            : "bg-stone-900 border-white/5 text-stone-400 hover:border-white/10"
                                        )}
                                      >
                                        <span>{opt}</span>
                                        {isSelected && <Check size={12} className="shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>

                                {quizSubmitted && !quizPassed && (
                                  <div className="p-3 rounded-xl text-[11px] bg-stone-950 border border-white/5 space-y-1 mt-2">
                                    {userAnswers[qIdx] === q.correct ? (
                                      <p className="text-emerald-500 font-bold uppercase tracking-wider text-[8px]">✔ Verified</p>
                                    ) : (
                                      <p className="text-red-500 font-bold uppercase tracking-wider text-[8px]">❌ Wrong answer. Correct option: {q.correct}</p>
                                    )}
                                    {q.explanation && (
                                      <p className="text-stone-500 leading-relaxed italic mt-0.5">{q.explanation}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {!quizPassed ? (
                              <Button
                                onClick={handleSubmitQuiz}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-black text-[10px] tracking-wider uppercase h-11 rounded-lg px-6"
                              >
                                VALIDATE ANSWERS
                              </Button>
                            ) : (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-black">
                                EVALUATION PASSED perfectly!
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step navigation controls */}
                    <div className="pt-12 border-t border-white/5 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        disabled={activeModuleIndex === 0 && activeMilestoneIndex === 0}
                        onClick={() => {
                          if (activeMilestoneIndex !== null && activeMilestoneIndex > 0) {
                            handleSelectMilestone(activeModuleIndex, activeMilestoneIndex - 1, false);
                          } else if (showModuleExam) {
                            // Go back to the module's last milestone
                            handleSelectMilestone(activeModuleIndex, currentModule.milestones.length - 1, false);
                          } else if (activeModuleIndex > 0) {
                            // Go back to previous module's exam
                            handleSelectMilestone(activeModuleIndex - 1, null, true);
                          }
                        }}
                        className="text-stone-500 hover:text-white font-black text-[10px] uppercase tracking-widest"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> REWIND
                      </Button>
                      
                      {/* Only allow going forward if quiz passed OR didn't have test */}
                      {(!currentMilestone.hasTest || quizPassed || isCurrentItemCompleted) ? (
                        <Button
                          onClick={handleNextStep}
                          className="bg-pink-500 hover:bg-pink-600 text-white font-black text-[10px] uppercase tracking-widest px-8 py-5 rounded-xl shadow-xl shadow-pink-500/10"
                        >
                          NEXT STEP <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          disabled
                          className="bg-stone-800 text-stone-600 font-black text-[10px] uppercase tracking-widest px-8 py-5 rounded-xl cursor-default border border-white/5"
                        >
                          SOLVE QUIZ TO CONTINUE
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 text-stone-700 py-32">
                    <BookOpen size={64} className="opacity-20 animate-pulse text-stone-700" />
                    <p className="font-black uppercase tracking-widest text-xs">Curriculum loading...</p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-left">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500 rounded-lg">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase text-white">CoLearn Flux</h1>
        </div>
        <p className="text-stone-400 font-medium">Accelerate your specialty skill development with structured tracks and verifiable portfolios.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-64 bg-stone-900 animate-pulse rounded-3xl border border-white/5" />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-stone-900/10 rounded-[2.5rem] border border-stone-800 px-6 text-center">
          <div className="w-20 h-20 bg-stone-950 rounded-3xl flex items-center justify-center border border-white/5 mb-6 text-stone-800">
            <Map size={40} />
          </div>
          <h2 className="text-2xl font-black text-stone-300 mb-2 italic">ZERO ACTIVE ENROLLED TRACKS</h2>
          <p className="text-stone-500 max-w-sm mb-8 font-medium italic uppercase tracking-wider text-[10px]">
            Ready to scale up? Head to the Browse Flux specialty courses and join an interactive track!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {enrollments.map((enrollment) => {
              const totalMilestonesCount = (enrollment.trackData.modules || []).reduce((sum, m) => sum + (m.milestones?.length || 0), 0);
              return (
                <motion.div
                  key={enrollment.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className="bg-stone-900 border-white/5 hover:border-pink-500/20 transition-all group rounded-[2.5rem] overflow-hidden relative backdrop-blur-sm">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Zap className="w-24 h-24 text-pink-500 fill-pink-500" />
                    </div>
                    
                    <CardContent className="p-8 text-left">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="space-y-4 max-w-md text-left">
                          <Badge variant="outline" className="border-pink-500/30 text-pink-500 font-black tracking-widest text-[9px] uppercase bg-pink-500/5">
                            {enrollment.trackData.category}
                          </Badge>
                          <h3 className="text-2xl font-black italic tracking-tight uppercase leading-tight text-white">{enrollment.trackData.title}</h3>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase">
                              <Sparkles size={12} className="text-pink-500" /> {enrollment.trackData.modules?.length || 0} MODULES
                            </div>
                            <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase">
                              <BookOpen size={12} className="text-stone-700" /> {totalMilestonesCount} STEPS
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center md:items-end gap-1">
                          <div className="text-5xl font-black text-white italic tracking-tighter">{enrollment.progress}<span className="text-pink-500">%</span></div>
                          <div className="text-[9px] font-black uppercase text-stone-500 tracking-[0.3em]">Mastery Index</div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="w-full h-2 bg-stone-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-violet-600 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${enrollment.progress}%` }}
                          />
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <p className="text-[10px] font-bold text-stone-500 italic uppercase tracking-wider">
                            {enrollment.progress === 100 ? "Engines optimized for peak performance." : "Strategic learning in progress..."}
                          </p>
                          <div className="flex gap-3 w-full md:w-auto">
                            <Button 
                              onClick={() => handleOpenTrack(enrollment)}
                              className="flex-1 md:flex-none bg-stone-100 text-black hover:bg-white rounded-xl font-black text-[10px] uppercase tracking-widest px-8 h-12 shadow-xl shadow-white/5"
                            >
                              OPEN ENGINE <PlayCircle size={16} className="ml-2" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default FluxTracks;
