import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, getDocs, orderBy, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
  LayoutGrid,
  ChevronRight,
  TrendingUp,
  Edit3,
  Save,
  X,
  PlusCircle,
  BookOpen,
  Video,
  FileText,
  Check,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../../components/ui/badge';
import { NoteBuilder } from '../../components/NoteBuilder';
import { cn } from '../../lib/utils';

interface FluxMilestone {
  id: string;
  title: string;
  type: 'video' | 'note';
  videoUrl?: string;
  noteContent?: string;
  hasTest: boolean;
  testContent?: string; // PLX Format
}

interface FluxModule {
  id: string;
  title: string;
  milestones: FluxMilestone[];
  exam?: {
    id: string;
    title: string;
    content: string; // PLX Format
  };
}

interface FluxTrack {
  id: string;
  title: string;
  description: string;
  category: string;
  enrolledCount: number;
  completedCount: number;
  modules: FluxModule[];
  published: boolean;
}

const PLX_QUESTION_TEMPLATE = `<PLX>
  <QUES ="q1">
    Write your multiple-choice question here?
    <COR ="Correct answer option content">
    <INC ="Incorrect option choice 1">
    <INC ="Incorrect option choice 2">
    <INC ="Incorrect option choice 3">
    <EXP ="Provide a clear explanation of why the correct choice is right.">
  </QUES>
</PLX>`;

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
  const [editModules, setEditModules] = useState<FluxModule[]>([]);
  const [editPublished, setEditPublished] = useState(false);

  // Selection state for navigation during editing
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [selectedExamModuleId, setSelectedExamModuleId] = useState<string | null>(null);

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
      toast.error('Failed to load CoLearn Flux Tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (track: FluxTrack) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditDescription(track.description);
    setEditCategory(track.category);
    setEditModules(track.modules || []);
    setEditPublished(track.published ?? false);

    // Default select
    setSelectedModuleId(null);
    setSelectedMilestoneId(null);
    setSelectedExamModuleId(null);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTrack(null);
    setSelectedModuleId(null);
    setSelectedMilestoneId(null);
    setSelectedExamModuleId(null);
  };

  const addModule = () => {
    const newModuleId = Math.random().toString(36).substr(2, 9);
    const newModule: FluxModule = {
      id: newModuleId,
      title: 'New Module',
      milestones: [],
      exam: {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Module Exam',
        content: PLX_QUESTION_TEMPLATE
      }
    };
    setEditModules([...editModules, newModule]);
    setSelectedModuleId(newModuleId);
    setSelectedMilestoneId(null);
    setSelectedExamModuleId(null);
    toast.success('Module added! Do not forget to design the concluding exam.');
  };

  const removeModule = (mId: string) => {
    if (!window.confirm('Delete this module and all its milestones?')) return;
    setEditModules(editModules.filter(m => m.id !== mId));
    if (selectedModuleId === mId || selectedExamModuleId === mId) {
      setSelectedModuleId(null);
      setSelectedExamModuleId(null);
    }
  };

  const updateModuleTitle = (mId: string, title: string) => {
    setEditModules(editModules.map(m => m.id === mId ? { ...m, title } : m));
  };

  const addMilestone = (mId: string) => {
    const newMilestoneId = Math.random().toString(36).substr(2, 9);
    const newMilestone: FluxMilestone = {
      id: newMilestoneId,
      title: 'New Milestone',
      type: 'note',
      noteContent: '',
      hasTest: false,
      testContent: PLX_QUESTION_TEMPLATE
    };

    setEditModules(editModules.map(m => {
      if (m.id === mId) {
        return {
          ...m,
          milestones: [...m.milestones, newMilestone]
        };
      }
      return m;
    }));

    setSelectedModuleId(mId);
    setSelectedMilestoneId(newMilestoneId);
    setSelectedExamModuleId(null);
  };

  const removeMilestone = (mId: string, milestoneId: string) => {
    setEditModules(editModules.map(m => {
      if (m.id === mId) {
        return {
          ...m,
          milestones: m.milestones.filter(sm => sm.id !== milestoneId)
        };
      }
      return m;
    }));
    if (selectedMilestoneId === milestoneId) {
      setSelectedMilestoneId(null);
    }
  };

  const updateMilestone = (mId: string, milestoneId: string, fields: Partial<FluxMilestone>) => {
    setEditModules(editModules.map(m => {
      if (m.id === mId) {
        return {
          ...m,
          milestones: m.milestones.map(sm => sm.id === milestoneId ? { ...sm, ...fields } : sm)
        };
      }
      return m;
    }));
  };

  const updateModuleExamContent = (mId: string, examContent: string) => {
    setEditModules(editModules.map(m => {
      if (m.id === mId) {
        return {
          ...m,
          exam: m.exam ? { ...m.exam, content: examContent } : { id: Math.random().toString(36).substr(2, 9), title: 'Module Exam', content: examContent }
        };
      }
      return m;
    }));
  };

  const handleSaveTrack = async () => {
    if (!profile || (profile.level !== '3' && profile.level !== '4')) {
      toast.error('Insufficient permissions');
      return;
    }

    if (!editTitle || !editDescription || !editCategory) {
      toast.error('Please fill all required general fields');
      return;
    }

    if (editModules.length === 0) {
      toast.error('A Skill Track must have at least one module');
      return;
    }

    // Strictly check concluding module exam rule
    for (const mod of editModules) {
      const examContent = mod.exam?.content?.trim() || '';
      // We look for QUES block inside. If none or just template unchanged
      const hasQues = examContent.includes('<QUES') && examContent.includes('</QUES>');
      if (!hasQues) {
        toast.error(`Module "${mod.title}" must have a conclude exam questionnaire configured containing at least one valid question block (<QUES> format) before saving or publishing!`);
        setSelectedExamModuleId(mod.id);
        setSelectedModuleId(null);
        setSelectedMilestoneId(null);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const trackData = {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        modules: editModules,
        published: editPublished,
        updatedAt: Timestamp.now()
      };

      if (editingTrack?.id) {
        await updateDoc(doc(db, 'flux_tracks', editingTrack.id), trackData);
        toast.success('CoLearn Flux Track updated successfully!');
      } else {
        const newTrack = {
          ...trackData,
          enrolledCount: 0,
          completedCount: 0,
          authorId: profile.uid,
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'flux_tracks'), newTrack);
        toast.success('CoLearn Flux Track created successfully!');
      }
      
      cancelEditing();
      fetchTracks();
    } catch (error) {
      console.error('Error saving track:', error);
      toast.error('Failed to save CoLearn Flux Track');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this track? This cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'flux_tracks', id));
      toast.success('Track deleted from ecosystem');
      fetchTracks();
    } catch (error) {
      console.error('Error deleting track:', error);
      toast.error('Failed to delete track');
    }
  };

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500 rounded-lg">
              <Zap className="text-white w-6 h-6 fill-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">CoLearn Flux Admin</h1>
          </div>
          <p className="text-stone-400 font-medium">Build, orchestrate, and audit the academic skill-acceleration Tracks.</p>
        </div>

        {!editingTrack && (
          <Button 
            onClick={() => startEditing({
              id: '',
              title: '',
              description: '',
              category: 'Creative Computing',
              enrolledCount: 0,
              completedCount: 0,
              modules: [],
              published: false
            })}
            className="bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl px-6"
          >
            <Plus className="mr-2 h-5 w-5" /> CREATE NEW FLUX TRACK
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={cancelEditing}
                    className="text-stone-500 hover:text-white"
                  >
                    <X size={24} />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tight text-white">
                      {editingTrack.id ? 'EDITING FLUX TRACK' : 'DESIGNING NEW FLUX TRACK'}
                    </h2>
                    <p className="text-[10px] uppercase font-black text-pink-500 tracking-widest mt-0.5">Hierarchy: Track ➔ Module ➔ Milestone ➔ Note/Video</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2 bg-stone-950/60 px-4 py-2 rounded-xl border border-white/5 mr-2">
                    <input 
                      type="checkbox" 
                      id="publish-check"
                      checked={editPublished}
                      onChange={(e) => setEditPublished(e.target.checked)}
                      className="accent-pink-500" 
                    />
                    <label htmlFor="publish-check" className="text-xs font-black uppercase text-stone-300 cursor-pointer">Published to Ecosystem</label>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={cancelEditing}
                    className="border-white/10 hover:bg-white/5 font-bold text-white bg-stone-900"
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

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Structural Navigation & Left Menu */}
                <div className="xl:col-span-1 space-y-6">
                  {/* General Track info */}
                  <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/5">
                    <h3 className="text-xs font-black uppercase text-pink-500 tracking-widest flex items-center justify-between">
                      <span>General Info</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedModuleId(null);
                          setSelectedMilestoneId(null);
                          setSelectedExamModuleId(null);
                        }}
                        className="text-[9px] h-6 px-2 text-stone-400 hover:text-white"
                      >
                        FOCUS
                      </Button>
                    </h3>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">Track Title</label>
                      <Input 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Mastering Machine learning"
                        className="bg-stone-950/50 border-white/10 text-white focus:border-pink-500/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">Category / Skill Cluster</label>
                      <Input 
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Artificial Intelligence"
                        className="bg-stone-950/50 border-white/10 text-white focus:border-pink-500/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-500">About/Narrative</label>
                      <Textarea 
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Narrative about outcomes and targets for this skill track..."
                        className="bg-stone-950/50 border-white/10 text-white focus:border-pink-500/50 transition-colors min-h-[90px]"
                      />
                    </div>
                  </div>

                  {/* Modules list & adding */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-pink-500 tracking-widest">Modules & Curriculums</h3>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={addModule}
                        className="text-[10px] font-black uppercase text-stone-400 hover:text-pink-500 h-8 hover:bg-white/5"
                      >
                        <PlusCircle className="mr-1 h-3.5 w-3.5" /> ADD MODULE
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {editModules.length === 0 && (
                        <div className="bg-white/5 border border-dashed border-stone-800 rounded-2xl p-8 text-center text-stone-500">
                          <AlertTriangle className="mx-auto mb-2 opacity-40 text-yellow-500" size={24} />
                          <p className="text-stone-500 text-xs font-bold italic">No modules created. Click ADD MODULE above to start!</p>
                        </div>
                      )}

                      {editModules.map((module, mIdx) => {
                        const isExamMissing = !module.exam?.content?.includes('<QUES');
                        return (
                          <div 
                            key={module.id}
                            className={cn(
                              "bg-stone-950/40 p-4 rounded-2xl border transition-all",
                              selectedModuleId === module.id || selectedExamModuleId === module.id
                                ? "border-pink-500/20 bg-pink-500/5" 
                                : "border-white/5 hover:border-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[10px] font-black uppercase text-pink-500 bg-pink-500/10 px-1.5 py-0.5 rounded">
                                  M{mIdx + 1}
                                </span>
                                <input 
                                  value={module.title}
                                  onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                                  className="bg-transparent border-none p-0 text-xs font-black text-white focus:outline-none focus:ring-0 w-full"
                                  placeholder="Module title..."
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeModule(module.id)}
                                  className="h-6 w-6 text-stone-500 hover:text-red-500 rounded"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>

                            {/* Milestones in this Module */}
                            <div className="space-y-1.5 mt-3 pl-2 border-l border-white/5">
                              {module.milestones.map((milestone, milIdx) => {
                                const isSelected = selectedMilestoneId === milestone.id;
                                return (
                                  <button
                                    key={milestone.id}
                                    onClick={() => {
                                      setSelectedModuleId(module.id);
                                      setSelectedMilestoneId(milestone.id);
                                      setSelectedExamModuleId(null);
                                    }}
                                    className={cn(
                                      "w-full text-left p-2 rounded-lg text-[11px] font-bold uppercase transition-colors flex items-center justify-between gap-2",
                                      isSelected
                                        ? "bg-pink-500 text-white"
                                        : "bg-white/5 hover:bg-white/10 text-stone-400 hover:text-stone-300"
                                    )}
                                  >
                                    <span className="flex items-center gap-1.5 truncate">
                                      {milestone.type === 'video' ? <Video size={10} /> : <BookOpen size={10} />}
                                      Step {milIdx + 1}: {milestone.title}
                                    </span>
                                    {milestone.hasTest && (
                                      <Badge className="bg-amber-500 text-black text-[8px] font-black px-1 leading-none rounded">Q</Badge>
                                    )}
                                  </button>
                                );
                              })}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addMilestone(module.id)}
                                className="w-full text-left justify-start text-[10px] font-bold uppercase tracking-wider text-stone-500 group focus:outline-none hover:bg-transparent hover:text-pink-500 h-6 px-1"
                              >
                                <Plus size={10} className="mr-1 group-hover:scale-125 transition-transform" /> Add Step
                              </Button>
                            </div>

                            {/* Required Exam ending for module */}
                            <div className="mt-4 border-t border-white/5 pt-2">
                              <button
                                onClick={() => {
                                  setSelectedModuleId(null);
                                  setSelectedMilestoneId(null);
                                  setSelectedExamModuleId(module.id);
                                }}
                                className={cn(
                                  "w-full text-left p-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-between border",
                                  selectedExamModuleId === module.id
                                    ? "bg-pink-500 text-white border-pink-500"
                                    : isExamMissing
                                      ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                                )}
                              >
                                <span className="flex items-center gap-1.5">
                                  <FileText size={12} />
                                  Module Exam
                                </span>
                                {isExamMissing ? (
                                  <span className="text-[8px] tracking-normal px-1 py-0.5 rounded bg-red-500 text-white font-bold blink">REQUIRED</span>
                                ) : (
                                  <span className="text-[8px] tracking-normal px-1 py-0.5 rounded bg-emerald-500 text-white font-bold">READY</span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Left/Right Editor Workspace */}
                <div className="xl:col-span-2">
                  <div className="bg-stone-950/50 border border-white/5 rounded-3xl min-h-[600px] flex flex-col overflow-hidden">
                    {selectedExamModuleId ? (
                      /* Module Exam PLX editing workspace */
                      (() => {
                        const moduleObj = editModules.find(m => m.id === selectedExamModuleId);
                        if (!moduleObj) return null;
                        return (
                          <div className="p-6 flex flex-col h-full space-y-6">
                            <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-pink-500 text-white font-black">MODULE EXAM</Badge>
                                <span className="text-stone-400 text-xs font-bold uppercase">{moduleObj.title}</span>
                              </div>
                              <h3 className="text-xl font-black uppercase text-white mt-2">Design Module Concluding Questionnaire</h3>
                              <p className="text-stone-500 text-xs">A module must be ended with a module exam. Use valid CoLearn PLX format with multiple questionnaire blocks.</p>
                            </div>

                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase text-stone-400">Exam Questions (PLX Format Textarea)</label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateModuleExamContent(moduleObj.id, PLX_QUESTION_TEMPLATE)}
                                  className="bg-white/5 hover:bg-pink-500/20 text-[10px] text-stone-300 hover:text-white uppercase font-bold h-7"
                                >
                                  Paste PLX Template Code
                                </Button>
                              </div>

                              <Textarea 
                                value={moduleObj.exam?.content || ''}
                                onChange={(e) => updateModuleExamContent(moduleObj.id, e.target.value)}
                                placeholder="Write <PLX><QUES...>...</QUES></PLX> here"
                                className="bg-stone-900 border-white/10 font-mono text-xs whitespace-pre text-yellow-100 min-h-[350px] focus:border-pink-500"
                              />

                              <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-stone-400 text-[11px] space-y-1">
                                <p className="font-black text-amber-500 uppercase flex items-center gap-1">
                                  <AlertTriangle size={12} /> Remember CoLearn Question Syntax:
                                </p>
                                <p>Combine multiple questions inside a <code className="text-pink-400 font-mono">&lt;PLX&gt;</code> container tag. Each question is coded inside <code className="text-pink-400 font-mono">&lt;QUES&gt;</code> containing exactly one <code className="text-pink-400 font-mono">&lt;COR ="Correct text"&gt;</code> and up to three <code className="text-pink-400 font-mono">&lt;INC ="Incorrect text"&gt;</code> elements.</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : selectedMilestoneId ? (
                      /* Individual Milestone editing workspace */
                      (() => {
                        const moduleObj = editModules.find(m => m.id === selectedModuleId);
                        const milestoneObj = moduleObj?.milestones.find(sm => sm.id === selectedMilestoneId);
                        if (!moduleObj || !milestoneObj) return null;
                        
                        return (
                          <div className="p-6 flex flex-col h-full space-y-6">
                            <div className="border-b border-white/5 pb-4 flex justify-between items-start gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-500 text-white font-black uppercase">MILESTONE STEP</Badge>
                                  <span className="text-stone-400 text-xs font-bold uppercase">{moduleObj.title}</span>
                                </div>
                                <h3 className="text-xl font-black uppercase text-white mt-1">Configure Course Milestone</h3>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeMilestone(moduleObj.id, milestoneObj.id)}
                                className="text-red-500 hover:text-white hover:bg-red-500/10 text-xs font-black uppercase"
                              >
                                <Trash2 className="mr-1 w-3 h-3" /> DELETE STEP
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-500">Step Title</label>
                                <Input 
                                  value={milestoneObj.title}
                                  onChange={(e) => updateMilestone(moduleObj.id, milestoneObj.id, { title: e.target.value })}
                                  className="bg-stone-900 border-white/10"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-500">Milestone Type</label>
                                <select
                                  value={milestoneObj.type}
                                  onChange={(e) => updateMilestone(moduleObj.id, milestoneObj.id, { type: e.target.value as any })}
                                  className="w-full h-10 px-3 bg-stone-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
                                >
                                  <option value="note">Written Lecture Note</option>
                                  <option value="video">Interactive Videolink</option>
                                </select>
                              </div>
                            </div>

                            {/* Test after milestone selection toggle */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                              <div>
                                <h4 className="text-xs font-black uppercase text-white">Append Concept Check Quiz?</h4>
                                <p className="text-[10px] text-stone-500 font-medium">Should the student satisfy a practice test questionnaire before clearing this step?</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateMilestone(moduleObj.id, milestoneObj.id, { hasTest: true })}
                                  className={cn(
                                    "font-black text-xs rounded-lg px-4 h-8",
                                    milestoneObj.hasTest ? "bg-amber-500 text-black" : "bg-stone-850 hover:bg-stone-800 text-stone-400"
                                  )}
                                >
                                  YES
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => updateMilestone(moduleObj.id, milestoneObj.id, { hasTest: false })}
                                  className={cn(
                                    "font-black text-xs rounded-lg px-4 h-8",
                                    !milestoneObj.hasTest ? "bg-stone-300 text-black" : "bg-stone-850 hover:bg-stone-800 text-stone-400"
                                  )}
                                >
                                  NO
                                </Button>
                              </div>
                            </div>

                            {/* Conditionally reveal based on Milestone Type */}
                            {milestoneObj.type === 'video' ? (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-stone-500">YouTube or Google Drive Direct Link (Video URL)</label>
                                <Input 
                                  value={milestoneObj.videoUrl || ''}
                                  onChange={(e) => updateMilestone(moduleObj.id, milestoneObj.id, { videoUrl: e.target.value })}
                                  placeholder="https://www.youtube.com/watch?v=..."
                                  className="bg-stone-900 border-white/10 text-white"
                                />
                              </div>
                            ) : (
                              <div className="space-y-2 flex-grow flex flex-col min-h-[300px]">
                                <label className="text-[10px] font-black uppercase text-stone-500">Written Note Document Content (Rich Note Editor)</label>
                                <div className="border border-white/10 rounded-2xl flex-grow overflow-hidden bg-stone-950 p-1 min-h-[250px]">
                                  <NoteBuilder 
                                    key={milestoneObj.id + '_note'}
                                    initialContent={milestoneObj.noteContent || ''}
                                    onChange={(content) => updateMilestone(moduleObj.id, milestoneObj.id, { noteContent: content })}
                                    mode="edit"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Conditionally reveal the Concept test questions area if hasTest is true */}
                            {milestoneObj.hasTest && (
                              <div className="space-y-4 border-t border-white/5 pt-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <label className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Concept Check Quiz Questions (PLX questionnaire format)</label>
                                    <p className="text-[9px] text-stone-500">Enter multiple choice questions to solve right after the milestone content.</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateMilestone(moduleObj.id, milestoneObj.id, { testContent: PLX_QUESTION_TEMPLATE })}
                                    className="bg-white/5 hover:bg-amber-500 hover:text-black text-[9px] height-6 uppercase px-2"
                                  >
                                    Paste Quiz Template Code
                                  </Button>
                                </div>

                                <Textarea 
                                  value={milestoneObj.testContent || ''}
                                  onChange={(e) => updateMilestone(moduleObj.id, milestoneObj.id, { testContent: e.target.value })}
                                  placeholder="Enter quiz questions <PLX>..."
                                  className="bg-stone-900 border-white/10 font-mono text-xs text-amber-100 min-h-[200px]"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      /* Welcome instructions workspace when nothing specific is chosen */
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto space-y-6">
                        <div className="p-4 bg-pink-500/10 border border-pink-500/20 text-pink-500 rounded-3xl">
                          <Zap size={36} className="fill-pink-500/20" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xl font-black uppercase tracking-tight text-white">Flux Curriculum Creator</h4>
                          <p className="text-stone-400 font-medium text-sm leading-relaxed">
                            Welcome to the next-generation Track workspace. Create curriculum items in order, design custom interactive checks, and concluding examinations!
                          </p>
                        </div>
                        <div className="w-full bg-white/5 p-4 rounded-2xl border border-white/5 text-left text-xs text-stone-500 space-y-2 font-medium">
                          <p className="font-black uppercase text-pink-500 text-[10px] tracking-wide mb-1 flex items-center gap-1">
                            <Check size={12} /> Designing Steps Checklist:
                          </p>
                          <p>1. Type general Title and Narrative Category.</p>
                          <p>2. Create Modules to structure your training path.</p>
                          <p>3. Append Video or Note milestones within modules.</p>
                          <p>4. Conclude each Module: Configure a Module exam questionnaire before launching!</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* List of live skill tracks in system */
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black flex items-center gap-2 italic uppercase text-white">
                <TrendingUp className="text-pink-500" size={20} />
                Ecosystem Skill Tracks
                <Badge variant="outline" className="ml-2 border-stone-800 bg-stone-900 text-stone-400 font-black">
                  {tracks.length} LIVE
                </Badge>
              </h2>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
                <Input 
                  placeholder="Search live tracks..." 
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
                <p className="text-stone-500 font-black uppercase tracking-widest text-xs">No active skill tracks here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredTracks.map((track) => {
                    const totalMilestonesCount = (track.modules || []).reduce((sum, m) => sum + (m.milestones?.length || 0), 0);
                    return (
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
                            <div className="flex justify-between items-start mb-2 gap-2">
                              <div className="flex gap-1">
                                <Badge variant="outline" className="bg-white/5 border-white/5 text-[9px] uppercase font-black tracking-wider text-pink-500">
                                  {track.category}
                                </Badge>
                                {track.published ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase">LIVE</Badge>
                                ) : (
                                  <Badge className="bg-stone-800 text-stone-400 text-[9px] font-black uppercase">DRAFT</Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => startEditing(track)}
                                  className="text-stone-400 hover:text-white hover:bg-white/5 h-8 w-8"
                                >
                                  <Edit3 size={14} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleDeleteTrack(track.id)}
                                  className="text-stone-500 hover:text-red-500 hover:bg-red-500/10 h-8 w-8"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                            <h3 className="text-lg font-black tracking-tight leading-tight mb-2 uppercase text-white">{track.title}</h3>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="bg-stone-800/50 border-white/5 text-[9px] font-black uppercase tracking-wider text-amber-400">
                                {track.modules?.length || 0} MODULES
                              </Badge>
                              <Badge variant="outline" className="bg-stone-800/50 border-white/5 text-[9px] font-black uppercase tracking-wider text-stone-400">
                                {totalMilestonesCount} STEPS
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="p-6 pt-2">
                            <p className="text-stone-500 text-xs font-medium line-clamp-3 mb-6 min-h-[45px]">
                              {track.description}
                            </p>
                            
                            <div className="flex items-center justify-between text-stone-600 text-[10px] font-black uppercase tracking-tighter border-t border-white/5 pt-4">
                              <div className="flex items-center gap-1.5">
                                <Users size={12} className="text-pink-500" />
                                {track.enrolledCount || 0} Enrolled Students
                              </div>
                              <div className="flex items-center gap-1.5 font-bold text-[9px]">
                                ID: {track.id.substring(0, 8)}...
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FluxAdmin;
