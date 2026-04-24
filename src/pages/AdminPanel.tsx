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
import { Badge } from '../components/ui/badge';
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
  Pencil,
  ChevronRight,
  HelpCircle,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
  Bell,
  AlertOctagon,
  Users,
  MessageCircle,
  History as HistoryIcon
} from 'lucide-react';
import { Course, UserLevel, Semester, Note, Question, ActivationCode, VerificationRequest, QuestionSheet, VideoQuestion, NotificationTarget, Announcement, TelegramConfig } from '../types';
import { sendTelegramAlert, testTelegramConnection } from '../services/telegramService';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { NoteBuilder } from '../components/NoteBuilder';
import AdminReports from './AdminReports';
import { useTitle } from '../hooks/useTitle';
import { MathJax } from 'better-react-mathjax';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { DEPARTMENTS } from '../constants/departments';
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
  const { profile, user, systemConfig, promoConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // User Management State
  const [targetUid, setTargetUid] = useState('');
  const [banReason, setBanReason] = useState('');

  // Course Management State
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourse, setNewCourse] = useState({ 
    code: '', 
    title: '', 
    semester: '1st', 
    level: '100',
    department: 'general' 
  });
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [editCourse, setEditCourse] = useState({ 
    code: '', 
    title: '', 
    semester: '1st', 
    level: '100',
    department: 'general' 
  });
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  // Notes State
  const [notes, setNotes] = useState<Note[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newNote, setNewNote] = useState<{
    courseId: string;
    title: string;
    content: string;
    type: Note['type'];
  }>({ courseId: '', title: '', content: '', type: 'lecture' });
  const [createNoteKey, setCreateNoteKey] = useState(0);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [editNote, setEditNote] = useState<{
    courseId: string;
    title: string;
    content: string;
    type: Note['type'];
  }>({ courseId: '', title: '', content: '', type: 'lecture' });

  // CBT & Past Questions State
  const [questionSheets, setQuestionSheets] = useState<QuestionSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<QuestionSheet | null>(null);
  const [newSheet, setNewSheet] = useState({
    courseId: '',
    semester: '1st' as '1st' | '2nd',
    academicLevel: '100',
    year: '',
    isAvailable: true
  });
  const [newQuestion, setNewQuestion] = useState({ 
    text: '', 
    correctAnswer: '', 
    incorrectAnswers: ['', '', ''],
    explanation: '' 
  });
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [sheetToEdit, setSheetToEdit] = useState<QuestionSheet | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  // News State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');

  // Activation Code State
  const [generatedCode, setGeneratedCode] = useState('');
  const [pinType, setPinType] = useState<'standard' | 'plus'>('standard');
  const [unusedPins, setUnusedPins] = useState<ActivationCode[]>([]);
  const [usedPins, setUsedPins] = useState<ActivationCode[]>([]);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Verification Requests State
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  // Notifier State
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyTargetType, setNotifyTargetType] = useState<NotificationTarget>('all');
  const [notifyTargetValue, setNotifyTargetValue] = useState('');
  const [notifyTargetLevel, setNotifyTargetLevel] = useState('100');
  const [notifyTargetDept, setNotifyTargetDept] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Promo Mode State
  const [promoQuota, setPromoQuota] = useState(0);

  // Telegram State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [editTelegram, setEditTelegram] = useState({
    botToken: '',
    chatId: '',
    isActive: false
  });

  // Video Library State
  const [videoFilterLevel, setVideoFilterLevel] = useState('all');
  const [videoFilterDept, setVideoFilterDept] = useState('all');
  const [videoLinkCourseId, setVideoLinkCourseId] = useState('');
  const [videoLinkNoteId, setVideoLinkNoteId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoQuestions, setVideoQuestions] = useState<VideoQuestion[]>([]);
  const [newVideoQuestion, setNewVideoQuestion] = useState({
    text: '',
    correctAnswer: '',
    incorrectAnswers: ['', '', '']
  });
  const [selectedVideoNote, setSelectedVideoNote] = useState<Note | null>(null);

  useEffect(() => {
    if (!profile) return;

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'courses');
    });

    const unsubNotes = onSnapshot(collection(db, 'notes'), (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notes');
    });

    const unsubQuestions = onSnapshot(collection(db, 'questions'), (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'questions');
    });

    const unsubSheets = onSnapshot(collection(db, 'questionSheets'), (snapshot) => {
      setQuestionSheets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'questionSheets');
    });

    const unsubPins = onSnapshot(collection(db, 'activationCodes'), (snapshot) => {
      const allPins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivationCode));
      setUnusedPins(allPins.filter(p => !p.isUsed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setUsedPins(allPins.filter(p => p.isUsed).sort((a, b) => b.usedAt?.localeCompare(a.usedAt || '') || 0));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'activationCodes');
    });

    const unsubVerifications = onSnapshot(collection(db, 'verificationRequests'), (snapshot) => {
      setVerificationRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationRequest)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'verificationRequests');
    });

    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'announcements');
    });

    // Fetch Telegram Config for Level 4
    let unsubTelegram = () => {};
    if (profile.level === '4') {
      unsubTelegram = onSnapshot(doc(db, 'system', 'telegram'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as TelegramConfig;
          setTelegramConfig(data);
          setEditTelegram({
            botToken: data.botToken || '',
            chatId: data.chatId || '',
            isActive: data.isActive || false
          });
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'system/telegram');
      });
    }

    return () => {
      unsubCourses();
      unsubNotes();
      unsubQuestions();
      unsubSheets();
      unsubPins();
      unsubVerifications();
      unsubAnnouncements();
      unsubTelegram();
    };
  }, [profile]);

  useEffect(() => {
    if (!selectedVideoNote) {
      setVideoQuestions([]);
      return;
    }
    const q = query(collection(db, `notes/${selectedVideoNote.id}/videoQuestions`));
    const unsub = onSnapshot(q, (snapshot) => {
      setVideoQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoQuestion)));
    });
    return () => unsub();
  }, [selectedVideoNote]);

  const handleLinkVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLinkNoteId || !videoUrl) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'notes', videoLinkNoteId), { videoUrl });
      toast.success('Video linked to note');
      setVideoUrl('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideoQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoNote || !newVideoQuestion.text || !newVideoQuestion.correctAnswer) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `notes/${selectedVideoNote.id}/videoQuestions`), {
        noteId: selectedVideoNote.id,
        text: newVideoQuestion.text,
        correctAnswer: newVideoQuestion.correctAnswer,
        incorrectAnswers: newVideoQuestion.incorrectAnswers.filter(a => a.trim()),
        createdAt: new Date().toISOString()
      });
      setNewVideoQuestion({ text: '', correctAnswer: '', incorrectAnswers: ['', '', ''] });
      toast.success('Question added to video');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideoQuestion = async (noteId: string, qId: string) => {
    if (!confirm('Delete this video question?')) return;
    try {
      await deleteDoc(doc(db, `notes/${noteId}/videoQuestions`, qId));
      toast.success('Video question deleted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

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
      const userData = userSnap.data();
      await updateDoc(userRef, { level });
      toast.success(`User elevated to Level ${level}`);
      
      // Telegram Alert
      sendTelegramAlert(
        `<b>ALERT: ACCOUNT PROMOTION</b>\n\n` +
        `<b>STUDENT:</b> ${userData.username || 'N/A'}\n` +
        `<b>UID:</b> ${targetUid}\n` +
        `<b>OLD LEVEL:</b> ${userData.level}\n` +
        `<b>NEW LEVEL:</b> ${level}\n` +
        `<b>PROMOTED BY:</b> ${profile?.level} (UID: ${user?.uid})\n` +
        `<b>TIME:</b> ${new Date().toLocaleString()}`
      );

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
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      
      await updateDoc(userRef, { 
        isBanned, 
        banReason: isBanned ? banReason : '' 
      });
      toast.success(isBanned ? 'User banned' : 'User unbanned');

      if (isBanned) {
        // Telegram Alert
        sendTelegramAlert(
          `<b>ALERT: ACCOUNT BANNED</b>\n\n` +
          `<b>STUDENT:</b> ${userData?.username || 'N/A'}\n` +
          `<b>UID:</b> ${targetUid}\n` +
          `<b>REASON:</b> ${banReason}\n` +
          `<b>BANNED BY:</b> ${profile?.level} (UID: ${user?.uid})\n` +
          `<b>TIME:</b> ${new Date().toLocaleString()}`
        );
      }

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
        department: newCourse.department || null,
        createdAt: new Date().toISOString()
      });
      toast.success('Course created successfully');
      setNewCourse({ code: '', title: '', semester: '1st', level: '100', department: 'general' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseToEdit) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'courses', courseToEdit.id), {
        ...editCourse,
        updatedAt: new Date().toISOString()
      });
      toast.success('Course updated successfully');
      setCourseToEdit(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) {
      console.warn("Delete attempted without course ID");
      return;
    }
    
    setLoading(true);
    console.log(`Starting deletion for course: ${courseToDelete}`);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Delete associated notes
      const notesQuery = query(collection(db, 'notes'), where('courseId', '==', courseToDelete));
      const notesSnap = await getDocs(notesQuery);
      console.log(`Found ${notesSnap.size} associated notes to delete`);
      notesSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 2. Delete associated question sheets
      const sheetsQuery = query(collection(db, 'questionSheets'), where('courseId', '==', courseToDelete));
      const sheetsSnap = await getDocs(sheetsQuery);
      console.log(`Found ${sheetsSnap.size} associated question sheets to delete`);
      sheetsSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 3. Delete associated questions (they have courseId too)
      const questionsQuery = query(collection(db, 'questions'), where('courseId', '==', courseToDelete));
      const questionsSnap = await getDocs(questionsQuery);
      console.log(`Found ${questionsSnap.size} associated questions to delete`);
      questionsSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 4. Finally delete the course itself
      batch.delete(doc(db, 'courses', courseToDelete));
      
      await batch.commit();
      console.log("Cascading deletion completed successfully");
      
      toast.success('Course and all associated materials deleted');
      setCourseToDelete(null);
    } catch (error: any) {
      console.error("Course deletion failed:", error);
      toast.error(`Deletion failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const toastId = toast.loading("Creating new note...");
    try {
      await addDoc(collection(db, 'notes'), {
        ...newNote,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Note created successfully', { id: toastId });
      setNewNote({ courseId: '', title: '', content: '', type: 'lecture' });
      setCreateNoteKey(prev => prev + 1);
    } catch (error: any) {
      toast.error("Failed to create note", { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, 'notes');
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

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleUpdateNote triggered", { noteToEdit, editNote });
    if (!noteToEdit) {
      toast.error("No note selected for editing");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Saving changes to note...");
    try {
      console.log("Updating document...", noteToEdit.id);
      await updateDoc(doc(db, 'notes', noteToEdit.id), {
        ...editNote,
        updatedAt: new Date().toISOString()
      });
      console.log("Update successful");
      toast.success('Note updated successfully', { id: toastId });
      setNoteToEdit(null);
    } catch (error: any) {
      console.error("Update failed", error);
      toast.error("Failed to update note", { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, `notes/${noteToEdit.id}`);
    } finally {
      setLoading(false);
    }
  };

  const [sheetQuestions, setSheetQuestions] = useState<Question[]>([]);
  useEffect(() => {
    if (!selectedSheet) {
      setSheetQuestions([]);
      return;
    }
    const q = query(collection(db, 'questions'), where('sheetId', '==', selectedSheet.id));
    const unsub = onSnapshot(q, (snapshot) => {
      setSheetQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)).sort((a, b) => a.order - b.order));
    });
    return () => unsub();
  }, [selectedSheet]);

  const handleCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'questionSheets'), {
        ...newSheet,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Question sheet created');
      setNewSheet({ courseId: '', semester: '1st', academicLevel: '100', year: '', isAvailable: true });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetToEdit) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'questionSheets', sheetToEdit.id), {
        semester: sheetToEdit.semester,
        academicLevel: sheetToEdit.academicLevel,
        year: sheetToEdit.year,
        isAvailable: sheetToEdit.isAvailable
      });
      toast.success('Sheet updated');
      setSheetToEdit(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    setLoading(true);
    try {
      // Delete all questions in this sheet first
      const q = query(collection(db, 'questions'), where('sheetId', '==', sheetToDelete));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'questionSheets', sheetToDelete));
      await batch.commit();

      toast.success('Sheet and all questions deleted');
      setSheetToDelete(null);
      if (selectedSheet?.id === sheetToDelete) setSelectedSheet(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSheet) return;
    if (!newQuestion.text || !newQuestion.correctAnswer) {
      toast.error('Please fill required fields');
      return;
    }
    setLoading(true);
    try {
      const order = questions.length + 1;
      await addDoc(collection(db, 'questions'), {
        ...newQuestion,
        sheetId: selectedSheet.id,
        courseId: selectedSheet.courseId,
        order,
        authorId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Question added to sheet');
      setNewQuestion({ text: '', correctAnswer: '', incorrectAnswers: ['', '', ''], explanation: '' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'questions', editingQuestion.id), {
        text: editingQuestion.text,
        correctAnswer: editingQuestion.correctAnswer,
        incorrectAnswers: editingQuestion.incorrectAnswers,
        explanation: editingQuestion.explanation
      });
      toast.success('Question updated');
      setEditingQuestion(null);
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
        createdAt: new Date().toISOString(),
        type: pinType
      });
      setGeneratedCode(pin);
      toast.success('Activation pin generated');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePin = async () => {
    if (!pinToDelete) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'activationCodes', pinToDelete));
      toast.success('Pin removed');
      setPinToDelete(null);
    } catch (error: any) {
      console.error("Delete pin error:", error);
      toast.error('Failed to delete: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearUsedPins = async () => {
    if (usedPins.length === 0) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      // Firebase batch limit is 500. For safety, we only clear the first 450 if more exist.
      const pinsToProcess = usedPins.slice(0, 450);
      pinsToProcess.forEach(pin => {
        batch.delete(doc(db, 'activationCodes', pin.id));
      });
      await batch.commit();
      toast.success('History cleared');
      setShowClearConfirm(false);
    } catch (error: any) {
      console.error("Clear pins error:", error);
      toast.error('Failed to clear: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyNoteAsScript = (note: Note) => {
    try {
      const blocks = JSON.parse(note.content);
      const script = blocks
        .filter((b: any) => b.type !== 'diagram')
        .map((b: any) => {
          if (b.type === 'h1') return `\n[HEADING: ${b.content}]\n`;
          if (b.type === 'h2') return `\n[SUBHEADING: ${b.content}]\n`;
          if (b.type === 'math') return `[LATEX: ${b.content}]`;
          if (b.type === 'table') return `\n[TABLE DATA: ${b.content}]\n`;
          return b.content;
        })
        .join('\n');
      
      const course = courses.find(c => c.id === note.courseId);
      const fullText = `VOICE OVER SCRIPT\nCOURSE: ${course?.code || 'N/A'}\nTITLE: ${note.title}\nTYPE: ${note.type}\n\n--- CONTENT ---\n${script}\n--- END ---`;
      copyToClipboard(fullText);
    } catch (e) {
      copyToClipboard(note.content);
    }
  };

  const handleUpdateSemester = async (semester: Semester) => {
    if (!user) return;
    setLoading(true);
    console.log(`Updating semester to: ${semester}`);
    try {
      const configRef = doc(db, 'system', 'config');
      const updateData: any = {
        currentSemester: semester,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      };
      
      // Preserve maintenance mode if it exists in current local state
      if (systemConfig) {
        updateData.maintenanceMode = systemConfig.maintenanceMode;
      }
      
      await setDoc(configRef, updateData, { merge: true });
      console.log("System config updated successfully");

      // If ending a semester, demote 1+ and deactivate 1
      if (semester === 'none') {
        const batch = writeBatch(db);
        let countDeactivated = 0;
        let countDemoted = 0;

        try {
          // 1. Deactivate Level 1 users
          const level1Query = query(collection(db, 'users'), where('level', '==', '1'), where('isActivated', '==', true));
          const level1Snap = await getDocs(level1Query);
          level1Snap.docs.forEach((userDoc) => {
            batch.update(userDoc.ref, { isActivated: false });
            countDeactivated++;
          });

          // 2. Demote Level 1+ users while keeping them activated
          const level1PlusQuery = query(collection(db, 'users'), where('level', '==', '1+'));
          const level1PlusSnap = await getDocs(level1PlusQuery);
          level1PlusSnap.docs.forEach((userDoc) => {
            batch.update(userDoc.ref, { level: '1' });
            countDemoted++;
          });

          await batch.commit();
          toast.success(`Semester ended. ${countDeactivated} deactivated, ${countDemoted} demoted.`);
        } catch (innerError: any) {
          console.error("Batch update failed during semester end:", innerError);
          toast.error(`Semester config updated, but user reset failed: ${innerError.message}. Please check indexes.`);
        }
      } else {
        toast.success(`${semester} Semester started.`);
      }
    } catch (error: any) {
      console.error("Semester update error:", error);
      toast.error(`Failed to update semester: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePromo = async (active: boolean) => {
    if (!profile || profile.level !== '4') return;
    if (active && promoQuota <= 0) {
      toast.error("Please set a valid quota first");
      return;
    }
    
    setLoading(true);
    
    try {
      await setDoc(doc(db, 'system', 'promo'), {
        isActive: active,
        quota: active ? promoQuota : 0,
        count: active ? 0 : (promoConfig?.count || 0),
        updatedBy: user?.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success(`Promo mode ${active ? 'started' : 'stopped'}`);
    } catch (error) {
      toast.error('Failed to update promo config');
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

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLevel4) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'system', 'telegram'), {
        ...editTelegram,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid
      });
      toast.success('Telegram configuration saved');
    } catch (error: any) {
      toast.error('Failed to save Telegram config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!editTelegram.botToken || !editTelegram.chatId) {
      toast.error('Token and Chat ID are required for testing');
      return;
    }
    setLoading(true);
    try {
      const result = await testTelegramConnection(editTelegram.botToken, editTelegram.chatId);
      if (result.success) {
        toast.success('Test message sent successfully! Check your Telegram chat.');
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error('Connection test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !notifyTitle || !notifyMessage) return;
    setLoading(true);
    try {
      let finalTargetValue = notifyTargetValue;
      if (notifyTargetType === 'academicLevel') finalTargetValue = notifyTargetLevel;
      if (notifyTargetType === 'level') finalTargetValue = notifyTargetValue; // Reuse for UID or specific level string
      if (notifyTargetType === 'department') finalTargetValue = notifyTargetDept;
      if (notifyTargetType === 'level_dept') finalTargetValue = `${notifyTargetLevel}_${notifyTargetDept}`;
      if (notifyTargetType === 'all') finalTargetValue = 'everyone';

      await addDoc(collection(db, 'announcements'), {
        title: notifyTitle,
        message: notifyMessage,
        type: 'announcement',
        targetType: notifyTargetType,
        targetValue: finalTargetValue,
        createdAt: new Date().toISOString(),
        authorId: user.uid
      });
      toast.success('Announcement broadcasted successfully');
      setNotifyTitle('');
      setNotifyMessage('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast.success('Announcement deleted');
    } catch (error: any) {
      toast.error(error.message);
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
  const isAtLeastLevel3 = profile?.level === '3' || profile?.level === '4';
  const isLevel2 = profile?.level === '2';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, courses, and platform content.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        <Button variant={location.pathname === '/administrator' ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator')}>Overview</Button>
        {isAtLeastLevel3 && (
          <>
            <Button variant={location.pathname.includes('users') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/users')}>Users</Button>
            <Button variant={location.pathname.includes('courses') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/courses')}>Courses</Button>
            <Button variant={location.pathname.includes('notes') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/notes')}>Notes</Button>
            <Button variant={location.pathname.includes('cbt') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/cbt')}>CBT</Button>
            <Button variant={location.pathname.includes('news') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/news')}>News</Button>
          </>
        )}
        <Button variant={location.pathname.includes('pins') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/pins')}>Pins</Button>
        {isAtLeastLevel3 && (
          <>
            <Button variant={location.pathname.includes('videos') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/videos')}>Video Library</Button>
            <Button variant={location.pathname.includes('notifier') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/notifier')}>Notifier</Button>
            <Button variant={location.pathname.includes('reports') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/reports')}>Reports</Button>
          </>
        )}
        <Button variant={location.pathname.includes('manual') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/manual')}>Admin Manual</Button>
        {isLevel4 && <Button variant={location.pathname.includes('system') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/system')}>System</Button>}
      </div>

      <Routes>
        <Route index element={<AdminOverview courses={courses} notes={notes} questions={questions} unusedPins={unusedPins} usedPins={usedPins} />} />
        <Route path="/manual" element={<AdminManual />} />
        <Route path="/videos" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Link Video to Note
                </CardTitle>
                <CardDescription>Select a course and note to attach an unlisted YouTube video URL.</CardDescription>
              </CardHeader>
              <form onSubmit={handleLinkVideo}>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Filter Level</Label>
                      <Select value={videoFilterLevel} onValueChange={setVideoFilterLevel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="100">100 Level</SelectItem>
                          <SelectItem value="200">200 Level</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Filter Department</Label>
                      <Select value={videoFilterDept} onValueChange={setVideoFilterDept}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          <SelectItem value="General">General Courses</SelectItem>
                          {DEPARTMENTS.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <Select value={videoLinkCourseId} onValueChange={setVideoLinkCourseId}>
                        <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                        <SelectContent>
                          {courses
                            .filter(c => videoFilterLevel === 'all' || c.level === videoFilterLevel)
                            .filter(c => videoFilterDept === 'all' || (videoFilterDept === 'General' ? !c.department : c.department === videoFilterDept))
                            .map(course => (
                            <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Select value={videoLinkNoteId} onValueChange={setVideoLinkNoteId} disabled={!videoLinkCourseId}>
                        <SelectTrigger><SelectValue placeholder="Select Note" /></SelectTrigger>
                        <SelectContent>
                          {notes.filter(n => n.courseId === videoLinkCourseId).map(note => (
                            <SelectItem key={note.id} value={note.id}>{note.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>YouTube URL</Label>
                      <Input 
                        value={videoUrl} 
                        onChange={(e) => setVideoUrl(e.target.value)} 
                        placeholder="e.g. https://youtu.be/..." 
                        required 
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading || !videoLinkNoteId}>Link to Note</Button>
                </CardFooter>
              </form>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Video Lessons Library</CardTitle>
                  <CardDescription>Manage quizzes for notes with linked videos.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {notes.filter(n => n.videoUrl).length > 0 ? (
                      notes.filter(n => n.videoUrl).map(note => (
                        <div key={note.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium">{note.title}</p>
                            <p className="text-[10px] text-muted-foreground">{courses.find(c => c.id === note.courseId)?.code}</p>
                          </div>
                          <Button size="sm" variant={selectedVideoNote?.id === note.id ? "default" : "outline"} onClick={() => setSelectedVideoNote(note)}>
                            Manage Quiz
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No videos linked yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {selectedVideoNote && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Quiz: {selectedVideoNote.title}</CardTitle>
                        <CardDescription>Add concept check questions for this video lesson.</CardDescription>
                      </div>
                      <Badge variant="outline">{videoQuestions.length} Qs</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <form onSubmit={handleAddVideoQuestion} className="space-y-6 p-6 border rounded-2xl bg-primary/5 shadow-inner">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-primary">New Quiz Question</Label>
                          <Textarea 
                            value={newVideoQuestion.text} 
                            onChange={(e) => setNewVideoQuestion({...newVideoQuestion, text: e.target.value})} 
                            placeholder="Question text (LaTeX supported)" 
                            className="font-mono bg-background"
                            required 
                          />
                        </div>
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-dashed text-sm">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Text Preview</p>
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {newVideoQuestion.text || '_No preview_'}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="grid gap-4">
                        <Label className="text-[10px] font-bold uppercase text-green-600">Correct Answer</Label>
                        <Input value={newVideoQuestion.correctAnswer} onChange={(e) => setNewVideoQuestion({...newVideoQuestion, correctAnswer: e.target.value})} placeholder="The right answer" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Incorrect Options</Label>
                        <div className="grid gap-2">
                          {newVideoQuestion.incorrectAnswers.map((ans, i) => (
                            <Input 
                              key={i}
                              value={ans} 
                              onChange={(e) => {
                                const newAns = [...newVideoQuestion.incorrectAnswers];
                                newAns[i] = e.target.value;
                                setNewVideoQuestion({...newVideoQuestion, incorrectAnswers: newAns});
                              }} 
                              placeholder={`Wrong Option ${i + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>Add Question</Button>
                    </form>

                    <div className="space-y-3">
                      {videoQuestions.map(q => (
                        <div key={q.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="text-sm font-medium prose prose-sm dark:prose-invert">
                              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {q.text}
                              </ReactMarkdown>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteVideoQuestion(selectedVideoNote.id, q.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge className="bg-green-500/10 text-green-600 border-none text-[9px]">{q.correctAnswer}</Badge>
                            {q.incorrectAnswers.map((a, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] opacity-70">{a}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        } />
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
          <div className="space-y-6">
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
                    <Select value={newCourse.level} onValueChange={(v) => setNewCourse({...newCourse, level: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department (Optional)</Label>
                    <Select value={newCourse.department} onValueChange={(v) => setNewCourse({...newCourse, department: v})}>
                      <SelectTrigger><SelectValue placeholder="General / All Departments" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General / All Departments</SelectItem>
                        {DEPARTMENTS.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading}>Create Course</Button>
                </CardFooter>
              </form>
            </Card>

            <div className="grid gap-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 px-1">
                <BookPlus className="h-5 w-5 text-primary" />
                Existing Courses
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-bold">{course.code}</CardTitle>
                        <CardDescription className="text-xs line-clamp-1">{course.title}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setCourseToEdit(course);
                          setEditCourse({
                            code: course.code,
                            title: course.title,
                            semester: course.semester,
                            level: course.level,
                            department: course.department || 'general'
                          });
                        }} disabled={loading}>
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setCourseToDelete(course.id)} disabled={loading}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px]">{course.level} Level</Badge>
                        <Badge variant="outline" className="text-[10px]">{course.semester} Sem</Badge>
                        {course.department && course.department !== 'general' && (
                          <Badge variant="secondary" className="text-[10px] truncate max-w-[120px]">{course.department}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
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
                    <Input 
                      value={newNote.title} 
                      onChange={(e) => setNewNote({...newNote, title: e.target.value})} 
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      placeholder="Introduction to Calculus" 
                      required 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Note Content Builder</Label>
                    <NoteBuilder 
                      key={`create-note-${createNoteKey}`}
                      initialContent={newNote.content} 
                      onChange={(content) => setNewNote({...newNote, content})} 
                      mode="create"
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Copy as Voice-over Script" onClick={() => copyNoteAsScript(note)} disabled={loading}>
                          <FileText className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setNoteToEdit(note);
                          setEditNote({ courseId: note.courseId, title: note.title, content: note.content, type: note.type });
                        }} disabled={loading}>
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setNoteToDelete(note.id)} disabled={loading}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-1">{previewText}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Dialog open={!!noteToEdit} onOpenChange={(open) => !open && setNoteToEdit(null)}>
              <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] max-h-[98vh] h-[98vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-2xl">Edit Note</DialogTitle>
                  <DialogDescription>Update note details and mathematical content in real-time.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateNote} className="flex-1 flex flex-col min-h-0 gap-4 mt-2">
                  <div className="shrink-0 grid gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Course</Label>
                      <Select value={editNote.courseId} onValueChange={(v) => setEditNote({...editNote, courseId: v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Course" /></SelectTrigger>
                        <SelectContent>
                          {courses.map(course => (
                            <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Type</Label>
                      <Select value={editNote.type} onValueChange={(v) => setEditNote({...editNote, type: v as any})}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lecture">Lecture Note</SelectItem>
                          <SelectItem value="punch">Punch Note</SelectItem>
                          <SelectItem value="past_question">Past Question</SelectItem>
                          <SelectItem value="cbt">CBT Practice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Note Title</Label>
                      <Input 
                        value={editNote.title} 
                        onChange={(e) => setEditNote({...editNote, title: e.target.value})} 
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder="e.g., First Order Differential Equations" 
                        required 
                        className="h-10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-0 flex flex-col border rounded-xl overflow-hidden shadow-inner">
                    <div className="flex-1 min-h-0">
                      <NoteBuilder 
                        key={noteToEdit?.id || 'edit-note'}
                        initialContent={editNote.content} 
                        onChange={(content) => setEditNote({...editNote, content})} 
                        mode="edit"
                      />
                    </div>
                  </div>

                  <DialogFooter className="shrink-0 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setNoteToEdit(null)}>Cancel Changes</Button>
                    <Button 
                      type="submit" 
                      disabled={loading} 
                      className="bg-primary hover:bg-primary/90 px-8"
                      onClick={(e) => {
                        // Ensure state is updated before submit if necessary
                        // handleUpdateNote uses editNote state
                      }}
                    >
                      {loading ? 'Saving...' : 'Save & Publish Note'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

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

            <Dialog open={!!courseToEdit} onOpenChange={(open) => !open && setCourseToEdit(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Course</DialogTitle>
                  <DialogDescription>Update course details below.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateCourse}>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Course Code</Label>
                      <Input value={editCourse.code} onChange={(e) => setEditCourse({...editCourse, code: e.target.value})} placeholder="MATH101" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Course Title</Label>
                      <Input value={editCourse.title} onChange={(e) => setEditCourse({...editCourse, title: e.target.value})} placeholder="General Mathematics I" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Select value={editCourse.semester} onValueChange={(v) => setEditCourse({...editCourse, semester: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1st">1st Semester</SelectItem>
                          <SelectItem value="2nd">2nd Semester</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Level</Label>
                      <Select value={editCourse.level} onValueChange={(v) => setEditCourse({...editCourse, level: v})}>
                        <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={editCourse.department} onValueChange={(v) => setEditCourse({...editCourse, department: v})}>
                        <SelectTrigger><SelectValue placeholder="General / All Departments" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General / All Departments</SelectItem>
                          {DEPARTMENTS.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCourseToEdit(null)}>Cancel</Button>
                    <Button type="submit" disabled={loading}>Update Course</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Course</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this course? All associated notes and questions might be orphaned or inaccessible. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCourseToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteCourse} disabled={loading}>Delete Course</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } />

        <Route path="/questions" element={
          <div className="space-y-6">
            {!selectedSheet ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add New Question Sheet
                    </CardTitle>
                    <CardDescription>Create a collection of questions for a specific year and semester.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleCreateSheet}>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Course</Label>
                        <Select value={newSheet.courseId} onValueChange={(v) => setNewSheet({...newSheet, courseId: v})}>
                          <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                          <SelectContent>
                            {courses.map(course => (
                              <SelectItem key={course.id} value={course.id}>{course.code} - {course.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Academic Level</Label>
                        <Select value={newSheet.academicLevel} onValueChange={(v) => setNewSheet({...newSheet, academicLevel: v})}>
                          <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">100 Level</SelectItem>
                            <SelectItem value="200">200 Level</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Semester</Label>
                        <Select value={newSheet.semester} onValueChange={(v: any) => setNewSheet({...newSheet, semester: v})}>
                          <SelectTrigger><SelectValue placeholder="Select Semester" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1st">1st Semester</SelectItem>
                            <SelectItem value="2nd">2nd Semester</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Examination Year</Label>
                        <Input 
                          value={newSheet.year} 
                          onChange={(e) => setNewSheet({...newSheet, year: e.target.value})} 
                          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                          placeholder="e.g. 2022/2023" 
                          required 
                        />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" disabled={loading || !newSheet.courseId}>Create Question Sheet</Button>
                    </CardFooter>
                  </form>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {questionSheets.map(sheet => {
                    const course = courses.find(c => c.id === sheet.courseId);
                    return (
                      <Card key={sheet.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <Badge variant={sheet.isAvailable ? "secondary" : "destructive"}>
                              {sheet.isAvailable ? "Available" : "Disabled"}
                            </Badge>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSheetToEdit(sheet)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSheetToDelete(sheet.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <CardTitle className="text-lg">{course?.code || 'Course'} - {sheet.year}</CardTitle>
                          <CardDescription>{sheet.academicLevel} Level • {sheet.semester} Semester</CardDescription>
                        </CardHeader>
                        <CardFooter>
                          <Button variant="outline" className="w-full" onClick={() => setSelectedSheet(sheet)}>
                            Manage Questions
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => setSelectedSheet(null)}>
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold">{courses.find(c => c.id === selectedSheet.courseId)?.code} - {selectedSheet.year}</h2>
                      <p className="text-muted-foreground">{selectedSheet.academicLevel} Level • {selectedSheet.semester} Semester</p>
                    </div>
                  </div>
                  <Badge>{sheetQuestions.length} Questions</Badge>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Add New Question</CardTitle>
                    <CardDescription>Enter question details. You can use LaTeX for math symbols.</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleCreateQuestion}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Textarea value={newQuestion.text} onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})} placeholder="e.g. Find \int x dx" required />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-primary font-bold">Correct Answer</Label>
                          <Input value={newQuestion.correctAnswer} onChange={(e) => setNewQuestion({...newQuestion, correctAnswer: e.target.value})} placeholder="Correct Option" required />
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
                        <Textarea value={newQuestion.explanation} onChange={(e) => setNewQuestion({...newQuestion, explanation: e.target.value})} placeholder="Detailed explanation for the answer" />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" disabled={loading}>Add to Sheet</Button>
                    </CardFooter>
                  </form>
                </Card>

                <div className="grid gap-4">
                  {sheetQuestions.map((q, idx) => (
                    <Card key={q.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline">Q{idx + 1}</Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingQuestion(q)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setQuestionToDelete(q.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 prose dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {q.text}
                          </ReactMarkdown>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                          <div className="p-2 rounded bg-primary/10 border border-primary/20">
                            <p className="text-[10px] font-bold uppercase text-primary mb-1">Correct</p>
                            <p className="text-sm">{q.correctAnswer}</p>
                          </div>
                          {q.incorrectAnswers.map((ans, i) => (
                            <div key={i} className="p-2 rounded bg-muted">
                              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Incorrect {i+1}</p>
                              <p className="text-sm">{ans}</p>
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm border border-blue-100 dark:border-blue-900/30">
                            <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">Explanation:</p>
                            <p className="text-muted-foreground">{q.explanation}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Editing Modals */}
            <Dialog open={!!sheetToEdit} onOpenChange={(open) => !open && setSheetToEdit(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Question Sheet</DialogTitle>
                </DialogHeader>
                {sheetToEdit && (
                  <form onSubmit={handleUpdateSheet} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input value={sheetToEdit.year} onChange={(e) => setSheetToEdit({...sheetToEdit, year: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Level</Label>
                        <Select value={sheetToEdit.academicLevel} onValueChange={(v) => setSheetToEdit({...sheetToEdit, academicLevel: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">100 Level</SelectItem>
                            <SelectItem value="200">200 Level</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Semester</Label>
                        <Select value={sheetToEdit.semester} onValueChange={(v: any) => setSheetToEdit({...sheetToEdit, semester: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1st">1st Semester</SelectItem>
                            <SelectItem value="2nd">2nd Semester</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="isAvailable" 
                        checked={sheetToEdit.isAvailable} 
                        onChange={(e) => setSheetToEdit({...sheetToEdit, isAvailable: e.target.checked})}
                      />
                      <Label htmlFor="isAvailable">Available for students</Label>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>Save Changes</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Question</DialogTitle>
                </DialogHeader>
                {editingQuestion && (
                  <form onSubmit={handleUpdateQuestion} className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Question Text (Supports LaTeX)</Label>
                        <Textarea 
                          value={editingQuestion.text} 
                          onChange={(e) => setEditingQuestion({...editingQuestion, text: e.target.value})} 
                          required 
                          className="min-h-[100px] font-mono"
                          placeholder="Type question text. Use $...$ for inline or $$...$$ for block LaTeX."
                        />
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Live Preview</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {editingQuestion.text || '_No text entered_'}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <Input value={editingQuestion.correctAnswer} onChange={(e) => setEditingQuestion({...editingQuestion, correctAnswer: e.target.value})} required />
                      </div>
                      {editingQuestion.incorrectAnswers.map((ans, i) => (
                        <div key={i} className="space-y-2">
                          <Label>Incorrect Option {i + 1}</Label>
                          <Input 
                            value={ans} 
                            onChange={(e) => {
                              const newAns = [...editingQuestion.incorrectAnswers];
                              newAns[i] = e.target.value;
                              setEditingQuestion({...editingQuestion, incorrectAnswers: newAns});
                            }} 
                            required 
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Explanation (Supports LaTeX)</Label>
                        <Textarea 
                          value={editingQuestion.explanation} 
                          onChange={(e) => setEditingQuestion({...editingQuestion, explanation: e.target.value})} 
                          className="font-mono"
                          placeholder="Explain the answer..."
                        />
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                        <p className="text-[10px] font-bold uppercase text-blue-600 mb-2">Explanation Preview</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                            {editingQuestion.explanation || '_No explanation provided_'}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>Update Question</Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={!!sheetToDelete} onOpenChange={(open) => !open && setSheetToDelete(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Delete Question Sheet</DialogTitle></DialogHeader>
                <div className="py-4">Are you sure you want to delete this sheet and all its settings? This action cannot be undone.</div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSheetToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteSheet} disabled={loading}>Delete Sheet</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Delete Question</DialogTitle></DialogHeader>
                <div className="py-4">Are you sure you want to delete this question?</div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setQuestionToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteQuestion} disabled={loading}>Delete Question</Button>
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
                    <div className="flex flex-col">
                      <div className="text-4xl font-mono font-bold tracking-widest">
                        {generatedCode}
                      </div>
                      <Badge variant={pinType === 'plus' ? 'default' : 'secondary'} className="w-fit mt-1">
                        {pinType === 'plus' ? 'PLUS PIN (Level 1+)' : 'STANDARD PIN (Level 1)'}
                      </Badge>
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
                
                <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                  <div className="flex items-center gap-4 w-full">
                    <Button 
                      variant={pinType === 'standard' ? 'default' : 'outline'} 
                      className="flex-1"
                      onClick={() => setPinType('standard')}
                    >
                      Standard
                    </Button>
                    <Button 
                      variant={pinType === 'plus' ? 'default' : 'outline'} 
                      className="flex-1"
                      onClick={() => setPinType('plus')}
                    >
                      PLUS
                    </Button>
                  </div>
                  
                  <Button onClick={generatePin} disabled={loading} size="lg" className="w-full">
                    {loading ? 'Generating...' : `Generate ${pinType.toUpperCase()} Pin`}
                  </Button>
                </div>
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
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono font-bold tracking-wider">{pin.code}</code>
                              {pin.type === 'plus' && (
                                <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{new Date(pin.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              onClick={() => copyToClipboard(pin.code)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                              onClick={() => setPinToDelete(pin.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No unused pins available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle>Used Pins History ({usedPins.length})</CardTitle>
                    <CardDescription>Pins used by students this semester.</CardDescription>
                  </div>
                  {usedPins.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive text-xs hover:bg-destructive/10"
                      onClick={() => setShowClearConfirm(true)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {usedPins.length > 0 ? (
                      usedPins.map(pin => (
                        <div key={pin.id} className="p-3 bg-muted/50 rounded-lg border space-y-2 relative group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <code className="font-mono font-bold text-primary">{pin.code}</code>
                              {pin.type === 'plus' && (
                                <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{pin.usedAt ? new Date(pin.usedAt).toLocaleString() : 'Unknown'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground truncate flex-1">
                              <span className="font-semibold">Used by:</span> {pin.usedByStudentId || pin.usedBy}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                              onClick={() => setPinToDelete(pin.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No pins have been used yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pin Management Dialogs */}
            <Dialog open={!!pinToDelete} onOpenChange={(open) => !open && setPinToDelete(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Pin</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this activation pin? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPinToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeletePin} disabled={loading}>
                    {loading ? 'Deleting...' : 'Delete Pin'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear Used Pins History</DialogTitle>
                  <DialogDescription>
                    This will permanently delete up to 450 used pin records. 
                    Are you sure you want to proceed?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleClearUsedPins} disabled={loading}>
                    {loading ? 'Clearing...' : 'Clear All History'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-amber-500" />
                  Promo Mode Setup
                </CardTitle>
                <CardDescription>Enable free activations for a limited batch of students (Level 4 Only).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {promoConfig?.isActive ? (
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 animate-pulse border-none">PROMO ACTIVE</Badge>
                        <span className="text-sm font-bold">{promoConfig.count} / {promoConfig.quota} Activations</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleTogglePromo(false)}
                        disabled={loading}
                      >
                        Stop Promo
                      </Button>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (promoConfig.count / promoConfig.quota) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 items-end sm:grid-cols-[1fr,auto]">
                    <div className="space-y-2">
                      <Label>Free Activation Quota (x)</Label>
                      <Input 
                        type="number" 
                        placeholder="e.g. 50" 
                        value={promoQuota === 0 ? '' : promoQuota} 
                        onChange={(e) => setPromoQuota(parseInt(e.target.value) || 0)}
                        min="1"
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      />
                    </div>
                    <Button 
                      className="bg-amber-600 hover:bg-amber-700" 
                      onClick={() => handleTogglePromo(true)}
                      disabled={loading || promoQuota <= 0}
                    >
                      Start Promo Mode
                    </Button>
                  </div>
                )}
              </CardContent>
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

            {isLevel4 && (
              <Card className="border-sky-500/20 bg-sky-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sky-600">
                    <MessageCircle className="h-5 w-5" />
                    Telegram Alerts Configuration
                  </CardTitle>
                  <CardDescription>Set up bot credentials for real-time system alerts.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSaveTelegram}>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-sky-200 dark:border-sky-900">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Alerts Active</Label>
                        <p className="text-xs text-muted-foreground">Enable or disable all Telegram notifications.</p>
                      </div>
                      <div 
                        className={`w-12 h-6 rounded-full cursor-pointer transition-colors ${editTelegram.isActive ? 'bg-sky-500' : 'bg-muted'}`}
                        onClick={() => setEditTelegram(prev => ({ ...prev, isActive: !prev.isActive }))}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white mt-1 transition-transform ${editTelegram.isActive ? 'translate-x-7' : 'translate-x-1'}`} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Bot API Token</Label>
                      <Input 
                        type="password" 
                        value={editTelegram.botToken} 
                        onChange={(e) => setEditTelegram(prev => ({ ...prev, botToken: e.target.value }))}
                        placeholder="Enter Telegram Bot Token"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Chat ID</Label>
                      <Input 
                        value={editTelegram.chatId} 
                        onChange={(e) => setEditTelegram(prev => ({ ...prev, chatId: e.target.value }))}
                        placeholder="Enter Chat ID or Channel Name"
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      className="flex-1"
                      onClick={handleTestTelegram}
                      disabled={loading}
                    >
                      Test Connection
                    </Button>
                    <Button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-700" disabled={loading}>
                      Save Configuration
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            )}
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

        <Route path="/notifier" element={
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Send Announcement
                </CardTitle>
                <CardDescription>Broadcast a notification to users based on specific filters.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSendBroadcast}>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Target Type</Label>
                      <Select value={notifyTargetType} onValueChange={(v: any) => setNotifyTargetType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="level">Permission Level</SelectItem>
                          <SelectItem value="uid">Specific User (UID)</SelectItem>
                          <SelectItem value="academicLevel">Academic Level</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                          <SelectItem value="level_dept">Level & Department</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Selection</Label>
                      {notifyTargetType === 'all' && (
                        <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground italic">
                          Targeting everyone
                        </div>
                      )}
                      {notifyTargetType === 'level' && (
                        <Select value={notifyTargetValue} onValueChange={setNotifyTargetValue}>
                          <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="1+">Level 1+</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                            <SelectItem value="4">Level 4</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {notifyTargetType === 'uid' && (
                        <Input 
                          placeholder="Paste User UID" 
                          value={notifyTargetValue} 
                          onChange={(e) => setNotifyTargetValue(e.target.value)} 
                          required 
                        />
                      )}
                      {notifyTargetType === 'academicLevel' && (
                        <Select value={notifyTargetLevel} onValueChange={setNotifyTargetLevel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">100 Level</SelectItem>
                            <SelectItem value="200">200 Level</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {notifyTargetType === 'department' && (
                        <Select value={notifyTargetDept} onValueChange={setNotifyTargetDept}>
                          <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(dept => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {notifyTargetType === 'level_dept' && (
                        <div className="flex gap-2">
                          <Select value={notifyTargetLevel} onValueChange={setNotifyTargetLevel}>
                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100">100</SelectItem>
                              <SelectItem value="200">200</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={notifyTargetDept} onValueChange={setNotifyTargetDept}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Dept" /></SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      placeholder="e.g. System Update" 
                      value={notifyTitle} 
                      onChange={(e) => setNotifyTitle(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      placeholder="Type your notification message here..." 
                      value={notifyMessage} 
                      onChange={(e) => setNotifyMessage(e.target.value)} 
                      rows={4} 
                      required 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading} className="w-full h-12 text-lg">
                    {loading ? 'Sending...' : 'Broadcast Notification'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sent Announcements</CardTitle>
                <CardDescription>History of broadcasted notifications.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {announcements.length > 0 ? (
                    announcements.slice(0, 10).map(ann => (
                      <div key={ann.id} className="p-4 bg-muted/50 rounded-lg border group relative">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold">{ann.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {ann.targetType.replace('_', ' & ')}: {ann.targetValue}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground italic">
                                {new Date(ann.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground italic">
                      No announcements sent yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        } />
        <Route path="/reports" element={<AdminReports />} />
      </Routes>
    </div>
  );
}

function AdminManual() {
  const [selectedTutorial, setSelectedTutorial] = useState<typeof sections[0] | null>(null);

  const sections = [
    {
      title: "User Management",
      icon: <Users className="h-5 w-5" />,
      content: "Admins can elevate users to different levels (1, 1+, 2, 3, 4) using their specific UID. You can also ban users and provide a reason.",
      tutorial: (
        <div className="space-y-4">
          <p>The User Management system is designed for account moderation and role assignment.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Elevating a User:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Open the <strong>Users</strong> tab.</li>
              <li>Enter the user's unique <strong>UID</strong> (found in their profile or database).</li>
              <li>Select the desired <strong>Target Level</strong> (Lvl 3/4 are Admins).</li>
              <li>Click <strong>Elevate User</strong> to apply changes immediately.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Banning a User:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Enter the user's <strong>UID</strong>.</li>
              <li>Provide a <strong>Ban Reason</strong> (this is displayed to the user on login).</li>
              <li>Click <strong>Ban User</strong>. The user will be logged out and blocked.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Course Management",
      icon: <BookPlus className="h-5 w-5" />,
      content: "Create new courses by providing a unique course code, title, semester, level, and department.",
      tutorial: (
        <div className="space-y-4">
          <p>Courses serve as the foundation for organizing all study materials on the platform.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Creating a Course:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Go to the <strong>Courses</strong> tab.</li>
              <li>Enter <strong>Course Code</strong> (e.g., GST 111) and <strong>Title</strong>.</li>
              <li>Specify <strong>Semester</strong> and <strong>Level</strong>.</li>
              <li>Select the <strong>Primary Department</strong>. Common courses (GST) should select 'General'.</li>
              <li>Click <strong>Create Course</strong>.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground italic bg-muted p-2 rounded">Note: Users will only see courses matching their academic level and department unless they are GST courses.</p>
        </div>
      )
    },
    {
      title: "Note Builder & Materials",
      icon: <FileText className="h-5 w-5" />,
      content: "Use the Note Builder for rich text content, math equations, and linked resources.",
      tutorial: (
        <div className="space-y-4">
          <p>The Note Builder is a powerful tool for creating high-quality, readable study guides.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Structure:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Headings:</strong> Use `#` for title, `##` for subheadings.</li>
              <li><strong>Math Expressions:</strong> Wrap formulas in `$$` for KaTeX rendering (e.g., `$$E=mc^2$$`).</li>
              <li><strong>Video Links:</strong> You can link YouTube videos to specific notes in the <strong>Video Library</strong> tab.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Workflow:</h4>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              <li>Select a <strong>Course</strong> to host the note.</li>
              <li>Choose <strong>Note Type</strong> (Lecture, Summary, or Punch).</li>
              <li>Draft your content in the editor.</li>
              <li>Use the <strong>Preview</strong> toggle to see how it looks for students.</li>
              <li>Click <strong>Save Note</strong>.</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "CBT & Past Questions",
      icon: <HistoryIcon className="h-5 w-5" />,
      content: "Organize exams into Question Sheets with detailed explanations for every answer.",
      tutorial: (
        <div className="space-y-4">
          <p>CBT practice is a core feature for examination preparation.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Creating an Exam:</h4>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              <li>In the <strong>CBT</strong> tab, create a <strong>Question Sheet</strong> first.</li>
              <li>Provide metadata: Course, Semester, Academic Year.</li>
              <li>Once created, select the sheet from the list.</li>
              <li>Add questions one-by-one: Text, Correct Answer, and 3 Incorrect options.</li>
              <li>Add an <strong>Explanation</strong> to help students learn from their mistakes.</li>
            </ol>
          </div>
          <p className="text-xs text-amber-600 font-bold border-l-2 border-amber-500 pl-2">Remember to set 'Is Available' to true for students to see the sheet.</p>
        </div>
      )
    },
    {
      title: "Activation Pins",
      icon: <Key className="h-5 w-5" />,
      content: "Generate secure 12-digit pins for account activation and tier upgrades.",
      tutorial: (
        <div className="space-y-4">
          <p>Pins are the primary monetization and access control mechanism.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Pin Types:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Standard:</strong> Activates Level 1 accounts for one semester.</li>
              <li><strong>Plus:</strong> Grants Level 1+ (VIP) status with extra benefits.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Management:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Pins can only be generated when a semester is **Active**.</li>
              <li>Copy and send pins directly to students.</li>
              <li>Monitor the **Used Pins** history to prevent fraud.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Notifier (Broadcasts)",
      icon: <Bell className="h-5 w-5" />,
      content: "Send targeted messages to students using the Notifier system.",
      tutorial: (
        <div className="space-y-4">
          <p>Keep the student body updated with real-time broadcasts.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Targeting Options:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>All:</strong> Every user in the system.</li>
              <li><strong>Academic Level:</strong> Specific year (Currently 100L or 200L).</li>
              <li><strong>Department:</strong> Specific faculty group.</li>
              <li><strong>Uids:</strong> Direct message to one specific user.</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground italic">Tip: Use descriptive titles and concise messages for higher engagement.</p>
        </div>
      )
    },
    {
      title: "System Control",
      icon: <Settings className="h-5 w-5" />,
      content: "Manage semester states and global system maintenance (Level 4 Admins only).",
      tutorial: (
        <div className="space-y-4">
          <p>These are 'God Mode' controls that impact the entire platform.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Semester Transition:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li><strong>Starting 1st/2nd:</strong> Opens materials for the current session.</li>
              <li><strong>Ending Semester:</strong> Triggers global reset.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Maintenance Mode:</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Use during database updates or critical fixes.</li>
              <li>Locks all students out while allowing Admins to continue work.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Referral Policy",
      icon: <UserPlus className="h-5 w-5" />,
      content: "Policy enforcement for the automated referral and point system.",
      tutorial: (
        <div className="space-y-4">
          <p>Understanding the anti-fraud measures in the referral system.</p>
          <p className="text-sm">The software automatically blocks Levels {">"}= 1+ from participation. This is hardcoded into the business logic to prevent Admins or VIP users from farming points using their influence.</p>
          <div className="p-3 bg-destructive/5 rounded border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-tight">
            Level 1+ / 2 / 3 / 4 Restricted
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Administrator Operations Manual
          </CardTitle>
          <CardDescription>Comprehensive guide for Pantheon platform administrators. Click any card to view detailed tutorial.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, idx) => (
          <Card 
            key={idx} 
            className="hover:border-primary/30 transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-100"
            onClick={() => setSelectedTutorial(section)}
          >
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {section.icon}
              </div>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.content}
              </p>
              <div className="mt-4 flex items-center text-xs font-bold text-primary gap-1 group">
                View Tutorial <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {selectedTutorial?.icon}
              </div>
              <DialogTitle>{selectedTutorial?.title}</DialogTitle>
            </div>
            <DialogDescription>
              Detailed documentation and workflow tutorial.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 border-y my-4">
            {selectedTutorial?.tutorial}
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedTutorial(null)}>Close Tutorial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Support</CardTitle>
          <CardDescription>For technical emergencies or database issues.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Developer Contact</span>
              <span className="text-sm text-primary font-mono">support@pantheon.futo</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">Last Audit</span>
              <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
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
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(d => d.data());
        
        // Group users by join date
        const groups: Record<string, number> = {};
        users.forEach(u => {
          if (u.createdAt) {
            const date = new Date(u.createdAt).toLocaleDateString();
            groups[date] = (groups[date] || 0) + 1;
          }
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
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      }
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
