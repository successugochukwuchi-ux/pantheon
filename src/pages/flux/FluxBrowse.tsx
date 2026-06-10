import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, Timestamp, setDoc, doc, getDoc, updateDoc, increment, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { 
  Search, 
  Users, 
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  Lock,
  LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';

interface FluxTrack {
  id: string;
  title: string;
  description: string;
  category: string;
  enrolledCount: number;
  modules?: {
    id: string;
    title: string;
    milestones: {
      id: string;
      title: string;
      type: 'video' | 'note';
    }[];
  }[];
}

const FluxBrowse: React.FC = () => {
  const { user, profile } = useAuth();
  const [tracks, setTracks] = useState<FluxTrack[]>([]);
  const [enrolledTrackIds, setEnrolledTrackIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch tracks
      const q = query(collection(db, 'flux_tracks'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedTracks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FluxTrack[];
      setTracks(fetchedTracks);

      // Fetch user enrollments
      if (user) {
        const enrollmentQuery = query(
          collection(db, 'flux_enrollments'),
          where('userId', '==', user.uid)
        );
        const enrolled = new Set<string>();
        const eSnapshot = await getDocs(enrollmentQuery);
        eSnapshot.forEach(doc => {
          enrolled.add(doc.data().trackId);
        });
        setEnrolledTrackIds(enrolled);
      }
    } catch (error) {
      console.error('Error fetching flux data:', error);
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (trackId: string) => {
    if (!user) return;
    
    try {
      const enrollmentId = `${user.uid}_${trackId}`;
      const enrollmentRef = doc(db, 'flux_enrollments', enrollmentId);
      
      const exists = await getDoc(enrollmentRef);
      if (exists.exists()) {
        toast.error('You are already enrolled in this track');
        return;
      }

      await setDoc(enrollmentRef, {
        userId: user.uid,
        trackId: trackId,
        status: 'enrolled',
        enrolledAt: Timestamp.now(),
        progress: 0
      });

      // Update enrollment count on track
      await updateDoc(doc(db, 'flux_tracks', trackId), {
        enrolledCount: increment(1)
      });

      setEnrolledTrackIds(prev => new Set(prev).add(trackId));
      toast.success('Successfully registered for Skill Track!');
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error('Could not join Skill Track');
    }
  };

  const categories = Array.from(new Set(tracks.map(t => t.category)));
  
  const filteredTracks = tracks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !activeCategory || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500 rounded-xl shadow-lg shadow-pink-500/20">
            <Zap className="text-white w-6 h-6 fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
              SKILL TRACKS
              <Badge className="bg-pink-500/10 text-pink-500 border-pink-500/20 px-3 py-1 font-black">BROWSER</Badge>
            </h1>
            <p className="text-stone-500 font-medium mt-1">Unlock next-gen abilities. Choose your path and start building.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
          <div className="lg:col-span-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={20} />
              <Input 
                placeholder="What do you want to master today?" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 bg-stone-900 border-white/5 text-lg rounded-2xl focus:ring-pink-500/50"
              />
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-stone-950 p-1.5 rounded-2xl flex items-center gap-1 border border-white/5 h-14 overflow-x-auto no-scrollbar">
              <Button
                variant={!activeCategory ? "default" : "ghost"}
                onClick={() => setActiveCategory(null)}
                className={!activeCategory ? "bg-stone-800 text-white hover:bg-stone-700" : "text-stone-500 hover:text-white"}
                size="sm"
              >
                All
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "ghost"}
                  onClick={() => setActiveCategory(cat)}
                  className={activeCategory === cat ? "bg-pink-500 text-white hover:bg-pink-600" : "text-stone-500 hover:text-white whitespace-nowrap"}
                  size="sm"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
          <Zap className="animate-pulse text-pink-500 w-16 h-16" />
          <p className="font-black tracking-widest text-stone-500 uppercase text-xs">Calibrating Ecosystem...</p>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="text-center py-32 bg-stone-900/20 rounded-[2rem] border border-dashed border-white/5">
          <LayoutGrid size={60} className="mx-auto text-stone-800 mb-6" />
          <h3 className="text-xl font-bold text-stone-600 mb-2">No tracks found in this category</h3>
          <p className="text-stone-700 max-w-sm mx-auto">Try broadening your search or choosing a different specialty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTracks.map((track, i) => {
              const isEnrolled = enrolledTrackIds.has(track.id);
              
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="bg-stone-900 border-white/5 hover:border-pink-500/30 transition-all duration-300 group rounded-[2rem] overflow-hidden flex flex-col h-full hvr-grow">
                    <div className="h-40 bg-gradient-to-br from-stone-800 to-stone-950 relative overflow-hidden">
                      <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-pink-500 text-white border-0 font-black tracking-tighter">
                          Skill Track
                        </Badge>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="w-16 h-16 text-white/5 group-hover:text-pink-500/20 group-hover:scale-110 transition-all duration-700" />
                      </div>
                      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-stone-400 border border-white/10 uppercase tracking-widest">
                        {track.category}
                      </div>
                    </div>

                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl font-black group-hover:text-pink-500 transition-colors leading-tight">
                        {track.title}
                      </CardTitle>
                      <CardDescription className="text-stone-500 font-medium line-clamp-2 mt-2 leading-relaxed">
                        {track.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto pt-4 border-t border-white/5 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Modules</span>
                          <div className="flex items-center gap-2 text-stone-300 font-bold text-xs">
                            <Sparkles size={14} className="text-pink-500" />
                            {track.modules?.length || 0} Modules
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Milestones</span>
                          <div className="flex items-center gap-2 text-stone-300 font-bold text-xs">
                            <Clock size={14} className="text-pink-500" />
                            {(track.modules || []).reduce((sum, m) => sum + (m.milestones?.length || 0), 0)} Milestones
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-stone-500">
                          <div className="flex -space-x-2">
                             {[1,2,3].map(j => (
                               <div key={j} className="w-6 h-6 rounded-full border-2 border-stone-900 bg-stone-800" />
                             ))}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider">{track.enrolledCount || 0} Learners</span>
                        </div>
                        
                        <Button 
                          onClick={() => handleEnroll(track.id)}
                          disabled={isEnrolled}
                          className={isEnrolled 
                            ? "bg-stone-800 text-stone-500 cursor-default border border-white/5" 
                            : "bg-pink-500 hover:bg-pink-600 text-white font-black px-6 rounded-xl shadow-lg shadow-pink-500/20 active:scale-95 transition-all"
                          }
                        >
                          {isEnrolled ? (
                            <span className="flex items-center gap-2">
                              <CheckCircle2 size={16} /> ENROLLED
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              JOIN TRACK <Zap size={16} fill="white" />
                            </span>
                          )}
                        </Button>
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

export default FluxBrowse;
