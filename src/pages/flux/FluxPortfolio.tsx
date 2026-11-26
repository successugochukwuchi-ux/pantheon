import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Star, 
  Award, 
  Zap, 
  ShieldCheck, 
  Share2,
  TrendingUp,
  LayoutGrid,
  Trophy,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

interface CompletedTrack {
  id: string;
  trackId: string;
  completedAt: Date;
  trackData: {
    title: string;
    category: string;
    difficulty: string;
    estimatedHours: number;
  };
}

const FluxPortfolio: React.FC = () => {
  const { user, profile } = useAuth();
  const [completedTracks, setCompletedTracks] = useState<CompletedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCompleted();
    }
  }, [user]);

  const fetchCompleted = async () => {
    try {
      const q = query(
        collection(db, 'flux_enrollments'), 
        where('userId', '==', user?.uid),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      const tracks: CompletedTrack[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const tRef = doc(db, 'flux_tracks', data.trackId);
        const tSnap = await getDoc(tRef);
        
        if (tSnap.exists()) {
          tracks.push({
            id: docSnap.id,
            trackId: data.trackId,
            completedAt: data.completedAt?.toDate() || new Date(),
            trackData: tSnap.data() as any
          });
        }
      }
      setCompletedTracks(tracks);
    } catch (error) {
      console.error('Error fetching completed tracks:', error);
      toast.error('Failed to load portfolio achievements');
    } finally {
      setIsLoading(false);
    }
  };

  const totalMilestones = completedTracks.reduce((acc, t) => {
    const modules = (t.trackData as any).modules || [];
    const count = modules.reduce((sum: number, m: any) => sum + (m.milestones?.length || 0), 0);
    return acc + count;
  }, 0);
  const impactScore = completedTracks.length * 100 + totalMilestones * 15;

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Stats */}
      <div className="relative p-10 rounded-[3rem] bg-stone-900 border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
           <Zap size={200} className="text-pink-500 fill-pink-500" />
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-500 rounded-2xl">
                <Star className="text-white w-6 h-6 fill-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Skill Portfolio</h1>
            </div>
            <p className="text-stone-400 text-base leading-relaxed max-w-md">
              View your completed skill tracks, points earned, and learning milestones.
            </p>
            <div className="flex gap-3">
              <Button
                className="bg-white text-black hover:bg-stone-200 font-semibold rounded-xl"
                onClick={() => {
                  const summary = `${profile?.username || 'Student'}'s CoLearn Flux Portfolio: ${completedTracks.length} completed tracks (${impactScore} points).`;
                  navigator.clipboard?.writeText(summary);
                  toast.success('Portfolio summary copied to clipboard');
                }}
              >
                Share Portfolio <Share2 size={16} className="ml-2" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-stone-950/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md">
                <Activity className="text-pink-500 mb-4" size={24} />
                <div className="text-4xl font-black mb-1">{impactScore}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">Points</div>
             </div>
             <div className="bg-stone-950/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md">
                <Trophy className="text-yellow-500 mb-4" size={24} />
                <div className="text-4xl font-black mb-1">{completedTracks.length}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">Completed Tracks</div>
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-2xl font-bold flex items-center gap-2">
             <ShieldCheck className="text-pink-500" size={24} />
             Completed Tracks
           </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3].map(i => <div key={i} className="h-64 bg-stone-900 animate-pulse rounded-[2.5rem]" />)}
          </div>
        ) : completedTracks.length === 0 ? (
          <div className="py-32 text-center bg-stone-900/10 rounded-[3rem] border border-stone-800/50">
             <LayoutGrid size={60} className="mx-auto text-stone-900 mb-6" />
             <h3 className="text-xl font-bold text-stone-700">Portfolio Empty</h3>
             <p className="text-stone-800 font-medium">Complete Skill Tracks to populate your smart portfolio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {completedTracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="bg-stone-900/50 border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-pink-500/30 transition-all duration-300">
                    <div className="p-8 space-y-6">
                      <div className="flex items-start justify-between">
                         <div className="p-4 bg-stone-950 rounded-2xl group-hover:bg-pink-500 transition-colors duration-500">
                            <Award className="text-stone-700 group-hover:text-white" size={32} />
                         </div>
                         <div className="text-right">
                            <div className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Completed</div>
                            <div className="text-xs font-bold text-stone-400">{track.completedAt.toLocaleDateString()}</div>
                         </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-xl font-black group-hover:text-white transition-colors">{track.trackData.title}</h4>
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{track.trackData.category}</p>
                      </div>

                      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                           <span className="text-[8px] font-black uppercase text-stone-700 tracking-widest">Modules</span>
                           <span className="text-[10px] font-black text-white">{(track.trackData as any).modules?.length || 0}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                           <span className="text-[8px] font-black uppercase text-stone-700 tracking-widest">Milestones</span>
                           <span className="text-[10px] font-black text-white">
                             {((track.trackData as any).modules || []).reduce((sum: number, m: any) => sum + (m.milestones?.length || 0), 0)}
                           </span>
                        </div>
                        <div className="ml-auto w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                           <TrendingUp size={14} className="text-pink-500" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default FluxPortfolio;
