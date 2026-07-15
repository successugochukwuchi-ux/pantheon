import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
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
  Check,
  Pencil,
  Save,
  School
} from 'lucide-react';

export default function AdminDiscipline() {
  const { profile } = useAuth();
  const isLevel5 = profile?.level === '5' || profile?.email === 'successugochukwuchi@gmail.com';
  const isLevel4 = profile?.level === '4';
  const universityId = profile?.At || 'futo';

  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  const userUni = (profile?.At || 'futo').toLowerCase().trim();
  const displayedCourses = isLevel4 
    ? courses.filter(course => (course.At || 'futo').toLowerCase().trim() === userUni) 
    : courses;

  // Form State
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deptSearch, setDeptSearch] = useState('');

  // Management State
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

  // Departments management state
  const [selectedDisciplineForDepts, setSelectedDisciplineForDepts] = useState<Discipline | null>(null);
  const [deptsDialogOpen, setDeptsDialogOpen] = useState(false);
  const [deptsSearch, setDeptsSearch] = useState('');
  const [deptsLoading, setDeptsLoading] = useState(false);

  // University specific departments
  const [uniDepartments, setUniDepartments] = useState<string[]>([]);

  // Edit university departments states
  const [editUniDeptsDialogOpen, setEditUniDeptsDialogOpen] = useState(false);
  const [newUniDeptName, setNewUniDeptName] = useState('');
  const [editingUniDeptIndex, setEditingUniDeptIndex] = useState<number | null>(null);
  const [editingUniDeptValue, setEditingUniDeptValue] = useState('');
  const [uniDeptsSaving, setUniDeptsSaving] = useState(false);

  const handleAddUniDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniDeptName.trim()) return;

    if (uniDepartments.some(d => d.toLowerCase() === newUniDeptName.trim().toLowerCase())) {
      toast.error("Department already exists!");
      return;
    }

    setUniDeptsSaving(true);
    try {
      const updated = [...uniDepartments, newUniDeptName.trim()];
      await setDoc(doc(db, 'universities', universityId), {
        departments: updated
      }, { merge: true });
      setUniDepartments(updated);
      setNewUniDeptName('');
      toast.success("Department added successfully!");
    } catch (err) {
      console.error("Failed to add department:", err);
      toast.error("Failed to add department");
    } finally {
      setUniDeptsSaving(false);
    }
  };

  const handleSaveEditUniDept = async (index: number) => {
    if (!editingUniDeptValue.trim()) return;

    const updated = [...uniDepartments];
    updated[index] = editingUniDeptValue.trim();

    setUniDeptsSaving(true);
    try {
      await setDoc(doc(db, 'universities', universityId), {
        departments: updated
      }, { merge: true });
      setUniDepartments(updated);
      setEditingUniDeptIndex(null);
      toast.success("Department updated successfully!");
    } catch (err) {
      console.error("Failed to update department:", err);
      toast.error("Failed to update department");
    } finally {
      setUniDeptsSaving(false);
    }
  };

  const handleDeleteUniDept = async (index: number) => {
    const deptToDelete = uniDepartments[index];
    const updated = uniDepartments.filter((_, i) => i !== index);

    setUniDeptsSaving(true);
    try {
      await setDoc(doc(db, 'universities', universityId), {
        departments: updated
      }, { merge: true });
      setUniDepartments(updated);
      toast.success(`Department "${deptToDelete}" deleted`);
    } catch (err) {
      console.error("Failed to delete department:", err);
      toast.error("Failed to delete department");
    } finally {
      setUniDeptsSaving(false);
    }
  };

  useEffect(() => {
    if (!universityId) return;
    const fetchUni = async () => {
      try {
        const uSnap = await getDoc(doc(db, 'universities', universityId));
        if (uSnap.exists()) {
          setUniDepartments(uSnap.data().departments || []);
        }
      } catch (err) {
        console.error("Error fetching university departments:", err);
      }
    };
    fetchUni();
  }, [universityId]);

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

  const handleToggleDepartmentLink = async (deptName: string, isLinked: boolean) => {
    if (!selectedDisciplineForDepts) return;
    
    setDeptsLoading(true);
    try {
      let updatedDepts = [...(selectedDisciplineForDepts.departments || [])];
      if (isLinked) {
        // Remove department
        updatedDepts = updatedDepts.filter(d => d !== deptName);
      } else {
        // Add department if not already present
        if (!updatedDepts.includes(deptName)) {
          updatedDepts.push(deptName);
        }
      }

      await setDoc(doc(db, 'disciplines', selectedDisciplineForDepts.id), {
        ...selectedDisciplineForDepts,
        departments: updatedDepts
      });

      // Update local state for open dialog
      const updatedDisc = {
        ...selectedDisciplineForDepts,
        departments: updatedDepts
      };
      setSelectedDisciplineForDepts(updatedDisc);
      
      // Update the general disciplines state to match
      setDisciplines(prev => prev.map(d => d.id === selectedDisciplineForDepts.id ? updatedDisc : d));

      toast.success(isLinked ? `Unlinked "${deptName}" from ${selectedDisciplineForDepts.name}` : `Linked "${deptName}" to ${selectedDisciplineForDepts.name}`);
    } catch (err: any) {
      console.error("Error toggling department link:", err);
      toast.error("Failed to update departments: " + err.message);
    } finally {
      setDeptsLoading(false);
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
    const matchedCourse = displayedCourses.find(c => c.id === cId);
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
  const availableToAddCourses = displayedCourses.filter(course => {
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
        {/* Create Form or University Admin Center */}
        {!isLevel5 ? (
          <Card className="lg:col-span-1 border-violet-500/20 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-violet-700">
                <GraduationCap className="h-5 w-5" />
                University Portal
              </CardTitle>
              <CardDescription>
                Map your university's departments to national CCMAS disciplines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 bg-background border rounded-lg">
                <Label className="text-xs text-muted-foreground block font-bold uppercase tracking-wide">Selected University</Label>
                <div className="text-sm font-black flex items-center gap-1.5 text-primary">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  {universityId.toUpperCase()}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground block font-bold uppercase tracking-wide">Your Registered Departments ({uniDepartments.length})</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-1.5 text-xs text-violet-700 hover:text-violet-800 font-semibold"
                    onClick={() => setEditUniDeptsDialogOpen(true)}
                  >
                    <Settings2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 border rounded-lg p-2.5 bg-background">
                  {uniDepartments.map(dept => (
                    <div key={dept} className="text-xs py-1 px-2 rounded-md bg-muted/40 font-medium flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      <span className="truncate">{dept}</span>
                    </div>
                  ))}
                  {uniDepartments.length === 0 && (
                    <p className="text-xs text-muted-foreground italic p-2 text-center">No departments registered. Click edit to add departments.</p>
                  )}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground bg-background p-3 border rounded-lg leading-normal">
                As an administrator of <strong>{universityId.toUpperCase()}</strong>, you can link or unlink your university's registered departments to existing CCMAS disciplines. Click <strong>"Manage Departments"</strong> on any discipline card to configure.
              </div>
            </CardContent>
          </Card>
        ) : (
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
        )}

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
                const numCourses = Object.keys(disc.courses || {}).filter(cId => {
                  if (isLevel4) {
                    const matchedCourse = courses.find(c => c.id === cId);
                    if (!matchedCourse) return false;
                    return (matchedCourse.At || 'futo').toLowerCase().trim() === userUni;
                  }
                  return true;
                }).length;
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
                        {isLevel5 && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10 -mt-1 -mr-1 h-8 w-8"
                            onClick={() => handleDeleteDiscipline(disc.id, disc.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3 flex-grow">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Departments ({(disc.departments || []).length})</Label>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                          {(disc.departments || []).map(dept => (
                            <Badge key={dept} variant="outline" className="text-[10px] py-0 px-2 rounded-sm bg-muted/35">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 pb-3 block space-y-2">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full flex items-center justify-center gap-1.5 font-semibold"
                        onClick={() => {
                          setSelectedDiscipline(disc);
                          setManageDialogOpen(true);
                          setCourseSearch('');
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                        Manage CCMAS Courses
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full flex items-center justify-center gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 font-semibold"
                        onClick={() => {
                          setSelectedDisciplineForDepts(disc);
                          setDeptsDialogOpen(true);
                          setDeptsSearch('');
                        }}
                      >
                        <Building2 className="h-4 w-4" />
                        Manage Departments
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

      {/* MANAGE DEPARTMENTS DIALOG */}
      <Dialog open={deptsDialogOpen} onOpenChange={setDeptsDialogOpen}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold text-violet-700">
              <Building2 className="h-5 w-5" />
              Manage Departments
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {isLevel5 
                ? `Add or remove departments for the discipline: ${selectedDisciplineForDepts?.name}`
                : `Map departments from ${universityId.toUpperCase()} to the discipline: ${selectedDisciplineForDepts?.name}`}
            </DialogDescription>
          </DialogHeader>

          {/* Search bar */}
          <div className="relative my-3">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search departments..." 
              className="pl-9 h-10 text-sm shadow-inner animate-none"
              value={deptsSearch}
              onChange={(e) => setDeptsSearch(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block">
              {isLevel5 ? "All Departments Catalog" : `${universityId.toUpperCase()} Registered Departments`}
            </Label>

            <div className="border rounded-lg max-h-60 overflow-y-auto divide-y bg-background">
              {(isLevel5 ? DEPARTMENTS : uniDepartments)
                .filter(dept => dept.toLowerCase().includes(deptsSearch.toLowerCase()))
                .map(dept => {
                  const isLinked = selectedDisciplineForDepts?.departments?.includes(dept);
                  return (
                    <div key={dept} className="flex items-center justify-between p-2.5 text-sm hover:bg-accent/40">
                      <span className="font-medium text-foreground truncate max-w-[240px]" title={dept}>{dept}</span>
                      <Button
                        size="sm"
                        variant={isLinked ? "destructive" : "secondary"}
                        className="h-7 px-2.5 text-xs font-bold"
                        disabled={deptsLoading}
                        onClick={() => handleToggleDepartmentLink(dept, !!isLinked)}
                      >
                        {isLinked ? "Unlink" : "Link"}
                      </Button>
                    </div>
                  );
                })}
              
              {((isLevel5 ? DEPARTMENTS : uniDepartments).filter(dept => dept.toLowerCase().includes(deptsSearch.toLowerCase())).length === 0) && (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  No departments found.
                </div>
              )}
            </div>

            {/* Read-only other departments for Level 4 admins */}
            {!isLevel5 && selectedDisciplineForDepts && (
              <div className="space-y-2 pt-3 border-t">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Other Universities / General Departments ({
                    (selectedDisciplineForDepts.departments || []).filter(d => !uniDepartments.includes(d)).length
                  })
                </Label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-muted/40 border rounded-lg">
                  {(selectedDisciplineForDepts.departments || [])
                    .filter(d => !uniDepartments.includes(d))
                    .map(dept => (
                      <Badge key={dept} variant="outline" className="text-[10px] py-0 px-2 rounded-sm bg-background border-muted text-muted-foreground">
                        {dept}
                      </Badge>
                    ))}
                  {(selectedDisciplineForDepts.departments || []).filter(d => !uniDepartments.includes(d)).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">None</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t">
            <Button onClick={() => setDeptsDialogOpen(false)} className="w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT UNIVERSITY DEPARTMENTS DIALOG */}
      <Dialog open={editUniDeptsDialogOpen} onOpenChange={setEditUniDeptsDialogOpen}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2 font-bold text-violet-700">
              <School className="h-5 w-5" />
              University Departments
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Add, rename, or delete registered departments for <strong>{universityId.toUpperCase()}</strong>. Changes are instantly reflected across the platform.
            </DialogDescription>
          </DialogHeader>

          {/* Add Department Form */}
          <form onSubmit={handleAddUniDept} className="flex gap-2 my-4">
            <Input 
              placeholder="e.g. Mechanical Engineering"
              value={newUniDeptName}
              onChange={(e) => setNewUniDeptName(e.target.value)}
              className="h-10 text-sm"
              required
            />
            <Button type="submit" disabled={uniDeptsSaving} className="h-10 bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block">
              Registered Departments ({uniDepartments.length})
            </Label>

            <div className="border rounded-lg max-h-64 overflow-y-auto divide-y bg-background">
              {uniDepartments.map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 text-sm">
                  {editingUniDeptIndex === index ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input 
                        value={editingUniDeptValue}
                        onChange={(e) => setEditingUniDeptValue(e.target.value)}
                        className="h-8 py-0 text-sm"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleSaveEditUniDept(index)} disabled={uniDeptsSaving}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => setEditingUniDeptIndex(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-foreground truncate max-w-[260px]">{dept}</span>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingUniDeptIndex(index);
                            setEditingUniDeptValue(dept);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUniDept(index)}
                          disabled={uniDeptsSaving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {uniDepartments.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  No registered departments yet. Add one above!
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t">
            <Button onClick={() => setEditUniDeptsDialogOpen(false)} variant="secondary" className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
