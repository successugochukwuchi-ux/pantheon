import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, getDocs, orderBy, Timestamp, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Search, 
  Users, 
  Trophy, 
  Clock,
  LayoutGrid,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Edit3,
  Save,
  X,
  PlusCircle,
  GripVertical,
  BookOpen,
  Video
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { NoteBuilder } from '../../components/NoteBuilder';

interface FluxStep {
  id: string;
  title: string;
  content: string; // JSON string from NoteBuilder
}

interface FluxTrack {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  estimatedHours: number;
  enrolledCount: number;
  completedCount: number;
  steps?: FluxStep[];
}

const FluxAdmin: React.FC = () => {
  const { user, profile } = useAuth();
  const [tracks, setTracks] = useState<FluxTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Editor State
  const [editingTrack, setEditingTrack] = useState<FluxTrack | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState<FluxTrack['difficulty']>('Beginner');
  const [editHours, setEditHours] = useState('5');
  const [editSteps, setEditSteps] = useState<FluxStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTracks();
    }
  }, [user]);

  const fetchTracks = async () => {
    try {
      const q = query(collection(db, 'flux_tracks'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedTracks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FluxTrack[];
      setTracks(fetchedTracks);
    } catch (error) {
      console.error('Error fetching flux tracks:', error);
      toast.error('Failed to load Skill Tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (track: FluxTrack) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditDescription(track.description);
    setEditCategory(track.category);
    setEditDifficulty(track.difficulty);
    setEditHours(track.estimatedHours.toString());
    setEditSteps(track.steps || []);
    setSelectedStepId(track.steps && track.steps.length > 0 ? track.steps[0].id : null);
    
    // Scroll to top of editor
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTrack(null);
    setSelectedStepId(null);
  };

  const handleSaveTrack = async () => {
    if (!profile || (profile.level !== '3' && profile.level !== '4')) {
      toast.error('Insufficient permissions');
      return;
    }

    if (!editTitle || !editDescription || !editCategory) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const trackData = {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        difficulty: editDifficulty,
        estimatedHours: parseInt(editHours),
        steps: editSteps,
        updatedAt: Timestamp.now()
      };

      if (editingTrack?.id) {
        await updateDoc(doc(db, 'flux_tracks', editingTrack.id), trackData);
        toast.success('Skill Track updated successfully!');
      } else {
        const newTrack = {
          ...trackData,
          enrolledCount: 0,
          completedCount: 0,
          authorId: profile.uid,
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'flux_tracks'), newTrack);
        toast.success('Skill Track created successfully!');
      }
      
      cancelEditing();
      fetchTracks();
    } catch (error) {
      console.error('Error saving track:', error);
      toast.error('Failed to save track');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this track? This cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'flux_tracks', id));
      toast.success('Track deleted');
      fetchTracks();
    } catch (error) {
      console.error('Error deleting track:', error);
      toast.error('Failed to delete track');
    }
  };

  const addStep = () => {
    const newStep: FluxStep = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Milestone',
      content: ''
    };
    setEditSteps([...editSteps, newStep]);
    setSelectedStepId(newStep.id);
  };

  const removeStep = (id: string) => {
    const newSteps = editSteps.filter(s => s.id !== id);
    setEditSteps(newSteps);
    if (selectedStepId === id) {
      setSelectedStepId(newSteps.length > 0 ? newSteps[0].id : null);
    }
  };

  const updateStepTitle = (id: string, title: string) => {
    setEditSteps(editSteps.map(s => s.id === id ? { ...s, title } : s));
  };

  const updateStepContent = (id: string, content: string) => {
    setEditSteps(editSteps.map(s => s.id === id ? { ...s, content } : s));
  };

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedStep = editSteps.find(s => s.id === selectedStepId);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500 rounded-lg">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Flux Engine Admin</h1>
          </div>
          <p className="text-stone-400 font-medium">Build, edit, and orchestrate the extracuricular Skill Tracks.</p>
        </div>

        {!editingTrack && (
          <Button 
            onClick={() => startEditing({
              id: '',
              title: '',
              description: '',
              category: '',
              difficulty: 'Beginner',
              estimatedHours: 5,
              enrolledCount: 0,
              completedCount: 0,
              steps: []
            })}
            className="bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl px-6"
          >
            <Plus className="mr-2 h-5 w-5" /> CREATE NEW TRACK
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {editingTrack ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-stone-900/80 border border-white/5 rounded-[2rem] p-8 backdrop-blur-md overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={cancelEditing}
                    className="text-stone-500 hover:text-white"
                  >
                    <X size={24} />
                  </Button>
                  <h2 className="text-2xl font-black italic tracking-tight">
                    {editingTrack.id ? 'EDITING TRACK' : 'DESIGNING NEW TRACK'}
                  </h2>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={cancelEditing}
                    className="border-white/10 hover:bg-white/5 font-bold"
                  >
                    DISCARD
                  </Button>
                  <Button 
                    onClick={handleSaveTrack}
                    disabled={isSubmitting}
                    className="bg-pink-500 hover:bg-pink-600 text-white font-black px-8"
                  >
                    <Save className="mr-2 h-5 w-5" /> 
                    {isSubmitting ? 'SAVING...' : 'SAVE & DEPLOY'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Meta Data */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/5">
                    <h3 className="text-xs font-black uppercase text-pink-500 tracking-widest">General Info</h3>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">Track Title</label>
                      <Input 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Mastering Generative Art"
                        className="bg-stone-950/50 border-white/10 focus:border-pink-500/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">Category</label>
                      <Input 
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Creative Computing"
                        className="bg-stone-950/50 border-white/10 focus:border-pink-500/50 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-stone-500">Difficulty</label>
                        <select 
                          value={editDifficulty}
                          onChange={(e) => setEditDifficulty(e.target.value as any)}
                          className="w-full h-10 px-3 bg-stone-950/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500/50"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Elite">Elite</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-stone-500">Hours (Est.)</label>
                        <Input 
                          type="number"
                          value={editHours}
                          onChange={(e) => setEditHours(e.target.value)}
                          className="bg-stone-950/50 border-white/10 focus:border-pink-500/50 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">Narrative Description</label>
                      <Textarea 
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="What makes this track special?"
                        className="bg-stone-950/50 border-white/10 focus:border-pink-500/50 transition-colors min-h-[120px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-pink-500 tracking-widest">Milestones</h3>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={addStep}
                        className="text-[10px] font-black uppercase text-stone-400 hover:text-pink-500"
                      >
                        <PlusCircle className="mr-1 h-3 w-3" /> ADD STEP
                      </Button>
                    </div>

                    <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                      {editSteps.length === 0 && (
                        <div className="bg-white/5 border border-dashed border-stone-800 rounded-xl p-8 text-center">
                          <p className="text-stone-600 text-xs font-bold italic">No steps yet. Add your first milestone.</p>
                        </div>
                      )}
                      {editSteps.map((step, index) => (
                        <div 
                          key={step.id} 
                          onClick={() => setSelectedStepId(step.id)}
                          className={cn(
                            "group p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3",
                            selectedStepId === step.id 
                              ? "bg-pink-500/10 border-pink-500/30 ring-1 ring-pink-500/30" 
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black",
                            selectedStepId === step.id ? "bg-pink-500 text-white" : "bg-stone-800 text-stone-500"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <input 
                              value={step.title}
                              onChange={(e) => updateStepTitle(step.id, e.target.value)}
                              className="w-full bg-transparent border-none p-0 text-xs font-bold text-stone-300 focus:outline-none"
                              placeholder="Step title..."
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                            className="h-6 w-6 text-stone-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Content Editor */}
                <div className="lg:col-span-2">
                  <div className="bg-stone-950/50 border border-white/5 rounded-3xl h-full flex flex-col overflow-hidden">
                    {selectedStep ? (
                      <>
                        <div className="p-6 border-b border-white/5 bg-white/5">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-xs font-black uppercase text-pink-500 tracking-widest">Milestone Content</h3>
                            <p className="text-stone-500 text-[10px] font-medium uppercase tracking-[0.2em]">{selectedStep.title}</p>
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden p-1">
                          <NoteBuilder 
                            key={selectedStep.id}
                            initialContent={selectedStep.content}
                            onChange={(content) => updateStepContent(selectedStep.id, content)}
                            mode="edit"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-stone-800">
                          <BookOpen size={40} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-lg font-black tracking-tight">Select a Milestone</h4>
                          <p className="text-stone-500 text-sm font-medium">Click on a step in the sidebar to design its curriculum.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2 italic">
                <TrendingUp className="text-pink-500" size={20} />
                Live Skill Tracks
                <Badge variant="outline" className="ml-2 border-stone-800 text-stone-500">
                  {tracks.length}
                </Badge>
              </h2>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
                <Input 
                  placeholder="Search architecture..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-stone-900 border-white/5 text-white rounded-xl focus:border-pink-500/50"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-32">
                <Zap className="animate-pulse text-pink-500 w-16 h-16 fill-pink-500" />
              </div>
            ) : filteredTracks.length === 0 ? (
              <div className="text-center py-32 bg-stone-900/20 rounded-[3rem] border border-dashed border-stone-800">
                <LayoutGrid size={48} className="mx-auto text-stone-800 mb-6" />
                <p className="text-stone-500 font-black uppercase tracking-widest text-xs">Deployment void detected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredTracks.map((track) => (
                    <motion.div
                      key={track.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card className="bg-stone-900 border-white/5 hover:border-pink-500/30 transition-all group overflow-hidden rounded-[2rem] relative">
                         <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap className="w-16 h-16 text-pink-500 fill-pink-500" />
                         </div>
                         
                         <CardHeader className="p-6 pb-2">
                           <div className="flex justify-between items-start mb-2">
                              <Badge variant="outline" className="bg-white/5 border-white/5 text-[9px] uppercase font-black tracking-wider text-pink-500">
                                {track.category}
                              </Badge>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => startEditing(track)}
                                  className="text-stone-600 hover:text-white hover:bg-white/5 h-8 w-8"
                                >
                                  <Edit3 size={14} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleDeleteTrack(track.id)}
                                  className="text-stone-600 hover:text-red-500 hover:bg-red-500/10 h-8 w-8"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                           </div>
                           <h3 className="text-lg font-black tracking-tight leading-tight mb-2 uppercase">{track.title}</h3>
                           <div className="flex gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-[9px] font-black uppercase tracking-wider ${
                                  track.difficulty === 'Beginner' ? 'text-green-500 border-green-500/20 bg-green-500/5' :
                                  track.difficulty === 'Intermediate' ? 'text-blue-500 border-blue-500/20 bg-blue-500/5' :
                                  track.difficulty === 'Advanced' ? 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5' :
                                  'text-red-500 border-red-500/20 bg-red-500/5'
                                }`}
                              >
                                {track.difficulty}
                              </Badge>
                              <Badge variant="outline" className="bg-stone-800/50 border-white/5 text-[9px] font-black uppercase tracking-wider text-stone-400">
                                {track.steps?.length || 0} STEPS
                              </Badge>
                           </div>
                         </CardHeader>

                         <CardContent className="p-6">
                           <p className="text-stone-500 text-xs font-medium line-clamp-3 mb-6 min-h-[45px]">
                             {track.description}
                           </p>
                           
                           <div className="flex items-center justify-between text-stone-600 text-[10px] font-black uppercase tracking-tighter border-t border-white/5 pt-4">
                             <div className="flex items-center gap-1.5">
                               <Users size={12} className="text-pink-500" />
                               {track.enrolledCount || 0} Learners
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Clock size={12} className="text-pink-500" />
                               {track.estimatedHours} Hours
                             </div>
                           </div>
                         </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FluxAdmin;
