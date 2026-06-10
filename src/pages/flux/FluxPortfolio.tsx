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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

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
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-500 rounded-2xl">
                <Star className="text-white w-6 h-6 fill-white" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter">SMART PORTFOLIO</h1>
            </div>
            <p className="text-stone-500 text-lg font-medium leading-relaxed max-w-sm">
              Your cryptographic proof of mastery. Every completed track increases your global impact factor.
            </p>
            <div className="flex gap-4">
               <Button className="bg-white text-black hover:bg-stone-200 font-black rounded-xl">
                 SHARE PROFILE <Share2 size={16} className="ml-2" />
               </Button>
               <Button variant="outline" className="bg-white/5 border-white/5 text-stone-300 font-black rounded-xl">
                 DOWNLOAD CERTIFICATES
               </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-stone-950/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md">
                <Activity className="text-pink-500 mb-4" size={24} />
                <div className="text-4xl font-black mb-1">{impactScore}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">Impact Factor</div>
             </div>
             <div className="bg-stone-950/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md">
                <Trophy className="text-yellow-500 mb-4" size={24} />
                <div className="text-4xl font-black mb-1">{completedTracks.length}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">Mastery Certificates</div>
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-2xl font-black flex items-center gap-2">
             <ShieldCheck className="text-pink-500" size={24} />
             VERIFIED ACHIEVEMENTS
           </h2>
           <Badge className="bg-white/5 text-stone-500 border-white/5 font-black uppercase tracking-widest px-4 py-1">
             BLOCKCHAIN SECURED
           </Badge>
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

      {/* Global Rank Mock */}
      <div className="p-10 rounded-[3rem] bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-10">
         <div className="space-y-4 text-center md:text-left">
           <div className="flex items-center gap-2 justify-center md:justify-start">
             <Trophy className="text-yellow-500" size={20} />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">Global Ranking</span>
           </div>
           <h3 className="text-3xl font-black">Top 12% in Ecosystem</h3>
           <p className="text-stone-500 max-w-md font-medium">You are outperforming 88% of other students in technical extracurricular tracks this month.</p>
         </div>
         <Button className="h-20 px-12 rounded-3xl bg-white text-black hover:bg-stone-100 font-black text-xl shadow-2xl shadow-white/10 group">
           VIEW LEADERBOARD <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
         </Button>
      </div>
    </div>
  );
};

// Simple ArrowRight since it was missing in imports
const ArrowRight = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

export default FluxPortfolio;
