import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Course, Note, QuestionSheet, Question, University } from '../types';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { 
  Download, 
  Archive, 
  Building2, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  AlertCircle,
  FolderArchive
} from 'lucide-react';
import { Button } from './ui/button';

const DEFAULT_UNIVERSITIES = [
  { id: 'futo', name: 'Federal University of Technology, Owerri (FUTO)', shortName: 'FUTO' },
  { id: 'uniport', name: 'University of Port Harcourt (UNIPORT)', shortName: 'UNIPORT' },
  { id: 'unilag', name: 'University of Lagos (UNILAG)', shortName: 'UNILAG' },
  { id: 'ui', name: 'University of Ibadan (UI)', shortName: 'UI' },
  { id: 'oau', name: 'Obafemi Awolowo University (OAU)', shortName: 'OAU' },
  { id: 'abu', name: 'Ahmadu Bello University (ABU)', shortName: 'ABU' },
  { id: 'buk', name: 'Bayero University Kano (BUK)', shortName: 'BUK' },
  { id: 'unizik', name: 'Nnamdi Azikiwe University (UNIZIK)', shortName: 'UNIZIK' },
  { id: 'futa', name: 'Federal University of Technology, Akure (FUTA)', shortName: 'FUTA' },
  { id: 'futminna', name: 'Federal University of Technology, Minna (FUTMINNA)', shortName: 'FUTMINNA' },
];

function sanitizeFilename(str: string): string {
  if (!str) return 'untitled';
  return str
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export function convertNoteToPLX(note: Note): string {
  if (typeof note.content === 'string' && /<PLX>[\s\S]*?<\/PLX>/i.test(note.content)) {
    return note.content;
  }

  let plxContent = "<PLX>\n";

  try {
    const blocks = JSON.parse(note.content);
    if (Array.isArray(blocks) && blocks.length > 0) {
      blocks.forEach(block => {
        const type = block.type;
        const content = block.content || '';

        if (type === 'h1') {
          plxContent += `  <H1>\n    ${content}\n  </H1>\n\n`;
        } else if (type === 'h2') {
          plxContent += `  <H2>\n    ${content}\n  </H2>\n\n`;
        } else if (type === 'text') {
          plxContent += `  <TEXT>\n    ${content}\n  </TEXT>\n\n`;
        } else if (type === 'math') {
          plxContent += `  <MATH>\n    ${content}\n  </MATH>\n\n`;
        } else if (type === 'bullet-list') {
          plxContent += `  <LIST>\n    ${content}\n  </LIST>\n\n`;
        } else if (type === 'numbered-list') {
          plxContent += `  <ORDERED>\n    ${content}\n  </ORDERED>\n\n`;
        } else if (type === 'table') {
          try {
            const grid = JSON.parse(content);
            if (Array.isArray(grid)) {
              const csvStr = grid.map((row: any) =>
                Array.isArray(row) ? row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(', ') : ''
              ).join('\n');
              plxContent += `  <TABLE>\n    ${csvStr}\n  </TABLE>\n\n`;
            } else {
              plxContent += `  <TABLE>\n    ${content}\n  </TABLE>\n\n`;
            }
          } catch {
            plxContent += `  <TABLE>\n    ${content}\n  </TABLE>\n\n`;
          }
        } else if (type === 'video') {
          plxContent += `  <VIDEO>\n    ${content}\n  </VIDEO>\n\n`;
        } else if (type === 'diagram') {
          plxContent += `  <DIAGRAM>\n    ${content}\n  </DIAGRAM>\n\n`;
        } else if (type === 'question') {
          try {
            const q = typeof content === 'string' ? JSON.parse(content) : content;
            plxContent += `  <QUES>\n`;
            plxContent += `    ${q.question || q.text || ''}\n`;
            if (q.correct || q.correctAnswer) {
              plxContent += `    <COR ="${q.correct || q.correctAnswer}">\n`;
            }
            const incs = q.incorrect || q.incorrectAnswers;
            if (Array.isArray(incs)) {
              incs.forEach((inc: string) => {
                if (inc) plxContent += `    <INC ="${inc}">\n`;
              });
            }
            if (q.explanation) {
              plxContent += `    <EXP ="${q.explanation}">\n`;
            }
            plxContent += `  </QUES>\n\n`;
          } catch {
            plxContent += `  <TEXT>\n    ${content}\n  </TEXT>\n\n`;
          }
        } else {
          plxContent += `  <TEXT>\n    ${content}\n  </TEXT>\n\n`;
        }
      });
      plxContent += "</PLX>";
      return plxContent;
    }
  } catch {
    // Not JSON blocks
  }

  // Plain text fallback
  plxContent += `  <H1>\n    ${note.title || 'Untitled Note'}\n  </H1>\n\n`;
  plxContent += `  <TEXT>\n    ${note.content || ''}\n  </TEXT>\n`;
  plxContent += "</PLX>";
  return plxContent;
}

export function convertSheetToPLX(questions: Question[]): string {
  let plxContent = "<PLX>\n";
  questions.forEach(q => {
    plxContent += "  <QUES>\n";
    plxContent += `    ${q.text || ''}\n`;
    if (q.correctAnswer) {
      plxContent += `    <COR ="${q.correctAnswer}">\n`;
    }
    if (Array.isArray(q.incorrectAnswers)) {
      q.incorrectAnswers.forEach(inc => {
        if (inc) plxContent += `    <INC ="${inc}">\n`;
      });
    }
    if (q.explanation) {
      plxContent += `    <EXP ="${q.explanation}">\n`;
    }
    plxContent += "  </QUES>\n\n";
  });
  plxContent += "</PLX>";
  return plxContent;
}

export function AdminBackup() {
  const [universities, setUniversities] = useState<Array<{ id: string; name: string; shortName?: string }>>([]);
  const [selectedUniId, setSelectedUniId] = useState<string>('futo');
  const [loadingUnis, setLoadingUnis] = useState<boolean>(true);

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [uniStats, setUniStats] = useState<{
    coursesCount: number;
    notesCount: number;
    sheetsCount: number;
    questionsCount: number;
    coursesList: Array<{ id: string; code: string; title: string }>;
  } | null>(null);

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (selectedUniId) {
      analyzeUniversityContent(selectedUniId);
    }
  }, [selectedUniId]);

  const fetchUniversities = async () => {
    setLoadingUnis(true);
    try {
      const uniSnap = await getDocs(collection(db, 'universities'));
      const fetchedMap = new Map<string, { id: string; name: string; shortName?: string }>();

      DEFAULT_UNIVERSITIES.forEach(u => fetchedMap.set(u.id, u));

      uniSnap.docs.forEach(d => {
        const data = d.data();
        fetchedMap.set(d.id, {
          id: d.id,
          name: data.name || data.shortName || d.id.toUpperCase(),
          shortName: data.shortName || d.id.toUpperCase()
        });
      });

      // Also scan courses for any other At values
      const courseSnap = await getDocs(collection(db, 'courses'));
      courseSnap.docs.forEach(d => {
        const cAt = d.data().At;
        if (cAt && !fetchedMap.has(cAt)) {
          fetchedMap.set(cAt, {
            id: cAt,
            name: cAt.toUpperCase(),
            shortName: cAt.toUpperCase()
          });
        }
      });

      const list = Array.from(fetchedMap.values());
      setUniversities(list);
      if (list.length > 0 && !selectedUniId) {
        setSelectedUniId(list[0].id);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'universities');
      setUniversities(DEFAULT_UNIVERSITIES);
    } finally {
      setLoadingUnis(false);
    }
  };

  const analyzeUniversityContent = async (uniId: string) => {
    setAnalyzing(true);
    try {
      // 1. Fetch courses
      const courseSnap = await getDocs(collection(db, 'courses'));
      const matchedCourses = courseSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Course))
        .filter(c => {
          if (c.At) return c.At.toLowerCase() === uniId.toLowerCase();
          return uniId.toLowerCase() === 'futo';
        });

      const courseIds = new Set(matchedCourses.map(c => c.id));

      if (matchedCourses.length === 0) {
        setUniStats({
          coursesCount: 0,
          notesCount: 0,
          sheetsCount: 0,
          questionsCount: 0,
          coursesList: []
        });
        setAnalyzing(false);
        return;
      }

      // 2. Fetch notes
      const notesSnap = await getDocs(collection(db, 'notes'));
      const matchedNotes = notesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Note))
        .filter(n => courseIds.has(n.courseId));

      // 3. Fetch sheets
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      const matchedSheets = sheetsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as QuestionSheet))
        .filter(s => courseIds.has(s.courseId));

      const sheetIds = new Set(matchedSheets.map(s => s.id));

      // 4. Fetch questions
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const matchedQuestions = questionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Question))
        .filter(q => sheetIds.has(q.sheetId));

      setUniStats({
        coursesCount: matchedCourses.length,
        notesCount: matchedNotes.length,
        sheetsCount: matchedSheets.length,
        questionsCount: matchedQuestions.length,
        coursesList: matchedCourses.map(c => ({ id: c.id, code: c.code, title: c.title }))
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'courses/notes/sheets');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!selectedUniId) {
      toast.error('Please select a university');
      return;
    }

    const targetUni = universities.find(u => u.id === selectedUniId);
    const uniName = targetUni ? targetUni.name : selectedUniId.toUpperCase();

    setDownloading(true);
    setProgressStatus('Fetching university courses...');
    const toastId = toast.loading(`Preparing academic backup for ${uniName}...`);

    try {
      // Step 1: Fetch Courses
      const courseSnap = await getDocs(collection(db, 'courses'));
      const matchedCourses = courseSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Course))
        .filter(c => {
          if (c.At) return c.At.toLowerCase() === selectedUniId.toLowerCase();
          return selectedUniId.toLowerCase() === 'futo';
        });

      if (matchedCourses.length === 0) {
        toast.error(`No courses found for ${uniName}`, { id: toastId });
        setDownloading(false);
        return;
      }

      const courseMap = new Map<string, Course>();
      matchedCourses.forEach(c => courseMap.set(c.id, c));
      const courseIds = new Set(courseMap.keys());

      // Step 2: Fetch Notes
      setProgressStatus(`Fetching notes for ${matchedCourses.length} courses...`);
      const notesSnap = await getDocs(collection(db, 'notes'));
      const matchedNotes = notesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Note))
        .filter(n => courseIds.has(n.courseId));

      // Step 3: Fetch Question Sheets
      setProgressStatus(`Fetching past question sheets...`);
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      const matchedSheets = sheetsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as QuestionSheet))
        .filter(s => courseIds.has(s.courseId));

      const sheetIds = new Set(matchedSheets.map(s => s.id));

      // Step 4: Fetch Questions
      setProgressStatus(`Fetching questions...`);
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const matchedQuestions = questionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Question))
        .filter(q => sheetIds.has(q.sheetId));

      // Group questions by sheetId
      const questionsBySheet = new Map<string, Question[]>();
      matchedQuestions.forEach(q => {
        if (!questionsBySheet.has(q.sheetId)) {
          questionsBySheet.set(q.sheetId, []);
        }
        questionsBySheet.get(q.sheetId)!.push(q);
      });

      // Step 5: Build ZIP structure
      setProgressStatus(`Compiling files into PLX formats...`);
      const zip = new JSZip();
      const rootFolder = zip.folder(`${sanitizeFilename(selectedUniId.toUpperCase())}_ACADEMIC_BACKUP`) || zip;

      let totalFilesAdded = 0;

      for (const course of matchedCourses) {
        const courseFolder = rootFolder.folder(sanitizeFilename(course.code));
        if (!courseFolder) continue;

        const notesSubfolder = courseFolder.folder('notes');
        const pqSubfolder = courseFolder.folder('past_questions');

        // 1. Add Notes
        const courseNotes = matchedNotes.filter(n => n.courseId === course.id);
        const usedNoteNames = new Map<string, number>();

        courseNotes.forEach(note => {
          let baseTitle = sanitizeFilename(note.title || 'Untitled Note');
          if (usedNoteNames.has(baseTitle)) {
            const count = usedNoteNames.get(baseTitle)! + 1;
            usedNoteNames.set(baseTitle, count);
            baseTitle = `${baseTitle}_${count}`;
          } else {
            usedNoteNames.set(baseTitle, 1);
          }

          const filename = `${baseTitle}.plx.txt`;
          const plxContent = convertNoteToPLX(note);
          if (notesSubfolder) {
            notesSubfolder.file(filename, plxContent);
            totalFilesAdded++;
          }
        });

        // 2. Add Past Questions
        const courseSheets = matchedSheets.filter(s => s.courseId === course.id);
        const usedPqNames = new Map<string, number>();

        courseSheets.forEach(sheet => {
          const sheetQuestions = questionsBySheet.get(sheet.id) || [];
          const courseCodeClean = sanitizeFilename(course.code);
          const yearClean = sanitizeFilename(sheet.year || 'UnknownYear');

          let baseName = `${courseCodeClean}_${yearClean}`;
          if (usedPqNames.has(baseName)) {
            const count = usedPqNames.get(baseName)! + 1;
            usedPqNames.set(baseName, count);
            baseName = `${baseName}_${sheet.semester || 'sem'}_${count}`;
          } else {
            usedPqNames.set(baseName, 1);
          }

          const filename = `${baseName}.plx.txt`;
          const plxContent = convertSheetToPLX(sheetQuestions);
          if (pqSubfolder) {
            pqSubfolder.file(filename, plxContent);
            totalFilesAdded++;
          }
        });
      }

      // Step 6: Generate ZIP Blob
      setProgressStatus(`Generating final ZIP archive...`);
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setProgressStatus(`Compressing: ${Math.round(metadata.percent)}%`);
      });

      const cleanUniCode = sanitizeFilename(selectedUniId.toUpperCase());
      const zipFilename = `${cleanUniCode}_Academic_Content_Backup.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Successfully downloaded backup for ${uniName}! (${totalFilesAdded} files)`, { id: toastId });
    } catch (err) {
      console.error("Backup download error:", err);
      toast.error('Failed to generate backup. Check console for details.', { id: toastId });
    } finally {
      setDownloading(false);
      setProgressStatus('');
    }
  };

  const selectedUniObj = universities.find(u => u.id === selectedUniId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-stone-900 border border-blue-500/20 rounded-xl p-6 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">University Content Backup</h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  Level 5 Admin Only
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1">
                Export all academic notes and past questions for a university formatted cleanly as <code className="text-pink-400 font-mono">.plx.txt</code> files organized in course folders.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              fetchUniversities();
              if (selectedUniId) analyzeUniversityContent(selectedUniId);
            }} 
            disabled={analyzing || downloading}
            className="text-xs gap-1.5 border-stone-700 hover:bg-stone-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Select University & Action */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-stone-200 font-semibold text-sm border-b border-stone-800 pb-3">
              <Building2 className="h-4 w-4 text-blue-400" />
              Select Target University
            </div>

            {loadingUnis ? (
              <div className="flex items-center justify-center py-6 text-stone-400 text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                Loading universities...
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs text-stone-400 font-medium">University</label>
                <select
                  value={selectedUniId}
                  onChange={(e) => setSelectedUniId(e.target.value)}
                  disabled={downloading}
                  className="w-full bg-stone-950 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {universities.map((uni) => (
                    <option key={uni.id} value={uni.id}>
                      {uni.name} ({uni.id.toUpperCase()})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500">
                  Target Code: <span className="text-blue-400 font-mono font-bold uppercase">{selectedUniId}</span>
                </p>
              </div>
            )}

            {/* Structure Summary Card */}
            <div className="bg-stone-950/60 border border-stone-800/80 rounded-lg p-3 space-y-2 text-xs text-stone-300">
              <span className="font-semibold text-stone-200 block border-b border-stone-800 pb-1">
                ZIP Folder Specifications
              </span>
              <ul className="space-y-1.5 text-[11px] text-stone-400 font-mono">
                <li className="flex items-center gap-1.5">
                  <FolderArchive className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>{selectedUniId.toUpperCase()}_ACADEMIC_BACKUP/</span>
                </li>
                <li className="pl-4 flex items-center gap-1.5">
                  <span className="text-stone-600">├──</span>
                  <span>[CourseCode]/</span>
                </li>
                <li className="pl-8 flex items-center gap-1.5 text-blue-300">
                  <span className="text-stone-600">├──</span>
                  <span>notes/[NoteTitle].plx.txt</span>
                </li>
                <li className="pl-8 flex items-center gap-1.5 text-purple-300">
                  <span className="text-stone-600">└──</span>
                  <span>past_questions/[CourseCode]_[Year].plx.txt</span>
                </li>
              </ul>
            </div>

            {/* Download Button */}
            <div className="pt-2">
              <Button
                onClick={handleDownloadBackup}
                disabled={downloading || analyzing || !uniStats || uniStats.coursesCount === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all gap-2"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Academic Backup (.ZIP)</span>
                  </>
                )}
              </Button>

              {progressStatus && (
                <p className="text-[11px] text-blue-400 text-center mt-2 font-mono animate-pulse">
                  {progressStatus}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Statistics & Course Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                <span>Courses</span>
                <BookOpen className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {analyzing ? <Loader2 className="h-5 w-5 animate-spin text-stone-500" /> : uniStats?.coursesCount || 0}
              </p>
            </div>

            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                <span>Lecture Notes</span>
                <FileText className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {analyzing ? <Loader2 className="h-5 w-5 animate-spin text-stone-500" /> : uniStats?.notesCount || 0}
              </p>
            </div>

            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                <span>Question Sheets</span>
                <HelpCircle className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {analyzing ? <Loader2 className="h-5 w-5 animate-spin text-stone-500" /> : uniStats?.sheetsCount || 0}
              </p>
            </div>

            <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
                <span>Total Questions</span>
                <CheckCircle2 className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white">
                {analyzing ? <Loader2 className="h-5 w-5 animate-spin text-stone-500" /> : uniStats?.questionsCount || 0}
              </p>
            </div>
          </div>

          {/* Included Courses Preview */}
          <div className="bg-stone-900/80 border border-stone-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                <span>Course Inventory for {selectedUniObj?.name || selectedUniId.toUpperCase()}</span>
                {uniStats && (
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-mono">
                    {uniStats.coursesCount} items
                  </span>
                )}
              </h3>
            </div>

            {analyzing ? (
              <div className="flex flex-col items-center justify-center py-12 text-stone-400 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                <p className="text-xs">Scanning academic catalog for {selectedUniId.toUpperCase()}...</p>
              </div>
            ) : !uniStats || uniStats.coursesCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-stone-500 space-y-2 border border-dashed border-stone-800 rounded-lg">
                <AlertCircle className="h-8 w-8 text-stone-600" />
                <p className="text-xs font-medium text-stone-400">No courses associated with this university yet.</p>
                <p className="text-[11px] text-stone-600 max-w-sm text-center">
                  Courses must have their <code className="text-stone-400">At</code> field set to <code className="text-stone-400">{selectedUniId}</code> to be included in this backup.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {uniStats.coursesList.map((course, idx) => (
                  <div key={course.id || idx} className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800/80 rounded-lg hover:border-stone-700 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">
                        {course.code}
                      </span>
                      <span className="text-xs font-medium text-stone-300">
                        {course.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {course.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
