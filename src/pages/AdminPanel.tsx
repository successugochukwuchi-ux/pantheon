import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  UserPlus, 
  Ban, 
  BookPlus, 
  Newspaper, 
  Key, 
  LayoutDashboard, 
  Settings, 
  FileText, 
  Trash2, 
  Plus,
  HelpCircle,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Course, UserLevel, Semester, Note, Question, ActivationCode, VerificationRequest } from '../types';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { NoteBuilder } from '../components/NoteBuilder';
import { useTitle } from '../hooks/useTitle';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../components/ui/dialog';

export default function AdminPanel() {
  useTitle('Admin Panel');
  const { profile, user, systemConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // User Management State
  const [targetUid, setTargetUid] = useState('');
  const [banReason, setBanReason] = useState('');

  // Course Management State
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourse, setNewCourse] = useState({ code: '', title: '', semester: '1st', level: '100' });

  // Notes State
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState({ courseId: '', title: '', content: '', type: 'lecture' as const });
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // CBT State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({ 
    courseId: '', 
    text: '', 
    correctAnswer: '', 
    incorrectAnswers: ['', '', ''],
    explanation: '' 
  });
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // News State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');

  // Activation Code State
  const [generatedCode, setGeneratedCode] = useState('');
  const [unusedPins, setUnusedPins] = useState<ActivationCode[]>([]);
  const [usedPins, setUsedPins] = useState<ActivationCode[]>([]);

  // Verification Requests State
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  useEffect(() => {
    if (!profile) return;

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubNotes = onSnapshot(collection(db, 'notes'), (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    });

    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    });

    const unsubPins = onSnapshot(collection(db, 'activationCodes'), (snapshot) => {
      const allPins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivationCode));
      setUnusedPins(allPins.filter(p => !p.isUsed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setUsedPins(allPins.filter(p => p.isUsed).sort((a, b) => b.usedAt?.localeCompare(a.usedAt || '') || 0));
    });

    const unsubVerifications = onSnapshot(collection(db, 'verificationRequests'), (snapshot) => {
      setVerificationRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationRequest)));
    });

    return () => {
      unsubCourses();
      unsubNotes();
      unsubQuestions();
      unsubPins();
      unsubVerifications();
    };
  }, [profile]);

  const handleElevate = async (level: UserLevel) => {
    if (!targetUid) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        toast.error('User not found');
        return;
      }
      await updateDoc(userRef, { level });
      toast.success(`User elevated to Level ${level}`);
      setTargetUid('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (isBanned: boolean) => {
    if (!targetUid) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, { 
        isBanned, 
        banReason: isBanned ? banReason : '' 
      });
      toast.success(isBanned ? 'User banned' : 'User unbanned');
      setTargetUid('');
      setBanReason('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        ...newCourse,
        createdAt: new Date().toISOString()
      });
      toast.success('Course created successfully');
      setNewCourse({ code: '', title: '', semester: '1st', level: '100' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'notes'), {
        ...newNote,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Note created successfully');
      setNewNote({ courseId: '', title: '', content: '', type: 'lecture' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete));
      toast.success('Note deleted');
      setNoteToDelete(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newQuestion.courseId || !newQuestion.text || !newQuestion.correctAnswer) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        ...newQuestion,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Question added successfully');
      setNewQuestion({ 
        courseId: newQuestion.courseId, 
        text: '', 
        correctAnswer: '', 
        incorrectAnswers: ['', '', ''],
        explanation: '' 
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'questions', questionToDelete));
      toast.success('Question deleted');
      setQuestionToDelete(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'news'), {
        title: newsTitle,
        content: newsContent,
        createdAt: new Date().toISOString()
      });
      toast.success('News posted successfully');
      setNewsTitle('');
      setNewsContent('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = async () => {
    if (!systemConfig || systemConfig.currentSemester === 'none') {
      toast.error('Cannot generate pins when no semester is active');
      return;
    }
    const pin = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const path = `activationCodes/${pin}`;
    setLoading(true);
    try {
      await setDoc(doc(db, 'activationCodes', pin), {
        code: pin,
        isUsed: false,
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      });
      setGeneratedCode(pin);
      toast.success('Activation pin generated');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleUpdateSemester = async (semester: Semester) => {
    if (!user) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      await updateDoc(configRef, {
        currentSemester: semester,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      });

      // If ending a semester, deactivate all level 1 users
      if (semester === 'none') {
        const usersQuery = query(collection(db, 'users'), where('level', '==', '1'), where('isActivated', '==', true));
        const usersSnap = await getDocs(usersQuery);
        
        if (!usersSnap.empty) {
          const batch = writeBatch(db);
          usersSnap.docs.forEach((userDoc) => {
            batch.update(userDoc.ref, { isActivated: false });
          });
          await batch.commit();
          toast.success(`Semester ended. ${usersSnap.size} student accounts deactivated.`);
        } else {
          toast.success('Semester ended.');
        }
      } else {
        toast.success(`${semester} Semester started.`);
      }
    } catch (error: any) {
      toast.error(`Failed to update semester: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!user || !systemConfig) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      await updateDoc(configRef, {
        maintenanceMode: !systemConfig.maintenanceMode,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Maintenance mode ${!systemConfig.maintenanceMode ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (request: VerificationRequest, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Update request status
      batch.update(doc(db, 'verificationRequests', request.id), { status });
      
      if (status === 'approved') {
        // Activate user
        batch.update(doc(db, 'users', request.uid), { isActivated: true });
        toast.success('User verified and activated');
      } else {
        toast.info('Verification request rejected');
      }
      
      await batch.commit();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const isLevel4 = profile?.level === '4';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, courses, and platform content.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button variant={location.pathname === '/administrator' ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator')}>Overview</Button>
        <Button variant={location.pathname.includes('users') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/users')}>Users</Button>
        <Button variant={location.pathname.includes('courses') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/courses')}>Courses</Button>
        <Button variant={location.pathname.includes('notes') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/notes')}>Notes</Button>
        <Button variant={location.pathname.includes('cbt') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/cbt')}>CBT</Button>
        <Button variant={location.pathname.includes('news') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/news')}>News</Button>
        <Button variant={location.pathname.includes('pins') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/pins')}>Pins</Button>
        {isLevel4 && <Button variant={location.pathname.includes('system') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/system')}>System</Button>}
      </div>

      <Routes>
        <Route index element={<AdminOverview courses={courses} notes={notes} questions={questions} unusedPins={unusedPins} usedPins={usedPins} />} />
        <Route path="/users" element={
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Elevate User
                </CardTitle>
                <CardDescription>Change a user's permission level using their UID.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>User UID</Label>
                  <Input value={targetUid} onChange={(e) => setTargetUid(e.target.value)} placeholder="Enter UID" />
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button onClick={() => handleElevate('2')} disabled={loading || !targetUid}>Level 2</Button>
                {isLevel4 && (
                  <>
                    <Button onClick={() => handleElevate('3')} variant="outline" disabled={loading || !targetUid}>Level 3</Button>
                    <Button onClick={() => handleElevate('4')} variant="destructive" disabled={loading || !targetUid}>Level 4</Button>
                  </>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5" />
                  Ban/Demote User
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>User UID</Label>
                  <Input value={targetUid} onChange={(e) => setTargetUid(e.target.value)} placeholder="Enter UID" />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason for ban" />
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="destructive" onClick={() => handleBan(true)} disabled={loading || !targetUid}>Ban Account</Button>
                <Button variant="outline" onClick={() => handleBan(false)} disabled={loading || !targetUid}>Unban</Button>
              </CardFooter>
            </Card>
          </div>
        } />

        <Route path="/courses" element={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookPlus className="h-5 w-5" />
                Create New Course
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateCourse}>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Course Code</Label>
                  <Input value={newCourse.code} onChange={(e) => setNewCourse({...newCourse, code: e.target.value})} placeholder="MATH101" required />
                </div>
                <div className="space-y-2">
                  <Label>Course Title</Label>
                  <Input value={newCourse.title} onChange={(e) => setNewCourse({...newCourse, title: e.target.value})} placeholder="General Mathematics I" required />
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select value={newCourse.semester} onValueChange={(v) => setNewCourse({...newCourse, semester: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1st Semester</SelectItem>
                      <SelectItem value="2nd">2nd Semester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input value={newCourse.level} onChange={(e) => setNewCourse({...newCourse, level: e.target.value})} placeholder="100" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading}>Create Course</Button>
              </CardFooter>
            </form>
          </Card>
        } />

        <Route path="/news" element={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Post News
              </CardTitle>
            </CardHeader>
            <form onSubmit={handlePostNews}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={newsContent} onChange={(e) => setNewsContent(e.target.value)} rows={6} required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading}>Post to Board</Button>
              </CardFooter>
            </form>
          </Card>
        } />

        <Route path="/notes" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create New Note
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleCreateNote}>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={newNote.courseId} onValueChange={(v) => setNewNote({...newNote, courseId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newNote.type} onValueChange={(v) => setNewNote({...newNote, type: v as any})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lecture">Lecture Note</SelectItem>
                        <SelectItem value="punch">Punch Note</SelectItem>
                        <SelectItem value="past_question">Past Question</SelectItem>
                        <SelectItem value="cbt">CBT Practice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} placeholder="Introduction to Calculus" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Note Content Builder</Label>
                    <NoteBuilder 
                      initialContent={newNote.content} 
                      onChange={(content) => setNewNote({...newNote, content})} 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || !newNote.courseId}>Create Note</Button>
                </CardFooter>
              </form>
            </Card>

            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Existing Notes</h3>
              {notes.map(note => {
                const course = courses.find(c => c.id === note.courseId);
                let previewText = '';
                try {
                  const blocks = JSON.parse(note.content);
                  previewText = blocks.find((b: any) => b.type === 'text')?.content || 'No text content';
                } catch (e) {
                  previewText = note.content;
                }
                
                return (
                  <Card key={note.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium">{note.title}</CardTitle>
                        <CardDescription>{course?.code} • {note.type.toUpperCase()}</CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setNoteToDelete(note.id)} disabled={loading}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-1">{previewText}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Dialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Note</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this note? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNoteToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteNote} disabled={loading}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } />

        <Route path="/cbt" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Add CBT Question
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleCreateQuestion}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={newQuestion.courseId} onValueChange={(v) => setNewQuestion({...newQuestion, courseId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Textarea value={newQuestion.text} onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})} placeholder="What is the derivative of x^2?" required />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-primary font-bold">Correct Answer</Label>
                      <Input value={newQuestion.correctAnswer} onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})} placeholder="2x" required />
                    </div>
                    {newQuestion.incorrectAnswers.map((ans, i) => (
                      <div key={i} className="space-y-2">
                        <Label>Incorrect Answer {i + 1}</Label>
                        <Input 
                          value={ans} 
                          onChange={(e) => {
                            const newAns = [...newQuestion.incorrectAnswers];
                            newAns[i] = e.target.value;
                            setNewQuestion({...newQuestion, incorrectAnswers: newAns});
                          }} 
                          placeholder={`Option ${i + 2}`}
                          required 
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Explanation (Optional)</Label>
                    <Textarea value={newQuestion.explanation} onChange={(e) => setNewQuestion({...newQuestion, explanation: e.target.value})} placeholder="Power rule: d/dx(x^n) = nx^(n-1)" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || !newQuestion.courseId}>Add Question</Button>
                </CardFooter>
              </form>
            </Card>

            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Existing Questions</h3>
              {questions.map(q => {
                const course = courses.find(c => c.id === q.courseId);
                return (
                  <Card key={q.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium line-clamp-2">{q.text}</CardTitle>
                        <CardDescription>{course?.code} • {course?.title}</CardDescription>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setQuestionToDelete(q.id)} disabled={loading}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs space-y-1">
                        <p><span className="font-bold text-primary">Correct:</span> {q.correctAnswer}</p>
                        <p><span className="font-bold">Incorrect:</span> {q.incorrectAnswers.join(', ')}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Dialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Question</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this question?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setQuestionToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteQuestion} disabled={loading}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } />

        <Route path="/pins" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Generate Activation Pin
                </CardTitle>
                <CardDescription>Generate a unique 12-digit pin for account activation.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
                {generatedCode && (
                  <div className="flex items-center gap-4 bg-muted p-6 rounded-lg border">
                    <div className="text-4xl font-mono font-bold tracking-widest">
                      {generatedCode}
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-12 w-12" 
                      onClick={() => copyToClipboard(generatedCode)}
                    >
                      <Copy className="h-6 w-6" />
                    </Button>
                  </div>
                )}
                <Button onClick={generatePin} disabled={loading} size="lg">
                  {loading ? 'Generating...' : 'Generate New Pin'}
                </Button>
                {(!systemConfig || systemConfig.currentSemester === 'none') && (
                  <p className="text-sm text-destructive font-medium">Semester must be active to generate pins.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Unused Pins ({unusedPins.length})</CardTitle>
                  <CardDescription>Available pins for distribution.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {unusedPins.length > 0 ? (
                      unusedPins.map(pin => (
                        <div key={pin.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                          <div className="flex flex-col">
                            <code className="font-mono font-bold tracking-wider">{pin.code}</code>
                            <span className="text-[10px] text-muted-foreground">{new Date(pin.createdAt).toLocaleDateString()}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => copyToClipboard(pin.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No unused pins available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Used Pins History ({usedPins.length})</CardTitle>
                  <CardDescription>Pins used by students this semester.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {usedPins.length > 0 ? (
                      usedPins.map(pin => (
                        <div key={pin.id} className="p-3 bg-muted/50 rounded-lg border space-y-1">
                          <div className="flex items-center justify-between">
                            <code className="font-mono font-bold text-primary">{pin.code}</code>
                            <span className="text-[10px] text-muted-foreground">{pin.usedAt ? new Date(pin.usedAt).toLocaleString() : 'Unknown'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            <span className="font-semibold">Used by:</span> {pin.usedByStudentId || pin.usedBy}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No pins have been used yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        } />

        <Route path="/system" element={
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Semester Control
                </CardTitle>
                <CardDescription>Manage the active academic semester.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <p className="text-2xl font-bold uppercase text-primary">
                      {systemConfig?.currentSemester === 'none' ? 'Holiday / Ended' : `${systemConfig?.currentSemester} Semester`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    size="lg" 
                    variant={systemConfig?.currentSemester === '1st' ? 'default' : 'outline'}
                    onClick={() => handleUpdateSemester('1st')}
                    disabled={loading || systemConfig?.currentSemester === '1st'}
                  >
                    Start 1st Semester
                  </Button>
                  <Button 
                    size="lg" 
                    variant={systemConfig?.currentSemester === '2nd' ? 'default' : 'outline'}
                    onClick={() => handleUpdateSemester('2nd')}
                    disabled={loading || systemConfig?.currentSemester === '2nd'}
                  >
                    Start 2nd Semester
                  </Button>
                  <Button 
                    size="lg" 
                    variant="destructive"
                    onClick={() => handleUpdateSemester('none')}
                    disabled={loading || systemConfig?.currentSemester === 'none'}
                  >
                    End Current Semester
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground italic">
                  * Ending a semester will deactivate all Level 1 student accounts.
                </p>
              </CardFooter>
            </Card>

            <Card className={systemConfig?.maintenanceMode ? "border-destructive" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className={systemConfig?.maintenanceMode ? "text-destructive" : "text-muted-foreground"} />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>Lock the system for maintenance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`p-4 rounded-lg border flex items-center justify-between ${systemConfig?.maintenanceMode ? "bg-destructive/10 border-destructive/20" : "bg-muted"}`}>
                  <div>
                    <p className="font-bold">{systemConfig?.maintenanceMode ? "System Locked" : "System Active"}</p>
                    <p className="text-xs text-muted-foreground">
                      {systemConfig?.maintenanceMode 
                        ? "Only Level 4 admins can access the portal." 
                        : "All users can access the portal normally."}
                    </p>
                  </div>
                  <Button 
                    variant={systemConfig?.maintenanceMode ? "default" : "destructive"}
                    onClick={handleToggleMaintenance}
                    disabled={loading}
                  >
                    {systemConfig?.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        } />

        <Route path="/verifications" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Verification Queue
                </CardTitle>
                <CardDescription>Approve or reject account activations from Level 2 admins.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {verificationRequests.filter(r => r.status === 'pending').length > 0 ? (
                    verificationRequests.filter(r => r.status === 'pending').map(request => (
                      <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-muted rounded-xl border gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <RefreshCw className="h-6 w-6 animate-spin-slow" />
                          </div>
                          <div>
                            <p className="font-bold">{request.username || 'Unknown Student'}</p>
                            <p className="text-xs text-muted-foreground font-mono">ID: {request.studentId || request.uid}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Pin Used: <code className="font-bold">{request.code}</code></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1 md:flex-none text-destructive hover:bg-destructive/10"
                            onClick={() => handleVerification(request, 'rejected')}
                            disabled={loading}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                          <Button 
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                            onClick={() => handleVerification(request, 'approved')}
                            disabled={loading}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                      <p className="text-muted-foreground">No pending verification requests.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Verification History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {verificationRequests.filter(r => r.status !== 'pending').length > 0 ? (
                    verificationRequests.filter(r => r.status !== 'pending').sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10).map(request => (
                      <div key={request.id} className="flex items-center justify-between p-3 text-sm border rounded-lg bg-muted/50">
                        <div className="flex flex-col">
                          <span className="font-medium">{request.username || request.studentId}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(request.timestamp).toLocaleString()}</span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${request.status === 'approved' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                          {request.status}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No history available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        } />
      </Routes>
    </div>
  );
}

function AdminOverview({ courses, notes, questions, unusedPins, usedPins }: { 
  courses: Course[], 
  notes: Note[], 
  questions: Question[], 
  unusedPins: ActivationCode[], 
  usedPins: ActivationCode[] 
}) {
  const [userStats, setUserStats] = useState<{ date: string, count: number }[]>([]);
  const [cbtStats, setCbtStats] = useState<{ name: string, value: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => d.data());
      
      // Group users by join date
      const groups: Record<string, number> = {};
      users.forEach(u => {
        const date = new Date(u.createdAt).toLocaleDateString();
        groups[date] = (groups[date] || 0) + 1;
      });
      
      const chartData = Object.entries(groups)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);
      
      setUserStats(chartData);

      // Group CBT sessions by course
      const sessionsSnap = await getDocs(collection(db, 'cbt_sessions'));
      const sessions = sessionsSnap.docs.map(d => d.data());
      const courseGroups: Record<string, number> = {};
      sessions.forEach(s => {
        const course = courses.find(c => c.id === s.courseId)?.code || 'Unknown';
        courseGroups[course] = (courseGroups[course] || 0) + 1;
      });

      const pieData = Object.entries(courseGroups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      setCbtStats(pieData);
    };

    fetchStats();
  }, [courses]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CBT Questions</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pins</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unusedPins.length}</div>
            <p className="text-xs text-muted-foreground">{usedPins.length} used so far</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Registration Trend</CardTitle>
            <CardDescription>New users joined over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Most Active Courses</CardTitle>
            <CardDescription>Based on CBT practice sessions.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cbtStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {cbtStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
