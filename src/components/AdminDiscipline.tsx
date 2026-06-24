import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DEPARTMENTS } from '../constants/departments';
import { Course, Discipline } from '../types';
import { toast } from 'sonner';
import { 
  Plus, 
  Settings2, 
  Trash2, 
  Search, 
  Lock, 
  Unlock, 
  GraduationCap, 
  Building2, 
  X,
  BookOpen,
  Check
} from 'lucide-react';

export default function AdminDiscipline() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deptSearch, setDeptSearch] = useState('');

  // Management State
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

  // Fetch disciplines and courses
  useEffect(() => {
    const unsubDisciplines = onSnapshot(collection(db, 'disciplines'), (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Discipline));
      setDisciplines(docs);
    }, (error) => {
      console.error("Error listening to disciplines:", error);
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(docs);
    }, (error) => {
      console.error("Error listening to courses:", error);
    });

    return () => {
      unsubDisciplines();
      unsubCourses();
    };
  }, []);

  // Filter departments for creation
  const filteredDeptsList = DEPARTMENTS.filter(d => 
    d.toLowerCase().includes(deptSearch.toLowerCase()) && 
    !selectedDepts.includes(d)
  );

  const toggleDeptSelection = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const handleCreateDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisciplineName.trim()) {
      toast.error('Please enter a discipline name');
      return;
    }
    if (selectedDepts.length === 0) {
      toast.error('Please add at least one department');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'disciplines'), {
        name: newDisciplineName.trim(),
        departments: selectedDepts,
        courses: {},
        createdAt: new Date().toISOString()
      });
      toast.success('Discipline created successfully');
      setNewDisciplineName('');
      setSelectedDepts([]);
    } catch (err: any) {
      toast.error('Failed to create discipline: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscipline = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the discipline "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'disciplines', id));
      toast.success('Discipline deleted successfully');
    } catch (err: any) {
      toast.error('Failed to delete discipline: ' + err.message);
    }
  };

  const handleCourseOptionChange = async (discipline: Discipline, courseId: string, option: 'allow' | 'lock' | 'remove') => {
    const updatedCourses = { ...(discipline.courses || {}) };
    
    if (option === 'remove') {
      delete updatedCourses[courseId];
    } else {
      updatedCourses[courseId] = option;
    }

    try {
      await setDoc(doc(db, 'disciplines', discipline.id), {
        ...discipline,
        courses: updatedCourses
      });
      
      // Update local state for active dialog
      setSelectedDiscipline({
        ...discipline,
        courses: updatedCourses
      });
      toast.success('Course list updated');
    } catch (err: any) {
      toast.error('Failed to update course configuration: ' + err.message);
    }
  };

  // Helper to check if a course is locked under another discipline
  const getCourseLockingDiscipline = (courseId: string, currentDisciplineId: string): string | null => {
    for (const d of disciplines) {
      if (d.id !== currentDisciplineId && d.courses?.[courseId] === 'lock') {
        return d.name;
      }
    }
    return null;
  };

  // Render Courses in current discipline
  const assignedCourses = Object.entries(selectedDiscipline?.courses || {}).map(([cId, option]) => {
    const matchedCourse = courses.find(c => c.id === cId);
    return {
      id: cId,
      option,
      course: matchedCourse
    };
  }).filter(item => item.course && (
    item.course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
    item.course.code.toLowerCase().includes(courseSearch.toLowerCase())
  ));

  // Render Courses available to be added
  const availableToAddCourses = courses.filter(course => {
    // Not already added
    const isAssigned = !!selectedDiscipline?.courses?.[course.id];
    // Matches search
    const matchesSearch = course.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
                          course.code.toLowerCase().includes(courseSearch.toLowerCase());
    return !isAssigned && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Upper Area: Form and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              New Discipline
            </CardTitle>
            <CardDescription aria-describedby="discipline-form-desc">
              Create a CCMAS discipline and map departments to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateDiscipline} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discipline-name">Discipline Name</Label>
                <Input 
                  id="discipline-name"
                  placeholder="e.g. Computing, Engineering" 
                  value={newDisciplineName}
                  onChange={(e) => setNewDisciplineName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Linked Departments</Label>
                
                {/* Selected departments view */}
                {selectedDepts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/40 max-h-36 overflow-y-auto">
                    {selectedDepts.map(dept => (
                      <Badge key={dept} variant="secondary" className="flex items-center gap-1">
                        <span className="truncate max-w-[150px]">{dept}</span>
                        <button 
                          type="button" 
                          onClick={() => toggleDeptSelection(dept)}
                          className="hover:text-destructive focus:outline-none"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground p-3 border border-dashed rounded-md text-center">
                    No departments added yet. Select from below.
                  </div>
                )}

                {/* Dropdown / list of departments */}
                <div className="space-y-2 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search departments..." 
                      className="pl-8"
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                    {filteredDeptsList.length > 0 ? (
                      filteredDeptsList.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                          onClick={() => toggleDeptSelection(dept)}
                        >
                          <span className="truncate">{dept}</span>
                          <span className="text-xs text-primary">+ Add</span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-xs p-3 text-muted-foreground">
                        No matches found
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Discipline'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Disciplines Cards Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Disciplines List
            </h2>
            <Badge variant="outline">{disciplines.length} total</Badge>
          </div>

          {disciplines.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-card text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p className="font-medium">No Disciplines Created</p>
              <p className="text-sm">Create the first discipline using the left panel</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {disciplines.map(disc => {
                const numCourses = Object.keys(disc.courses || {}).length;
                return (
                  <Card key={disc.id} className="flex flex-col justify-between">
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg font-bold">{disc.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {numCourses} configured course{numCourses !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10 -mt-1 -mr-1 h-8 w-8"
                          onClick={() => handleDeleteDiscipline(disc.id, disc.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 flex-grow">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Departments ({disc.departments.length})</Label>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          {disc.departments.map(dept => (
                            <Badge key={dept} variant="outline" className="text-[10px] py-0 px-2 rounded-sm bg-muted/35">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-3 block">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full flex items-center justify-center gap-1.5"
                        onClick={() => {
                          setSelectedDiscipline(disc);
                          setManageDialogOpen(true);
                          setCourseSearch('');
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                        Manage CCMAS Courses
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MANAGE DISCIPLINE DIALOG */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-5xl lg:max-w-6xl w-full max-h-[92vh] h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold select-none">
              <Settings2 className="h-5 w-5 text-indigo-600" />
              Manage CCMAS Courses — {selectedDiscipline?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Assign general or departmental courses to this discipline. Set access privileges to "Allow" (sharable across disciplines) or "Lock" (exclusive restrict to this discipline only).
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative my-3 shrink-0">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter available or assigned courses by code, title, or department..." 
              className="pl-9 h-10 text-sm shadow-inner"
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
          </div>

          <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-hidden">
            {/* Left Hand: Assigned Courses */}
            <div className="border rounded-xl p-4 bg-muted/20 flex flex-col min-h-0">
              <h3 className="font-semibold text-sm pb-3 border-b flex items-center justify-between shrink-0">
                <span className="flex items-center gap-2 text-foreground">
                  Selected Courses 
                  <Badge variant="secondary" className="px-2 py-0 text-xs bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold">{assignedCourses.length}</Badge>
                </span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground tracking-wide bg-background py-0.5">Active Locking/Allowing</Badge>
              </h3>
              
              <div className="flex-grow overflow-y-auto mt-3 pr-1 space-y-2.5">
                {assignedCourses.length === 0 ? (
                  <div className="text-center py-20 text-xs text-muted-foreground font-medium flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-muted rounded-full">
                      <Unlock className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    No courses are assigned to this discipline yet.
                  </div>
                ) : (
                  assignedCourses.map(({ id, option, course }) => {
                    if (!course) return null;
                    return (
                      <div key={id} className="p-3 border rounded-lg bg-card hover:border-indigo-200 transition-colors flex flex-col gap-2 justify-between shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-foreground leading-snug">{course.code}: {course.title}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-muted-foreground leading-none">
                              <span>Semester: {course.semester}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>Level: {course.level}</span>
                              {course.department && (
                                <>
                                  <span className="text-muted-foreground/40">•</span>
                                  <span className="truncate max-w-[140px]" title={course.department}>Dept: {course.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-md"
                            onClick={() => selectedDiscipline && handleCourseOptionChange(selectedDiscipline, id, 'remove')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-1.5 pt-2 justify-end border-t border-muted/50">
                          <button
                            onClick={() => selectedDiscipline && handleCourseOptionChange(selectedDiscipline, id, 'allow')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                              option === 'allow' 
                                ? 'bg-indigo-50/80 text-indigo-700 border-indigo-200 shadow-xs' 
                                : 'bg-background hover:bg-accent text-muted-foreground border-input'
                            }`}
                          >
                            <Unlock className="h-3 w-3" />
                            Allow Access
                          </button>
                          <button
                            onClick={() => selectedDiscipline && handleCourseOptionChange(selectedDiscipline, id, 'lock')}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                              option === 'lock' 
                                ? 'bg-amber-50/80 text-amber-700 border-amber-200 shadow-xs' 
                                : 'bg-background hover:bg-accent text-muted-foreground border-input'
                            }`}
                          >
                            <Lock className="h-3 w-3" />
                            Lock Exclusive
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Hand: Addable Courses */}
            <div className="border rounded-xl p-4 bg-card flex flex-col min-h-0 shadow-xs">
              <h3 className="font-semibold text-sm pb-3 border-b flex items-center gap-2 shrink-0 text-foreground">
                Available Courses
                <Badge variant="secondary" className="px-2 py-0 text-xs bg-muted/60 text-muted-foreground font-semibold">{availableToAddCourses.length}</Badge>
              </h3>

              <div className="flex-grow overflow-y-auto mt-3 pr-1 space-y-2.5">
                {availableToAddCourses.length === 0 ? (
                  <div className="text-center py-20 text-xs text-muted-foreground font-medium flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-muted rounded-full">
                      <Search className="h-5 w-5 text-muted-foreground/60" />
                    </div>
                    No matching available courses.
                  </div>
                ) : (
                  availableToAddCourses.map(course => {
                    const otherLock = selectedDiscipline ? getCourseLockingDiscipline(course.id, selectedDiscipline.id) : null;
                    return (
                      <div key={course.id} className="p-3 border rounded-lg bg-muted/10 hover:bg-muted/20 transition-all flex flex-col justify-between gap-2.5 shadow-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-foreground block">{course.code}</span>
                          <span className="text-xs text-muted-foreground block truncate font-medium mt-0.5" title={course.title}>{course.title}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-muted-foreground leading-none">
                            <span>Sem: {course.semester}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>Lvl: {course.level}</span>
                            {course.department && (
                              <>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="truncate max-w-[120px]" title={course.department}>Dept: {course.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-muted/50">
                          {otherLock ? (
                            <Badge variant="destructive" className="text-[10px] py-0.5 px-2 flex items-center gap-1 bg-destructive/10 text-destructive border-none font-semibold">
                              <Lock className="h-3 w-3" />
                              Locked to {otherLock}
                            </Badge>
                          ) : (
                            <>
                              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Track as:</span>
                              <div className="flex items-center gap-1.5">
                                <Button 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2.5 flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-bold shadow-xs transition-transform active:scale-95"
                                  onClick={() => selectedDiscipline && handleCourseOptionChange(selectedDiscipline, course.id, 'allow')}
                                >
                                  <Unlock className="h-3 w-3" />
                                  Allow
                                </Button>
                                <Button 
                                  variant="outline" 
                                  className="h-7 text-[10px] px-2.5 flex items-center gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 font-bold shadow-xs transition-transform active:scale-95"
                                  onClick={() => selectedDiscipline && handleCourseOptionChange(selectedDiscipline, course.id, 'lock')}
                                >
                                  <Lock className="h-3 w-3" />
                                  Lock
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t shrink-0 flex items-center justify-between w-full">
            <p className="text-[11px] text-muted-foreground hidden sm:block">Changes are synchronized dynamically into the curriculum matrix.</p>
            <Button onClick={() => setManageDialogOpen(false)} className="px-6 font-semibold shadow-xs">Done Editing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
