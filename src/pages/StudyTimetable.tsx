import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTitle } from '../hooks/useTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { 
  Calendar, 
  Grid, 
  Trash2, 
  Save, 
  Sparkles, 
  BookOpen, 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  Plus, 
  ArrowRight, 
  Check, 
  Info,
  Clock,
  Download,
  Upload,
  User,
  Coffee,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Course } from '../types';

// Predefined Days of the week
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute < 10 ? `0${minute}` : minute;
  return `${displayHour}:${displayMinute} ${ampm}`;
}

export function generateSlots(blockSize: '20min' | '30min' | '1hr') {
  const slots: { id: string; name: string; hour: number; minute: number }[] = [];
  const startHour = 8; // 08:00 AM
  const endHour = 22;  // 10:00 PM (up to 22:00)
  
  if (blockSize === '1hr') {
    for (let h = startHour; h < endHour; h++) {
      const startStr = formatTime(h, 0);
      const endStr = formatTime(h + 1, 0);
      slots.push({
        id: `slot_1h_${h}`,
        name: `${startStr} - ${endStr}`,
        hour: h,
        minute: 0
      });
    }
  } else if (blockSize === '30min') {
    for (let h = startHour; h < endHour; h++) {
      const startStr1 = formatTime(h, 0);
      const endStr1 = formatTime(h, 30);
      slots.push({
        id: `slot_30m_${h}_0`,
        name: `${startStr1} - ${endStr1}`,
        hour: h,
        minute: 0
      });
      const startStr2 = formatTime(h, 30);
      const endStr2 = formatTime(h + 1, 0);
      slots.push({
        id: `slot_30m_${h}_30`,
        name: `${startStr2} - ${endStr2}`,
        hour: h,
        minute: 30
      });
    }
  } else if (blockSize === '20min') {
    for (let h = startHour; h < endHour; h++) {
      slots.push({
        id: `slot_20m_${h}_0`,
        name: `${formatTime(h, 0)} - ${formatTime(h, 20)}`,
        hour: h,
        minute: 0
      });
      slots.push({
        id: `slot_20m_${h}_20`,
        name: `${formatTime(h, 20)} - ${formatTime(h, 40)}`,
        hour: h,
        minute: 20
      });
      slots.push({
        id: `slot_20m_${h}_40`,
        name: `${formatTime(h, 40)} - ${formatTime(h + 1, 0)}`,
        hour: h,
        minute: 40
      });
    }
  }
  return slots;
}

// Helper to represent empty timetable shape
const createEmptyTimetable = (blockSize: '20min' | '30min' | '1hr' = '1hr') => {
  const table: Record<string, Record<string, { code: string; title: string; isCustom?: boolean }>> = {};
  const slots = generateSlots(blockSize);
  DAYS.forEach(day => {
    table[day] = {};
    slots.forEach(slot => {
      table[day][slot.id] = { code: '', title: '' };
    });
  });
  return table;
};

export default function StudyTimetable() {
  useTitle('Study Timetable');
  const { profile, user, systemConfig } = useAuth();

  // Roles check
  const isAdmin = profile?.level === '3' || profile?.level === '4' || profile?.level === '5';

  // Spacing configurations
  const [blockSize, setBlockSize] = useState<'20min' | '30min' | '1hr'>('1hr');
  const [adminBlockSize, setAdminBlockSize] = useState<'20min' | '30min' | '1hr'>('1hr');

  // State
  const [timetable, setTimetable] = useState<Record<string, Record<string, { code: string; title: string; isCustom?: boolean }>>>(createEmptyTimetable('1hr'));
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab ] = useState('student'); // 'student' | 'admin'
  const [activeMobileDay, setActiveMobileDay] = useState('Monday');
  
  // Custom slots/tasks state
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskType, setCustomTaskType] = useState('Study'); // 'Study', 'Break', 'Research', 'Meal'
  
  // Selected course/task for "Tap to Place" mode
  const [selectedCourse, setSelectedCourse] = useState<{ code: string; title: string; isCustom?: boolean } | null>(null);

  // Admin configuration state for Recommended Timetable
  const [adminLevel, setAdminLevel] = useState('100');
  const [adminDept, setAdminDept] = useState('Computer Science');
  const [adminTimetable, setAdminTimetable] = useState<Record<string, Record<string, { code: string; title: string; isCustom?: boolean }>>>(createEmptyTimetable('1hr'));
  const [selectedAdminCourse, setSelectedAdminCourse] = useState<{ code: string; title: string; isCustom?: boolean } | null>(null);
  
  // Fetching status
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecommended, setHasRecommended] = useState(false);

  // Student details
  const studentLevel = profile?.academicLevel || (profile?.level ? `${profile.level}00` : '100');
  const studentDept = profile?.department || 'Computer Science';

  // Predefined custom activities
  const PRESET_ACTIVITIES = [
    { code: 'STUDY', title: 'Personal Study Block', type: 'Study', icon: BookOpen },
    { code: 'BREAK', title: 'Rest & Refreshment', type: 'Break', icon: Coffee },
    { code: 'RESEARCH', title: 'Research & Project Work', type: 'Research', icon: Sparkles },
    { code: 'REVISION', title: 'Past Question Revision', type: 'Revision', icon: Clock }
  ];

  // Load everything
  useEffect(() => {
    if (!profile || !user) return;
    
    setLoading(true);
    
    // 1. Fetch academic courses
    const semesterArg = systemConfig?.currentSemester || '1st';
    const coursesQuery = query(
      collection(db, 'courses'),
      where('semester', '==', semesterArg === 'none' ? '1st' : semesterArg)
    );

    getDocs(coursesQuery).then((snapshot) => {
      const allFetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      // Filter for student level & department + General courses
      const relevant = allFetched.filter(c => {
        const isSameLevel = String(c.level) === studentLevel;
        const isGeneral = !c.department || c.department.trim() === '' || c.department.toLowerCase() === 'general';
        const isSameDept = c.department?.toLowerCase() === studentDept.toLowerCase();
        return isSameLevel && (isGeneral || isSameDept);
      });
      setCourses(relevant);
    }).catch(err => {
      console.error("Error loading courses:", err);
      handleFirestoreError(err, OperationType.LIST, 'courses');
    });

    // 2. Fetch User's customized timetable
    const userTimetableRef = doc(db, 'timetables', user.uid);
    getDoc(userTimetableRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.blockSize) {
          setBlockSize(data.blockSize);
        }
        if (data.grid) {
          setTimetable(data.grid);
        }
      } else {
        // If no customized timetable, check if we has recommended one to load
        checkRecommendedAvailability();
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading user timetable:", err);
      handleFirestoreError(err, OperationType.GET, `timetables/${user.uid}`);
      setLoading(false);
    });

    const checkRecommendedAvailability = async () => {
      try {
        const recId = `${studentLevel}_${studentDept.replace(/\s+/g, '_')}`;
        const recRef = doc(db, 'recommended_timetables', recId);
        const recSnap = await getDoc(recRef);
        setHasRecommended(recSnap.exists());
      } catch (e) {
        console.error("Error checking recommended timetable:", e);
      }
    };

    checkRecommendedAvailability();

  }, [profile, user, systemConfig, studentLevel, studentDept]);

  // Load admin recommended timetable grid whenever target admin level or dept changes
  useEffect(() => {
    if (!isAdmin) return;
    
    const recId = `${adminLevel}_${adminDept.replace(/\s+/g, '_')}`;
    getDoc(doc(db, 'recommended_timetables', recId)).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.blockSize) {
          setAdminBlockSize(data.blockSize);
        } else {
          setAdminBlockSize('1hr');
        }
        if (data.grid) {
          setAdminTimetable(data.grid);
        } else {
          setAdminTimetable(createEmptyTimetable(data.blockSize || '1hr'));
        }
      } else {
        setAdminBlockSize('1hr');
        setAdminTimetable(createEmptyTimetable('1hr'));
      }
    }).catch(err => {
      console.error("Error loading admin recommended:", err);
      setAdminBlockSize('1hr');
      setAdminTimetable(createEmptyTimetable('1hr'));
    });

  }, [adminLevel, adminDept, isAdmin]);

  // --- HTML5 Drag & Drop handlers for student ---
  const handleDragStart = (e: React.DragEvent, item: { code: string; title: string; isCustom?: boolean }) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: string, slotId: string, isAdminGrid = false) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;
      
      const item = JSON.parse(rawData) as { code: string; title: string; isCustom?: boolean };
      
      if (isAdminGrid) {
        setAdminTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          updated[day][slotId] = { code: item.code, title: item.title, isCustom: item.isCustom || false };
          return updated;
        });
        toast.success(`Assigned ${item.code} to recommended timetable`);
      } else {
        setTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          updated[day][slotId] = { code: item.code, title: item.title, isCustom: item.isCustom || false };
          return updated;
        });
        toast.success(`Planned study block for ${item.code}`);
      }
    } catch (err) {
      console.error("Drop handling error:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // --- Click/Tap to place handlers (extremely robust, mobile friendly) ---
  const handleSelectCourse = (item: { code: string; title: string; isCustom?: boolean }, isAdminSelect = false) => {
    if (isAdminSelect) {
      if (selectedAdminCourse?.code === item.code) {
        setSelectedAdminCourse(null);
      } else {
        setSelectedAdminCourse(item);
        toast.info(`Selected ${item.code}. Click any slot in the designer below to place it.`);
      }
    } else {
      if (selectedCourse?.code === item.code) {
        setSelectedCourse(null);
      } else {
        setSelectedCourse(item);
        toast.info(`Selected ${item.code}. Click/tap any grid cell to paint/place it.`);
      }
    }
  };

  const handleCellClick = (day: string, slotId: string, isAdminGrid = false) => {
    if (isAdminGrid) {
      if (selectedAdminCourse) {
        setAdminTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          updated[day][slotId] = { 
            code: selectedAdminCourse.code, 
            title: selectedAdminCourse.title, 
            isCustom: selectedAdminCourse.isCustom || false 
          };
          return updated;
        });
      } else {
        // Clear cell if clicked with no selection
        setAdminTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          updated[day][slotId] = { code: '', title: '' };
          return updated;
        });
      }
    } else {
      if (selectedCourse) {
        setTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          updated[day][slotId] = { 
            code: selectedCourse.code, 
            title: selectedCourse.title, 
            isCustom: selectedCourse.isCustom || false 
          };
          return updated;
        });
      } else {
        // If clicking and nothing is selected, offer quick options or clear
        setTimetable(prev => {
          const updated = { ...prev };
          updated[day] = { ...updated[day] };
          if (updated[day][slotId].code !== '') {
            updated[day][slotId] = { code: '', title: '' };
            toast.info("Cleared study block");
          }
          return updated;
        });
      }
    }
  };

  const handleClearCell = (day: string, slotId: string, isAdminGrid = false) => {
    if (isAdminGrid) {
      setAdminTimetable(prev => {
        const updated = { ...prev };
        updated[day] = { ...updated[day] };
        updated[day][slotId] = { code: '', title: '' };
        return updated;
      });
    } else {
      setTimetable(prev => {
        const updated = { ...prev };
        updated[day] = { ...updated[day] };
        updated[day][slotId] = { code: '', title: '' };
        return updated;
      });
    }
  };

  const handleClearAll = (isAdminGrid = false) => {
    if (window.confirm("Are you sure you want to clear the entire timetable?")) {
      if (isAdminGrid) {
        setAdminTimetable(createEmptyTimetable(adminBlockSize));
      } else {
        setTimetable(createEmptyTimetable(blockSize));
      }
      toast.success("Timetable cleared");
    }
  };

  // Saved to cloud durably
  const handleSaveTimetable = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'timetables', user.uid), {
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        grid: timetable,
        blockSize: blockSize
      });
      toast.success("Study timetable saved successfully to your cloud profile!");
    } catch (err) {
      console.error("Save timetable error:", err);
      toast.error("Failed to save your timetable to cloud.");
      handleFirestoreError(err, OperationType.WRITE, `timetables/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Apply Recommended Timetable from cloud and overwrite
  const handleApplyRecommended = async () => {
    try {
      const recId = `${studentLevel}_${studentDept.replace(/\s+/g, '_')}`;
      const recRef = doc(db, 'recommended_timetables', recId);
      const recSnap = await getDoc(recRef);
      
      if (recSnap.exists()) {
        const data = recSnap.data();
        if (data.grid) {
          if (window.confirm("Applying the recommended timetable will overwrite your current draft. Do you wish to continue?")) {
            if (data.blockSize) {
              setBlockSize(data.blockSize);
            }
            setTimetable(data.grid);
            toast.success(`Successfully loaded Recommended Timetable for ${studentDept} (${studentLevel} Level)`);
          }
        } else {
          toast.error("The recommended template has an empty or corrupt layout.");
        }
      } else {
        toast.error(`No recommended timetable set up for ${studentDept} (${studentLevel} Level). Contact an admin!`);
      }
    } catch (e) {
      console.error("Error applying recommended timetable:", e);
      toast.error("Could not fetch the recommended timetable template.");
    }
  };

  // Save recommended timetable (Admin ONLY)
  const handleSaveRecommendedByAdmin = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const recId = `${adminLevel}_${adminDept.replace(/\s+/g, '_')}`;
      await setDoc(doc(db, 'recommended_timetables', recId), {
        level: adminLevel,
        department: adminDept,
        updatedBy: user?.email,
        updatedAt: new Date().toISOString(),
        grid: adminTimetable,
        blockSize: adminBlockSize
      });
      toast.success(`Recommended template published for ${adminDept} Level ${adminLevel}!`);
    } catch (err) {
      console.error("Failed to save recommended template:", err);
      toast.error("Cloud write failed.");
      handleFirestoreError(err, OperationType.WRITE, '/recommended_timetables');
    } finally {
      setIsSaving(false);
    }
  };

  // Add custom manual activity to our lists
  const handleAddCustomTask = () => {
    if (!customTaskName.trim()) {
      toast.error("Please specify a name/code for your custom activity!");
      return;
    }
    const slug = customTaskName.toUpperCase().replace(/\s+/g, '_').substring(0, 10);
    const item = {
      code: slug,
      title: `${customTaskType}: ${customTaskName}`,
      isCustom: true
    };
    setSelectedCourse(item);
    setCustomTaskName('');
    toast.success(`Created activity "${item.title}" & highlighted it! Select a cell in the table below to place it.`);
  };

  // Filter courses based on search
  const filteredCourses = courses.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse font-mono text-sm">Loading your custom & recommended study schedules...</p>
      </div>
    );
  }

  const currentUserSlots = generateSlots(blockSize);
  const adminSlots = generateSlots(adminBlockSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4">
      {/* Header section with description */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="text-primary h-8 w-8" />
            Study Timetable Planner
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up your weekly academic calendar. Drag or tap courses into desired study blocks to block study sessions.
          </p>
        </div>
        
        {/* Recommended action / Admin action buttons */}
        <div className="flex flex-wrap gap-2">
          {hasRecommended ? (
            <Button 
              id="apply-recommended-btn"
              onClick={handleApplyRecommended} 
              variant="outline" 
              className="border-primary/20 text-primary hover:bg-primary/10 gap-2 font-bold"
            >
              <Sparkles className="h-4 w-4 text-yellow-500 fill-yellow-500 animate-pulse" />
              Use Recommended Timetable
            </Button>
          ) : (
            <Button 
              variant="outline"
              disabled
              title="No template set up yet"
              className="opacity-50 gap-2 cursor-pointer"
            >
              <Info className="h-4 w-4" />
              Recommended Block Unavailable
            </Button>
          )}

          <Button 
            id="save-timetable-btn"
            onClick={handleSaveTimetable} 
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Draft to Cloud'}
          </Button>
        </div>
      </div>

      {hasRecommended && (
        <Alert className="border-emerald-500/20 bg-emerald-500/5">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800 font-bold">Recommended Timetable is Ready!</AlertTitle>
          <AlertDescription className="text-emerald-700 text-xs">
            An administrator has published a standard timetable template matching Level {studentLevel} & {studentDept}.
            Click on <strong>Use Recommended Timetable</strong> to instantly seed your planner, then tweak it.
          </AlertDescription>
        </Alert>
      )}

      {/* Admin tab switcher */}
      {isAdmin && (
        <div className="bg-muted p-1.5 rounded-xl border border-primary/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-3 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Privileged Controls
          </span>
          <div className="flex gap-1">
            <Button 
              variant={activeTab === 'student' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('student')}
              className="text-xs font-bold"
            >
              Student Mode
            </Button>
            <Button 
              variant={activeTab === 'admin' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('admin')}
              className="text-xs font-bold"
            >
              Recommended Timetable Designer
            </Button>
          </div>
        </div>
      )}

      {/* MAIN VIEW: STUDENT WORKSPACE */}
      {activeTab === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* LEFT COLUMN: AVAILABLE COURSE SELECTOR & TOOLS */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* 1. Mapped info */}
            <Card className="border-primary/10 bg-primary/5">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Academic Target</CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-4 pb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Level:</span>
                  <span className="font-bold">{studentLevel} Level</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dept:</span>
                  <span className="font-bold truncate max-w-[120px]" title={studentDept}>{studentDept}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Semester:</span>
                  <span className="font-bold">{systemConfig?.currentSemester || '1st'}</span>
                </div>
              </CardContent>
            </Card>

            {/* 1.5 preferred block size select */}
            <Card className="border-secondary shadow-sm">
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Study Block Size
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">
                  Choose your preferred study block size. Options are 20min, 30min, 1hr.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <Select 
                  value={blockSize} 
                  onValueChange={(val: '20min' | '30min' | '1hr') => {
                    if (window.confirm("Changing the study block size will automatically clear your current timetable grid to adapt to the new spacing. Do you want to proceed?")) {
                      setBlockSize(val);
                      setTimetable(createEmptyTimetable(val));
                    }
                  }}
                >
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder="Select Block Spacing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20min">20 Minutes</SelectItem>
                    <SelectItem value="30min">30 Minutes</SelectItem>
                    <SelectItem value="1hr">1 Hour</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 2. Interactive brush selector instruction */}
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-3 text-xs text-amber-900 flex gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Smart Interaction Tool</span>
                  Select a Course on the list below, then tap any slot in the Timetable to place it. Clear slots with the <Trash2 className="inline h-3.5 w-3.5 mx-0.5 text-muted-foreground" /> button.
                </div>
              </CardContent>
            </Card>

            {/* 3. Available Courses list */}
            <Card className="border-secondary shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  Available Courses
                  <Badge variant="secondary">{filteredCourses.length}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">Drag courses or select them for easy paint-deposition</CardDescription>
                
                {/* Search query */}
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search courses..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0 max-h-[220px] overflow-y-auto custom-scrollbar space-y-1">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map((course) => {
                    const isSelected = selectedCourse?.code === course.code;
                    return (
                      <div
                        key={course.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, { code: course.code, title: course.title })}
                        onClick={() => handleSelectCourse({ code: course.code, title: course.title })}
                        className={`p-2 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all ${
                          isSelected 
                            ? 'bg-primary/20 border-primary shadow-sm text-primary ring-2 ring-primary/30 font-bold scale-[1.01]' 
                            : 'bg-card border-border hover:bg-accent/50 hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-mono">{course.code}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">Course</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{course.title}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-4 italic">No courses fit your criteria.</p>
                )}
              </CardContent>
            </Card>

            {/* 4. Predefined activities and custom custom task builder */}
            <Card className="border-secondary shadow-sm">
              <CardHeader className="py-3 px-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Coffee className="h-3.5 w-3.5 text-orange-500" />
                  Add Custom Blocks
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 space-y-3">
                {/* Slugs/Presets */}
                <div className="flex flex-wrap gap-1">
                  {PRESET_ACTIVITIES.map((act) => {
                    const isSelected = selectedCourse?.code === act.code;
                    return (
                      <button
                        key={act.code}
                        onClick={() => handleSelectCourse({ code: act.code, title: act.title, isCustom: true })}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${
                          isSelected 
                            ? 'bg-primary border-primary text-white shadow-sm font-extrabold ring-1 ring-primary' 
                            : 'bg-background hover:bg-accent hover:border-muted-foreground/30 text-muted-foreground'
                        }`}
                      >
                        <act.icon className="h-3 w-3" />
                        {act.code}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Task input */}
                <div className="space-y-2 pt-2 border-t text-xs">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Activity Label</Label>
                    <div className="flex gap-1.5">
                      <Input 
                        placeholder="e.g., Coding prep, Break, Lunch" 
                        value={customTaskName}
                        onChange={(e) => setCustomTaskName(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button onClick={handleAddCustomTask} size="sm" className="h-8 px-2 font-bold shrink-0">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clear all tool */}
            <Button 
              variant="outline" 
              onClick={() => handleClearAll()} 
              className="w-full h-9 border-destructive/20 text-destructive hover:bg-destructive/10 text-xs font-bold gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset Timetable
            </Button>
          </div>

          {/* RIGHT COLUMN: MAIN TIMETABLE GRID */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Desktop Full View */}
            <Card className="hidden md:block shadow-md border-primary/15 overflow-hidden">
              <div className="bg-primary/5 border-b p-4 justify-between items-center flex">
                <div className="flex items-center gap-2">
                  <Grid className="text-primary h-5 w-5" />
                  <span className="font-extrabold text-sm uppercase tracking-wider text-primary">Your Weekly Timetable Template</span>
                </div>
                {selectedCourse && (
                  <Badge className="bg-amber-500 text-white flex items-center gap-1 border-none animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-white block" />
                    Painting Mode Active: {selectedCourse.code}
                  </Badge>
                )}
              </div>
              
              <div className="overflow-x-auto min-w-full">
                <table className="w-full border-collapse text-left text-sm whitespace-nowrap min-w-[1000px]">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold text-xs border-b">
                    <tr>
                      <th className="p-3 w-36 border-r font-mono text-center sticky left-0 bg-background uppercase tracking-widest text-[10px] z-20 shadow-sm">Day of Week</th>
                      {currentUserSlots.map(slot => (
                        <th key={slot.id} className="p-3 border-r text-center font-bold text-foreground">
                          {slot.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day} className="border-b hover:bg-accent/20 transition-colors">
                        <td className="p-3 border-r align-middle bg-muted/30 sticky left-0 z-10 text-center font-bold text-xs uppercase tracking-wider text-foreground">
                          {day}
                        </td>
                        
                        {currentUserSlots.map((slot) => {
                          const assigned = timetable[day]?.[slot.id];
                          const hasValue = assigned && assigned.code !== '';
                          const isCustomActivity = assigned?.isCustom;
                          
                          return (
                            <td 
                              key={`${day}-${slot.id}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, day, slot.id)}
                              onClick={() => handleCellClick(day, slot.id)}
                              className={`p-1.5 border-r h-20 align-top cursor-pointer relative group transition-all text-center ${
                                hasValue 
                                  ? isCustomActivity
                                    ? 'bg-orange-500/10 hover:bg-orange-500/15 border-orange-500/30'
                                    : 'bg-primary/10 hover:bg-primary/15 border-primary/30'
                                  : 'bg-card hover:bg-muted/40 border-muted-foreground/10'
                              }`}
                            >
                              {hasValue ? (
                                <div className="h-full flex flex-col justify-between p-1">
                                  <div>
                                    <Badge 
                                      className={`text-[9px] font-bold ${
                                        isCustomActivity 
                                          ? 'bg-orange-600/20 text-orange-700 hover:bg-orange-600/30' 
                                          : 'bg-primary/20 text-primary hover:bg-primary/30'
                                      } border-none rounded-sm px-1 shadow-none`}
                                    >
                                      {assigned.code}
                                    </Badge>
                                    <p className="text-[10px] text-foreground font-extrabold mt-1 truncate leading-tight">
                                      {assigned.title.includes(':') ? assigned.title.split(':').slice(1).join(':').trim() : assigned.title}
                                    </p>
                                  </div>
                                  
                                  {/* Trash trigger absolute hover */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearCell(day, slot.id);
                                    }}
                                    className="absolute bottom-1 right-1 p-1 h-5 w-5 flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground/40 font-mono italic">
                                  Empty slot
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
 
            {/* Mobile Responsive Vertical Day-by-Day View switcher */}
            <div className="md:hidden space-y-4">
              <div className="bg-primary/5 p-3 rounded-lg flex items-center justify-between border">
                <div className="flex items-center gap-2">
                  <Grid className="text-primary h-4 w-4" />
                  <span className="font-bold text-xs uppercase text-primary">Mobile Schedule Assistant</span>
                </div>
                {selectedCourse && (
                  <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 border-none animate-pulse">
                    Brush: {selectedCourse.code}
                  </Badge>
                )}
              </div>
 
              {/* Day selection horizontal bar */}
              <div className="flex items-center overflow-x-auto gap-1 pb-1 scrollbar-none">
                {DAYS.map((day) => (
                  <Button
                    key={day}
                    variant={activeMobileDay === day ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveMobileDay(day)}
                    className="text-xs shrink-0 py-1 px-3 h-8 font-bold"
                  >
                    {day.substring(0, 3)}
                  </Button>
                ))}
              </div>
 
              {/* Display items for the actively selected mobile day */}
              <div className="bg-card border rounded-lg p-3 grid gap-3">
                <h3 className="text-sm font-bold border-b pb-2 flex items-center justify-between">
                  <span>{activeMobileDay} Study Targets</span>
                  <Badge variant="outline" className="text-[10px]">{DAYS.indexOf(activeMobileDay) + 1} of 7</Badge>
                </h3>
                
                {currentUserSlots.map((slot) => {
                  const assigned = timetable[activeMobileDay]?.[slot.id];
                  const hasValue = assigned && assigned.code !== '';
                  const isCustomActivity = assigned?.isCustom;
 
                  return (
                    <div 
                      key={slot.id}
                      onClick={() => handleCellClick(activeMobileDay, slot.id)}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-all ${
                        hasValue
                          ? isCustomActivity
                            ? 'bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/20 ring-1 ring-orange-500/10'
                            : 'bg-primary/5 hover:bg-primary/10 border-primary/20 ring-1 ring-primary/10'
                          : 'bg-background hover:bg-accent border-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-bold text-muted-foreground font-mono">{slot.name}</span>
                        </div>
                        
                        {hasValue ? (
                          <div>
                            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                              isCustomActivity ? 'bg-orange-500/20 text-orange-700' : 'bg-primary/20 text-primary'
                            }`}>
                              {assigned.code}
                            </span>
                            <h4 className="font-bold text-xs mt-1 text-foreground leading-tight truncate">
                              {assigned.title}
                            </h4>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/55 italic">
                            Empty block (Tap to place selected activity)
                          </div>
                        )}
                      </div>
 
                      {hasValue && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearCell(activeMobileDay, slot.id);
                          }}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ADMIN DESIGN VIEW: CREATE RECOMMENDED TIMETABLES FOR MAJORS */}
      {isAdmin && activeTab === 'admin' && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-3xl p-4 sm:p-6 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
            <div>
              <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Recommended Timetable Builder (Admin Access)
              </h2>
              <p className="text-xs text-amber-800">
                Design official standard timetable templates for departments and levels. When published, users in those cohorts can immediately fetch and seed them.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => handleClearAll(true)} 
                variant="outline"
                className="border-destructive/30 hover:bg-destructive/5 text-destructive font-bold text-xs"
              >
                Clear Template Grid
              </Button>
              <Button 
                onClick={handleSaveRecommendedByAdmin} 
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-2"
                disabled={isSaving}
              >
                <Upload className="h-4 w-4" />
                {isSaving ? 'Publishing...' : 'Publish Template to Live Cloud'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Cohort selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-amber-950">Target Academic Level</Label>
              <Select value={adminLevel} onValueChange={setAdminLevel}>
                <SelectTrigger className="bg-white border-amber-500/20 text-xs text-amber-950">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 Level</SelectItem>
                  <SelectItem value="200">200 Level</SelectItem>
                  <SelectItem value="300">300 Level</SelectItem>
                  <SelectItem value="400">400 Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-amber-950">Target Department Major</Label>
              <Select value={adminDept} onValueChange={setAdminDept}>
                <SelectTrigger className="bg-white border-amber-500/20 text-xs text-amber-950">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Software Engineering">Software Engineering</SelectItem>
                  <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                  <SelectItem value="Computer Engineering">Computer Engineering</SelectItem>
                  <SelectItem value="Biochemistry">Biochemistry</SelectItem>
                  <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                  <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                  <SelectItem value="Agribusiness">Agribusiness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-amber-950">Recommended Block Size</Label>
              <Select 
                value={adminBlockSize} 
                onValueChange={(val: '20min' | '30min' | '1hr') => {
                  if (window.confirm("Changing the block spacing will instantly reset the design grid to adapt to the new layout slots. Proceed?")) {
                    setAdminBlockSize(val);
                    setAdminTimetable(createEmptyTimetable(val));
                  }
                }}
              >
                <SelectTrigger className="bg-white border-amber-500/20 text-xs text-amber-950">
                  <SelectValue placeholder="Select Spacing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20min">20 Minutes</SelectItem>
                  <SelectItem value="30min">30 Minutes</SelectItem>
                  <SelectItem value="1hr">1 Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-white/40 border border-amber-200 rounded-xl text-xs text-amber-950/80 leading-snug flex flex-col justify-center">
              <span>Editing: <strong>Level {adminLevel} {adminDept}</strong></span>
              <span>Spacing: <strong>{adminBlockSize} study blocks</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Admin Available selector list */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-secondary shadow-sm">
                <CardHeader className="py-3">
                  <CardTitle className="text-xs font-extrabold uppercase text-muted-foreground">Select Academic Course</CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-1 max-h-[250px] overflow-y-auto">
                  {courses.map((course) => {
                    const isSelected = selectedAdminCourse?.code === course.code;
                    return (
                      <div
                        key={course.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, { code: course.code, title: course.title })}
                        onClick={() => handleSelectCourse({ code: course.code, title: course.title }, true)}
                        className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-purple-100 border-purple-500 text-purple-800 ring-2 ring-purple-500/20 font-bold' 
                            : 'bg-card border-border hover:bg-accent/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold font-mono">{course.code}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">Course</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{course.title}</p>
                      </div>
                    );
                  })}
                  
                  {/* Preset rest/study items for admin */}
                  <div className="border-t pt-2 my-2 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground px-1 pb-1">Activity Blocks</p>
                    {PRESET_ACTIVITIES.map((act) => {
                      const isSelected = selectedAdminCourse?.code === act.code;
                      return (
                        <div 
                          key={act.code}
                          onClick={() => handleSelectCourse({ code: act.code, title: act.title, isCustom: true }, true)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-amber-100 border-amber-500 text-amber-800 font-bold' 
                              : 'bg-card border-border hover:bg-accent/40'
                          }`}
                        >
                          <span className="font-bold font-mono">{act.code}</span>
                          <p className="text-[10px] text-muted-foreground">{act.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Admin Template Grid */}
            <div className="lg:col-span-3">
              <Card className="shadow-md border-amber-500/20 overflow-hidden bg-white">
                <div className="overflow-x-auto min-w-full">
                  <table className="w-full border-collapse text-left text-sm whitespace-nowrap bg-white min-w-[1000px]">
                    <thead className="bg-amber-500/10 text-amber-900 border-b border-amber-500/20">
                      <tr>
                        <th className="p-3 w-36 border-r text-center font-mono uppercase tracking-wider text-[10px] bg-background sticky left-0 z-20 shadow-sm">Day of Week</th>
                        {adminSlots.map(slot => (
                          <th key={slot.id} className="p-3 border-r text-center font-bold text-amber-950">
                            {slot.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => (
                        <tr key={day} className="border-b border-amber-500/10 hover:bg-amber-500/5 transition-colors">
                          <td className="p-3 border-r border-amber-500/10 align-middle text-center bg-muted/20 font-bold text-xs uppercase text-amber-950">
                            {day}
                          </td>
                          
                          {adminSlots.map((slot) => {
                            const assigned = adminTimetable[day]?.[slot.id];
                            const hasValue = assigned && assigned.code !== '';
                            const isCustomActivity = assigned?.isCustom;
                            
                            return (
                              <td 
                                key={`admin-${day}-${slot.id}`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, day, slot.id, true)}
                                onClick={() => handleCellClick(day, slot.id, true)}
                                className={`p-1.5 border-r border-amber-500/10 h-20 align-top cursor-pointer relative group transition-all text-center ${
                                  hasValue 
                                    ? isCustomActivity
                                      ? 'bg-amber-500/20 border-amber-500' 
                                      : 'bg-purple-100 border-purple-500'
                                    : 'bg-background hover:bg-amber-500/10'
                                  }`}
                              >
                                {hasValue ? (
                                  <div className="h-full flex flex-col justify-between p-1">
                                    <div>
                                      <Badge className="text-[9px] font-bold bg-purple-700/10 text-purple-800 border-none rounded">
                                        {assigned.code}
                                      </Badge>
                                      <p className="text-[10px] text-foreground font-extrabold mt-1 truncate">
                                        {assigned.title.includes(':') ? assigned.title.split(':').slice(1).join(':').trim() : assigned.title}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearCell(day, slot.id, true);
                                      }}
                                      className="absolute bottom-1 right-1 p-1 h-5 w-5 flex items-center justify-center rounded bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="h-full w-full flex items-center justify-center text-[9px] text-muted-foreground/30 italic">
                                    Empty
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
