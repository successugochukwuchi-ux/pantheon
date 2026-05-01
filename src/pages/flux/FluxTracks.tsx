import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, where, orderBy, Timestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { 
  Zap, 
  Map, 
  ChevronRight, 
  Clock, 
  Star,
  CheckCircle2,
  Compass,
  ArrowRight,
  X,
  PlayCircle,
  BookOpen,
  ArrowLeft,
  ChevronDown,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { NoteRenderer } from '../../components/NoteBuilder';
import { cn } from '../../lib/utils';

interface FluxStep {
  id: string;
  title: string;
  content: string;
}

interface EnrolledTrack {
  id: string; // enrollmentId
  trackId: string;
  status: 'enrolled' | 'completed';
  progress: number;
  trackData: {
    title: string;
    category: string;
    difficulty: string;
    estimatedHours: number;
    steps?: FluxStep[];
  };
}

const FluxTracks: React.FC = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrolledTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<EnrolledTrack | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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
            trackData: trackSnap.data() as any
          });
        }
      }
      
      setEnrollments(enrolledTracks);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load your tracks');
    } finally {
      setIsLoading(false);
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

      toast.success('Course Completed! Achievement added to Portfolio.');
      handleCloseTrack();
      fetchEnrollments();
    } catch (error) {
       console.error('Error completing track:', error);
       toast.error('Failed to update status');
    }
  };

  const handleOpenTrack = (enrollment: EnrolledTrack) => {
    setActiveTrack(enrollment);
    setActiveStepIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseTrack = () => {
    setActiveTrack(null);
  };

  if (activeTrack) {
    const steps = activeTrack.trackData.steps || [];
    const currentStep = steps[activeStepIndex];

    return (
      <div className="min-h-screen bg-stone-950 -mt-8 -mx-4 md:-mx-8 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCloseTrack}
                className="text-stone-500 hover:text-white"
              >
                <ArrowLeft size={24} />
              </Button>
              <div className="space-y-1">
                <Badge variant="outline" className="border-pink-500/20 text-pink-500 text-[10px] uppercase font-black tracking-widest">
                  {activeTrack.trackData.category}
                </Badge>
                <h2 className="text-3xl font-black tracking-tighter uppercase italic">{activeTrack.trackData.title}</h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <div className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-1">Overall Progress</div>
                <div className="text-xl font-black text-white">{activeTrack.progress}%</div>
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
            {/* Steps Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-stone-900/50 border border-white/5 rounded-[2rem] p-6 backdrop-blur-sm">
                <h3 className="text-xs font-black uppercase text-stone-500 tracking-widest mb-6 px-2">Path Milestones</h3>
                <div className="space-y-2">
                  {steps.length === 0 ? (
                    <div className="p-4 text-center text-stone-600 italic text-sm">No steps defined for this track.</div>
                  ) : (
                    steps.map((step, index) => (
                      <button
                        key={step.id}
                        onClick={() => setActiveStepIndex(index)}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                          activeStepIndex === index 
                            ? "bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/20 scale-[1.02]" 
                            : "bg-stone-950/50 border-white/5 text-stone-500 hover:border-white/20"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                          activeStepIndex === index ? "bg-white text-pink-500" : "bg-stone-900"
                        )}>
                          {index + 1}
                        </div>
                        <span className="text-xs font-black uppercase truncate">{step.title}</span>
                        {activeStepIndex === index && <ChevronRight className="ml-auto w-4 h-4" />}
                      </button>
                    ))
                  )}
                </div>

                {activeStepIndex === steps.length - 1 && steps.length > 0 && (
                  <Button 
                    onClick={() => handleCompleteTrack(activeTrack.id, activeTrack.trackId)}
                    className="w-full mt-8 bg-white text-black hover:bg-stone-200 font-black rounded-xl py-6 tracking-widest text-[10px] uppercase shadow-xl"
                  >
                    <Trophy className="mr-2 h-4 w-4" /> FINISH ENGINE
                  </Button>
                )}
              </div>
            </div>

            {/* Step Content */}
            <div className="lg:col-span-3">
              <motion.div
                key={activeStepIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-stone-900/30 border border-white/5 rounded-[2.5rem] p-8 md:p-12 min-h-[600px] backdrop-blur-sm"
              >
                {currentStep ? (
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-pink-500 text-[10px] font-black uppercase tracking-[0.3em]">
                        Milestone {activeStepIndex + 1}
                      </div>
                      <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">{currentStep.title}</h1>
                      <div className="h-1 w-20 bg-pink-500 rounded-full" />
                    </div>

                    <div className="prose prose-invert prose-stone max-w-none">
                      <NoteRenderer content={currentStep.content} />
                    </div>

                    <div className="pt-12 border-t border-white/5 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        disabled={activeStepIndex === 0}
                        onClick={() => setActiveStepIndex(prev => prev - 1)}
                        className="text-stone-500 hover:text-white font-black text-[10px] uppercase tracking-widest"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> REWIND
                      </Button>
                      
                      {activeStepIndex < steps.length - 1 ? (
                        <Button
                          onClick={() => setActiveStepIndex(prev => prev + 1)}
                          className="bg-pink-500 hover:bg-pink-600 text-white font-black text-[10px] uppercase tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-pink-500/10"
                        >
                          NEXT MILESTONE <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleCompleteTrack(activeTrack.id, activeTrack.trackId)}
                          className="bg-white text-black hover:bg-stone-200 font-black text-[10px] uppercase tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-white/10"
                        >
                          CLAIM MASTERY <Trophy className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 text-stone-700">
                    <BookOpen size={64} className="opacity-20" />
                    <p className="font-black uppercase tracking-widest text-xs">Awaiting Curriculum...</p>
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
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500 rounded-lg">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic uppercase">Track Management</h1>
        </div>
        <p className="text-stone-500 font-medium">Power up your specialty and track your engine progress.</p>
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
          <h2 className="text-2xl font-black text-stone-300 mb-2 italic">ZERO ACTIVE ENGINES</h2>
          <p className="text-stone-600 max-w-sm mb-8 font-medium italic uppercase tracking-wider text-[10px]">
            Ready to challenge yourself? Browse the ecosystem and pick a specialty to start your journey.
          </p>
          <Button size="lg" className="bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl px-10 h-14 uppercase italic tracking-tighter">
            ENTER BROWSER
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {enrollments.map((enrollment) => (
              <motion.div
                key={enrollment.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card className="bg-stone-900/50 border-white/5 hover:border-pink-500/20 transition-all group rounded-[2.5rem] overflow-hidden relative backdrop-blur-sm">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-24 h-24 text-pink-500 fill-pink-500" />
                  </div>
                  
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div className="space-y-4 max-w-md text-left">
                        <Badge variant="outline" className="border-pink-500/30 text-pink-500 font-black tracking-widest text-[9px] uppercase bg-pink-500/5">
                          {enrollment.trackData.category}
                        </Badge>
                        <h3 className="text-2xl font-black italic tracking-tight uppercase leading-tight">{enrollment.trackData.title}</h3>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase">
                            <Clock size={12} className="text-stone-700" /> {enrollment.trackData.estimatedHours} HOURS
                          </div>
                          <div className="flex items-center gap-2 text-stone-500 text-[10px] font-black uppercase">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" /> {enrollment.trackData.difficulty}
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
                        <p className="text-[10px] font-bold text-stone-600 italic uppercase tracking-wider">
                          {enrollment.progress === 100 ? "Engines optimized for peak performance." : "Strategic learning in progress..."}
                        </p>
                        <div className="flex gap-3 w-full md:w-auto">
                          <Button 
                            onClick={() => handleOpenTrack(enrollment)}
                            className="flex-1 md:flex-none bg-stone-100 text-black hover:bg-white rounded-xl font-black text-[10px] uppercase tracking-widest px-8 h-12 shadow-xl shadow-white/5"
                          >
                            OPEN ENGINE <PlayCircle size={16} className="ml-2" />
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleCompleteTrack(enrollment.id, enrollment.trackId)}
                            className="flex-1 md:flex-none bg-white/5 border-white/10 text-stone-400 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest h-12 px-6"
                          >
                            FINISH
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {enrollments.length > 0 && (
         <div className="p-10 bg-stone-900/30 rounded-[3rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-md">
           <div className="space-y-1 text-center md:text-left">
             <h4 className="text-2xl font-black italic tracking-tight uppercase">Ready for a new module?</h4>
             <p className="text-stone-500 font-medium italic text-sm">Expand your expertise by browsing more skill modules in the Flux Browser.</p>
           </div>
           <Button className="bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl px-10 h-14 uppercase italic tracking-tighter group">
             FLUX BROWSER <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
           </Button>
         </div>
      )}
    </div>
  );
};

export default FluxTracks;
