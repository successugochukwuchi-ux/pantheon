import React, { useState, useEffect, useMemo } from 'react';
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
  deleteDoc,
  increment,
  limit
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
  Wand2,
  ChevronRight,
  ChevronDown,
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
  History as HistoryIcon,
  Zap,
  Download
} from 'lucide-react';
import { Course, UserLevel, Semester, Note, Question, ActivationCode, VerificationRequest, QuestionSheet, VideoQuestion, NotificationTarget, Announcement, TelegramConfig, AIConfig } from '../types';
import { sendTelegramAlert, testTelegramConnection } from '../services/telegramService';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { NoteBuilder } from '../components/NoteBuilder';
import AdminReports from './AdminReports';
import AdminDiscipline from '../components/AdminDiscipline';
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

const RECOMMENDED_MODELS = {
  groq: {
    chat: 'llama-3.3-70b-versatile',
    magicNote: 'llama-3.2-11b-vision-instruct'
  },
  gemini: {
    chat: 'gemini-2.0-flash-lite',
    magicNote: 'gemini-2.0-flash-lite'
  },
  openrouter: {
    chat: 'google/gemini-2.0-flash-001',
    magicNote: 'google/gemini-2.0-flash-001'
  }
};

const safeCompareDates = (aStr: any, bStr: any, descending = true): number => {
  if (!aStr && !bStr) return 0;
  if (!aStr) return descending ? 1 : -1;
  if (!bStr) return descending ? -1 : 1;

  const getMs = (val: any): number => {
    if (typeof val === 'string') {
      return new Date(val).getTime();
    }
    if (val && typeof val === 'object') {
      if (typeof val.toDate === 'function') {
        return val.toDate().getTime();
      }
      if (typeof val.seconds === 'number') {
        return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
      }
    }
    if (typeof val === 'number') return val;
    return 0;
  };

  const msA = getMs(aStr);
  const msB = getMs(bStr);
  
  return descending ? msB - msA : msA - msB;
};

const safeCompareStrings = (aStr: any, bStr: any, descending = false): number => {
  const strA = String(aStr || '');
  const strB = String(bStr || '');
  return descending ? strB.localeCompare(strA) : strA.localeCompare(strB);
};

const safeFormatDate = (val: any, fallback = 'N/A'): string => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    return new Date(val).toLocaleString();
  }
  if (val && typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      return val.toDate().toLocaleString();
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toLocaleString();
    }
  }
  return String(val);
};

const safeFormatDateOnly = (val: any, fallback = 'N/A'): string => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    return new Date(val).toLocaleDateString();
  }
  if (val && typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      return val.toDate().toLocaleDateString();
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
  }
  return String(val);
};

export default function AdminPanel() {
  useTitle('Admin Panel');
  const { profile, user, systemConfig, promoConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

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
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({
    '1st': true,
    '2nd': false,
    'uncategorized': false,
  });
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
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
  const [transferredPins, setTransferredPins] = useState<ActivationCode[]>([]);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // New Level 3 Vendor & Level 4 Pin States
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkIncludePlus, setBulkIncludePlus] = useState(false);
  const [bulkPlusCount, setBulkPlusCount] = useState(0);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [transferStudentId, setTransferStudentId] = useState('');
  const [standardPriceSetting, setStandardPriceSetting] = useState(3000);
  const [plusPriceSetting, setPlusPriceSetting] = useState(5000);
  const [shifting, setShifting] = useState(false);

  useEffect(() => {
    if (systemConfig) {
      setStandardPriceSetting(systemConfig.standardPrice ?? 3000);
      setPlusPriceSetting(systemConfig.plusPrice ?? 5000);
    }
  }, [systemConfig]);

  // Verification Requests State
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  // System Stats State
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalNotes: 0,
    totalQuestionSheets: 0,
    totalUnusedPins: 0,
    totalUsedPins: 0,
    totalUsers: 0
  });

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

  // CoLearn Compete Season State
  const [newSeasonName, setNewSeasonName] = useState('');

  // Telegram State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [editTelegram, setEditTelegram] = useState<{
    botToken: string;
    chatId: string;
    isActive: boolean;
    source: string;
  }>({
    botToken: '',
    chatId: '',
    isActive: false,
    source: ''
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // AI Configuration State
  const [hermesConfig, setHermesConfig] = useState<AIConfig | null>(null);
  const [editAI, setEditAI] = useState({
    provider: 'groq' as 'groq' | 'openrouter' | 'gemini',
    model: 'llama-3.3-70b-versatile',
    apiKey: '',
    isActive: true
  });

  const [magicNoteConfig, setMagicNoteConfig] = useState<AIConfig | null>(null);
  const [editMagicNote, setEditMagicNote] = useState({
    provider: 'groq' as 'groq' | 'openrouter' | 'gemini',
    model: 'llama-3.2-11b-vision-instruct',
    apiKey: '',
    isActive: true
  });

  const updateStatCount = async (field: string, amount: number) => {
    try {
      const statsDocRef = doc(db, 'system', 'stats');
      await setDoc(statsDocRef, {
        [field]: increment(amount)
      }, { merge: true });
    } catch (err) {
      console.error(`Error updating stat ${field}:`, err);
    }
  };

  const fetchAndSyncStats = async () => {
    try {
      const statsDocRef = doc(db, 'system', 'stats');
      const snap = await getDoc(statsDocRef);
      let currentStats = snap.exists() ? snap.data() : {};
      
      let needsUpdate = false;
      const updatedStats = { ...currentStats };

      const checkAndSync = async (field: string, collectionName: string, queryConstraint?: any) => {
        if (currentStats[field] === undefined || currentStats[field] === null || currentStats[field] === 0) {
          console.log(`Stat ${field} is 0 or missing, performing manual count...`);
          let count = 0;
          if (queryConstraint) {
            const qSnap = await getDocs(queryConstraint);
            count = qSnap.size;
          } else {
            const cSnap = await getDocs(collection(db, collectionName));
            count = cSnap.size;
          }
          updatedStats[field] = count;
          needsUpdate = true;
        }
      };

      await checkAndSync('totalCourses', 'courses');
      await checkAndSync('totalNotes', 'notes');
      await checkAndSync('totalQuestionSheets', 'questionSheets');
      await checkAndSync('totalUnusedPins', 'activationCodes', query(collection(db, 'activationCodes'), where('isUsed', '==', false)));
      await checkAndSync('totalUsedPins', 'activationCodes', query(collection(db, 'activationCodes'), where('isUsed', '==', true)));
      await checkAndSync('totalUsers', 'users');

      if (needsUpdate || !snap.exists()) {
        await setDoc(statsDocRef, updatedStats, { merge: true });
      }
      
      setStats({
        totalCourses: updatedStats.totalCourses || 0,
        totalNotes: updatedStats.totalNotes || 0,
        totalQuestionSheets: updatedStats.totalQuestionSheets || 0,
        totalUnusedPins: updatedStats.totalUnusedPins || 0,
        totalUsedPins: updatedStats.totalUsedPins || 0,
        totalUsers: updatedStats.totalUsers || 0,
      });
    } catch (error) {
      console.error("Error fetching or syncing stats:", error);
    }
  };

  useEffect(() => {
    if (!profile) return;

    if (profile.level === '4') {
      // Fetch system configs
      getDoc(doc(db, 'system', 'telegram')).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as TelegramConfig;
          setTelegramConfig(data);
          setEditTelegram({
            botToken: data.botToken || '',
            chatId: data.chatId || '',
            isActive: data.isActive || false,
            source: data.source || ''
          });
        }
      }).catch((err) => {
        handleFirestoreError(err, OperationType.GET, 'system/telegram');
      });

      getDoc(doc(db, 'system', 'hermes')).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AIConfig;
          setHermesConfig(data);
          setEditAI({
            provider: data.provider || 'groq',
            model: data.model || '',
            apiKey: data.apiKey || '',
            isActive: data.isActive ?? true
          });
        }
      }).catch((err) => {
        handleFirestoreError(err, OperationType.GET, 'system/hermes');
      });

      getDoc(doc(db, 'system', 'magicNote')).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as AIConfig;
          setMagicNoteConfig(data);
          setEditMagicNote({
            provider: data.provider || 'groq',
            model: data.model || '',
            apiKey: data.apiKey || '',
            isActive: data.isActive ?? true
          });
        }
      }).catch((err) => {
        handleFirestoreError(err, OperationType.GET, 'system/magicNote');
      });

      // Bootstrap and sync stats
      fetchAndSyncStats();

      // Listen to real-time updates for stats
      const statsDocRef = doc(db, 'system', 'stats');
      const unsub = onSnapshot(statsDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setStats({
            totalCourses: data.totalCourses || 0,
            totalNotes: data.totalNotes || 0,
            totalQuestionSheets: data.totalQuestionSheets || 0,
            totalUnusedPins: data.totalUnusedPins || 0,
            totalUsedPins: data.totalUsedPins || 0,
            totalUsers: data.totalUsers || 0,
          });
        }
      });
      return () => unsub();
    }
  }, [profile, refreshTrigger]);

  // Route-Specific Resource Loader to cut database read operations by 99%
  useEffect(() => {
    if (!profile) return;
    const path = location.pathname;

    // Fetch courses when on courses, notes, questions, videos, or system tabs, or overview
    const needCourses = path.includes('/courses') || path.includes('/notes') || path.includes('/questions') || path.includes('/videos') || path.includes('/system') || path === '/administrator' || path === '/administrator/';
    if (needCourses && courses.length === 0) {
      getDocs(collection(db, 'courses')).then((snapshot) => {
        const fetchedCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        fetchedCourses.sort((a, b) => safeCompareStrings(a.code, b.code));
        setCourses(fetchedCourses);
      }).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'courses');
      });
    }

    // Fetch notes when on notes or videos tab
    const needNotes = path.includes('/notes') || path.includes('/videos');
    if (needNotes && notes.length === 0) {
      getDocs(collection(db, 'notes')).then((snapshot) => {
        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
      }).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'notes');
      });
    }

    // Fetch questionSheets when on questions tab
    const needQuestionSheets = path.includes('/questions');
    if (needQuestionSheets && questionSheets.length === 0) {
      getDocs(collection(db, 'questionSheets')).then((snapshot) => {
        setQuestionSheets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet)));
      }).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'questionSheets');
      });
    }

    // Fetch announcements when on notifier tab
    const needAnnouncements = path.includes('/notifier');
    if (needAnnouncements && announcements.length === 0) {
      getDocs(collection(db, 'announcements')).then((snapshot) => {
        setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)).sort((a, b) => safeCompareDates(a.createdAt, b.createdAt)));
      }).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'announcements');
      });
    }

    // Fetch activationCodes when on pins tab OR if the user is Level 3 (vendor ONLY receives activation codes)
    const needPins = path.includes('/pins') || profile.level === '3';
    if (needPins && unusedPins.length === 0 && usedPins.length === 0) {
      getDocs(collection(db, 'activationCodes')).then((snapshot) => {
        const allPins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivationCode));
        if (profile.level === '3') {
          const sortedUnused = allPins.filter(p => !p.isUsed && p.assignedTo === user?.uid).sort((a, b) => safeCompareDates(a.createdAt, b.createdAt));
          const sortedUsed = allPins.filter(p => p.isUsed && p.assignedTo === user?.uid).sort((a, b) => safeCompareDates(a.usedAt || a.createdAt, b.usedAt || b.createdAt));
          setUnusedPins(sortedUnused);
          setUsedPins(sortedUsed);
          setTransferredPins([]);
        } else {
          const sortedUnused = allPins.filter(p => !p.isUsed && !p.assignedTo).sort((a, b) => safeCompareDates(a.createdAt, b.createdAt));
          const sortedUsed = allPins.filter(p => p.isUsed).sort((a, b) => safeCompareDates(a.usedAt || a.createdAt, b.usedAt || b.createdAt));
          const sortedTransferred = allPins.filter(p => p.assignedTo).sort((a, b) => safeCompareDates(a.createdAt, b.createdAt));
          setUnusedPins(sortedUnused);
          setUsedPins(sortedUsed);
          setTransferredPins(sortedTransferred);
        }
      }).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, 'activationCodes');
      });
    }
  }, [profile, location.pathname, refreshTrigger]);

  useEffect(() => {
    if (!selectedVideoNote) {
      setVideoQuestions([]);
      return;
    }
    const q = query(collection(db, `notes/${selectedVideoNote.id}/videoQuestions`));
    getDocs(q).then((snapshot) => {
      setVideoQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoQuestion)));
    }).catch((err) => {
      console.error("Error fetching video questions:", err);
    });
  }, [selectedVideoNote, refreshTrigger]);

  const handleLinkVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLinkNoteId || !videoUrl) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'notes', videoLinkNoteId), { videoUrl });
      toast.success('Video linked to note');
      setNotes(prev => prev.map(n => n.id === videoLinkNoteId ? { ...n, videoUrl } : n));
      setVideoUrl('');
      triggerRefresh();
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
      triggerRefresh();
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
      triggerRefresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteVideo = async (noteId: string, bypassConfirm = false) => {
    if (!bypassConfirm && !confirm('Are you sure you want to delete the video from this note? This will remove it from the video library.')) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'notes', noteId), { videoUrl: '' });
      toast.success('Video deleted successfully');
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, videoUrl: '' } : n));
      if (selectedVideoNote?.id === noteId) {
        setSelectedVideoNote(null);
      }
      triggerRefresh();
    } catch (error: any) {
      toast.error(`Failed to delete video: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleElevate = async (level: UserLevel) => {
    if (!targetUid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', targetUid.toString().trim()));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        toast.error('User with this Student ID not found');
        return;
      }
      const userDoc = querySnap.docs[0];
      const userRef = userDoc.ref;
      const userData = userDoc.data();
      const actualUid = userDoc.id;

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
      const q = query(collection(db, 'users'), where('studentId', '==', targetUid.toString().trim()));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        toast.error('User with this Student ID not found');
        return;
      }
      const userDoc = querySnap.docs[0];
      const userRef = userDoc.ref;
      const userData = userDoc.data();
      const actualUid = userDoc.id;
      
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
        department: newCourse.department || null,
        createdAt: new Date().toISOString()
      });
      
      // Update system stats
      await updateStatCount('totalCourses', 1);

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

      // Update system stats trackers
      await updateStatCount('totalCourses', -1);
      if (notesSnap.size > 0) {
        await updateStatCount('totalNotes', -notesSnap.size);
      }
      if (sheetsSnap.size > 0) {
        await updateStatCount('totalQuestionSheets', -sheetsSnap.size);
      }
      
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

      // Update system stats
      await updateStatCount('totalNotes', 1);

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

      // Update system stats
      await updateStatCount('totalNotes', -1);

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
    getDocs(q).then((snapshot) => {
      setSheetQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)).sort((a, b) => a.order - b.order));
    }).catch((err) => {
      console.error("Error fetching sheet questions:", err);
    });
  }, [selectedSheet, refreshTrigger]);

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

      // Update system stats
      await updateStatCount('totalQuestionSheets', 1);

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

      // Update system stats
      await updateStatCount('totalQuestionSheets', -1);

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
      const order = sheetQuestions.length + 1;
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

  const handleMagicImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSheet || !user) return;
    
    setLoading(true);
    const toastId = toast.loading("Parsing PLX questions...");
    
    try {
      const rawText = await file.text();
      
      // Requirement: Entire note must be wrapped in <PLX> tags
      const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(rawText);
      if (!plxMatch) {
        toast.error("Invalid PLX format: Missing root <PLX> tags", { id: toastId });
        setLoading(false);
        return;
      }
      
      const text = plxMatch[1].trim();
      
      // Simple PLX v4 <QUES> parser
      const tagRegex = /<([A-Z0-9_]+)(?:\s+=\s*"([^"]*)")?>\s*([\s\S]*?)\s*<\/\1>/g;
      let match;
      const importedQuestions: any[] = [];
      
      while ((match = tagRegex.exec(text)) !== null) {
        const tagName = match[1];
        const content = match[3].trim();
        
        if (tagName === 'QUES') {
          // Pre-processing: Support internal <B> tags by converting them to Markdown bold
          const processedContent = content.replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**');
          
          // Robust parsing for internal subtags <COR ="...">, <INC ="..."> and <EXP ="...">
          const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(processedContent);
          const incMatches = [...processedContent.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
          const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(processedContent);
          
          // Extract question text (up to the first tag)
          const firstTagIndex = processedContent.indexOf('<');
          const questionText = firstTagIndex === -1 ? processedContent : processedContent.substring(0, firstTagIndex).trim();
          
          const correctAnswer = corMatch ? (corMatch[1] || corMatch[2] || '') : '';
          const incorrectAnswers = incMatches.map(m => m[1] || m[2] || '').filter(Boolean);
          const explanation = expMatch ? (expMatch[1] || expMatch[2] || '') : '';
          
          if (questionText && correctAnswer) {
            importedQuestions.push({
              text: questionText,
              correctAnswer,
              incorrectAnswers: incorrectAnswers.slice(0, 3),
              explanation
            });
          }
        }
      }
      
      if (importedQuestions.length === 0) {
        toast.error("No valid <QUES> blocks found in file.", { id: toastId });
        return;
      }
      
      const batch = writeBatch(db);
      let currentOrder = sheetQuestions.length + 1;
      
      for (const q of importedQuestions) {
        const docRef = doc(collection(db, 'questions'));
        batch.set(docRef, {
          ...q,
          sheetId: selectedSheet.id,
          courseId: selectedSheet.courseId,
          order: currentOrder++,
          authorId: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast.success(`Imported ${importedQuestions.length} questions successfully`, { id: toastId });
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDownloadSheetPLX = () => {
    if (!selectedSheet) {
      toast.error("No sheet selected");
      return;
    }
    
    if (sheetQuestions.length === 0) {
      toast.error("This sheet has no questions to download");
      return;
    }

    try {
      let plxContent = "<PLX>\n";
      
      sheetQuestions.forEach((q) => {
        plxContent += "  <QUES>\n";
        plxContent += `    ${q.text}\n`;
        if (q.correctAnswer) {
          plxContent += `    <COR ="${q.correctAnswer}">\n`;
        }
        if (Array.isArray(q.incorrectAnswers)) {
          q.incorrectAnswers.forEach((inc) => {
            if (inc) {
              plxContent += `    <INC ="${inc}">\n`;
            }
          });
        }
        if (q.explanation) {
          plxContent += `    <EXP ="${q.explanation}">\n`;
        }
        plxContent += "  </QUES>\n\n";
      });
      
      plxContent += "</PLX>";

      const course = courses.find(c => c.id === selectedSheet.courseId);
      const courseCode = course ? course.code : 'Course';
      const rawFileName = `${courseCode}_${selectedSheet.year}_${selectedSheet.semester}_Level_${selectedSheet.academicLevel}.plx`;
      const fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      const blob = new Blob([plxContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Sheet exported as ${fileName}`);
    } catch (error: any) {
      console.error("Failed to export PLX sheet:", error);
      toast.error("Failed to export PLX sheet");
    }
  };

  const handleMagicImportVideoQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVideoNote) return;
    
    setLoading(true);
    const toastId = toast.loading("Parsing PLX questions for video...");
    
    try {
      const rawText = await file.text();
      
      // Requirement: Entire note must be wrapped in <PLX> tags
      const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(rawText);
      if (!plxMatch) {
        toast.error("Invalid PLX format: Missing root <PLX> tags", { id: toastId });
        setLoading(false);
        return;
      }
      
      const text = plxMatch[1].trim();
      
      const tagRegex = /<([A-Z0-9_]+)(?:\s+=\s*"([^"]*)")?>\s*([\s\S]*?)\s*<\/\1>/g;
      let match;
      const importedQuestions: any[] = [];
      
      while ((match = tagRegex.exec(text)) !== null) {
        const tagName = match[1];
        const content = match[3].trim();
        
        if (tagName === 'QUES') {
          // Pre-processing: Support internal <B> tags by converting them to Markdown bold
          const processedContent = content.replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**');
          
          const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(processedContent);
          const incMatches = [...processedContent.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
          const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(processedContent);
          
          const firstTagIndex = processedContent.indexOf('<');
          const questionText = firstTagIndex === -1 ? processedContent : processedContent.substring(0, firstTagIndex).trim();
          
          const correctAnswer = corMatch ? (corMatch[1] || corMatch[2] || '') : '';
          const incorrectAnswers = incMatches.map(m => m[1] || m[2] || '').filter(Boolean);
          const explanation = expMatch ? (expMatch[1] || expMatch[2] || '') : '';
          
          if (questionText && correctAnswer) {
            importedQuestions.push({
              text: questionText,
              correctAnswer,
              incorrectAnswers: incorrectAnswers.slice(0, 3),
              explanation
            });
          }
        }
      }
      
      if (importedQuestions.length === 0) {
        toast.error("No valid <QUES> blocks found in file.", { id: toastId });
        return;
      }
      
      const batch = writeBatch(db);
      for (const q of importedQuestions) {
        const docRef = doc(collection(db, `notes/${selectedVideoNote.id}/videoQuestions`));
        batch.set(docRef, {
          ...q,
          noteId: selectedVideoNote.id,
          createdAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast.success(`Imported ${importedQuestions.length} video questions successfully`, { id: toastId });
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
      e.target.value = '';
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
    const creatorId = profile?.studentId || 'N/A';
    setLoading(true);
    try {
      await setDoc(doc(db, 'activationCodes', pin), {
        code: pin,
        isUsed: false,
        createdBy: user?.uid,
        createdAt: new Date().toISOString(),
        type: pinType,
        owner: creatorId
      });

      // Update system stats
      await updateStatCount('totalUnusedPins', 1);

      setGeneratedCode(pin);
      
      // Send Telegram Alert for pin generation
      const pinTypeStr = pinType?.toUpperCase() || 'STANDARD';
      const pinCreatedAlert = 
        `<b>🆕 ALERT: ACTIVATION PIN GENERATED</b>\n\n` +
        `<b>Source:</b> {source}\n` +
        `<b>Pin Code:</b> ${pin}\n` +
        `<b>Pin Type:</b> ${pinTypeStr}\n` +
        `<b>Time Created:</b> ${new Date().toLocaleString()}\n` +
        `<b>Creator Student ID:</b> ${creatorId}\n` +
        `<b>Initial Owner:</b> ${creatorId}`;
      await sendTelegramAlert(pinCreatedAlert);

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
      const pinRef = doc(db, 'activationCodes', pinToDelete);
      const pinSnap = await getDoc(pinRef);
      let isPinUsed = false;
      if (pinSnap.exists()) {
        const pinData = pinSnap.data();
        isPinUsed = !!pinData.isUsed;
        if (profile?.level === '3') {
          if (pinData.assignedTo !== user?.uid) {
            toast.error("You are only allowed to delete pins assigned to you.");
            setLoading(false);
            return;
          }
        } else if (profile?.level === '4') {
          if (pinData.assignedTo) {
            toast.error("Cannot delete pin: it has already been transferred to a vendor.");
            setLoading(false);
            return;
          }
        }
      }
      await deleteDoc(pinRef);

      // Update system stats
      if (isPinUsed) {
        await updateStatCount('totalUsedPins', -1);
      } else {
        await updateStatCount('totalUnusedPins', -1);
      }
      
      // Send Telegram alert for single pin deletion
      const deleteAlert = 
        `<b>🗑️ ALERT: ACTIVATION PIN DELETED</b>\n\n` +
        `<b>Source:</b> {source}\n` +
        `<b>Time of Deletion:</b> ${new Date().toLocaleString()}\n` +
        `<b>Pins Deleted:</b> 1 (${pinToDelete})\n` +
        `<b>Deleted By Student ID:</b> ${profile?.studentId || 'N/A'}`;
      await sendTelegramAlert(deleteAlert);

      toast.success('Pin removed');
      setPinToDelete(null);
    } catch (error: any) {
      console.error("Delete pin error:", error);
      toast.error('Failed to delete: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const sanitizedKey = editAI.apiKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
      await setDoc(doc(db, 'system', 'hermes'), {
        ...editAI,
        apiKey: sanitizedKey,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('Hermes Chat configuration updated');
    } catch (error: any) {
      toast.error('Failed to update AI config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMagicNoteAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const sanitizedKey = editMagicNote.apiKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
      await setDoc(doc(db, 'system', 'magicNote'), {
        ...editMagicNote,
        apiKey: sanitizedKey,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('Magic Note configuration updated');
    } catch (error: any) {
      toast.error('Failed to update Magic Note config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearUsedPins = async () => {
    const pinsToClear = profile?.level === '3' 
      ? usedPins.filter(pin => pin.assignedTo === user?.uid)
      : usedPins;
      
    if (pinsToClear.length === 0) {
      toast.info('No pinned history to clear');
      return;
    }
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      // Firebase batch limit is 500. For safety, we only clear the first 450 if more exist.
      const pinsToProcess = pinsToClear.slice(0, 450);
      pinsToProcess.forEach(pin => {
        batch.delete(doc(db, 'activationCodes', pin.id));
      });
      await batch.commit();

      // Update system stats
      await updateStatCount('totalUsedPins', -pinsToProcess.length);

      // Send Telegram alert for cleared history pins
      const clearAlert = 
        `<b>🗑️ ALERT: ACTIVATION PINS DELETED (HISTORY CLEAR)</b>\n\n` +
        `<b>Source:</b> {source}\n` +
        `<b>Time of Deletion:</b> ${new Date().toLocaleString()}\n` +
        `<b>Pins Deleted:</b> ${pinsToProcess.length}\n` +
        `<b>Deleted By Student ID:</b> ${profile?.studentId || 'N/A'}`;
      await sendTelegramAlert(clearAlert);

      toast.success('History cleared successfully');
      setShowClearConfirm(false);
    } catch (error: any) {
      console.error("Clear pins error:", error);
      toast.error('Failed to clear: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGeneratePins = async () => {
    if (!systemConfig || systemConfig.currentSemester === 'none') {
      toast.error('Cannot generate pins when no semester is active');
      return;
    }
    
    if (bulkCount <= 0 || bulkCount > 100) {
      toast.error('Bulk generation is limited to 1 to 100 pins at a time');
      return;
    }
    
    if (bulkIncludePlus && (bulkPlusCount < 0 || bulkPlusCount > bulkCount)) {
      toast.error('Invalid number of PLUS pins specified');
      return;
    }
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const creatorId = profile?.studentId || 'Admin';
      
      for (let i = 0; i < bulkCount; i++) {
        const pin = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        // Determine whether this pin is PLUS or Standard based on includePlus and plusCount
        const type = bulkIncludePlus && i < bulkPlusCount ? 'plus' : 'standard';
        
        batch.set(doc(db, 'activationCodes', pin), {
          code: pin,
          isUsed: false,
          createdBy: user?.uid,
          createdAt: now,
          type: type,
          owner: creatorId
        });
      }
      
      await batch.commit();

      // Update system stats
      await updateStatCount('totalUnusedPins', bulkCount);

      // Send Telegram notification
      const numPlus = bulkIncludePlus ? bulkPlusCount : 0;
      const numStandard = bulkCount - numPlus;
      const bulkAlert = 
        `<b>🆕 ALERT: BULK ACTIVATION PINS GENERATED</b>\n\n` +
        `<b>Source:</b> {source}\n` +
        `<b>Total Generated:</b> ${bulkCount} (Standard: ${numStandard}, PLUS: ${numPlus})\n` +
        `<b>Time Created:</b> ${new Date(now).toLocaleString()}\n` +
        `<b>Creator Student ID:</b> ${creatorId}\n` +
        `<b>Initial Owner:</b> ${creatorId}`;
      await sendTelegramAlert(bulkAlert);

      toast.success(`Successfully generated ${bulkCount} activation pins!`);
      setGeneratedCode(`Generated ${bulkCount} pins successfully!`);
    } catch (error: any) {
      console.error("Bulk generate error:", error);
      toast.error('Failed to generate pins: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferPins = async () => {
    if (selectedPinIds.length === 0) {
      toast.error('Please select at least one pin to transfer');
      return;
    }
    
    if (!transferStudentId.trim()) {
      toast.error('Please enter the vendor\'s Student ID');
      return;
    }
    
    setLoading(true);
    try {
      // Find the target user by Student ID and check if level is '3'
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('studentId', '==', transferStudentId.trim()));
      const querySnap = await getDocs(q);
      
      if (querySnap.empty) {
        toast.error('No student profile found with this Student ID. Please ensure they registered.');
        setLoading(false);
        return;
      }
      
      const vendorDoc = querySnap.docs[0];
      const vendorData = vendorDoc.data();
      
      if (vendorData.level !== '3') {
        toast.error('The school ID matches a non-vendor account. Only Level 3 role can receive transfers.');
        setLoading(false);
        return;
      }
      
      const vendorUid = vendorDoc.id;
      const vendorName = vendorData.username || 'Vendor';

      // Gather transfer info for Telegram alert
      const pinsToTransfer = unusedPins.filter(p => selectedPinIds.includes(p.id));
      const creationTimes = Array.from(new Set(pinsToTransfer.map(p => p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A'))).join(', ');
      const numPlus = pinsToTransfer.filter(p => p.type === 'plus').length;
      const numStandard = pinsToTransfer.filter(p => p.type === 'standard').length;
      
      // Perform batch update to assign selected pins to this Level 3 Vendor
      const batch = writeBatch(db);
      selectedPinIds.forEach(id => {
        batch.update(doc(db, 'activationCodes', id), {
          assignedTo: vendorUid,
          assignedToStudentId: transferStudentId.trim(),
          owner: transferStudentId.trim()
        });
      });
      
      await batch.commit();

      // Send Telegram alert for transfer
      const transferAlert = 
        `<b>🔔 ALERT: ACTIVATION PINS TRANSFERRED</b>\n\n` +
        `<b>Source:</b> {source}\n` +
        `<b>Time of Transfer:</b> ${new Date().toLocaleString()}\n` +
        `<b>Pin(s) Creation Time:</b> ${creationTimes}\n` +
        `<b>Pins Transferred:</b> ${pinsToTransfer.length} (PLUS: ${numPlus}, Standard: ${numStandard})\n` +
        `<b>Sender Student ID:</b> ${profile?.studentId || 'Admin (N/A)'}\n` +
        `<b>Receiver Student ID:</b> ${transferStudentId.trim()}`;
      await sendTelegramAlert(transferAlert);

      toast.success(`Successfully transferred ${selectedPinIds.length} pins to ${vendorName}!`);
      setSelectedPinIds([]);
      setTransferStudentId('');
    } catch (error: any) {
      console.error("Pin transfer error:", error);
      toast.error('Failed to transfer pins: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePinPrices = async () => {
    if (Number(standardPriceSetting) <= 0 || Number(plusPriceSetting) <= 0) {
      toast.error('Price values must be greater than zero');
      return;
    }
    
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        ...systemConfig,
        standardPrice: Number(standardPriceSetting),
        plusPrice: Number(plusPriceSetting),
        updatedBy: user?.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('Pin prices updated successfully!');
    } catch (error: any) {
      console.error("Save prices error:", error);
      toast.error('Failed to update pin prices: ' + error.message);
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

      // If ending a semester, demote 2 to 1 and deactivate 1
      if (semester === 'none') {
        const batch = writeBatch(db);
        let countDeactivated = 0;
        let countDemoted = 0;

        try {
          // 1. Deactivate Level 1 and Level 3 users
          const level1And3Query = query(collection(db, 'users'), where('level', 'in', ['1', '3']));
          const level1And3Snap = await getDocs(level1And3Query);
          level1And3Snap.docs.forEach((userDoc) => {
            const data = userDoc.data();
            if (data.isActivated !== false || data.activatedViaPromo !== false) {
              batch.update(userDoc.ref, { isActivated: false, activatedViaPromo: false });
              countDeactivated++;
            }
          });

          // 2. Demote Level 2 users to Level 1 while keeping them activated
          const level2Query = query(collection(db, 'users'), where('level', '==', '2'));
          const level2Snap = await getDocs(level2Query);
          level2Snap.docs.forEach((userDoc) => {
            const data = userDoc.data();
            if (data.level !== '1' || data.isActivated !== true) {
              batch.update(userDoc.ref, { level: '1', isActivated: true });
              countDemoted++;
            }
          });

          await batch.commit();
          toast.success(`Semester ended. ${countDeactivated} level 1/3 users deactivated, ${countDemoted} level 2 users demoted.`);
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

      // Send telegram alerts
      if (active) {
        sendTelegramAlert(
          `<b>🎁 ALERT: PROMO MODE ACTIVATED</b>\n\n` +
          `<b>Source:</b> {source}\n` +
          `<b>Activated By:</b> ${profile?.studentId || user?.email || 'Admin'}\n` +
          `<b>Original Quota Allowance:</b> ${promoQuota}\n` +
          `<b>Time Started:</b> ${new Date().toLocaleString()}`
        );
      } else {
        const originalQuota = promoConfig?.quota || 0;
        const totalUsed = promoConfig?.count || 0;
        const remainingQuota = Math.max(0, originalQuota - totalUsed);
        sendTelegramAlert(
          `<b>🔕 ALERT: PROMO MODE MANUALLY STOPPED</b>\n\n` +
          `<b>Source:</b> {source}\n` +
          `<b>Stopped By:</b> ${profile?.studentId || user?.email || 'Admin'}\n` +
          `<b>Original Quota:</b> ${originalQuota}\n` +
          `<b>Remaining Quota when Stopped:</b> ${remainingQuota}\n` +
          `<b>Total Activations Recorded:</b> ${totalUsed}\n` +
          `<b>Time Stopped:</b> ${new Date().toLocaleString()}`
        );
      }

      toast.success(`Promo mode ${active ? 'started' : 'stopped'}`);
    } catch (error) {
      toast.error('Failed to update promo config');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSeason = async () => {
    if (!user) return;
    if (!newSeasonName.trim()) {
      toast.error("Please enter a valid season name");
      return;
    }
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      const seasonRef = doc(collection(db, 'seasons'));
      const activeSeasonId = seasonRef.id;

      await setDoc(seasonRef, {
        id: activeSeasonId,
        name: newSeasonName.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        status: 'active'
      });

      await setDoc(configRef, {
        activeSeasonId,
        activeSeasonName: newSeasonName.trim(),
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success(`Season "${newSeasonName}" started successfully!`);
      setNewSeasonName('');
    } catch (err: any) {
      toast.error(`Failed to start season: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSeason = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to end the current season? Quick Match mode will be locked and the leaderboard will be reset!")) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        activeSeasonId: null,
        activeSeasonName: null,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success("Competition season has been ended and the leaderboard has reset.");
    } catch (err: any) {
      toast.error(`Failed to end season: ${err.message}`);
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

  const handleToggleFlux = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const configRef = doc(db, 'system', 'config');
      const currentFluxEnabled = systemConfig && systemConfig.fluxEnabled !== false;
      await setDoc(configRef, {
        fluxEnabled: !currentFluxEnabled,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success(`Flux access ${!currentFluxEnabled ? 'enabled' : 'disabled'} platform wide.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShiftLevels = async () => {
    if (!user || !isLevel4) return;
    
    const confirmAction = window.confirm("Are you sure you want to switch all users with an academicLevel of 100 to 200?");
    if (!confirmAction) return;

    setShifting(true);
    try {
      // Find all users with academicLevel == "100"
      const usersQuery = query(collection(db, 'users'), where('academicLevel', '==', '100'));
      const snap = await getDocs(usersQuery);
      
      if (snap.empty) {
        toast.info("No users found with academicLevel of 100");
        setShifting(false);
        return;
      }

      const docs = snap.docs;
      const chunks: any[][] = [];
      for (let i = 0; i < docs.length; i += 400) {
        chunks.push(docs.slice(i, i + 400));
      }

      let count = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((userDoc) => {
          batch.update(userDoc.ref, { academicLevel: '200' });
          count++;
        });
        await batch.commit();
      }

      toast.success(`Successfully switched ${count} users from academic level 100 to 200.`);
    } catch (err: any) {
      console.error("Error shifting academic levels:", err);
      toast.error(`Failed to switch academic levels: ${err.message || err}`);
    } finally {
      setShifting(false);
    }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.error('Direct saving of Telegram configuration is disabled. Updates must be applied directly in Firebase.');
  };

  const handleTestTelegram = async () => {
    if (!telegramConfig?.botToken || !telegramConfig?.chatId) {
      toast.error('Token and Chat ID must be configured in Firebase to test connection');
      return;
    }
    setLoading(true);
    try {
      const result = await testTelegramConnection(telegramConfig.botToken, telegramConfig.chatId);
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

  if (profile?.level === '3' && !location.pathname.endsWith('/pins') && !location.pathname.includes('/pins')) {
    return <Navigate to="/administrator/pins" replace />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, courses, and platform content.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        {isLevel4 && (
          <Button variant={location.pathname === '/administrator' ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator')}>Overview</Button>
        )}
        {isLevel4 && (
          <>
            <Button variant={location.pathname.includes('users') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/users')}>Users</Button>
            <Button variant={location.pathname.includes('courses') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/courses')}>Courses</Button>
            <Button variant={location.pathname.includes('discipline') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/discipline')}>Discipline</Button>
            <Button variant={location.pathname.includes('notes') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/notes')}>Notes</Button>
            <Button variant={location.pathname.includes('news') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/news')}>News</Button>
          </>
        )}
        <Button variant={location.pathname.includes('pins') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/pins')}>
          {isLevel4 ? 'Pins' : 'Vendor Dashboard'}
        </Button>
        {isLevel4 && (
          <>
            <Button variant={location.pathname.includes('videos') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/videos')}>Video Library</Button>
            <Button variant={location.pathname.includes('notifier') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/notifier')}>Notifier</Button>
            <Button variant={location.pathname.includes('reports') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/reports')}>Reports</Button>
            <Button variant={location.pathname.includes('manual') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/manual')}>Admin Manual</Button>
            <Button variant={location.pathname.includes('system') ? 'default' : 'ghost'} size="sm" onClick={() => navigate('/administrator/system')}>System</Button>
          </>
        )}
      </div>

      <Routes>
        <Route index element={
          profile?.level === '3' 
            ? <Navigate to="/administrator/pins" replace />
            : <AdminOverview courses={courses} notes={notes} questions={questions} unusedPins={unusedPins} usedPins={usedPins} stats={stats} />
        } />
        <Route path="/manual" element={<AdminManual />} />
        <Route path="/discipline" element={<AdminDiscipline />} />
        <Route path="/videos" element={
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Link Video to Note
                </CardTitle>
                <CardDescription>Select a course and note to attach a YouTube or Google Drive video URL.</CardDescription>
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
                      <Label>Video URL (YouTube or Google Drive)</Label>
                      <Input 
                        value={videoUrl} 
                        onChange={(e) => setVideoUrl(e.target.value)} 
                        placeholder="YouTube link or Drive file link" 
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
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Video Lessons Library</CardTitle>
                  <CardDescription>Manage quizzes for notes with linked videos, arranged by semesters and courses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {(() => {
                      const notesWithVideo = notes.filter(n => n.videoUrl && n.videoUrl.trim() !== '');
                      
                      if (notesWithVideo.length === 0) {
                        return <p className="text-sm text-muted-foreground text-center py-4">No videos linked yet.</p>;
                      }

                      // Let's group courses that have at least one note with a video, by semester
                      const groupedBySemester: { [key: string]: { course: Course; notes: Note[] }[] } = {
                        '1st': [],
                        '2nd': []
                      };

                      courses.forEach(course => {
                        const courseVideoNotes = notesWithVideo.filter(n => n.courseId === course.id);
                        if (courseVideoNotes.length > 0) {
                          const sem = course.semester === '2nd' ? '2nd' : '1st';
                          groupedBySemester[sem].push({ course, notes: courseVideoNotes });
                        }
                      });

                      // We should also find any orphan notes whose course was deleted or not found
                      const orphanNotes = notesWithVideo.filter(n => !courses.find(c => c.id === n.courseId));
                      
                      return (
                        <div className="space-y-6">
                          {['1st', '2nd'].map(sem => {
                            const groups = groupedBySemester[sem];
                            if (groups.length === 0) return null;
                            
                            return (
                              <div key={sem} className="space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1.5 rounded flex items-center justify-between">
                                  <span>{sem} Semester</span>
                                  <Badge className="text-[10px] py-0 px-1.5 h-4 bg-primary text-primary-foreground border-none">
                                    {groups.reduce((acc, g) => acc + g.notes.length, 0)} videos
                                  </Badge>
                                </h3>
                                <div className="space-y-4 pl-1">
                                  {groups.map(({ course, notes: courseNotes }) => (
                                    <div key={course.id} className="space-y-2">
                                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1">
                                        <span>{course.code} - {course.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{courseNotes.length} linked</span>
                                      </div>
                                      <div className="space-y-2">
                                        {courseNotes.map(note => {
                                          const isActive = selectedVideoNote?.id === note.id;
                                          return (
                                            <div key={note.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isActive ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-muted/30 hover:bg-muted/50'}`}>
                                              <div className="space-y-1 pr-2 max-w-[65%]">
                                                <p className="font-semibold text-sm leading-tight text-foreground">{note.title}</p>
                                                <p className="text-[10px] text-muted-foreground truncate font-mono" title={note.videoUrl}>
                                                  {note.videoUrl}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <Button 
                                                  size="sm" 
                                                  variant={isActive ? "default" : "outline"} 
                                                  className="h-8 text-xs font-medium"
                                                  onClick={() => setSelectedVideoNote(note)}
                                                >
                                                  Manage Quiz
                                                </Button>
                                                {deleteConfirmId === note.id ? (
                                                  <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                                                    <Button 
                                                      size="icon" 
                                                      variant="destructive" 
                                                      className="h-8 w-8 text-white"
                                                      onClick={() => {
                                                        handleDeleteVideo(note.id, true);
                                                        setDeleteConfirmId(null);
                                                      }}
                                                      title="Confirm Delete"
                                                    >
                                                      <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                      size="icon" 
                                                      variant="outline" 
                                                      className="h-8 w-8 hover:bg-muted text-muted-foreground"
                                                      onClick={() => setDeleteConfirmId(null)}
                                                      title="Cancel"
                                                    >
                                                      <XCircle className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => setDeleteConfirmId(note.id)}
                                                    title="Delete Video Link"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {orphanNotes.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                                Uncategorized Notes
                              </h3>
                              <div className="space-y-2 pl-1">
                                {orphanNotes.map(note => {
                                  const isActive = selectedVideoNote?.id === note.id;
                                  return (
                                    <div key={note.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                      <div className="space-y-1 pr-2 max-w-[60%]">
                                        <p className="font-medium text-sm leading-tight">{note.title}</p>
                                        <p className="text-[10px] text-muted-foreground truncate font-mono" title={note.videoUrl}>
                                          {note.videoUrl}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <Button 
                                          size="sm" 
                                          variant={isActive ? "default" : "outline"} 
                                          className="h-8 text-xs font-medium"
                                          onClick={() => setSelectedVideoNote(note)}
                                        >
                                          Manage Quiz
                                        </Button>
                                        {deleteConfirmId === note.id ? (
                                          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                                            <Button 
                                              size="icon" 
                                              variant="destructive" 
                                              className="h-8 w-8 text-white"
                                              onClick={() => {
                                                handleDeleteVideo(note.id, true);
                                                setDeleteConfirmId(null);
                                              }}
                                              title="Confirm Delete"
                                            >
                                              <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                              size="icon" 
                                              variant="outline" 
                                              className="h-8 w-8 hover:bg-muted text-muted-foreground"
                                              onClick={() => setDeleteConfirmId(null)}
                                              title="Cancel"
                                            >
                                              <XCircle className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeleteConfirmId(note.id)}
                                            title="Delete Video Link"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-widest text-primary">New Quiz Question</Label>
                            <div className="relative">
                              <input
                                type="file"
                                id="video-plx-import"
                                className="hidden"
                                accept=".plx,.txt"
                                onChange={handleMagicImportVideoQuestions}
                              />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 gap-1.5 text-[10px] font-bold text-primary hover:bg-primary/10"
                                onClick={() => document.getElementById('video-plx-import')?.click()}
                              >
                                <Wand2 className="h-3 w-3" /> Magic Import (PLX)
                              </Button>
                            </div>
                          </div>
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
                <CardDescription>Change a user's permission level using their Student ID.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input value={targetUid} onChange={(e) => setTargetUid(e.target.value)} placeholder="Enter 11-digit Student ID" />
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button onClick={() => handleElevate('1')} variant="outline" disabled={loading || !targetUid}>Level 1</Button>
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
                <CardDescription>Ban/demote user using their Student ID.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input value={targetUid} onChange={(e) => setTargetUid(e.target.value)} placeholder="Enter 11-digit Student ID" />
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Existing Notes</h3>
                <Badge variant="outline" className="font-mono">
                  {notes.length} {notes.length === 1 ? 'Note' : 'Notes'} Total
                </Badge>
              </div>

              {notes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50 text-indigo-500" />
                    <p className="text-sm">No notes created yet. Use the Note Builder form above to publish your first note.</p>
                  </CardContent>
                </Card>
              ) : (() => {
                // Inline grouping calculation
                const grouped: {
                  '1st': Record<string, Note[]>;
                  '2nd': Record<string, Note[]>;
                  'uncategorized': Note[];
                } = {
                  '1st': {},
                  '2nd': {},
                  'uncategorized': [],
                };

                notes.forEach(note => {
                  const course = courses.find(c => c.id === note.courseId);
                  if (!course) {
                    grouped.uncategorized.push(note);
                  } else {
                    const sem = course.semester === '2nd' ? '2nd' : '1st';
                    if (!grouped[sem][course.id]) {
                      grouped[sem][course.id] = [];
                    }
                    grouped[sem][course.id].push(note);
                  }
                });

                return (
                  <div className="space-y-4">
                    {/* Semester Sections */}
                    {(['1st', '2nd'] as const).map(semKey => {
                      const courseGroups = grouped[semKey];
                      const courseIds = Object.keys(courseGroups);
                      const semesterTotalNotes = courseIds.reduce((sum, cid) => sum + courseGroups[cid].length, 0);

                      if (semesterTotalNotes === 0) return null;

                      const isSemExpanded = !!expandedSemesters[semKey];

                      return (
                        <div key={semKey} className="border rounded-xl overflow-hidden bg-muted/10 p-1">
                          <button
                            type="button"
                            onClick={() => setExpandedSemesters(prev => ({ ...prev, [semKey]: !prev[semKey] }))}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-all font-semibold text-left select-none text-stone-800 dark:text-stone-200 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {semKey === '1st' ? '🥇' : '🥈'}
                              </span>
                              <span className="font-medium text-base">
                                {semKey} Semester Notes
                              </span>
                              <Badge variant="secondary" className="font-normal font-mono text-[11px] bg-indigo-500/10 text-indigo-500 border-none">
                                {courseIds.length} {courseIds.length === 1 ? 'Course' : 'Courses'} • {semesterTotalNotes} {semesterTotalNotes === 1 ? 'Note' : 'Notes'}
                              </Badge>
                            </div>
                            {isSemExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground mr-1" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground mr-1" />
                            )}
                          </button>

                          {isSemExpanded && (
                            <div className="p-3 space-y-3 pl-4 md:pl-6 border-t bg-card/30">
                              {courseIds.map(courseId => {
                                const course = courses.find(c => c.id === courseId);
                                const courseNotes = courseGroups[courseId];
                                const isCourseExpanded = !!expandedCourses[courseId];

                                if (!course) return null;

                                return (
                                  <div key={courseId} className="border rounded-lg bg-card overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }))}
                                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-all text-left select-none cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center bg-muted px-2 py-0.5 rounded text-xs font-bold text-stone-700 dark:text-stone-300">
                                          {course.code}
                                        </span>
                                        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 line-clamp-1">
                                          {course.title}
                                        </span>
                                        <Badge variant="outline" className="font-normal font-mono text-[10px] text-muted-foreground border-stone-200">
                                          {courseNotes.length} {courseNotes.length === 1 ? 'Note' : 'Notes'}
                                        </Badge>
                                      </div>
                                      {isCourseExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground mr-1" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground mr-1" />
                                      )}
                                    </button>

                                    {isCourseExpanded && (
                                      <div className="p-3 pl-4 md:pl-6 border-t bg-muted/5 grid gap-3">
                                        {courseNotes.map(note => {
                                          let previewText = '';
                                          try {
                                            const blocks = JSON.parse(note.content);
                                            previewText = blocks.find((b: any) => b.type === 'text')?.content || 'No text content';
                                          } catch (e) {
                                            previewText = note.content;
                                          }

                                          return (
                                            <Card key={note.id} className="shadow-none hover:shadow-sm transition-all border-stone-200/60 dark:border-stone-800/60">
                                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <div className="space-y-1">
                                                  <CardTitle className="text-sm font-medium">{note.title}</CardTitle>
                                                  <CardDescription className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] font-semibold tracking-wider font-sans bg-muted uppercase px-1.5 border-none">
                                                      {note.type}
                                                    </Badge>
                                                    {note.updatedAt ? (
                                                      <span className="text-[10px] text-muted-foreground">
                                                        Updated: {new Date(note.updatedAt).toLocaleDateString()}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] text-muted-foreground">
                                                        Created: {new Date(note.createdAt).toLocaleDateString()}
                                                      </span>
                                                    )}
                                                  </CardDescription>
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
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Uncategorized Notes Group */}
                    {grouped.uncategorized.length > 0 && (
                      <div className="border rounded-xl overflow-hidden bg-destructive/5 p-1 border-destructive/20">
                        <button
                          type="button"
                          onClick={() => setExpandedSemesters(prev => ({ ...prev, 'uncategorized': !prev['uncategorized'] }))}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-destructive/10 transition-all font-semibold text-left select-none text-destructive cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">❓</span>
                            <span className="font-medium text-base">Uncategorized Notes</span>
                            <Badge variant="destructive" className="font-normal font-mono text-[11px] px-2 text-white border-none">
                              {grouped.uncategorized.length} {grouped.uncategorized.length === 1 ? 'Note' : 'Notes'}
                            </Badge>
                          </div>
                          {expandedSemesters['uncategorized'] ? (
                            <ChevronDown className="h-5 w-5 text-destructive mr-1" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-destructive mr-1" />
                          )}
                        </button>

                        {expandedSemesters['uncategorized'] && (
                          <div className="p-3 pl-4 md:pl-6 border-t bg-card/50 grid gap-3">
                            {grouped.uncategorized.map(note => {
                              let previewText = '';
                              try {
                                const blocks = JSON.parse(note.content);
                                previewText = blocks.find((b: any) => b.type === 'text')?.content || 'No text content';
                              } catch (e) {
                                previewText = note.content;
                              }

                              return (
                                <Card key={note.id} className="shadow-none hover:shadow-sm transition-all border-destructive/10">
                                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="space-y-1">
                                      <CardTitle className="text-sm font-medium text-destructive">{note.title}</CardTitle>
                                      <CardDescription>{note.type.toUpperCase()}</CardDescription>
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
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
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
                  {[...questionSheets].sort((a, b) => {
                    const courseA = courses.find(c => c.id === a.courseId);
                    const courseB = courses.find(c => c.id === b.courseId);
                    const codeA = courseA?.code || '';
                    const codeB = courseB?.code || '';
                    if (codeA !== codeB) {
                      return safeCompareStrings(codeA, codeB);
                    }
                    return safeCompareStrings(b.year, a.year, true);
                  }).map(sheet => {
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
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/5"
                      onClick={handleDownloadSheetPLX}
                      disabled={sheetQuestions.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" /> Export Sheet (.PLX)
                    </Button>
                    <Badge>{sheetQuestions.length} Questions</Badge>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Add New Question</CardTitle>
                      <div className="relative">
                        <input
                          type="file"
                          id="cbt-plx-import"
                          className="hidden"
                          accept=".plx,.txt"
                          onChange={handleMagicImportQuestions}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                          onClick={() => document.getElementById('cbt-plx-import')?.click()}
                        >
                          <Wand2 className="h-3.5 w-3.5" /> Magic Import (PLX)
                        </Button>
                      </div>
                    </div>
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
                            <div className="text-muted-foreground prose dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                                {q.explanation}
                              </ReactMarkdown>
                            </div>
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
            {!isLevel4 ? (
              /* ========================================== */
              /* LEVEL 3 VENDOR DASHBOARD ELEMENT         */
              /* ========================================== */
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">My Available Pins</CardTitle>
                      <Key className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {unusedPins.filter(p => p.assignedTo === user?.uid).length}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Unused activation pins in your inventory
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Sales Earnings</CardTitle>
                      <span className="text-primary font-bold text-sm">₦</span>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        ₦{(() => {
                          const mySoldPins = usedPins.filter(p => p.assignedTo === user?.uid);
                          const currentYearMonth = new Date().toISOString().slice(0, 7);
                          const thisMonthSold = mySoldPins.filter(p => {
                            const usedAtVal: any = p.usedAt;
                            if (!usedAtVal) return false;
                            let dateStr = '';
                            if (typeof usedAtVal === 'string') {
                              dateStr = usedAtVal;
                            } else if (usedAtVal && typeof usedAtVal === 'object') {
                              if (typeof usedAtVal.toDate === 'function') {
                                dateStr = usedAtVal.toDate().toISOString();
                              } else if (typeof usedAtVal.seconds === 'number') {
                                dateStr = new Date(usedAtVal.seconds * 1000).toISOString();
                              }
                            }
                            return dateStr && dateStr.startsWith(currentYearMonth);
                          });
                          
                          const total = thisMonthSold.reduce((sum, p) => {
                            const price = p.type === 'plus' 
                              ? (systemConfig?.plusPrice ?? 5000) 
                              : (systemConfig?.standardPrice ?? 3000);
                            return sum + price;
                          }, 0);
                          return total.toLocaleString();
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Est. profit based on market price standard (₦{(systemConfig?.standardPrice ?? 3000).toLocaleString()}) / PLUS (₦{(systemConfig?.plusPrice ?? 5000).toLocaleString()})
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>My Available Pins</CardTitle>
                      <CardDescription>Pins purchased from admin ready for students.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {unusedPins.filter(p => p.assignedTo === user?.uid).length > 0 ? (
                          unusedPins.filter(p => p.assignedTo === user?.uid).map(pin => (
                            <div key={pin.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono font-bold tracking-wider">{pin.code}</code>
                                  {pin.type === 'plus' ? (
                                    <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 leading-none">STANDARD</Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">Received on {safeFormatDateOnly(pin.createdAt)}</span>
                              </div>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8" 
                                onClick={() => copyToClipboard(pin.code)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">You have no unused pins. Buy from admins to restock.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="space-y-1">
                        <CardTitle>Sold Pins History</CardTitle>
                        <CardDescription>Pins activated by students purchased through you.</CardDescription>
                      </div>
                      {usedPins.filter(p => p.assignedTo === user?.uid).length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive text-xs hover:bg-destructive/10"
                          onClick={() => setShowClearConfirm(true)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Clear History
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {usedPins.filter(p => p.assignedTo === user?.uid).length > 0 ? (
                          usedPins.filter(p => p.assignedTo === user?.uid).map(pin => (
                            <div key={pin.id} className="p-3 bg-muted/50 rounded-lg border space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono font-bold text-primary">{pin.code}</code>
                                  {pin.type === 'plus' ? (
                                    <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 leading-none">STANDARD</Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{safeFormatDate(pin.usedAt, 'N/A')}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                <span className="font-semibold">Used by student ID:</span> <span className="font-mono">{pin.usedByStudentId || 'N/A'}</span>
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No pins used yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              /* ========================================== */
              /* LEVEL 4 FULL ADMIN ELEMENT               */
              /* ========================================== */
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Generate Activation Pin
                      </CardTitle>
                      <CardDescription>Generate a single unique 12-digit pin for immediate use.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-4 gap-4">
                      {generatedCode && (
                        <div className="flex items-center gap-4 bg-muted p-4 rounded-lg border w-full justify-between">
                          <div className="flex flex-col">
                            <div className="text-2xl font-mono font-bold tracking-widest">
                              {generatedCode}
                            </div>
                            <Badge variant={pinType === 'plus' ? 'default' : 'secondary'} className="w-fit mt-1">
                              {pinType === 'plus' ? 'PLUS PIN' : 'STANDARD PIN'}
                            </Badge>
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-10 w-10" 
                            onClick={() => copyToClipboard(generatedCode)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="flex items-center gap-3 w-full">
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
                        
                        <Button onClick={generatePin} disabled={loading} className="w-full">
                          {loading ? 'Generating...' : `Generate ${pinType.toUpperCase()} Pin`}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Bulk Pin Generation
                      </CardTitle>
                      <CardDescription>Generate multiple activation codes at once.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Total Pins to Generate</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          max={100} 
                          value={bulkCount} 
                          onChange={(e) => setBulkCount(Number(e.target.value))} 
                        />
                      </div>
                      
                      <div className="space-y-3 p-3 bg-muted rounded-lg border">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="bulkIncludePlus" 
                            className="h-4 w-4 rounded border-gray-300 text-primary" 
                            checked={bulkIncludePlus} 
                            onChange={(e) => setBulkIncludePlus(e.target.checked)} 
                          />
                          <Label htmlFor="bulkIncludePlus" className="cursor-pointer">Include PLUS pins in batch</Label>
                        </div>
                        
                        {bulkIncludePlus && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label>How many of the {bulkCount} should be PLUS pins?</Label>
                            <Input 
                              type="number" 
                              min={0} 
                              max={bulkCount} 
                              value={bulkPlusCount} 
                              onChange={(e) => setBulkPlusCount(Number(e.target.value))} 
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Remaining {bulkCount - bulkPlusCount} will be Standard pins.
                            </p>
                          </div>
                        )}
                      </div>

                      <Button onClick={handleBulkGeneratePins} disabled={loading} className="w-full">
                        {loading ? 'Processing...' : `Bulk Generate ${bulkCount} Pins`}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="flex flex-col">
                    <CardHeader className="flex flex-col">
                      <CardTitle>Transfer Pins to Vendor</CardTitle>
                      <CardDescription>Select unused pins below and assign them to a Level 3 Vendor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 col">
                      <div className="space-y-2">
                        <Label>Receiving Vendor Student ID</Label>
                        <Input 
                          placeholder="Enter vendor's registered student ID..." 
                          value={transferStudentId}
                          onChange={(e) => setTransferStudentId(e.target.value)}
                        />
                      </div>
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-xs flex flex-col gap-1 text-muted-foreground mb-4">
                        <span className="font-semibold text-primary">Selected Pins: {selectedPinIds.length}</span>
                        <span>Ensure you have confirmed payment from this Level 3 Vendor before clicking Transfer.</span>
                      </div>
                      <Button 
                        onClick={handleTransferPins} 
                        disabled={loading || selectedPinIds.length === 0} 
                        className="w-full mt-auto"
                      >
                        {loading ? 'Transferring...' : `Transfer ${selectedPinIds.length} Selected Pins`}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Configure Pin Prices</CardTitle>
                      <CardDescription>Set the pricing for Standard and PLUS plans displayed to students.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Standard Plan Price (₦)</Label>
                          <Input 
                            type="number" 
                            value={standardPriceSetting} 
                            onChange={(e) => setStandardPriceSetting(Number(e.target.value))} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>PLUS Plan Price (₦)</Label>
                          <Input 
                            type="number" 
                            value={plusPriceSetting} 
                            onChange={(e) => setPlusPriceSetting(Number(e.target.value))} 
                          />
                        </div>
                      </div>
                      <Button onClick={handleSavePinPrices} disabled={loading} className="w-full">
                        {loading ? 'Saving...' : 'Update Prices'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="space-y-1">
                        <CardTitle>Unused Pins ({unusedPins.length})</CardTitle>
                        <CardDescription>Manage master distribution inventory.</CardDescription>
                      </div>
                      {unusedPins.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs"
                            onClick={() => {
                              if (selectedPinIds.length === unusedPins.length) {
                                setSelectedPinIds([]);
                              } else {
                                setSelectedPinIds(unusedPins.map(p => p.id));
                              }
                            }}
                          >
                            {selectedPinIds.length === unusedPins.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto space-y-2">
                        {unusedPins.length > 0 ? (
                          unusedPins.map(pin => (
                            <div key={pin.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  className="h-4 w-4 rounded border-gray-300 text-primary"
                                  checked={selectedPinIds.includes(pin.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPinIds([...selectedPinIds, pin.id]);
                                    } else {
                                      setSelectedPinIds(selectedPinIds.filter(id => id !== pin.id));
                                    }
                                  }}
                                />
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono font-bold tracking-wider">{pin.code}</code>
                                    {pin.type === 'plus' ? (
                                      <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[8px] h-4 px-1 leading-none">STANDARD</Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {pin.assignedToStudentId ? `Assigned to: ${pin.assignedToStudentId}` : 'Master Pool'} • Owner: {pin.owner || 'N/A'} • {safeFormatDateOnly(pin.createdAt)}
                                  </span>
                                </div>
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
                        <CardDescription>Pins activated by students this semester.</CardDescription>
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
                                  {pin.type === 'plus' ? (
                                    <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-primary">PLUS</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 leading-none">STANDARD</Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{safeFormatDate(pin.usedAt, 'Unknown')}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                  <p className="text-[10px] text-muted-foreground truncate flex-1">
                                    <span className="font-semibold">Used by:</span> {pin.usedByStudentId || pin.usedBy}
                                  </p>
                                  {pin.assignedToStudentId && (
                                    <p className="text-[9px] text-muted-foreground italic">
                                      Vendor assignment: {pin.assignedToStudentId}
                                    </p>
                                  )}
                                </div>
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

                {/* Transferred Pins History for Level 4 */}
                {profile?.level === '4' && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Transferred Pins History ({transferredPins.length})</CardTitle>
                      <CardDescription>Pins that have been transferred out to vendors (Level 3 students) for discount reselling. These are managed and can be deleted only by those vendors.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {transferredPins.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {transferredPins.map(pin => (
                              <div key={pin.id} className="p-3 bg-muted/45 rounded-lg border flex flex-col justify-between gap-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <code className="font-mono font-bold text-sm tracking-wider text-primary">{pin.code}</code>
                                  <div className="flex gap-1 items-center">
                                    {pin.isUsed ? (
                                      <Badge variant="default" className="text-[8px] bg-emerald-500 hover:bg-emerald-600 text-white leading-none px-1 h-4">USED</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[8px] leading-none px-1 h-4">UNUSED</Badge>
                                    )}
                                    {pin.type === 'plus' ? (
                                      <Badge variant="default" className="text-[8px] h-4 px-1 leading-none bg-indigo-600">PLUS</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[8px] h-4 px-1 leading-none">STD</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground space-y-0.5">
                                  <p><span className="font-semibold">Transferred to Student:</span> {pin.assignedToStudentId || 'Unknown Vendor'}</p>
                                  <p><span className="font-semibold">Current Owner:</span> {pin.owner || 'Admin/Master Pool'}</p>
                                  {pin.isUsed && pin.usedByStudentId && (
                                    <p><span className="font-semibold">Activated by:</span> {pin.usedByStudentId}</p>
                                  )}
                                  <p className="italic text-[9px]">Transferred on {pin.usedAt ? safeFormatDateOnly(pin.usedAt) : safeFormatDateOnly(pin.createdAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No pins transferred out yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

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
                    This will permanently delete up to 450 of your sold / used pin records. 
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
          <div className="space-y-8">
            {/* Header Description */}
            <div className="flex flex-col gap-1 pb-2 border-b">
              <h2 className="text-xl font-bold tracking-tight">System Control Panel</h2>
              <p className="text-xs text-muted-foreground">Manage academic sessions, platform access modes, competition seasons, AI assistants, and backend infrastructure.</p>
            </div>

            {/* SECTION 1: ACADEMIC & TOURNAMENT CYCLES */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Academic & Tournament Cycles</h3>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Semester Control */}
                <Card className="shadow-sm border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <Settings className="h-4.5 w-4.5 text-primary" />
                      Semester Control
                    </CardTitle>
                    <CardDescription>Manage the active academic semester configuration.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 bg-muted/65 rounded-xl border border-muted-foreground/10">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-mono">Current Status</p>
                        <p className="text-xl font-black text-primary tracking-tight">
                          {systemConfig?.currentSemester === 'none' ? 'Holiday / Session Ended' : `${systemConfig?.currentSemester} Semester`}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      <Button 
                        size="sm" 
                        variant={systemConfig?.currentSemester === '1st' ? 'default' : 'outline'}
                        onClick={() => handleUpdateSemester('1st')}
                        disabled={loading || systemConfig?.currentSemester === '1st'}
                        className="w-full justify-center text-xs h-9 font-medium"
                      >
                        Start 1st Semester
                      </Button>
                      <Button 
                        size="sm" 
                        variant={systemConfig?.currentSemester === '2nd' ? 'default' : 'outline'}
                        onClick={() => handleUpdateSemester('2nd')}
                        disabled={loading || systemConfig?.currentSemester === '2nd'}
                        className="w-full justify-center text-xs h-9 font-medium"
                      >
                        Start 2nd Semester
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleUpdateSemester('none')}
                        disabled={loading || systemConfig?.currentSemester === 'none'}
                        className="w-full justify-center text-xs h-9 font-semibold"
                      >
                        End Current Semester
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 justify-center">
                    <p className="text-[10px] text-muted-foreground/80 italic text-center">
                      * Ending a semester deactivates all Level 1 (student) activation codes.
                    </p>
                  </CardFooter>
                </Card>

                {/* CoLearn Compete Season Control */}
                <Card className="shadow-sm border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <Zap className="h-4.5 w-4.5 text-primary" />
                      CoLearn Compete Season
                    </CardTitle>
                    <CardDescription>Configure tournament season and match scheduling.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {systemConfig?.activeSeasonId ? (
                      <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-primary tracking-wider uppercase">Active Tournament Season</span>
                          <span className="text-base font-black text-foreground tracking-tight">{systemConfig.activeSeasonName}</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={handleEndSeason}
                          disabled={loading}
                          className="w-full text-xs font-semibold h-9"
                        >
                          End Season & Reset Leaderboard
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">New Competition Season Name</Label>
                          <Input 
                            placeholder="e.g. 2026 Monsoon Semester Cup" 
                            value={newSeasonName} 
                            onChange={(e) => setNewSeasonName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                            className="h-9 text-xs"
                          />
                        </div>
                        <Button 
                          size="sm"
                          onClick={handleStartSeason}
                          disabled={loading || !newSeasonName.trim()}
                          className="w-full text-xs font-semibold h-9"
                        >
                          Start New Season
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* SECTION 2: PLATFORM GATEWAYS & PROMO */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Access Gates</h3>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Maintenance Mode */}
                <Card className="shadow-sm border col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <AlertTriangle className={systemConfig?.maintenanceMode ? "h-4.5 w-4.5 text-destructive" : "h-4.5 w-4.5 text-muted-foreground"} />
                      Maintenance Mode
                    </CardTitle>
                    <CardDescription>Gatekeep student platform requests.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`p-3 rounded-xl border flex flex-col gap-2 ${systemConfig?.maintenanceMode ? "bg-destructive/10 border-destructive/25 text-destructive" : "bg-muted/50"}`}>
                      <div>
                        <p className="font-bold text-xs">{systemConfig?.maintenanceMode ? "Lock Enabled" : "Platform Active"}</p>
                        <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                          {systemConfig?.maintenanceMode 
                            ? "Only Level 4 (Super-Admin) roles bypass login gates." 
                            : "Standard public connections permitted."}
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        variant={systemConfig?.maintenanceMode ? "default" : "destructive"}
                        onClick={handleToggleMaintenance}
                        disabled={loading}
                        className="w-full text-xs font-semibold h-8 mt-1"
                      >
                        {systemConfig?.maintenanceMode ? "Disable Maintenance" : "Go Under Maintenance"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Flux Platform Access */}
                <Card className="shadow-sm border col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-pink-600 dark:text-pink-400">
                      <Zap className="h-4.5 w-4.5 fill-pink-500 text-pink-500" />
                      Flux Extracurriculars
                    </CardTitle>
                    <CardDescription>Control ecosystem micro-services access.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`p-3 rounded-xl border flex flex-col gap-2 ${systemConfig?.fluxEnabled === false ? "bg-pink-500/10 border-pink-500/25" : "bg-muted/50"}`}>
                      <div>
                        <p className="font-bold text-xs">{systemConfig?.fluxEnabled !== false ? "Flux Ecosystem Live" : "Flux Suspended"}</p>
                        <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                          {systemConfig?.fluxEnabled !== false 
                            ? "All users can browse tracks, games, and active engines." 
                            : "Microtracks are restricted to active creators."}
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        variant={systemConfig?.fluxEnabled !== false ? "destructive" : "default"}
                        onClick={handleToggleFlux}
                        disabled={loading}
                        className={`w-full text-xs font-semibold h-8 mt-1 ${systemConfig?.fluxEnabled === false ? "bg-pink-600 hover:bg-pink-700 text-white" : ""}`}
                      >
                        {systemConfig?.fluxEnabled !== false ? "Suspend Flux Tracks" : "De-suspend Flux Tracks"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Promo Mode Setup */}
                <Card className="shadow-sm border col-span-1 border-amber-500/20 bg-amber-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                      <PlayCircle className="h-4.5 w-4.5 text-amber-500" />
                      Promo Activations
                    </CardTitle>
                    <CardDescription>Allow complimentary signups.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {promoConfig?.isActive ? (
                      <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <Badge className="bg-amber-600 border-none scale-90 -ml-1 text-[8px] tracking-wider py-0.5 px-1.5 h-3.5">PROMO ENROUTE</Badge>
                            <span className="text-xs font-bold">{promoConfig.count} / {promoConfig.quota} Used</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-7 text-[10px] font-bold px-2"
                            onClick={() => handleTogglePromo(false)}
                            disabled={loading}
                          >
                            Disable
                          </Button>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (promoConfig.count / promoConfig.quota) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Free Activation Quota (x)</Label>
                          <Input 
                            type="number" 
                            placeholder="e.g. 50" 
                            value={promoQuota === 0 ? '' : promoQuota} 
                            onChange={(e) => setPromoQuota(parseInt(e.target.value) || 0)}
                            min="1"
                            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button 
                          size="sm"
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-8" 
                          onClick={() => handleTogglePromo(true)}
                          disabled={loading || promoQuota <= 0}
                        >
                          Enable Promo Mode
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* SECTION 3: SYSTEM AI INTERFACES (LEVEL 4) */}
            {isLevel4 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Model Configurations</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Hermes Chat Config */}
                  <Card className="shadow-sm border border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-400">
                        <MessageCircle className="h-4.5 w-4.5 text-purple-500" />
                        Hermes Chatbot Assistant
                      </CardTitle>
                      <CardDescription>AI configuration context for real-time student conversations.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleUpdateAI}>
                      <CardContent className="space-y-4 text-xs">
                        <div className="flex items-center justify-between p-3.5 bg-purple-500/5 rounded-xl border border-purple-500/10">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold">Chatbot Active</Label>
                            <p className="text-[10px] text-muted-foreground">Allows student sidebar chat interactions.</p>
                          </div>
                          <div 
                            className={`w-11 h-5.5 rounded-full cursor-pointer transition-colors ${editAI.isActive ? 'bg-purple-500' : 'bg-muted'}`}
                            onClick={() => setEditAI(prev => ({ ...prev, isActive: !prev.isActive }))}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full bg-white mt-1 transition-transform ${editAI.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">API Provider</Label>
                          <Select 
                            value={editAI.provider} 
                            onValueChange={(v: 'groq' | 'openrouter' | 'gemini') => {
                              setEditAI(prev => ({ 
                                ...prev, 
                                provider: v,
                                model: RECOMMENDED_MODELS[v].chat
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="groq">Groq (Recommended — Fast & Free ✓)</SelectItem>
                              <SelectItem value="gemini">Google Gemini (Native — Free ✓)</SelectItem>
                              <SelectItem value="openrouter">OpenRouter (Pro Models)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Model Identifier</Label>
                          <Input 
                            value={editAI.model} 
                            onChange={(e) => setEditAI(prev => ({ ...prev, model: e.target.value }))}
                            placeholder="Model slug string"
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">API Key Override</Label>
                          <Input 
                            type="password" 
                            value={editAI.apiKey} 
                            onChange={(e) => setEditAI(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="Leave blank to use global fallbacks"
                            className="h-9 text-xs text-stone-700 dark:text-stone-300"
                          />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold h-9" disabled={loading}>
                          Save Chat Config
                        </Button>
                      </CardFooter>
                    </form>
                  </Card>

                  {/* Magic Note Creator AI */}
                  <Card className="shadow-sm border border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                        <FileText className="h-4.5 w-4.5 text-amber-500" />
                        Magic Note Creator AI
                      </CardTitle>
                      <CardDescription>AI settings for image-to-text notes extraction.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleUpdateMagicNoteAI}>
                      <CardContent className="space-y-4 text-xs">
                        <div className="flex items-center justify-between p-3.5 bg-amber-500/5 rounded-xl border border-amber-500/10">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold">Creator Engine Active</Label>
                            <p className="text-[10px] text-muted-foreground">Allows AI notes creation from images.</p>
                          </div>
                          <div 
                            className={`w-11 h-5.5 rounded-full cursor-pointer transition-colors ${editMagicNote.isActive ? 'bg-amber-500' : 'bg-muted'}`}
                            onClick={() => setEditMagicNote(prev => ({ ...prev, isActive: !prev.isActive }))}
                          >
                            <div className={`w-3.5 h-3.5 rounded-full bg-white mt-1 transition-transform ${editMagicNote.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">API Provider</Label>
                          <Select 
                            value={editMagicNote.provider} 
                            onValueChange={(v: 'groq' | 'openrouter' | 'gemini') => {
                              setEditMagicNote(prev => ({ 
                                ...prev, 
                                provider: v,
                                model: RECOMMENDED_MODELS[v].magicNote
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="groq">Groq (Recommended — Vision Model Free ✓)</SelectItem>
                              <SelectItem value="gemini">Google Gemini (Native — Free ✓)</SelectItem>
                              <SelectItem value="openrouter">OpenRouter (Pro Vision)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Model Identifier</Label>
                          <Input 
                            value={editMagicNote.model} 
                            onChange={(e) => setEditMagicNote(prev => ({ ...prev, model: e.target.value }))}
                            placeholder="Vision Model slug string"
                            required
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">API Key Override</Label>
                          <Input 
                            type="password" 
                            value={editMagicNote.apiKey} 
                            onChange={(e) => setEditMagicNote(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="Leave blank to use global fallbacks"
                            className="h-9 text-xs text-stone-700 dark:text-stone-300"
                          />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-9" disabled={loading}>
                          Save Magic Note Config
                        </Button>
                      </CardFooter>
                    </form>
                  </Card>
                </div>
              </div>
            )}

            {/* SECTION 4: INTEGRATIONS & AUTOMATION (LEVEL 4) */}
            {isLevel4 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Integrations & Automations</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Telegram Alerts Config */}
                  <Card className="shadow-sm border border-sky-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-400">
                        <MessageCircle className="h-4.5 w-4.5 text-sky-500" />
                        Telegram Alerts Integration
                      </CardTitle>
                      <CardDescription>Real-time backend trigger reports channel setup.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSaveTelegram}>
                      <CardContent className="space-y-4 text-xs">
                        <div className="flex items-center justify-between p-3 bg-sky-500/5 rounded-xl border border-sky-200/40">
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold">Webhook Alerts Channel</Label>
                            <p className="text-[10px] text-muted-foreground">Alerts are active forever on database modifications.</p>
                          </div>
                          <div className="px-2.5 py-0.5 bg-green-500/10 text-green-600 rounded text-[9px] font-bold uppercase tracking-wider border border-green-500/20">
                            Always Live
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Bot API Token</Label>
                          <Input 
                            type="password" 
                            value={editTelegram.botToken ? "••••••••••••••••••••••••••••" : ""} 
                            disabled
                            placeholder="Secured in backend"
                            className="h-9 text-xs bg-muted"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground font-semibold">Target Chat Room ID</Label>
                          <Input 
                            value={editTelegram.chatId || ""} 
                            disabled
                            placeholder="Secured in backend"
                            className="h-9 text-xs bg-muted"
                          />
                        </div>

                        {editTelegram.source && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Source Identity Tag</Label>
                            <Input 
                              value={editTelegram.source} 
                              disabled
                              className="h-9 text-xs bg-muted font-mono"
                            />
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button 
                          type="button" 
                          variant="outline"
                          className="w-full text-xs font-semibold h-9"
                          onClick={handleTestTelegram}
                          disabled={loading}
                        >
                          Send Test Alert
                        </Button>
                      </CardFooter>
                    </form>
                  </Card>

                  {/* Level Shifter */}
                  <Card className="shadow-sm border border-rose-500/20 bg-rose-500/10 dark:bg-rose-950/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
                        <Users className="h-4.5 w-4.5 text-rose-500" />
                        Level Shifter (100L → 200L)
                      </CardTitle>
                      <CardDescription>Automated batch update task for end of academic session.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3.5 bg-white/70 dark:bg-zinc-950/40 rounded-xl border border-rose-200 dark:border-rose-900 text-xs">
                        <p className="text-muted-foreground leading-relaxed">
                          This operation will search all system users whose active <strong className="text-rose-600 dark:text-rose-400">academicLevel</strong> equals <strong className="font-bold text-rose-600 dark:text-rose-400">"100"</strong> and instantly shift them to <strong className="font-bold text-rose-600 dark:text-rose-400">"200"</strong>. This is irreversible.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold h-9 shadow-md" 
                        onClick={handleShiftLevels}
                        disabled={shifting}
                      >
                        {shifting ? 'Shifting Levels...' : 'Switch 100L to 200L'}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            )}
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
      content: "Admins can elevate user roles, ban users with explicit reasons, and perform batch operations like switching all 100L active accounts to 200L.",
      tutorial: (
        <div className="space-y-4 text-xs md:text-sm">
          <p>The User Management interface allows administrators to moderate credentials and control permission-level status.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Role Definitions:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Level 1 (Student):</strong> Access standard notes & lectures after entering activation pin.</li>
              <li><strong>Level 2 (Active Student):</strong> Full dual-semester access badge.</li>
              <li><strong>Level 3 (Vendor / Creator):</strong> Can generate discount activation pins and transfer lists.</li>
              <li><strong>Level 4 (Super-Admin):</strong> God-mode system setting edits, reports, and AI endpoints.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Elevations & Moderations:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Input student unique identifier UID or matching database key.</li>
              <li>Assign Target level and execute <strong>Elevate User</strong>.</li>
              <li>To ban a user, type the reason and click <strong>Ban User</strong>; they are immediately disconnected.</li>
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
        <div className="space-y-4 text-xs md:text-sm">
          <p>Courses serve as the foundation for organizing all study materials on the platform.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Creating a Course:</h4>
            <ul className="list-disc pl-5 space-y-1">
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
      content: "Create or modify comprehensive study notes. Supports rich text format, KaTeX equations, and video lesson attachments.",
      tutorial: (
        <div className="space-y-4 text-xs md:text-sm">
          <p>The Note Builder is a powerful tool for creating high-quality, readable study guides.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Structure:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Headings:</strong> Use `#` for title, `##` for subheadings.</li>
              <li><strong>Math Expressions:</strong> Wrap formulas in `$$` for KaTeX rendering (e.g., `$$E=mc^2$$`).</li>
              <li><strong>Video Links:</strong> Link YouTube or Google Drive videos to notes inside the <strong>Video Management</strong> library.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Workflow:</h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Select a <strong>Course</strong> to host the note.</li>
              <li>Choose <strong>Note Type</strong> (such as Lecture Guide or past questions).</li>
              <li>Draft your content in the interactive markdown editor and review via the <strong>Preview</strong> mode.</li>
              <li>Click <strong>Save Note</strong> to release.</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "Video Library & Quizzes",
      icon: <PlayCircle className="h-5 w-5" />,
      content: "Admins can link study videos, arrange lessons group-sorted by semesters and courses, delete old video links, and compile quiz questions.",
      tutorial: (
        <div className="space-y-4 text-xs md:text-sm">
          <p>Video lessons supplement reading guides and support active learning via linked micro-quizzes.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Linking to a Note:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>In the <strong>Video Library</strong> dashboard, select the destination note from the selector.</li>
              <li>Copy and paste the YouTube / Google Drive file URL, and click <strong>Link to Note</strong>.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Organization & Deletion:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Videos are automatically arranged cleanly according to their course semester and department.</li>
              <li>Admins can delete any video link permanently by clicking the red <strong>Trashcan</strong> button next to the lesson cards.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Concept Check Quizzes:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Select any note in the Library and click <strong>Manage Quiz</strong>.</li>
              <li>Add multi-choice question items consisting of the question text, the correct answer, three incorrect options, and a helpful explanation.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Activation Pins",
      icon: <Key className="h-5 w-5" />,
      content: "Generate secure 12-digit pins for account activation and tier upgrades.",
      tutorial: (
        <div className="space-y-4 text-xs md:text-sm">
          <p>Pins are the primary activation and access control mechanism.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Pin Types:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Standard:</strong> Activates Level 1 accounts for one semester.</li>
              <li><strong>Plus:</strong> Grants Level 2 status (two semesters of access).</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Management:</h4>
            <ul className="list-disc pl-5 space-y-1">
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
        <div className="space-y-4 text-xs md:text-sm">
          <p>Keep the student body updated with real-time broadcasts.</p>
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Targeting Options:</h4>
            <ul className="list-disc pl-5 space-y-1">
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
      title: "System Control Panel",
      icon: <Settings className="h-5 w-5" />,
      content: "God-mode settings controlling semester transitions, competition matchmaking seasons, access gates, AI integrations, and real-time backend alerting.",
      tutorial: (
        <div className="space-y-4 text-xs md:text-sm">
          <p>Platform system configurations are structured into four clean sub-panels:</p>
          <div className="space-y-2.5">
            <h4 className="font-bold text-sm">1. Academic & Tournament Cycles:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Semester toggling:</strong> Deactivate past semester pins and update current course semesters (1st/2nd/None).</li>
              <li><strong>Matchmaking Seasons:</strong> Reset leaderboards, update championship name titles, and permit matchmaking leagues.</li>
            </ul>
            <h4 className="font-bold text-sm">2. Platform Access Gates:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Maintenance:</strong> Lock student routing access locks for emergency database updates.</li>
              <li><strong>Flux:</strong> Suspend or actuate the CoLearn Extracurricular Skills & active engines.</li>
              <li><strong>Promo:</strong> Grant free registration slots easily with targeted quotas.</li>
            </ul>
            <h4 className="font-bold text-sm">3. AI Model Configurations (Level 4 Only):</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Select active providers (Groq, Gemini, OpenRouter) and customize LLM model parameters for the **Hermes Chatbot** and the **Magic Notes vision OCR processor**.</li>
            </ul>
            <h4 className="font-bold text-sm">4. Integrations & Automations (Level 4 Only):</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Test the webhook configuration for Telegram operations notifications and deploy the **Level Shifter batch utility** shifting 100L users to 200L.</li>
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
        <div className="space-y-4 text-xs md:text-sm">
          <p>Understanding the anti-fraud measures in the referral system.</p>
          <p className="text-sm">The software automatically blocks Levels {">"}= 2 from participation. This is hardcoded into the business logic to prevent Admins, Vendors, or Multi-Semester users from farming points using their influence.</p>
          <div className="p-3 bg-destructive/5 rounded border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-tight text-center">
            Level 2 / 3 / 4 Restricted
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
          <CardDescription>Comprehensive guide for CoLearn platform administrators. Click any card to view detailed tutorial.</CardDescription>
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
              <span className="text-sm text-primary font-mono">support@colearn.futo</span>
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

function AdminOverview({ courses, notes, questions, unusedPins, usedPins, stats }: { 
  courses: Course[], 
  notes: Note[], 
  questions: Question[], 
  unusedPins: ActivationCode[], 
  usedPins: ActivationCode[],
  stats: any
}) {
  const [userStats, setUserStats] = useState<{ date: string, count: number }[]>([]);
  const [cbtStats, setCbtStats] = useState<{ name: string, value: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Query recent users with limits to save reads
        const usersQuery = query(collection(db, 'users'), limit(50));
        const usersSnap = await getDocs(usersQuery);
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

        // Limit query of cbt_sessions to save reads
        const sessionsQuery = query(collection(db, 'cbt_sessions'), limit(50));
        const sessionsSnap = await getDocs(sessionsQuery);
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
            <div className="text-2xl font-bold">{stats.totalCourses || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalNotes || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Question Sheets</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuestionSheets || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pins</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUnusedPins || 0}</div>
            <p className="text-xs text-muted-foreground">{stats.totalUsedPins || 0} used so far</p>
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