import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, addDoc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  ShieldCheck, School, BookOpen, DollarSign, Calendar, TrendingUp, Key, Plus, 
  List, Eye, FileDown, Loader2, Wand2, Sparkles, CheckCircle2, AlertTriangle, 
  Terminal, RefreshCw, XCircle, FileText, HelpCircle, Bot, Cpu, StopCircle,
  Camera, Smartphone, Lock, Unlock, CreditCard, Percent
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { autoCorrectNoteContent, autoCorrectQuestionData, autoCorrectLatexSyntax } from '../lib/latexAutoCorrect';
import { healLatexWithHermesAI, healQuestionsWithHermesPLX } from '../services/aiService';

interface UniversityItem {
  id: string;
  name: string;
  shortName: string;
  departments: string[];
}

interface DisciplineItem {
  id: string;
  name: string;
}

interface PriceHistoryRecord {
  id?: string;
  standardPrice: number;
  plusPrice: number;
  standardWholesalePrice?: number;
  plusWholesalePrice?: number;
  updatedAt: string;
}

export interface LatexCorrectionProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: string;
  progressPercent: number;
  notesScanned: number;
  totalNotes: number;
  notesCorrected: number;
  sheetsScanned: number;
  totalSheets: number;
  sheetsCorrected: number;
  questionsScanned: number;
  totalQuestions: number;
  questionsCorrected: number;
  currentBatchNum?: number;
  totalBatchesCount?: number;
  currentDocument: string;
  logs: string[];
  errorMsg?: string;
  completedAt?: string;
}

export default function OverseerControl() {
  const { profile, user } = useAuth();

  // Elevate level 4 admin states
  const [elevateStudentId, setElevateStudentId] = useState('');
  const [elevateLoading, setElevateLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [mergingQuestions, setMergingQuestions] = useState(false);
  const [mergeStats, setMergeStats] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error';
    stage: string;
    progressPercent: number;
    sheetsMerged: number;
    questionsMerged: number;
    totalSheets: number;
    totalQuestions: number;
    currentSheetName?: string;
    currentStep: number;
    totalSteps: number;
    message?: string;
    errorMsg?: string;
    completedAt?: string;
  }>({
    status: 'idle',
    stage: 'Idle',
    progressPercent: 0,
    sheetsMerged: 0,
    questionsMerged: 0,
    totalSheets: 0,
    totalQuestions: 0,
    currentStep: 0,
    totalSteps: 5,
  });
  const [showMergeConfirmDialog, setShowMergeConfirmDialog] = useState(false);
  const [latexCorrecting, setLatexCorrecting] = useState(false);
  const [showLatexConfirmModal, setShowLatexConfirmModal] = useState(false);
  const [healingEngine, setHealingEngine] = useState<'hermes' | 'heuristic'>('hermes');
  const [activeModelName, setActiveModelName] = useState('Hermes AI (from Firebase)');
  const [latexProgress, setLatexProgress] = useState<LatexCorrectionProgress>({
    status: 'idle',
    stage: 'Idle',
    progressPercent: 0,
    notesScanned: 0,
    totalNotes: 0,
    notesCorrected: 0,
    sheetsScanned: 0,
    totalSheets: 0,
    sheetsCorrected: 0,
    questionsScanned: 0,
    totalQuestions: 0,
    questionsCorrected: 0,
    currentDocument: '',
    logs: []
  });
  const isCorrectingRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom whenever new log events arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [latexProgress.logs]);

  // University creation states
  const [uniName, setUniName] = useState('');
  const [uniShortName, setUniShortName] = useState('');
  const [uniDeps, setUniDeps] = useState('');
  const [uniLoading, setUniLoading] = useState(false);
  const [universities, setUniversities] = useState<UniversityItem[]>([]);

  // Discipline creation states
  const [disciplineName, setDisciplineName] = useState('');
  const [disciplineLoading, setDisciplineLoading] = useState(false);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);

  // Price and Paystack configuration states
  const [standardPrice, setStandardPrice] = useState(1000);
  const [plusPrice, setPlusPrice] = useState(2000);
  const [bulkStandardPrice, setBulkStandardPrice] = useState(800);
  const [bulkPlusPrice, setBulkPlusPrice] = useState(1500);
  const [vendorCommissionPercentage, setVendorCommissionPercentage] = useState(15);
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [paystackSecretKey, setPaystackSecretKey] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);

  // Mobile Screenshot Authorization states
  const [screenshotTargetStudentId, setScreenshotTargetStudentId] = useState('');
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [searchedScreenshotUser, setSearchedScreenshotUser] = useState<any | null>(null);
  const [screenshotAllowedUsers, setScreenshotAllowedUsers] = useState<any[]>([]);

  // Revenue states
  const [revUni, setRevUni] = useState('');
  const [revYear, setRevYear] = useState(new Date().getFullYear().toString());
  const [revMonth, setRevMonth] = useState((new Date().getMonth() + 1).toString());
  const [revLoading, setRevLoading] = useState(false);
  const [calculatedRevenue, setCalculatedRevenue] = useState<{
    standardTransferred: number;
    standardUsedDirect: number;
    plusTransferred: number;
    plusUsedDirect: number;
    lendingStandardCount: number;
    lendingPlusCount: number;
    bulkRestockStandardCount: number;
    bulkRestockPlusCount: number;
    onDemandStandardCount: number;
    standardTotalRevenue: number;
    plusTotalRevenue: number;
    lendingTotalRevenue: number;
    colodgeCommissionRevenue?: number;
    grandTotal: number;
    details: string[];
    pins: {
      code: string;
      type: 'standard' | 'plus';
      status: 'transferred' | 'used_direct' | 'lending_settled' | 'bulk_restock' | 'on_demand';
      associatedId: string;
      timestamp: string;
      amount?: number;
    }[];
  } | null>(null);

  // Overseer Browser-style active tab state
  const [overseerTab, setOverseerTab] = useState<'revenue' | 'pricing' | 'access' | 'universities'>('revenue');

  // Fetch initial data
  const fetchData = async () => {
    try {
      // Fetch Universities
      const uniSnap = await getDocs(collection(db, 'universities'));
      const uniList = uniSnap.docs.map(d => ({ id: d.id, ...d.data() } as UniversityItem));
      setUniversities(uniList);
      if (uniList.length > 0) {
        setRevUni(uniList[0].id);
      }

      // Fetch Disciplines
      const discSnap = await getDocs(collection(db, 'disciplines'));
      const discList = discSnap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineItem));
      setDisciplines(discList);

      // Fetch Pricing & Paystack Config
      const configDoc = await getDoc(doc(db, 'system', 'config'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        setStandardPrice(data.standardPrice ?? 1000);
        setPlusPrice(data.plusPrice ?? 2000);
        setBulkStandardPrice(data.bulkStandardPrice ?? data.standardWholesalePrice ?? 800);
        setBulkPlusPrice(data.bulkPlusPrice ?? data.plusWholesalePrice ?? 1500);
        setVendorCommissionPercentage(data.vendorCommissionPercentage ?? 15);
        if (data.paystackPublicKey) setPaystackPublicKey(data.paystackPublicKey);
        if (data.paystackSecretKey) setPaystackSecretKey(data.paystackSecretKey);
      }

      // Also fetch from settings/paystack if available
      try {
        const paystackDoc = await getDoc(doc(db, 'settings', 'paystack'));
        if (paystackDoc.exists()) {
          const pData = paystackDoc.data();
          if (pData.publicKey) setPaystackPublicKey(pData.publicKey);
          if (pData.secretKey) setPaystackSecretKey(pData.secretKey);
        }
      } catch (pErr) {
        // ignore
      }

      // Fetch Price History
      const historySnap = await getDocs(query(collection(db, 'priceHistory'), orderBy('updatedAt', 'desc')));
      const historyList = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceHistoryRecord));
      setPriceHistory(historyList);

      // Fetch screenshot permitted users
      fetchScreenshotUsers();
    } catch (err) {
      console.error("Error loading overseer data:", err);
    }
  };

  const fetchScreenshotUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('canTakeScreenshots', '==', true));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setScreenshotAllowedUsers(list);
    } catch (e) {
      console.error("Failed to load screenshot allowed users:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Elevate user to Level 4
  const handleElevate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!elevateStudentId.trim()) return;

    setElevateLoading(true);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', elevateStudentId.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User with this School ID / Student ID was not found!");
        setElevateLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (userData.level === '4' || userData.level === '5') {
        toast.error(`User is already an Admin/Overseer (Level ${userData.level})`);
        setElevateLoading(false);
        return;
      }

      const targetAt = userData.At || 'futo';

      await updateDoc(doc(db, 'users', userDoc.id), {
        level: '4'
      });

      toast.success(`Success! Elevated ${userData.username || 'User'} to Level 4 Admin for university: ${targetAt.toUpperCase()}`);
      setElevateStudentId('');
    } catch (err: any) {
      console.error("Error elevating user:", err);
      toast.error(err.message || "Failed to elevate user");
    } finally {
      setElevateLoading(false);
    }
  };

  // Give target user the 'At' of FUTO
  const handleSetAtToFuto = async () => {
    if (!elevateStudentId.trim()) {
      toast.error("Please enter a Target User School ID / Student ID first!");
      return;
    }

    setElevateLoading(true);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', elevateStudentId.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User with this School ID / Student ID was not found!");
        setElevateLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      await updateDoc(doc(db, 'users', userDoc.id), {
        At: 'futo'
      });

      toast.success(`Success! Set university (At) to FUTO for user: ${userData.username || 'User'}`);
    } catch (err: any) {
      console.error("Error setting user At to FUTO:", err);
      toast.error(err.message || "Failed to update user's university");
    } finally {
      setElevateLoading(false);
    }
  };

  // Give logged-in user themselves the 'At' of FUTO
  const handleSetMyAtToFuto = async () => {
    if (!user?.uid) {
      toast.error("You are not authenticated!");
      return;
    }

    setElevateLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        At: 'futo'
      });
      toast.success("Success! Set your own university (At) to FUTO. Please reload the panel to see changes.");
    } catch (err: any) {
      console.error("Error setting own At to FUTO:", err);
      toast.error("Failed to update your own university.");
    } finally {
      setElevateLoading(false);
    }
  };

  // Set all courses to FUTO and remove At fields from notes & questionSheets
  const handleMigrateToFuto = async () => {
    setMigrating(true);
    const toastId = toast.loading("Starting database migration to FUTO...");
    try {
      const { deleteField, writeBatch } = await import('firebase/firestore');
      
      // 1. Migrate courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      let coursesUpdated = 0;
      let courseBatch = writeBatch(db);
      let opCount = 0;

      for (const courseDoc of coursesSnap.docs) {
        courseBatch.update(doc(db, 'courses', courseDoc.id), {
          At: 'futo'
        });
        coursesUpdated++;
        opCount++;
        
        if (opCount === 400) {
          await courseBatch.commit();
          courseBatch = writeBatch(db);
          opCount = 0;
        }
      }
      if (opCount > 0) {
        await courseBatch.commit();
      }

      // 2. Clean notes (remove At field)
      const notesSnap = await getDocs(collection(db, 'notes'));
      let notesCleaned = 0;
      let notesBatch = writeBatch(db);
      opCount = 0;

      for (const noteDoc of notesSnap.docs) {
        const data = noteDoc.data();
        if (data.At !== undefined) {
          notesBatch.update(doc(db, 'notes', noteDoc.id), {
            At: deleteField()
          });
          notesCleaned++;
          opCount++;
          
          if (opCount === 400) {
            await notesBatch.commit();
            notesBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }
      if (opCount > 0) {
        await notesBatch.commit();
      }

      // 3. Clean questionSheets (remove At field)
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      let sheetsCleaned = 0;
      let sheetsBatch = writeBatch(db);
      opCount = 0;

      for (const sheetDoc of sheetsSnap.docs) {
        const data = sheetDoc.data();
        if (data.At !== undefined) {
          sheetsBatch.update(doc(db, 'questionSheets', sheetDoc.id), {
            At: deleteField()
          });
          sheetsCleaned++;
          opCount++;
          
          if (opCount === 400) {
            await sheetsBatch.commit();
            sheetsBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }
      if (opCount > 0) {
        await sheetsBatch.commit();
      }

      toast.success(
        `Migration Successful!\nUpdated ${coursesUpdated} courses to FUTO.\nCleaned At field from ${notesCleaned} notes and ${sheetsCleaned} past questions.`, 
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(`Migration failed: ${err.message}`, { id: toastId });
    } finally {
      setMigrating(false);
    }
  };

  const handleMergePastQuestionsIntoSheets = () => {
    setShowMergeConfirmDialog(true);
  };

  const handleExecuteMerge = async () => {
    setShowMergeConfirmDialog(false);
    if (!user && !auth?.currentUser) {
      toast.error("Administrator session required. Please make sure you are signed in.");
      return;
    }

    setMergingQuestions(true);
    const toastId = toast.loading("Starting question sheets consolidation...");
    setMergeStats({
      status: 'running',
      stage: 'Scanning Question Sheets',
      progressPercent: 5,
      sheetsMerged: 0,
      questionsMerged: 0,
      totalSheets: 0,
      totalQuestions: 0,
      currentStep: 1,
      totalSteps: 5,
      message: 'Reading question sheets from Firestore...'
    });

    try {
      const { writeBatch } = await import('firebase/firestore');

      // 1. Fetch all question sheets
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      const totalSheets = sheetsSnap.docs.length;
      
      setMergeStats(prev => ({
        ...prev,
        stage: 'Fetching Questions Collection',
        progressPercent: 20,
        totalSheets,
        currentStep: 2,
        message: `Discovered ${totalSheets} question sheets. Reading questions collection from Firestore...`
      }));

      // 2. Fetch all questions
      toast.loading(`Found ${totalSheets} sheets. Fetching questions collection...`, { id: toastId });
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const totalQuestions = questionsSnap.docs.length;

      setMergeStats(prev => ({
        ...prev,
        stage: 'Mapping & Ordering Questions',
        progressPercent: 40,
        totalQuestions,
        currentStep: 3,
        message: `Discovered ${totalQuestions} questions. Indexing and grouping by sheet...`
      }));

      // 3. Map questions by sheetId
      const questionsBySheet = new Map<string, any[]>();
      for (const qDoc of questionsSnap.docs) {
        const qData = qDoc.data();
        const sheetId = qData.sheetId;
        if (!sheetId) continue;
        if (!questionsBySheet.has(sheetId)) {
          questionsBySheet.set(sheetId, []);
        }
        questionsBySheet.get(sheetId)!.push({
          id: qDoc.id,
          sheetId: sheetId,
          courseId: qData.courseId || '',
          text: qData.text || qData.q || qData.question || '',
          correctAnswer: qData.correctAnswer || '',
          incorrectAnswers: Array.isArray(qData.incorrectAnswers) ? qData.incorrectAnswers : [],
          options: Array.isArray(qData.options) ? qData.options : (Array.isArray(qData.opts) ? qData.opts : []),
          explanation: qData.explanation || '',
          order: typeof qData.order === 'number' ? qData.order : 0,
          authorId: qData.authorId || '',
          createdAt: qData.createdAt || new Date().toISOString()
        });
      }

      setMergeStats(prev => ({
        ...prev,
        stage: 'Consolidating Sheets into Database',
        progressPercent: 50,
        currentStep: 4,
        message: `Beginning batch consolidation across ${totalSheets} question sheets...`
      }));

      // 4. Batch update sheets with their embedded questions
      let sheetsUpdated = 0;
      let totalQuestionsMerged = 0;
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (let i = 0; i < totalSheets; i++) {
        const sheetDoc = sheetsSnap.docs[i];
        const existingData = sheetDoc.data();
        const sheetQs = questionsBySheet.get(sheetDoc.id) || existingData.questions || [];
        
        // Sort questions by order ascending
        sheetQs.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

        currentBatch.update(doc(db, 'questionSheets', sheetDoc.id), {
          questions: sheetQs
        });

        sheetsUpdated++;
        totalQuestionsMerged += sheetQs.length;
        opCount++;

        const currentPercent = Math.min(94, Math.round(50 + ((sheetsUpdated / totalSheets) * 44)));
        const sheetLabel = `${existingData.year || 'Exam'} (${existingData.semester || '1st'} Sem)`;

        setMergeStats(prev => ({
          ...prev,
          progressPercent: currentPercent,
          sheetsMerged: sheetsUpdated,
          questionsMerged: totalQuestionsMerged,
          currentSheetName: sheetLabel,
          message: `Consolidating sheet ${sheetsUpdated}/${totalSheets}: ${sheetLabel} (${sheetQs.length} Qs)...`
        }));

        // Allow UI to breathe and update smoothly
        if (i % 2 === 0 || i === totalSheets - 1) {
          await new Promise(r => setTimeout(r, 15));
        }

        if (opCount === 400) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        setMergeStats(prev => ({
          ...prev,
          stage: 'Committing Final Batch to Database',
          progressPercent: 95,
          message: 'Committing final batch of consolidated sheets to Firestore...'
        }));
        await currentBatch.commit();
      }

      // 5. Trigger academic update stamp in system/config so student apps reconcile immediately
      setMergeStats(prev => ({
        ...prev,
        stage: 'Syncing Academic Timestamp',
        progressPercent: 98,
        currentStep: 5,
        message: 'Updating academic update timestamp in system config...'
      }));

      try {
        await updateDoc(doc(db, 'system', 'config'), {
          lastAcademicUpdate: Date.now()
        });
      } catch (e) {
        console.error("Failed to update lastAcademicUpdate timestamp:", e);
      }

      const completedTime = new Date().toLocaleTimeString();
      setMergeStats({
        status: 'completed',
        stage: 'Consolidation Complete',
        progressPercent: 100,
        sheetsMerged: sheetsUpdated,
        questionsMerged: totalQuestionsMerged,
        totalSheets,
        totalQuestions,
        currentStep: 5,
        totalSteps: 5,
        completedAt: completedTime,
        message: `Successfully merged ${totalQuestionsMerged} questions into ${sheetsUpdated} question sheets! Future mobile course syncs will consume only 1 read per sheet.`
      });

      toast.success(
        `Consolidation Complete!\nMerged ${totalQuestionsMerged} questions into ${sheetsUpdated} question sheets.\nPast questions now cost only 1 read per sheet!`,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error("Question merge error:", err);
      setMergeStats({
        status: 'error',
        stage: 'Error Occurred',
        progressPercent: 0,
        sheetsMerged: 0,
        questionsMerged: 0,
        totalSheets: 0,
        totalQuestions: 0,
        currentStep: 0,
        totalSteps: 5,
        errorMsg: err.message || 'An unknown error occurred during consolidation.',
        message: `Merge failed: ${err.message}`
      });
      toast.error(`Consolidation failed: ${err.message}`, { id: toastId });
    } finally {
      setMergingQuestions(false);
    }
  };

  const handleStopAutoCorrectLatex = () => {
    isCorrectingRef.current = false;
    setLatexCorrecting(false);
    setLatexProgress(prev => ({
      ...prev,
      status: 'idle',
      stage: 'Process stopped by user',
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] LaTeX auto-correction process stopped.`]
    }));
    toast.info("LaTeX auto-correction stopped.");
  };

  // Auto-correct all incorrect LaTeX syntax across published notes and past questions in Firestore with live status updates
  const handleStartAutoCorrectLatex = async () => {
    if (isCorrectingRef.current) return;
    setShowLatexConfirmModal(false);
    isCorrectingRef.current = true;
    setLatexCorrecting(true);

    const formatTime = () => new Date().toLocaleTimeString();

    setLatexProgress({
      status: 'running',
      stage: `Initializing ${healingEngine === 'hermes' ? 'Hermes AI' : 'Local Heuristic'} LaTeX Engine...`,
      progressPercent: 2,
      notesScanned: 0,
      totalNotes: 0,
      notesCorrected: 0,
      questionsScanned: 0,
      totalQuestions: 0,
      questionsCorrected: 0,
      currentDocument: 'Connecting to Firestore & AI service...',
      logs: [`[${formatTime()}] Initialized ${healingEngine === 'hermes' ? 'Hermes AI LaTeX Auto-Correction (using Firebase config)' : 'Local Heuristic LaTeX Healing'}.`]
    });

    const addLog = (msg: string) => {
      setLatexProgress(prev => ({
        ...prev,
        logs: [...prev.logs.slice(-70), `[${formatTime()}] ${msg}`]
      }));
    };

    const toastId = toast.loading(`LaTeX auto-correction started (${healingEngine === 'hermes' ? 'Hermes AI' : 'Local'})... Watching progress`);

    try {
      const { writeBatch } = await import('firebase/firestore');

      // 0. Load Hermes Chat Configuration from Firestore if in AI mode
      let hermesConfig: any = null;
      if (healingEngine === 'hermes') {
        try {
          addLog("Connecting to Firebase to fetch Hermes AI Chat configuration (system/hermes)...");
          const hermesSnap = await getDoc(doc(db, 'system', 'hermes'));
          if (hermesSnap.exists()) {
            hermesConfig = hermesSnap.data();
            const prov = (hermesConfig.provider || 'gemini').toUpperCase();
            const mod = hermesConfig.model || 'gemini-3.8-flash';
            setActiveModelName(`Hermes AI (${prov}: ${mod})`);
            addLog(`[Hermes Engine] Loaded active configuration from Firebase: Provider=${prov}, Model=${mod}`);
          } else {
            setActiveModelName('Hermes AI (Server Gemini 3.8 Flash)');
            addLog("[Hermes Engine] No custom document at 'system/hermes'. Using server-side default Gemini 3.8 Flash engine.");
          }
        } catch (confErr: any) {
          addLog(`[Hermes Engine] Notice: Could not read 'system/hermes' (${confErr.message}), will use server fallback AI.`);
        }
      }

      // 1. Fetch note and question snapshots
      addLog("Fetching published notes from 'notes' collection...");
      const notesSnap = await getDocs(collection(db, 'notes'));
      const totalNotes = notesSnap.docs.length;
      addLog(`Found ${totalNotes} published notes in Firestore.`);

      addLog("Fetching past questions from 'questions' collection...");
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const totalQuestions = questionsSnap.docs.length;
      addLog(`Found ${totalQuestions} past questions in Firestore.`);

      const totalItems = totalNotes + totalQuestions || 1;

      setLatexProgress(prev => ({
        ...prev,
        stage: `Scanning ${totalNotes} notes for broken LaTeX, unclosed $ and bare fractions...`,
        totalNotes,
        totalQuestions,
        progressPercent: 5,
        currentDocument: 'Preparing note scanner...'
      }));

      let notesFixed = 0;
      let noteBatch = writeBatch(db);
      let opCount = 0;

      // 2. Scan and correct notes
      for (let i = 0; i < totalNotes; i++) {
        if (!isCorrectingRef.current) break;

        const noteDoc = notesSnap.docs[i];
        const data = noteDoc.data();
        const noteTitle = data.title || `Note #${noteDoc.id.slice(0, 8)}`;
        
        let changed = false;
        const updates: Record<string, any> = {};

        if (typeof data.content === 'string') {
          const res = autoCorrectNoteContent(data.content);
          if (res.changed) {
            updates.content = res.content;
            changed = true;
          }
        }

        if (typeof data.title === 'string') {
          const correctedTitle = autoCorrectLatexSyntax(data.title);
          if (correctedTitle !== data.title) {
            updates.title = correctedTitle;
            changed = true;
          }
        }

        if (changed) {
          noteBatch.update(doc(db, 'notes', noteDoc.id), updates);
          notesFixed++;
          opCount++;
          addLog(`Healed LaTeX syntax in note: "${noteTitle}"`);

          if (opCount >= 400) {
            addLog("Committing batch of note updates to Firestore...");
            await noteBatch.commit();
            noteBatch = writeBatch(db);
            opCount = 0;
          }
        }

        // Check any videoQuestions subcollection under notes
        try {
          const vqSnap = await getDocs(collection(db, `notes/${noteDoc.id}/videoQuestions`));
          for (const vqDoc of vqSnap.docs) {
            const vqData = vqDoc.data();
            const vqRes = autoCorrectQuestionData(vqData);
            if (vqRes.changed) {
              const cleanFields: Record<string, any> = {};
              if (vqRes.data.text !== undefined) cleanFields.text = vqRes.data.text;
              if (vqRes.data.correctAnswer !== undefined) cleanFields.correctAnswer = vqRes.data.correctAnswer;
              if (vqRes.data.incorrectAnswers !== undefined) cleanFields.incorrectAnswers = vqRes.data.incorrectAnswers;
              if (vqRes.data.explanation !== undefined) cleanFields.explanation = vqRes.data.explanation;

              noteBatch.update(doc(db, `notes/${noteDoc.id}/videoQuestions`, vqDoc.id), cleanFields);
              opCount++;
              addLog(`Healed LaTeX in video question for note: "${noteTitle}"`);

              if (opCount >= 400) {
                await noteBatch.commit();
                noteBatch = writeBatch(db);
                opCount = 0;
              }
            }
          }
        } catch {
          // ignore
        }

        const currentPct = Math.round(5 + ((i + 1) / totalItems) * 45);
        setLatexProgress(prev => ({
          ...prev,
          notesScanned: i + 1,
          notesCorrected: notesFixed,
          progressPercent: currentPct,
          currentDocument: `[Note ${i + 1}/${totalNotes}] ${noteTitle}`
        }));

        if (i % 8 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      if (opCount > 0) {
        addLog("Committing final batch of note updates to Firestore...");
        await noteBatch.commit();
      }

      addLog(`Completed note scanning. ${notesFixed} notes corrected.`);

      // 3. Process questions in batches of 1,000 using strict PLX <QUES ID="..."> syntax
      const BATCH_SIZE_1000 = 1000;
      const total1000Batches = Math.ceil(totalQuestions / BATCH_SIZE_1000);

      addLog(`Organizing ${totalQuestions} past questions into ${total1000Batches} batches of up to 1,000 questions each.`);
      addLog(`Engine configured: ${healingEngine === 'hermes' ? activeModelName : 'Fast Local Heuristic'}`);

      setLatexProgress(prev => ({
        ...prev,
        stage: `Healing ${totalQuestions} past questions in batches of 1,000...`,
        totalBatchesCount: total1000Batches,
        currentBatchNum: 0,
        currentDocument: `Preparing ${total1000Batches} batches (1,000 questions per batch)...`
      }));

      let questionsFixed = 0;
      let questionsProcessed = 0;

      for (let bIdx = 0; bIdx < totalQuestions; bIdx += BATCH_SIZE_1000) {
        if (!isCorrectingRef.current) {
          addLog("[Cancelled] Auto-correction stopped by user.");
          break;
        }

        const chunkDocs = questionsSnap.docs.slice(bIdx, bIdx + BATCH_SIZE_1000);
        const batchNum = Math.floor(bIdx / BATCH_SIZE_1000) + 1;
        const questionsInBatch = chunkDocs.map(d => ({ id: d.id, ...d.data() } as any));
        const firstQId = questionsInBatch[0]?.id?.slice(0, 8) || '';
        const lastQId = questionsInBatch[questionsInBatch.length - 1]?.id?.slice(0, 8) || '';

        addLog(`[Batch ${batchNum}/${total1000Batches}] Loaded ${questionsInBatch.length} questions from Firebase (IDs: ${firstQId}... to ${lastQId}...). Formatting in PLX syntax...`);

        setLatexProgress(prev => ({
          ...prev,
          stage: `Healing 1,000-Question Batch ${batchNum}/${total1000Batches} with ${healingEngine === 'hermes' ? activeModelName : 'Local Engine'}...`,
          currentBatchNum: batchNum,
          totalBatchesCount: total1000Batches,
          currentDocument: `[Batch ${batchNum}/${total1000Batches}] Questions ${bIdx + 1} - ${Math.min(bIdx + BATCH_SIZE_1000, totalQuestions)} / ${totalQuestions}`
        }));

        // Sub-chunk into blocks of 30 questions to stay comfortably within DeepSeek's max 8,192 output token limit
        const SUB_CHUNK_SIZE = 30;
        const subChunks: any[][] = [];
        for (let s = 0; s < questionsInBatch.length; s += SUB_CHUNK_SIZE) {
          subChunks.push(questionsInBatch.slice(s, s + SUB_CHUNK_SIZE));
        }

        addLog(`[Batch ${batchNum}/${total1000Batches}] Dispatching ${subChunks.length} PLX streams to ${healingEngine === 'hermes' ? 'DeepSeek' : 'Local Healer'} (3 streams concurrently)...`);

        const healedQuestionsFromBatch: any[] = [];
        const CONCURRENCY = 3;
        for (let i = 0; i < subChunks.length; i += CONCURRENCY) {
          if (!isCorrectingRef.current) break;
          const currentSlice = subChunks.slice(i, i + CONCURRENCY);
          await Promise.all(currentSlice.map(async (subChunk, sliceOffset) => {
            const streamIdx = i + sliceOffset + 1;
            if (!isCorrectingRef.current) return;
            try {
              if (healingEngine === 'hermes') {
                const healed = await healQuestionsWithHermesPLX(subChunk, hermesConfig);
                healedQuestionsFromBatch.push(...healed);
                addLog(`[Batch ${batchNum} Stream ${streamIdx}/${subChunks.length}] Healed ${healed.length} questions with PLX syntax.`);
              } else {
                const fallback = subChunk.map(q => autoCorrectQuestionData(q).data);
                healedQuestionsFromBatch.push(...fallback);
              }
            } catch (err: any) {
              addLog(`[Batch ${batchNum} Stream ${streamIdx}] Fallback applied: ${err.message || 'Error'}`);
              const fallback = subChunk.map(q => autoCorrectQuestionData(q).data);
              healedQuestionsFromBatch.push(...fallback);
            }
          }));

          const subDone = Math.min(questionsInBatch.length, (i + CONCURRENCY) * SUB_CHUNK_SIZE);
          setLatexProgress(prev => ({
            ...prev,
            questionsScanned: questionsProcessed + subDone,
            currentDocument: `[Batch ${batchNum}/${total1000Batches}] Stream ${Math.min(i + CONCURRENCY, subChunks.length)}/${subChunks.length} completed`
          }));
        }

        // Replace questions in Firebase by ID without losing data
        addLog(`[Batch ${batchNum}/${total1000Batches}] Replacing healed questions in Firebase by document ID...`);
        let qBatch = writeBatch(db);
        let opCount = 0;
        let batchUpdatedCount = 0;

        const healedMap = new Map(healedQuestionsFromBatch.map(q => [q.id, q]));

        for (const origDoc of chunkDocs) {
          const origData = origDoc.data();
          const healed = healedMap.get(origDoc.id);
          if (!healed) continue;

          const updates: Record<string, any> = {};
          let changed = false;

          if (healed.text && healed.text !== origData.text) {
            updates.text = healed.text;
            changed = true;
          }
          if (healed.question && healed.question !== origData.question) {
            updates.question = healed.question;
            changed = true;
          }
          if (healed.correctAnswer && healed.correctAnswer !== origData.correctAnswer) {
            updates.correctAnswer = healed.correctAnswer;
            changed = true;
          }
          if (healed.incorrectAnswers && JSON.stringify(healed.incorrectAnswers) !== JSON.stringify(origData.incorrectAnswers)) {
            updates.incorrectAnswers = healed.incorrectAnswers;
            changed = true;
          }
          if (healed.options && JSON.stringify(healed.options) !== JSON.stringify(origData.options)) {
            updates.options = healed.options;
            changed = true;
          }
          if (healed.explanation && healed.explanation !== origData.explanation) {
            updates.explanation = healed.explanation;
            changed = true;
          }

          if (changed) {
            qBatch.update(doc(db, 'questions', origDoc.id), updates);
            opCount++;
            batchUpdatedCount++;
            questionsFixed++;

            if (opCount >= 400) {
              await qBatch.commit();
              qBatch = writeBatch(db);
              opCount = 0;
            }
          }
        }

        if (opCount > 0) {
          await qBatch.commit();
        }

        questionsProcessed += questionsInBatch.length;
        addLog(`[Batch ${batchNum}/${total1000Batches}] Updated ${batchUpdatedCount} questions in Firebase. Total healed: ${questionsFixed}.`);

        const currentPct = Math.min(99, Math.round(50 + (questionsProcessed / totalQuestions) * 45));
        setLatexProgress(prev => ({
          ...prev,
          currentBatchNum: batchNum,
          totalBatchesCount: total1000Batches,
          questionsScanned: questionsProcessed,
          questionsCorrected: questionsFixed,
          progressPercent: currentPct,
        }));

        await new Promise(r => setTimeout(r, 20));
      }

      addLog(`Completed question healing. ${questionsFixed} questions healed across ${total1000Batches} batches of 1,000.`);
      addLog(`[Done] Successfully healed ${notesFixed} notes and ${questionsFixed} questions in Firebase!`);

      const finishTime = formatTime();
      setLatexProgress(prev => ({
        ...prev,
        status: 'completed',
        stage: 'All LaTeX Auto-Correction Complete!',
        progressPercent: 100,
        currentDocument: `Finished: ${notesFixed} notes and ${questionsFixed} questions healed in Firebase`,
        completedAt: finishTime
      }));

      toast.success(
        `LaTeX Autocorrection Complete (${healingEngine === 'hermes' ? 'DeepSeek / Hermes' : 'Local'})! Healed ${questionsFixed} questions and ${notesFixed} notes.`,
        { id: toastId, duration: 8000 }
      );
    } catch (err: any) {
      console.error("LaTeX autocorrection error:", err);
      addLog(`[Error] ${err.message || 'Operation failed'}`);
      setLatexProgress(prev => ({
        ...prev,
        status: 'error',
        stage: 'Auto-Correction Failed',
        errorMsg: err.message || 'Failed to auto-correct Firestore LaTeX'
      }));
      toast.error(`LaTeX autocorrection failed: ${err.message}`, { id: toastId });
    } finally {
      isCorrectingRef.current = false;
      setLatexCorrecting(false);
    }
  };

  // 2. Create University
  const handleCreateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniName.trim() || !uniShortName.trim()) {
      toast.error("Please fill in university name and short abbreviation");
      return;
    }

    setUniLoading(true);
    try {
      const uId = uniShortName.trim().toLowerCase();
      const departmentsArray = uniDeps
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const uniDocData = {
        name: uniName.trim(),
        shortName: uniShortName.trim().toUpperCase(),
        departments: departmentsArray
      };

      await setDoc(doc(db, 'universities', uId), uniDocData);
      toast.success(`University ${uniShortName.toUpperCase()} created successfully with ${departmentsArray.length} departments!`);
      
      setUniName('');
      setUniShortName('');
      setUniDeps('');
      fetchData();
    } catch (err: any) {
      console.error("Error creating university:", err);
      toast.error("Failed to create university");
    } finally {
      setUniLoading(false);
    }
  };

  // 3. Create Discipline
  const handleCreateDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplineName.trim()) return;

    setDisciplineLoading(true);
    try {
      const dId = disciplineName.trim().toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'disciplines', dId), {
        name: disciplineName.trim()
      });
      toast.success(`Discipline "${disciplineName.trim()}" created successfully!`);
      setDisciplineName('');
      fetchData();
    } catch (err) {
      console.error("Error creating discipline:", err);
      toast.error("Failed to create discipline");
    } finally {
      setDisciplineLoading(false);
    }
  };

  // Mobile App Screenshot Authorization Handlers
  const handleLookupScreenshotUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!screenshotTargetStudentId.trim()) {
      toast.error("Please enter a Student ID to look up");
      return;
    }
    setScreenshotLoading(true);
    setSearchedScreenshotUser(null);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', screenshotTargetStudentId.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error(`No student found with ID: "${screenshotTargetStudentId.trim()}"`);
        return;
      }
      const uDoc = snap.docs[0];
      setSearchedScreenshotUser({ id: uDoc.id, ...uDoc.data() });
    } catch (err: any) {
      console.error("Screenshot user lookup error:", err);
      toast.error(err.message || "Failed to search student");
    } finally {
      setScreenshotLoading(false);
    }
  };

  const handleToggleScreenshotPermission = async (
    targetUserId: string,
    currentStatus: boolean,
    studentId: string,
    username: string,
    currentLevel: string
  ) => {
    setScreenshotLoading(true);
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, 'users', targetUserId), {
        canTakeScreenshots: newStatus,
        screenshotAllowed: newStatus
      });

      toast.success(
        newStatus
          ? `Screenshot ability GRANTED to ${username || 'Student'} (${studentId}) without raising permission (stays Level ${currentLevel}).`
          : `Screenshot ability REVOKED for ${username || 'Student'} (${studentId}).`
      );

      if (searchedScreenshotUser && searchedScreenshotUser.id === targetUserId) {
        setSearchedScreenshotUser({
          ...searchedScreenshotUser,
          canTakeScreenshots: newStatus,
          screenshotAllowed: newStatus
        });
      }
      fetchScreenshotUsers();
    } catch (err: any) {
      console.error("Error toggling screenshot permission:", err);
      toast.error(err.message || "Failed to update screenshot permission");
    } finally {
      setScreenshotLoading(false);
    }
  };

  // 4. Save Prices, Bulk Rates, Commission & Paystack Keys (Level 5 Overseer Authority)
  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: Bulk purchase prices must be strictly lower than retail PIN prices
    if (bulkStandardPrice >= standardPrice) {
      toast.error(`Bulk purchase price for Standard PINs (₦${bulkStandardPrice.toLocaleString()}) must be lower than retail price (₦${standardPrice.toLocaleString()}) so vendors can sell at market price and turn a profit.`);
      return;
    }
    if (bulkPlusPrice >= plusPrice) {
      toast.error(`Bulk purchase price for PLUS PINs (₦${bulkPlusPrice.toLocaleString()}) must be lower than retail price (₦${plusPrice.toLocaleString()}) so vendors can sell at market price and turn a profit.`);
      return;
    }
    if (vendorCommissionPercentage <= 0 || vendorCommissionPercentage > 100) {
      toast.error("Vendor On-Demand commission percentage must be between 1% and 100%.");
      return;
    }

    setPriceLoading(true);
    try {
      const nowStr = new Date().toISOString();
      
      // Update system config
      await setDoc(doc(db, 'system', 'config'), {
        standardPrice,
        plusPrice,
        bulkStandardPrice,
        bulkPlusPrice,
        standardWholesalePrice: bulkStandardPrice, // backward compatibility
        plusWholesalePrice: bulkPlusPrice,
        vendorCommissionPercentage,
        paystackPublicKey: paystackPublicKey.trim(),
        paystackSecretKey: paystackSecretKey.trim(),
        pricesUpdatedAt: nowStr
      }, { merge: true });

      // Save Paystack keys in /settings/paystack as well for centralized access
      if (paystackPublicKey.trim() || paystackSecretKey.trim()) {
        try {
          await setDoc(doc(db, 'settings', 'paystack'), {
            publicKey: paystackPublicKey.trim(),
            secretKey: paystackSecretKey.trim(),
            mode: paystackPublicKey.startsWith('pk_live') ? 'live' : 'test',
            updatedAt: nowStr
          }, { merge: true });
        } catch (settingsErr) {
          console.warn("Could not sync to settings/paystack:", settingsErr);
        }
      }

      // Save to price history
      try {
        await addDoc(collection(db, 'priceHistory'), {
          standardPrice,
          plusPrice,
          bulkStandardPrice,
          bulkPlusPrice,
          vendorCommissionPercentage,
          updatedAt: nowStr
        });
      } catch (histErr) {
        console.warn("Could not append to priceHistory:", histErr);
      }

      toast.success("Activation pin prices, bulk rates, commission percentage, and Paystack keys updated successfully!");
      fetchData();
    } catch (err: any) {
      console.error("Error saving prices and keys:", err);
      toast.error(err?.message ? `Failed to update pricing: ${err.message}` : "Failed to update pricing and Paystack settings");
    } finally {
      setPriceLoading(false);
    }
  };

  // 5. Calculate Revenue with Price Changes
  const handleCalculateRevenue = async () => {
    if (!revUni) {
      toast.error("Please select a university");
      return;
    }
    setRevLoading(true);
    try {
      const targetYear = parseInt(revYear);
      const targetMonth = parseInt(revMonth); // 1-12

      // Start and end of the chosen month
      const startOfChosenMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfChosenMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      // Fetch all pins for this university
      const pinsQ = query(collection(db, 'activationCodes'), where('At', '==', revUni));
      const pinsSnap = await getDocs(pinsQ);

      const allPins = pinsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Filter pins transferred, used directly, or settled via lending in the selected month:
      // - Standard / Plus upfront transferred: has a vendor (assignedTo is set), isLent != true. Transfer date = createdAt.
      // - Standard / Plus used directly: isUsed is true, no vendor (assignedTo is not set), isLent != true. Usage date = usedAt.
      // - Lending Settled: isLent is true, settled is true. Settlement date = settledAt.
      
      const standardTransferred: any[] = [];
      const standardUsedDirect: any[] = [];
      const plusTransferred: any[] = [];
      const plusUsedDirect: any[] = [];
      const lendingSettledStandard: any[] = [];
      const lendingSettledPlus: any[] = [];
      const bulkRestockStandard: any[] = [];
      const bulkRestockPlus: any[] = [];
      const onDemandStandard: any[] = [];

      allPins.forEach(pin => {
        const isPlus = pin.type === 'plus';
        
        if (pin.isBulkRestocked || (pin.paymentReference && pin.paymentReference.startsWith('restock_'))) {
          if (pin.createdAt) {
            const restockDate = new Date(pin.createdAt);
            if (restockDate >= startOfChosenMonth && restockDate <= endOfChosenMonth) {
              if (isPlus) {
                bulkRestockPlus.push(pin);
              } else {
                bulkRestockStandard.push(pin);
              }
            }
          }
        } else if (pin.isOnDemand || (pin.paymentReference && pin.paymentReference.startsWith('ondemand_'))) {
          if (pin.createdAt) {
            const onDemandDate = new Date(pin.createdAt);
            if (onDemandDate >= startOfChosenMonth && onDemandDate <= endOfChosenMonth) {
              onDemandStandard.push(pin);
            }
          }
        } else if (pin.isLent) {
          // Lending PIN: Only counts towards revenue once settled/paid by vendor
          if (pin.settled && pin.settledAt) {
            const settlementDate = new Date(pin.settledAt);
            if (settlementDate >= startOfChosenMonth && settlementDate <= endOfChosenMonth) {
              if (isPlus) {
                lendingSettledPlus.push(pin);
              } else {
                lendingSettledStandard.push(pin);
              }
            }
          }
        } else if (pin.assignedTo) {
          // Upfront Transferred Non-Lent Pin
          if (pin.createdAt) {
            const transferDate = new Date(pin.createdAt);
            if (transferDate >= startOfChosenMonth && transferDate <= endOfChosenMonth) {
              if (isPlus) {
                plusTransferred.push(pin);
              } else {
                standardTransferred.push(pin);
              }
            }
          }
        } else if (pin.isUsed) {
          // Used Directly Non-Lent Pin
          if (pin.usedAt) {
            const usageDate = new Date(pin.usedAt);
            if (usageDate >= startOfChosenMonth && usageDate <= endOfChosenMonth) {
              if (isPlus) {
                plusUsedDirect.push(pin);
              } else {
                standardUsedDirect.push(pin);
              }
            }
          }
        }
      });

      // Get Price history sorted chronologically to trace mid-month price changes
      const priceHistoryQ = query(collection(db, 'priceHistory'), orderBy('updatedAt', 'asc'));
      const pHSnap = await getDocs(priceHistoryQ);
      const historyPoints = pHSnap.docs.map(d => d.data() as PriceHistoryRecord);

      // Helper function to get applicable prices at any given timestamp
      const getPricesAtDate = (dateIso: string): { standard: number; plus: number; standardWholesale: number; plusWholesale: number } => {
        const timestamp = new Date(dateIso).getTime();
        let activeStandard = 1000;
        let activePlus = 2000;
        let activeStandardWholesale = 800;
        let activePlusWholesale = 1500;
        
        // Find latest price change that occurred before or equal to this timestamp
        for (const pt of historyPoints) {
          if (new Date(pt.updatedAt).getTime() <= timestamp) {
            activeStandard = pt.standardPrice;
            activePlus = pt.plusPrice;
            if (pt.standardWholesalePrice !== undefined) activeStandardWholesale = pt.standardWholesalePrice;
            if (pt.plusWholesalePrice !== undefined) activePlusWholesale = pt.plusWholesalePrice;
          }
        }
        return { 
          standard: activeStandard, 
          plus: activePlus, 
          standardWholesale: activeStandardWholesale, 
          plusWholesale: activePlusWholesale 
        };
      };

      // Calculate Revenue
      let standardTotalRevenue = 0;
      let plusTotalRevenue = 0;
      let lendingTotalRevenue = 0;
      const details: string[] = [];

      // Process standard transferred
      standardTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        standardTotalRevenue += prices.standard;
      });
      if (standardTransferred.length > 0) {
        details.push(`Transferred Standard PINs (Upfront): ${standardTransferred.length}`);
      }

      // Process standard used direct
      standardUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        standardTotalRevenue += prices.standard;
      });
      if (standardUsedDirect.length > 0) {
        details.push(`Directly Used Standard PINs: ${standardUsedDirect.length}`);
      }

      // Process bulk restock standard
      bulkRestockStandard.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        const amount = p.price !== undefined ? p.price : prices.standardWholesale;
        standardTotalRevenue += amount;
      });
      if (bulkRestockStandard.length > 0) {
        details.push(`Bulk Restock Standard PINs (Paystack): ${bulkRestockStandard.length}`);
      }

      // Process on-demand standard
      onDemandStandard.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        const amount = p.price !== undefined ? p.price : prices.standard;
        standardTotalRevenue += amount;
      });
      if (onDemandStandard.length > 0) {
        details.push(`On-Demand Standard PINs (Paystack): ${onDemandStandard.length}`);
      }

      // Process plus transferred
      plusTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        plusTotalRevenue += prices.plus;
      });
      if (plusTransferred.length > 0) {
        details.push(`Transferred PLUS PINs (Upfront): ${plusTransferred.length}`);
      }

      // Process plus used direct
      plusUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        plusTotalRevenue += prices.plus;
      });
      if (plusUsedDirect.length > 0) {
        details.push(`Directly Used PLUS PINs: ${plusUsedDirect.length}`);
      }

      // Process bulk restock plus
      bulkRestockPlus.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        const amount = p.price !== undefined ? p.price : prices.plusWholesale;
        plusTotalRevenue += amount;
      });
      if (bulkRestockPlus.length > 0) {
        details.push(`Bulk Restock PLUS PINs (Paystack): ${bulkRestockPlus.length}`);
      }

      // Process settled lending pins (Wholesale debt cleared)
      lendingSettledStandard.forEach(p => {
        const prices = getPricesAtDate(p.settledAt || p.createdAt);
        const amount = p.lentWholesalePrice !== undefined ? p.lentWholesalePrice : prices.standardWholesale;
        lendingTotalRevenue += amount;
      });
      lendingSettledPlus.forEach(p => {
        const prices = getPricesAtDate(p.settledAt || p.createdAt);
        const amount = p.lentWholesalePrice !== undefined ? p.lentWholesalePrice : prices.plusWholesale;
        lendingTotalRevenue += amount;
      });

      if (lendingSettledStandard.length > 0 || lendingSettledPlus.length > 0) {
        details.push(`Settled Lending PINs Recovered: ${lendingSettledStandard.length + lendingSettledPlus.length} (Std: ${lendingSettledStandard.length}, Plus: ${lendingSettledPlus.length}) -> NGN ${lendingTotalRevenue.toLocaleString()}`);
      }

      // Display pricing in effect during this month
      const monthPriceChanges = historyPoints.filter(pt => {
        const ptDate = new Date(pt.updatedAt);
        return ptDate >= startOfChosenMonth && ptDate <= endOfChosenMonth;
      });

      if (monthPriceChanges.length > 0) {
        details.push("--- Price changes during this month ---");
        monthPriceChanges.forEach(pt => {
          details.push(`Date: ${new Date(pt.updatedAt).toLocaleDateString()} -> Standard: NGN ${pt.standardPrice}, PLUS: NGN ${pt.plusPrice}, Std Wholesale: NGN ${pt.standardWholesalePrice ?? 800}, PLUS Wholesale: NGN ${pt.plusWholesalePrice ?? 1500}`);
        });
      } else {
        // Find price point before month start
        let activeStandard = 1000;
        let activePlus = 2000;
        let activeStdWholesale = 800;
        let activePlusWholesale = 1500;
        for (const pt of historyPoints) {
          if (new Date(pt.updatedAt).getTime() < startOfChosenMonth.getTime()) {
            activeStandard = pt.standardPrice;
            activePlus = pt.plusPrice;
            if (pt.standardWholesalePrice !== undefined) activeStdWholesale = pt.standardWholesalePrice;
            if (pt.plusWholesalePrice !== undefined) activePlusWholesale = pt.plusWholesalePrice;
          }
        }
        details.push(`Price Point: Standard: NGN ${activeStandard}, PLUS: NGN ${activePlus} | Wholesale: Std NGN ${activeStdWholesale}, PLUS NGN ${activePlusWholesale}`);
      }

      const detailedPins: {
        code: string;
        type: 'standard' | 'plus';
        status: 'transferred' | 'used_direct' | 'lending_settled' | 'bulk_restock' | 'on_demand';
        associatedId: string;
        timestamp: string;
        amount?: number;
      }[] = [];

      standardTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'standard',
          status: 'transferred',
          associatedId: p.assignedToStudentId || p.owner || 'Unknown Vendor',
          timestamp: p.createdAt,
          amount: prices.standard
        });
      });

      plusTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'plus',
          status: 'transferred',
          associatedId: p.assignedToStudentId || p.owner || 'Unknown Vendor',
          timestamp: p.createdAt,
          amount: prices.plus
        });
      });

      standardUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'standard',
          status: 'used_direct',
          associatedId: p.usedByStudentId || 'N/A',
          timestamp: p.usedAt,
          amount: prices.standard
        });
      });

      plusUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'plus',
          status: 'used_direct',
          associatedId: p.usedByStudentId || 'N/A',
          timestamp: p.usedAt,
          amount: prices.plus
        });
      });

      bulkRestockStandard.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'standard',
          status: 'bulk_restock',
          associatedId: `Vendor Restock: ${p.assignedToStudentId || p.assignedToName || 'Vendor'}`,
          timestamp: p.createdAt,
          amount: p.price !== undefined ? p.price : prices.standardWholesale
        });
      });

      bulkRestockPlus.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'plus',
          status: 'bulk_restock',
          associatedId: `Vendor Restock: ${p.assignedToStudentId || p.assignedToName || 'Vendor'}`,
          timestamp: p.createdAt,
          amount: p.price !== undefined ? p.price : prices.plusWholesale
        });
      });

      onDemandStandard.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        detailedPins.push({
          code: p.code || p.id,
          type: 'standard',
          status: 'on_demand',
          associatedId: `On-Demand Sale (Vendor: ${p.assignedToStudentId || p.assignedToName || 'Vendor'})`,
          timestamp: p.createdAt,
          amount: p.price !== undefined ? p.price : prices.standard
        });
      });

      lendingSettledStandard.forEach(p => {
        const prices = getPricesAtDate(p.settledAt || p.createdAt);
        const amount = p.lentWholesalePrice !== undefined ? p.lentWholesalePrice : prices.standardWholesale;
        detailedPins.push({
          code: p.code || p.id,
          type: 'standard',
          status: 'lending_settled',
          associatedId: `Settled Vendor: ${p.assignedToStudentId || 'Vendor'} (User: ${p.usedByStudentId || 'Student'})`,
          timestamp: p.settledAt || p.usedAt || p.createdAt,
          amount
        });
      });

      lendingSettledPlus.forEach(p => {
        const prices = getPricesAtDate(p.settledAt || p.createdAt);
        const amount = p.lentWholesalePrice !== undefined ? p.lentWholesalePrice : prices.plusWholesale;
        detailedPins.push({
          code: p.code || p.id,
          type: 'plus',
          status: 'lending_settled',
          associatedId: `Settled Vendor: ${p.assignedToStudentId || 'Vendor'} (User: ${p.usedByStudentId || 'Student'})`,
          timestamp: p.settledAt || p.usedAt || p.createdAt,
          amount
        });
      });

      // Sort chronological by timestamp
      detailedPins.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Fetch CoLodge commissions from approved withdrawals for this university in the selected month
      let colodgeCommissionRevenue = 0;
      try {
        const colodgeQ = query(collection(db, 'colodge_withdrawal_requests'), where('At', '==', revUni));
        const colodgeSnap = await getDocs(colodgeQ);
        const colodgeWithdrawals = colodgeSnap.docs.map(d => d.data() as any);

        const filteredWithdrawals = colodgeWithdrawals.filter(w => {
          if (w.status !== 'approved') return false;
          const dateStr = w.processedAt || w.createdAt;
          if (!dateStr) return false;
          const wDate = new Date(dateStr);
          return wDate >= startOfChosenMonth && wDate <= endOfChosenMonth;
        });

        filteredWithdrawals.forEach(w => {
          const commission = w.colearnCommission !== undefined ? w.colearnCommission : (w.amount * 0.1);
          colodgeCommissionRevenue += commission;
        });

        if (colodgeCommissionRevenue > 0) {
          details.push(`CoLodge Commissions (Approved Withdrawals): NGN ${colodgeCommissionRevenue.toLocaleString()} (${filteredWithdrawals.length} Payouts Processed)`);
        }
      } catch (colodgeErr) {
        console.warn("Could not load colodge commissions from withdrawals, defaulting to 0:", colodgeErr);
      }

      setCalculatedRevenue({
        standardTransferred: standardTransferred.length,
        standardUsedDirect: standardUsedDirect.length,
        plusTransferred: plusTransferred.length,
        plusUsedDirect: plusUsedDirect.length,
        lendingStandardCount: lendingSettledStandard.length,
        lendingPlusCount: lendingSettledPlus.length,
        bulkRestockStandardCount: bulkRestockStandard.length,
        bulkRestockPlusCount: bulkRestockPlus.length,
        onDemandStandardCount: onDemandStandard.length,
        standardTotalRevenue,
        plusTotalRevenue,
        lendingTotalRevenue,
        colodgeCommissionRevenue,
        grandTotal: standardTotalRevenue + plusTotalRevenue + lendingTotalRevenue + colodgeCommissionRevenue,
        details,
        pins: detailedPins
      });

      toast.success("Revenue report calculated successfully!");
    } catch (err) {
      console.error("Revenue calculation failure:", err);
      toast.error("Failed to calculate monthly revenue");
    } finally {
      setRevLoading(false);
    }
  };

  const downloadRevenueExcel = () => {
    if (!calculatedRevenue) return;

    try {
      const selectedSchool = universities.find(u => u.id === revUni);
      const schoolShort = selectedSchool ? selectedSchool.shortName : revUni.toUpperCase();
      const schoolName = selectedSchool ? selectedSchool.name : revUni.toUpperCase();
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];
      const monthName = monthNames[parseInt(revMonth) - 1] || revMonth;

      const wb = XLSX.utils.book_new();

      const dataRows = [
        ["COLEARN STUDY PORTAL"],
        ["OFFICIAL ACADEMIC REVENUE AUDIT STATEMENT"],
        ["University", `${schoolShort} (${schoolName})`],
        ["Audit Period", `${monthName.toUpperCase()} ${revYear}`],
        ["Generated On", new Date().toLocaleString()],
        [],
        ["FINANCIAL SUMMARY"],
        ["Grand Total Revenue", `NGN ${calculatedRevenue.grandTotal.toLocaleString()}`],
        ["Standard PIN Income", `NGN ${calculatedRevenue.standardTotalRevenue.toLocaleString()}`, `${calculatedRevenue.standardTransferred + calculatedRevenue.standardUsedDirect + calculatedRevenue.bulkRestockStandardCount + calculatedRevenue.onDemandStandardCount} Pins`],
        ["PLUS PIN Income", `NGN ${calculatedRevenue.plusTotalRevenue.toLocaleString()}`, `${calculatedRevenue.plusTransferred + calculatedRevenue.plusUsedDirect + calculatedRevenue.bulkRestockPlusCount} Pins`],
        ["Lending Settlements Income", `NGN ${(calculatedRevenue.lendingTotalRevenue || 0).toLocaleString()}`, `${(calculatedRevenue.lendingStandardCount || 0) + (calculatedRevenue.lendingPlusCount || 0)} Settled Borrowed Pins`],
        ["CoLodge Commissions", `NGN ${(calculatedRevenue.colodgeCommissionRevenue || 0).toLocaleString()}`, "10% commission on withdrawn agent fees"],
        [],
        ["BREAKDOWN COUNTS"],
        ["Standard Pins Transferred (Upfront)", calculatedRevenue.standardTransferred],
        ["Standard Pins Used Directly", calculatedRevenue.standardUsedDirect],
        ["Bulk Restock Standard Pins (Paystack)", calculatedRevenue.bulkRestockStandardCount],
        ["On-Demand Standard Pins (Paystack)", calculatedRevenue.onDemandStandardCount],
        ["PLUS Pins Transferred (Upfront)", calculatedRevenue.plusTransferred],
        ["PLUS Pins Used Directly", calculatedRevenue.plusUsedDirect],
        ["Bulk Restock PLUS Pins (Paystack)", calculatedRevenue.bulkRestockPlusCount],
        ["Lending Standard PINs Settled", calculatedRevenue.lendingStandardCount || 0],
        ["Lending PLUS PINs Settled", calculatedRevenue.lendingPlusCount || 0],
        ["CoLodge Commission Income", `NGN ${(calculatedRevenue.colodgeCommissionRevenue || 0).toLocaleString()}`],
        [],
        ["DETAILED ACTIVATION PIN RECORDS"],
        ["S/N", "PIN Code", "Type", "Category/Status", "Associated Student ID (Vendor or User)", "Date & Time", "Revenue Amount (NGN)"]
      ];

      const pins = calculatedRevenue.pins || [];
      pins.forEach((p, idx) => {
        const typeStr = p.type.toUpperCase();
        const statusStr = p.status === 'transferred' ? 'TRANSFERRED (UPFRONT)' : p.status === 'lending_settled' ? 'LENDING (SETTLED DEBT)' : p.status === 'bulk_restock' ? 'BULK RESTOCK (PAYSTACK)' : p.status === 'on_demand' ? 'ON-DEMAND SALE (PAYSTACK)' : 'USED DIRECT';
        const formattedDate = new Date(p.timestamp).toLocaleString();
        
        dataRows.push([
          idx + 1,
          p.code,
          typeStr,
          statusStr,
          p.associatedId,
          formattedDate,
          p.amount !== undefined ? `NGN ${p.amount.toLocaleString()}` : 'N/A'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);

      // Force string format for PIN Code so Excel doesn't show them in scientific notation
      const pinsStartRow = 19; // 0-indexed row 19 is where PIN rows start (S/N is row 18)
      for (let i = pinsStartRow; i < dataRows.length; i++) {
        const pinCellRef = XLSX.utils.encode_cell({ r: i, c: 1 }); // Row i, Col 1 (PIN Code column B)
        if (ws[pinCellRef]) {
          ws[pinCellRef].t = 's'; // Set cell type to String
        }
      }

      // Configure beautiful column widths to prevent text clipping/mushing
      const colWidths = [
        { wch: 8 },   // S/N (Col A)
        { wch: 20 },  // PIN Code (Col B)
        { wch: 12 },  // Type (Col C)
        { wch: 22 },  // Category/Status (Col D)
        { wch: 45 },  // Associated Student ID (Col E)
        { wch: 28 }   // Date & Time (Col F)
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Revenue Audit");
      XLSX.writeFile(wb, `CoLearn_Revenue_Report_${schoolShort}_${monthName}_${revYear}.xlsx`);
      toast.success("Excel spreadsheet report downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to generate Excel sheet:", err);
      toast.error(`Spreadsheet generation failed: ${err.message}`);
    }
  };

  const downloadRevenuePDF = () => {
    if (!calculatedRevenue) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const selectedSchool = universities.find(u => u.id === revUni);
      const schoolName = selectedSchool ? selectedSchool.name : revUni.toUpperCase();
      const schoolShort = selectedSchool ? selectedSchool.shortName : revUni.toUpperCase();
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];
      const monthName = monthNames[parseInt(revMonth) - 1] || revMonth;

      // 1. Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 45, "F");

      // Draw elegant bottom accent bar
      doc.setFillColor(217, 119, 6); // amber-600
      doc.rect(0, 43, 210, 2, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.text("COLEARN STUDY PORTAL", 15, 18);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(156, 163, 175); // light grey
      doc.text("OFFICIAL ACADEMIC REVENUE AUDIT STATEMENT", 15, 25);

      doc.setFont("Helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(209, 213, 219);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 34);

      // 2. Metadata Information Block
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, 55, 180, 25, "FD");

      // Column 1
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("UNIVERSITY INSTITUTION", 20, 62);
      
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${schoolShort}`, 20, 68);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${schoolName.substring(0, 50)}${schoolName.length > 50 ? '...' : ''}`, 20, 73);

      // Column 2
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("AUDIT REPORT PERIOD", 130, 62);

      doc.setTextColor(217, 119, 6); // amber-600
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${monthName.toUpperCase()} ${revYear}`, 130, 69);
      
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`System ID: REF-${revUni.toUpperCase()}-${revYear}`, 130, 74);

      // 3. Financial Summary Cards
      // Card 1: Grand Total
      doc.setFillColor(254, 243, 199); // amber-100 background
      doc.setDrawColor(245, 158, 11); // amber-500 border
      doc.rect(15, 90, 56, 32, "FD");
      
      doc.setTextColor(146, 64, 14); // amber-800
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("GRAND TOTAL REVENUE", 20, 97);
      
      doc.setTextColor(217, 119, 6); // amber-600
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`N${calculatedRevenue.grandTotal.toLocaleString()}`, 20, 107);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text("Fully Audited Income", 20, 115);

      // Card 2: Standard PIN
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(77, 90, 56, 32, "FD");

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("STANDARD PIN INCOME", 82, 97);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`N${calculatedRevenue.standardTotalRevenue.toLocaleString()}`, 82, 107);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${calculatedRevenue.standardTransferred + calculatedRevenue.standardUsedDirect} Pins Processed`, 82, 115);

      // Card 3: PLUS PIN
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(139, 90, 56, 15, "FD");

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("PLUS PIN INCOME", 143, 95);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`N${calculatedRevenue.plusTotalRevenue.toLocaleString()}`, 143, 101);

      // Card 4: Lending Settlements
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(139, 107, 56, 15, "FD");

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("LENDING RECOVERY INCOME", 143, 112);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`N${(calculatedRevenue.lendingTotalRevenue || 0).toLocaleString()}`, 143, 118);

      // 4. Breakdown Table
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("ACTIVATION SOURCE & BREAKDOWN", 15, 133);

      // Table Header Row
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(15, 137, 180, 8, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("ACTIVATION PIN DESCRIPTION", 18, 142);
      doc.text("TRANSFERRED", 100, 142, { align: "center" });
      doc.text("USED DIRECT", 135, 142, { align: "center" });
      doc.text("TOTAL PINS", 165, 142, { align: "center" });

      // Row helper function
      const drawRow = (yPos: number, description: string, transCount: number, directCount: number, bgEven: boolean) => {
        if (bgEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, yPos, 180, 10, "F");
        }
        doc.setDrawColor(241, 245, 249);
        doc.line(15, yPos + 10, 195, yPos + 10);

        doc.setTextColor(51, 65, 85);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.text(description, 18, yPos + 6);
        
        doc.setFont("Helvetica", "bold");
        doc.text(transCount.toString(), 100, yPos + 6, { align: "center" });
        doc.text(directCount.toString(), 135, yPos + 6, { align: "center" });
        
        doc.setTextColor(15, 23, 42);
        doc.text((transCount + directCount).toString(), 165, yPos + 6, { align: "center" });
      };

      // Draw rows
      drawRow(145, "Standard Pin Activations (Regular Grade Access)", calculatedRevenue.standardTransferred, calculatedRevenue.standardUsedDirect, false);
      drawRow(155, "PLUS Pin Activations (Premium Advanced Access)", calculatedRevenue.plusTransferred, calculatedRevenue.plusUsedDirect, true);
      drawRow(165, "Settled Borrowed/Lent PINs (Wholesale Debt Cleared)", calculatedRevenue.lendingStandardCount || 0, calculatedRevenue.lendingPlusCount || 0, false);

      // 5. Audit Log Details
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("CHRONOLOGICAL CALCULATION STEPS", 15, 178);

      // Log Panel background
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      
      const logBoxHeight = Math.min(80, 10 + (calculatedRevenue.details.length * 6));
      doc.rect(15, 182, 180, logBoxHeight, "FD");

      doc.setTextColor(71, 85, 105);
      doc.setFont("Courier", "normal"); // Monospaced feel
      doc.setFontSize(8);

      let lineY = 188;
      calculatedRevenue.details.forEach((line) => {
        if (lineY < 182 + logBoxHeight - 4) {
          doc.text(line, 20, lineY);
          lineY += 5.5;
        }
      });

      // 6. Security & Verification Footer
      const footerY = 275;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, footerY - 5, 195, footerY - 5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("COLEARN SYSTEM PROTOCOL VERIFIED REPORT", 15, footerY);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("This report is programmatically generated directly from live system node logs. Access is strictly governed under Overseer guidelines.", 15, footerY + 4);
      
      const pins = calculatedRevenue.pins || [];
      const totalPages = 1 + Math.ceil(pins.length / 22);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page 1 of ${totalPages}`, 195, footerY, { align: "right" });

      // Generate additional pages for detailed pin list
      let currentPinIndex = 0;
      let currentPage = 2;

      while (currentPinIndex < pins.length) {
        doc.addPage();
        
        // Header for subsequent pages
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 20, "F");
        
        doc.setFillColor(217, 119, 6); // amber-600
        doc.rect(0, 19, 210, 1, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("COLEARN STUDY PORTAL - DETAILED ACTIVATION RECORDS", 15, 12);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(209, 213, 219);
        doc.text(`${schoolShort} • ${monthName.toUpperCase()} ${revYear}`, 195, 12, { align: "right" });

        // Table Header
        const tableTop = 28;
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(15, tableTop, 180, 8, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.text("S/N", 18, tableTop + 5);
        doc.text("PIN CODE", 30, tableTop + 5);
        doc.text("TYPE", 70, tableTop + 5);
        doc.text("CATEGORY/STATUS", 90, tableTop + 5);
        doc.text("STUDENT / VENDOR ID", 130, tableTop + 5);
        doc.text("DATE & TIME", 165, tableTop + 5);

        // Draw up to 22 records on this page
        let yPos = tableTop + 8;
        const pageLimit = Math.min(currentPinIndex + 22, pins.length);
        
        for (let i = currentPinIndex; i < pageLimit; i++) {
          const pin = pins[i];
          const isEven = (i - currentPinIndex) % 2 === 0;
          
          if (isEven) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, yPos, 180, 8, "F");
          }
          doc.setDrawColor(241, 245, 249);
          doc.line(15, yPos + 8, 195, yPos + 8);

          doc.setTextColor(51, 65, 85);
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8);
          
          doc.text((i + 1).toString(), 18, yPos + 5);
          
          doc.setFont("Courier", "bold");
          doc.text(pin.code, 30, yPos + 5);
          
          doc.setFont("Helvetica", "bold");
          if (pin.type === 'plus') {
            doc.setTextColor(79, 70, 229); // indigo-600
            doc.text("PLUS", 70, yPos + 5);
          } else {
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("STD", 70, yPos + 5);
          }
          
          doc.setTextColor(51, 65, 85);
          doc.setFont("Helvetica", "normal");
          doc.text(pin.status === 'transferred' ? "TRANSFERRED" : "USED DIRECT", 90, yPos + 5);
          doc.text(pin.associatedId, 130, yPos + 5);
          
          const formattedDate = new Date(pin.timestamp).toLocaleString();
          doc.setFontSize(7.5);
          doc.text(formattedDate, 165, yPos + 5);
          
          yPos += 8;
        }

        // Footer
        doc.setDrawColor(226, 232, 240);
        doc.line(15, footerY - 5, 195, footerY - 5);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("COLEARN SYSTEM PROTOCOL VERIFIED REPORT", 15, footerY);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("This report is programmatically generated directly from live system node logs. Access is strictly governed under Overseer guidelines.", 15, footerY + 4);
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${currentPage} of ${totalPages}`, 195, footerY, { align: "right" });

        currentPinIndex = pageLimit;
        currentPage++;
      }

      doc.save(`CoLearn_Revenue_Report_${schoolShort}_${monthName}_${revYear}.pdf`);
      toast.success("Stylized revenue report downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      toast.error(`PDF generation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overseer Executive Header */}
      <div className="border-b pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Overseer Command Center
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground font-medium">
              <span className="text-violet-700 dark:text-violet-400 font-semibold">Level 5 Executive Governance</span>
              <span aria-hidden="true">·</span>
              <span>Nationwide CoLearn Network</span>
              <span aria-hidden="true">·</span>
              <span><strong className="text-foreground">{universities.length}</strong> Deployed Campuses</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Browser-Style Overseer Tabs Container */}
      <Tabs value={overseerTab} onValueChange={setOverseerTab} className="w-full space-y-0">
        {/* Browser Tabs Header Bar */}
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 dark:bg-muted/25 px-3 pt-2.5 rounded-t-2xl overflow-x-auto no-scrollbar">
          <TabsList className="h-auto p-0 bg-transparent flex gap-1.5 border-none">
            <TabsTrigger
              value="revenue"
              className="px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border border-b-0 whitespace-nowrap cursor-pointer select-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:border-t-2 data-[state=active]:border-t-amber-500 bg-transparent text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground relative -mb-[1px] z-10"
            >
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              <span>Revenue & Audits</span>
            </TabsTrigger>

            <TabsTrigger
              value="pricing"
              className="px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border border-b-0 whitespace-nowrap cursor-pointer select-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:border-t-2 data-[state=active]:border-t-emerald-500 bg-transparent text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground relative -mb-[1px] z-10"
            >
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span>Pricing & Paystack</span>
            </TabsTrigger>

            <TabsTrigger
              value="access"
              className="px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border border-b-0 whitespace-nowrap cursor-pointer select-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:border-t-2 data-[state=active]:border-t-violet-500 bg-transparent text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground relative -mb-[1px] z-10"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
              <span>Access & Security</span>
            </TabsTrigger>

            <TabsTrigger
              value="universities"
              className="px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border border-b-0 whitespace-nowrap cursor-pointer select-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-xs data-[state=active]:border-t-2 data-[state=active]:border-t-blue-500 bg-transparent text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground relative -mb-[1px] z-10"
            >
              <School className="h-3.5 w-3.5 text-blue-500" />
              <span>Campuses & Catalog</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Browser Content Body: 100% full width, attached seamlessly */}
        <div className="w-full rounded-b-2xl border border-t-0 bg-card p-4 sm:p-6 shadow-2xs">
          {/* TAB 3: ACCESS & SECURITY */}
          <TabsContent value="access" className="space-y-6 mt-0 focus-visible:outline-none">
          {/* 1. Elevate Level 4 */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-500" />
            Confidential Admin Provisioning
          </CardTitle>
          <CardDescription>
            Elevate any existing platform user to a Level 4 Admin or set their university to FUTO. All course/past-question sheets are currently loaded on FUTO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleElevate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="elevateId">Target User School ID / Student ID</Label>
              <Input 
                id="elevateId"
                placeholder="Enter unique StudentID (e.g. 2021110052)" 
                value={elevateStudentId}
                onChange={(e) => setElevateStudentId(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button type="submit" disabled={elevateLoading} className="flex-1 md:flex-initial bg-violet-600 hover:bg-violet-700">
                {elevateLoading ? 'Elevating...' : 'Elevate to Level 4'}
              </Button>
              <Button 
                type="button" 
                onClick={handleSetAtToFuto} 
                disabled={elevateLoading} 
                variant="outline" 
                className="flex-1 md:flex-initial border-violet-500 text-violet-700 hover:bg-violet-50"
              >
                Set At to FUTO
              </Button>
            </div>
          </form>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Are you logged in and need to test FUTO datasets yourself? Give yourself FUTO access instantly.
            </div>
            <Button 
              type="button" 
              onClick={handleSetMyAtToFuto} 
              disabled={elevateLoading} 
              variant="outline" 
              className="w-full sm:w-auto bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Set My 'At' to FUTO
            </Button>
          </div>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <strong>Temporary Migration Tool:</strong> Update all available courses to be associated with university "FUTO" ("At" field), and purge any legacy "At" fields from Notes and Past Question sheets.
            </div>
            <Button 
              type="button" 
              onClick={handleMigrateToFuto} 
              disabled={migrating} 
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
            >
              {migrating ? 'Migrating Database...' : "Migrate Courses & Notes to FUTO"}
            </Button>
          </div>

          <div className="pt-4 border-t space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                  Consolidate Past Questions into Question Sheets (1 Read/Sheet)
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Bundles all individual documents from the <code className="text-pink-600 font-mono">questions</code> collection directly into an array on their matching <code className="text-pink-600 font-mono">questionSheets</code> documents. This permanently reduces mobile sync reads by <strong>over 95%</strong> (from 3,500+ reads down to ~40 reads).
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {mergeStats.status === 'completed' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMergeStats({
                      status: 'idle',
                      stage: 'Idle',
                      progressPercent: 0,
                      sheetsMerged: 0,
                      questionsMerged: 0,
                      totalSheets: 0,
                      totalQuestions: 0,
                      currentStep: 0,
                      totalSteps: 5,
                    })}
                    className="text-xs"
                  >
                    Dismiss Indicator
                  </Button>
                )}
                <Button 
                  type="button" 
                  onClick={handleMergePastQuestionsIntoSheets} 
                  disabled={mergingQuestions} 
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-sm"
                >
                  {mergingQuestions ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Merging... {mergeStats.progressPercent}%</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Merge Questions into Sheets</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Dedicated Real-Time Merger Progress Indicator Panel */}
            {mergeStats.status !== 'idle' && (
              <div className={`rounded-xl border p-4.5 transition-all duration-300 ${
                mergeStats.status === 'completed' 
                  ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800' 
                  : mergeStats.status === 'error'
                  ? 'bg-red-50/70 border-red-300 dark:bg-red-950/30 dark:border-red-800'
                  : 'bg-slate-50/90 border-emerald-300 dark:bg-slate-900/70 dark:border-emerald-800/60 shadow-sm'
              }`}>
                {/* Header row: Status, Step indicator & Numerical percentage */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      {mergeStats.status === 'running' && (
                        <div className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                        </div>
                      )}
                      {mergeStats.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      )}
                      {mergeStats.status === 'error' && (
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {mergeStats.stage}
                        </span>
                        {mergeStats.status === 'running' && (
                          <Badge variant="outline" className="text-[11px] font-medium bg-emerald-100/70 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Step {mergeStats.currentStep} of {mergeStats.totalSteps}
                          </Badge>
                        )}
                        {mergeStats.status === 'completed' && (
                          <Badge className="text-[11px] bg-emerald-600 text-white hover:bg-emerald-600">
                            Finished at {mergeStats.completedAt}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {mergeStats.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      mergeStats.status === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : mergeStats.status === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-foreground'
                    }`}>
                      {mergeStats.progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Animated Horizontal Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 relative mb-4">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      mergeStats.status === 'completed'
                        ? 'bg-emerald-600'
                        : mergeStats.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 animate-pulse'
                    }`}
                    style={{ width: `${Math.max(3, mergeStats.progressPercent)}%` }}
                  />
                </div>

                {/* Live Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sheets Merged</div>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {mergeStats.sheetsMerged} <span className="text-xs font-normal text-muted-foreground">/ {mergeStats.totalSheets || '—'}</span>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Questions Consolidated</div>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {mergeStats.questionsMerged.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {mergeStats.totalQuestions ? mergeStats.totalQuestions.toLocaleString() : '—'}</span>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Qs / Sheet</div>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {mergeStats.sheetsMerged > 0 ? (mergeStats.questionsMerged / mergeStats.sheetsMerged).toFixed(1) : '—'}
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Read Cost Reduction</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ~98% Less Reads
                    </div>
                  </div>
                </div>

                {/* Real-time active item tag when running */}
                {mergeStats.status === 'running' && mergeStats.currentSheetName && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2 font-mono bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 rounded-md border border-slate-200/60 dark:border-slate-700/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
                    <span>Processing: <strong className="text-foreground">{mergeStats.currentSheetName}</strong></span>
                  </div>
                )}

                {/* Error Box if needed */}
                {mergeStats.status === 'error' && mergeStats.errorMsg && (
                  <div className="mt-3 text-xs text-red-700 dark:text-red-300 bg-red-100/70 dark:bg-red-900/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <strong>Error Details:</strong> {mergeStats.errorMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Mobile App Screenshot Authorization (Direct Student ID Bypass - No Elevation) */}
      <Card className="border-cyan-200 dark:border-cyan-900 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
            <Camera className="h-5 w-5" />
            Mobile App Screenshot Authorization (Student ID Bypass)
          </CardTitle>
          <CardDescription>
            Grant or revoke mobile app screenshot and screen recording ability to any specific Student ID without raising their account permission level (they remain Level 1, Level 2, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLookupScreenshotUser} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="screenshotStudentId">Enter Target Student ID / School ID</Label>
              <div className="relative">
                <Input
                  id="screenshotStudentId"
                  placeholder="e.g. 2021110052 or CLN-XXXX"
                  value={screenshotTargetStudentId}
                  onChange={(e) => setScreenshotTargetStudentId(e.target.value)}
                  className="pr-10"
                />
                <Smartphone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={screenshotLoading || !screenshotTargetStudentId.trim()} 
              className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {screenshotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Camera className="h-4 w-4 mr-1.5" />}
              Find Student
            </Button>
          </form>

          {searchedScreenshotUser && (
            <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-900 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-base">
                      {searchedScreenshotUser.username || searchedScreenshotUser.name || 'Unnamed Student'}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      ID: {searchedScreenshotUser.studentId}
                    </Badge>
                    <Badge className="bg-slate-700 text-white text-xs">
                      Account Level: {searchedScreenshotUser.level || '1'} (Standard User)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchedScreenshotUser.email || 'No email'} • University: {(searchedScreenshotUser.At || 'futo').toUpperCase()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase">Current Access</div>
                    <Badge className={searchedScreenshotUser.canTakeScreenshots ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}>
                      {searchedScreenshotUser.canTakeScreenshots ? "Allowed (Bypass Active)" : "Blocked (Standard Guard)"}
                    </Badge>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleToggleScreenshotPermission(
                      searchedScreenshotUser.id,
                      Boolean(searchedScreenshotUser.canTakeScreenshots),
                      searchedScreenshotUser.studentId,
                      searchedScreenshotUser.username || '',
                      searchedScreenshotUser.level || '1'
                    )}
                    disabled={screenshotLoading}
                    className={searchedScreenshotUser.canTakeScreenshots ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                  >
                    {searchedScreenshotUser.canTakeScreenshots ? (
                      <>
                        <Lock className="h-4 w-4 mr-1.5" /> Revoke Screenshot Access
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 mr-1.5" /> Grant Screenshot Access
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* List of currently authorized students */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-cyan-600" />
                Active Authorized Screenshot Users ({screenshotAllowedUsers.length})
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchScreenshotUsers}
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh List
              </Button>
            </div>

            {screenshotAllowedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No individual student accounts currently have custom screenshot authorization.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {screenshotAllowedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{u.username || 'Student'}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {u.studentId}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Level {u.level || '1'} (No Permission Elevation)
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{u.email}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 text-xs h-7 px-2"
                      onClick={() => handleToggleScreenshotPermission(
                        u.id,
                        true,
                        u.studentId,
                        u.username || '',
                        u.level || '1'
                      )}
                      disabled={screenshotLoading}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* ========================================================================= */}
    {/* TAB 2: PRICING & PAYSTACK                                                 */}
    {/* ========================================================================= */}
    <TabsContent value="pricing" className="space-y-6 pt-1">
      {/* Activation PIN Pricing, Bulk Restock Rates, Commission & Paystack Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Activation PIN Pricing, Bulk Restock Rates & Paystack Configuration (Overseer Authority Only)
          </CardTitle>
          <CardDescription>
            Set student retail prices, wholesale bulk purchase prices (vendors restock in bulk at lower rates to turn a profit), vendor on-demand commission percentage, and Paystack API gateway keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSavePrices} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="standardPrice" className="font-semibold">Standard PIN Retail Price (₦)</Label>
                <Input 
                  id="standardPrice"
                  type="number"
                  min="1"
                  value={standardPrice}
                  onChange={(e) => setStandardPrice(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">Standard study portal access price charged to students (and used for On-Demand checkout)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plusPrice" className="font-semibold">PLUS PIN Retail Price (₦)</Label>
                <Input 
                  id="plusPrice"
                  type="number"
                  min="1"
                  value={plusPrice}
                  onChange={(e) => setPlusPrice(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">Premium PLUS study portal access retail price</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkStandardPrice" className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Standard PIN Bulk Purchase Price (₦)
                </Label>
                <Input 
                  id="bulkStandardPrice"
                  type="number"
                  min="1"
                  value={bulkStandardPrice}
                  onChange={(e) => setBulkStandardPrice(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Wholesale price for vendors restocking Standard PINs in bulk (min 5). <strong>Must be lower than Standard retail price (₦{standardPrice.toLocaleString()})</strong> so vendors profit.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkPlusPrice" className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  PLUS PIN Bulk Purchase Price (₦)
                </Label>
                <Input 
                  id="bulkPlusPrice"
                  type="number"
                  min="1"
                  value={bulkPlusPrice}
                  onChange={(e) => setBulkPlusPrice(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Wholesale price for vendors restocking PLUS PINs in bulk. <strong>Must be lower than PLUS retail price (₦{plusPrice.toLocaleString()})</strong> so vendors profit.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="vendorCommissionPercentage" className="text-indigo-700 dark:text-indigo-400 font-semibold flex items-center gap-1.5">
                  <Percent className="h-4 w-4" /> Vendor On-Demand Commission Percentage (%)
                </Label>
                <Input 
                  id="vendorCommissionPercentage"
                  type="number"
                  min="1"
                  max="100"
                  value={vendorCommissionPercentage}
                  onChange={(e) => setVendorCommissionPercentage(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Percentage of retail price credited to a vendor's wallet balance when a student activates an On-Demand PIN (e.g. at 15%, on ₦{standardPrice.toLocaleString()} Standard PIN, vendor receives ₦{Math.round(standardPrice * (vendorCommissionPercentage / 100)).toLocaleString()}).
                </p>
              </div>
            </div>

            {/* Paystack Gateway Configuration Block */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Paystack Payment Gateway Keys (Stored in Firebase)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Required for On-Demand student payments, vendor bulk restock checkouts, and bank payout transfers.
                  </p>
                </div>
                {paystackPublicKey && (
                  <Badge variant="outline" className={paystackPublicKey.startsWith('pk_live') ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                    {paystackPublicKey.startsWith('pk_live') ? "Live Mode" : "Test Mode"}
                  </Badge>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paystackPublicKey" className="text-xs font-mono">Paystack Public Key (Client Inline)</Label>
                  <Input 
                    id="paystackPublicKey"
                    placeholder="pk_test_... or pk_live_..."
                    value={paystackPublicKey}
                    onChange={(e) => setPaystackPublicKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Used safely on client for Paystack Inline popup modal</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paystackSecretKey" className="text-xs font-mono">Paystack Secret Key (Backend Proxy)</Label>
                  <Input 
                    id="paystackSecretKey"
                    type="password"
                    placeholder="sk_test_... or sk_live_..."
                    value={paystackSecretKey}
                    onChange={(e) => setPaystackSecretKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Saved securely in Firebase and utilized exclusively via backend proxy</p>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={priceLoading} className="bg-green-600 hover:bg-green-700 text-white">
              {priceLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {priceLoading ? 'Saving Pricing & Gateway Config...' : 'Save Pricing, Bulk Rates, Commission & Paystack Keys'}
            </Button>
          </form>

          {priceHistory.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <h4 className="font-bold text-sm text-muted-foreground flex items-center gap-1">
                <List className="h-4 w-4" /> Recent Price & Rate Log History
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1.5 border rounded-lg p-3 text-xs font-mono">
                {priceHistory.map((pt, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b last:border-0 flex-wrap gap-1">
                    <span>{new Date(pt.updatedAt).toLocaleString()}</span>
                    <span className="font-bold text-primary">
                      Std: ₦{pt.standardPrice} | PLUS: ₦{pt.plusPrice} | Bulk Std: ₦{pt.bulkStandardPrice ?? pt.standardWholesalePrice ?? 800} | Bulk PLUS: ₦{pt.bulkPlusPrice ?? pt.plusWholesalePrice ?? 1500}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    {/* ========================================================================= */}
    {/* TAB 4: CAMPUSES & CATALOG                                                 */}
    {/* ========================================================================= */}
    <TabsContent value="universities" className="space-y-6 pt-1">
      {/* University Management */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-blue-500" />
              Create University & Departments
            </CardTitle>
            <CardDescription>
              Deploy new universities onto the CoLearn ecosystem, adding their initial catalog of departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUniversity} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uniName">Full University Name</Label>
                <Input 
                  id="uniName"
                  placeholder="e.g. Federal University of Technology, Owerri" 
                  value={uniName}
                  onChange={(e) => setUniName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uniShort">Abbreviation / ID (Uppercase, e.g. FUTO)</Label>
                <Input 
                  id="uniShort"
                  placeholder="e.g. FUTO, UNILAG" 
                  value={uniShortName}
                  onChange={(e) => setUniShortName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uniDeps">Initial Departments (Comma-separated list)</Label>
                <textarea 
                  id="uniDeps"
                  placeholder="e.g. Computer Science, Mechanical Engineering, Electrical"
                  value={uniDeps}
                  onChange={(e) => setUniDeps(e.target.value)}
                  className="w-full min-h-[80px] p-2 border rounded-md text-sm bg-background"
                  required
                />
              </div>
              <Button type="submit" disabled={uniLoading} className="w-full">
                {uniLoading ? 'Creating...' : 'Create University'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" />
              Global Disciplines & Active Universities
            </CardTitle>
            <CardDescription>
              Deploy universal disciplines shared nationwide, or monitor deployed schools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleCreateDiscipline} className="space-y-2">
              <Label htmlFor="discName">Deploy Universal Discipline</Label>
              <div className="flex gap-2">
                <Input 
                  id="discName"
                  placeholder="e.g. Engineering, Sciences, Agriculture" 
                  value={disciplineName}
                  onChange={(e) => setDisciplineName(e.target.value)}
                  required
                />
                <Button type="submit" disabled={disciplineLoading}>
                  <Plus className="h-4 w-4 mr-1" /> Deploy
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Universities ({universities.length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {universities.map(u => (
                  <div key={u.id} className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{u.shortName}</span>
                      <span className="text-xs text-muted-foreground italic">{u.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Departments: {u.departments?.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    {/* ========================================================================= */}
    {/* TAB 1: REVENUE & AUDITS                                                   */}
    {/* ========================================================================= */}
    <TabsContent value="revenue" className="space-y-6 pt-1">
      {/* Monthly Revenue Reporting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Monthly Revenue Calculator
          </CardTitle>
          <CardDescription>
            Audit and calculate pin-sale dividends of any university. Factoring in precise historical price records in effect during that time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select University</Label>
              <Select value={revUni} onValueChange={setRevUni}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Select Campus" />
                </SelectTrigger>
                <SelectContent>
                  {universities.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.shortName} - {u.name.slice(0, 24)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Audit Year</Label>
              <Select value={revYear} onValueChange={setRevYear}>
                <SelectTrigger className="h-10 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Audit Month</Label>
              <Select value={revMonth} onValueChange={setRevMonth}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCalculateRevenue} disabled={revLoading} className="h-10 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-xs">
              {revLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TrendingUp className="h-4 w-4" />}
              {revLoading ? 'Calculating...' : 'Generate Revenue Audit'}
            </Button>
          </div>

          {calculatedRevenue && (
            <div className="p-5 sm:p-6 border rounded-2xl bg-amber-500/5 border-amber-500/25 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/80 pb-4 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      Monthly Revenue Audit: <span className="text-amber-600 dark:text-amber-400">{revUni.toUpperCase()}</span>
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-300">
                      Period: {revMonth}/{revYear}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Historical prices and ledger rates applied to all activated and restocked PINs for this cycle.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button 
                      size="sm" 
                      onClick={downloadRevenuePDF} 
                      className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg cursor-pointer shadow-2xs"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Download Stylized PDF
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={downloadRevenueExcel} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg cursor-pointer shadow-2xs"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Download Spreadsheet
                    </Button>
                  </div>
                </div>

                <div className="sm:text-right bg-card border border-amber-500/30 p-3.5 rounded-xl shadow-2xs shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Grand Total Income
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    ₦{calculatedRevenue.grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 4 Responsive Stat Columns */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 p-4 bg-card border rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Standard Pin Income</span>
                    <Badge variant="outline" className="text-[9px] font-mono">Standard</Badge>
                  </div>
                  <span className="font-bold text-xl text-primary block tabular-nums">
                    ₦{calculatedRevenue.standardTotalRevenue.toLocaleString()}
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">Transferred: {calculatedRevenue.standardTransferred}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">Used: {calculatedRevenue.standardUsedDirect}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">Restock: {calculatedRevenue.bulkRestockStandardCount}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">On-Demand: {calculatedRevenue.onDemandStandardCount}</span>
                  </div>
                </div>

                <div className="space-y-2 p-4 bg-card border rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">PLUS Pin Income</span>
                    <Badge variant="default" className="text-[9px] font-mono bg-primary">PLUS</Badge>
                  </div>
                  <span className="font-bold text-xl text-primary block tabular-nums">
                    ₦{calculatedRevenue.plusTotalRevenue.toLocaleString()}
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">Transferred: {calculatedRevenue.plusTransferred}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">Used: {calculatedRevenue.plusUsedDirect}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">Restock: {calculatedRevenue.bulkRestockPlusCount}</span>
                  </div>
                </div>

                <div className="space-y-2 p-4 bg-card border rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Lending Debt Cleared</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-300">Debt</Badge>
                  </div>
                  <span className="font-bold text-xl text-amber-600 dark:text-amber-400 block tabular-nums">
                    ₦{(calculatedRevenue.lendingTotalRevenue || 0).toLocaleString()}
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">Std Pins: {calculatedRevenue.lendingStandardCount || 0}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded">PLUS Pins: {calculatedRevenue.lendingPlusCount || 0}</span>
                  </div>
                </div>

                <div className="space-y-2 p-4 bg-card border rounded-xl shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">CoLodge Commission</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-300">10%</Badge>
                  </div>
                  <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400 block tabular-nums">
                    ₦{(calculatedRevenue.colodgeCommissionRevenue || 0).toLocaleString()}
                  </span>
                  <div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                    10% share of processed agent withdrawals
                  </div>
                </div>
              </div>

              {/* Audit Log Box */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-amber-500" /> Detailed Calculation Audit Ledger
                </h4>
                <div className="max-h-48 overflow-y-auto bg-card p-3 sm:p-4 border rounded-xl font-mono text-xs space-y-1.5 shadow-inner">
                  {calculatedRevenue.details.map((d, i) => (
                    <div key={i} className="py-1 px-1.5 border-b border-border/40 last:border-0 rounded hover:bg-muted/40 transition-colors">
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </div>
</Tabs>

      {/* Question Sheets Consolidation Confirmation Dialog */}
      <Dialog open={showMergeConfirmDialog} onOpenChange={setShowMergeConfirmDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <BookOpen className="h-5 w-5" />
              Consolidate Questions into Question Sheets
            </DialogTitle>
            <DialogDescription className="text-left pt-2 space-y-3 text-sm">
              <p>
                This will read all questions from the <code className="text-pink-600 font-mono bg-pink-50 dark:bg-pink-950/40 px-1 py-0.5 rounded">questions</code> collection, bundle them directly into an array on their matching <code className="text-pink-600 font-mono bg-pink-50 dark:bg-pink-950/40 px-1 py-0.5 rounded">questionSheets</code> documents, and commit the changes in Firestore.
              </p>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-200">
                  <Sparkles className="h-4 w-4" /> Why run this?
                </div>
                <p>
                  Instead of reading 3,500+ individual question documents when a student app syncs course materials, it will read only 1 document per sheet. This permanently cuts your Firebase read quota by <strong>over 95%</strong>.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMergeConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExecuteMerge}
              disabled={mergingQuestions}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Confirm & Start Consolidation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
