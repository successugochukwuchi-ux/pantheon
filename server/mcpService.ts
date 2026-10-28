import crypto from 'crypto';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { serverDb } from './firebaseServer.js';
import { autoCorrectNoteContent, autoCorrectQuestionData } from '../src/lib/latexAutoCorrect.js';
import { renderNotePreviewImage, renderQuestionGridImage } from './mcpVisualRenderer.js';

export interface AgentContext {
  tokenId: string;
  tokenPrefix: string;
  name: string;
  university: string;
  adminUid: string;
  adminEmail: string;
  level: string;
}

export interface McpTokenRecord {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  name: string;
  university: string;
  adminUid: string;
  adminEmail: string;
  level: string;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string | null;
}

/**
 * Validates bearer token and returns agent context with university boundaries
 */
export async function authenticateAgentToken(rawToken: string): Promise<AgentContext | null> {
  if (!rawToken || !rawToken.startsWith('cl_agent_')) {
    return null;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  try {
    const tokensRef = collection(serverDb, 'mcp_agent_tokens');
    const q = query(tokensRef, where('tokenHash', '==', tokenHash));
    const snap = await getDocs(q);

    if (snap.empty) {
      return null;
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data() as McpTokenRecord;

    if (data.status === 'revoked') {
      return null;
    }

    // Update lastUsedAt asynchronously
    updateDoc(doc(serverDb, 'mcp_agent_tokens', docSnap.id), {
      lastUsedAt: new Date().toISOString()
    }).catch(err => console.warn('[MCP] Failed to update token lastUsedAt:', err));

    return {
      tokenId: docSnap.id,
      tokenPrefix: data.tokenPrefix,
      name: data.name,
      university: (data.university || 'futo').toLowerCase().trim(),
      adminUid: data.adminUid,
      adminEmail: data.adminEmail,
      level: String(data.level || '4')
    };
  } catch (error) {
    console.error('[MCP Auth] Error authenticating token:', error);
    return null;
  }
}

/**
 * Asserts that an agent has access to a target university
 */
export function assertUniversityAccess(agent: AgentContext, targetUni?: string): void {
  const isSuperAdmin = agent.level === '5' || agent.adminEmail.toLowerCase() === 'successugochukwuchi@gmail.com';
  if (isSuperAdmin) {
    return; // Superadmins can view and manage any university
  }

  const normalizedTarget = (targetUni || 'futo').toLowerCase().trim();
  const normalizedAgentUni = agent.university.toLowerCase().trim();

  if (normalizedTarget !== normalizedAgentUni) {
    throw new Error(
      `Permission Denied: Agent is scoped strictly to university '${agent.university.toUpperCase()}' and is forbidden from reading or altering academic resources belonging to '${normalizedTarget.toUpperCase()}'.`
    );
  }
}

function cleanNoteContentForLecture(content: string): string {
  if (!content) return content;
  let cleaned = content.replace(/<QUES(?:\s*=\s*"[^"]*")?>([\s\S]*?)<\/QUES>/gi, (_, body) => {
    const firstSubTag = body.search(/<(COR|INC|EXP)/i);
    const qPrompt = firstSubTag !== -1 ? body.substring(0, firstSubTag).trim() : body.trim();
    const expMatch = /<EXP>([\s\S]*?)<\/EXP>/i.exec(body);
    let result = `<TEXT>${qPrompt}</TEXT>`;
    if (expMatch) {
      result += `\n<TEXT>Explanation: ${expMatch[1].trim()}</TEXT>`;
    }
    return result;
  });
  cleaned = cleaned.replace(/<\/?(COR|INC|EXP)(?:\s*=\s*"[^"]*")?>/gi, '');
  return cleaned;
}

function stripUnderlineTags(str: string): string {
  if (!str) return str;
  return str.replace(/<\/?u>/gi, '').replace(/<U>([\s\S]*?)<\/U>/gi, '$1');
}

/**
 * Ensures note content is stored in official CoLearn PLX markup (<PLX> ... </PLX>).
 * If the input is already PLX format, returns it directly.
 * If input is raw Markdown or JSON array, converts and wraps it into clean PLX tags.
 */
export function ensurePlxFormat(content: string, noteTitle?: string): string {
  if (!content) return '<PLX></PLX>';
  let str = content.trim();

  // If already wrapped in <PLX> ... </PLX>
  if (str.startsWith('<PLX>') || str.includes('<PLX>')) {
    if (!str.startsWith('<PLX>')) {
      const match = /<PLX>([\s\S]*?)<\/PLX>/i.exec(str);
      if (match) return `<PLX>\n${match[1].trim()}\n</PLX>`;
    }
    return str;
  }

  // If content contains PLX tags without root <PLX> wrapper
  if (str.includes('<H1>') || str.includes('<H2>') || str.includes('<TEXT>') || str.includes('<MATH>') || str.includes('<TABLE>') || str.includes('<LIST>') || str.includes('<ORDERED>') || str.includes('<QUES>')) {
    return `<PLX>\n${str}\n</PLX>`;
  }

  // If content is JSON array of NoteBlocks (from NoteBuilder)
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
        let plxBody = '';
        if (noteTitle) {
          plxBody += `  <H1>${noteTitle}</H1>\n\n`;
        }
        for (const b of parsed) {
          if (b.type === 'h1') plxBody += `  <H1>${b.content}</H1>\n\n`;
          else if (b.type === 'h2') plxBody += `  <H2>${b.content}</H2>\n\n`;
          else if (b.type === 'math') plxBody += `  <MATH>${b.content}</MATH>\n\n`;
          else if (b.type === 'table') {
            try {
              const grid = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
              if (Array.isArray(grid)) {
                const csvLines = grid.map((r: any[]) => r.join(', ')).join('\n');
                plxBody += `  <TABLE>\n${csvLines}\n  </TABLE>\n\n`;
              } else {
                plxBody += `  <TABLE>\n${b.content}\n  </TABLE>\n\n`;
              }
            } catch {
              plxBody += `  <TABLE>\n${b.content}\n  </TABLE>\n\n`;
            }
          }
          else if (b.type === 'bullet-list') plxBody += `  <LIST>\n${b.content}\n  </LIST>\n\n`;
          else if (b.type === 'numbered-list') plxBody += `  <ORDERED>\n${b.content}\n  </ORDERED>\n\n`;
          else if (b.type === 'question' && b.content) {
            try {
              const qData = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
              plxBody += `  <QUES ="${b.settings?.questionId || '1'}">\n    ${qData.question || ''}\n    <COR>${qData.correct || ''}</COR>\n`;
              (qData.incorrect || []).forEach((inc: string) => {
                plxBody += `    <INC>${inc}</INC>\n`;
              });
              if (qData.explanation) plxBody += `    <EXP>${qData.explanation}</EXP>\n`;
              plxBody += `  </QUES>\n\n`;
            } catch {
              plxBody += `  <TEXT>${b.content}</TEXT>\n\n`;
            }
          }
          else plxBody += `  <TEXT>${b.content}</TEXT>\n\n`;
        }
        return `<PLX>\n${plxBody.trim()}\n</PLX>`;
      }
    } catch {
      // ignore
    }
  }

  // Convert raw Markdown lines into PLX
  const lines = str.split('\n');
  let plxBody = '';
  if (noteTitle) {
    plxBody += `  <H1>${noteTitle}</H1>\n\n`;
  }

  let inMath = false;
  let mathBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('$$')) {
      if (inMath) {
        mathBuffer.push(trimmed.replace(/\$\$/g, ''));
        plxBody += `  <MATH>${mathBuffer.join(' ')}</MATH>\n\n`;
        mathBuffer = [];
        inMath = false;
      } else {
        inMath = true;
        const rem = trimmed.replace(/^\$\$/, '');
        if (rem.endsWith('$$') && rem.length > 2) {
          plxBody += `  <MATH>${rem.replace(/\$\$$/, '')}</MATH>\n\n`;
          inMath = false;
        } else if (rem) {
          mathBuffer.push(rem);
        }
      }
      continue;
    }
    if (inMath) {
      mathBuffer.push(trimmed);
      continue;
    }

    if (!trimmed) continue;

    if (trimmed.includes('|')) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().includes('|')) {
        const row = lines[j].trim();
        if (!(/^[\s|:-]+$/.test(row) && row.includes('-'))) {
          tableLines.push(row);
        }
        j++;
      }
      i = j - 1;
      if (tableLines.length > 0) {
        plxBody += `  <TABLE>\n${tableLines.map(r => `    ${r}`).join('\n')}\n  </TABLE>\n\n`;
        continue;
      }
    }

    if (trimmed.startsWith('# ')) {
      plxBody += `  <H1>${trimmed.slice(2).trim()}</H1>\n\n`;
    } else if (trimmed.startsWith('## ')) {
      plxBody += `  <H2>${trimmed.slice(3).trim()}</H2>\n\n`;
    } else if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      plxBody += `  <H2>${trimmed.replace(/^#+\s*/, '').trim()}</H2>\n\n`;
    } else {
      plxBody += `  <TEXT>${trimmed}</TEXT>\n\n`;
    }
  }

  if (inMath && mathBuffer.length > 0) {
    plxBody += `  <MATH>${mathBuffer.join(' ')}</MATH>\n\n`;
  }

  return `<PLX>\n${plxBody.trim()}\n</PLX>`;
}

/**
 * MCP Service Actions
 */
export const mcpService = {
  // 1. List Courses
  async listCourses(agent: AgentContext, params: { level?: string; semester?: string; department?: string } = {}) {
    const isSuperAdmin = agent.level === '5' || agent.adminEmail.toLowerCase() === 'successugochukwuchi@gmail.com';
    const coursesRef = collection(serverDb, 'courses');
    const snap = await getDocs(coursesRef);

    let courses = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (!isSuperAdmin) {
      courses = courses.filter(c => (c.At || 'futo').toLowerCase().trim() === agent.university);
    }

    if (params.level) {
      courses = courses.filter(c => String(c.level) === String(params.level));
    }
    if (params.semester) {
      courses = courses.filter(c => c.semester === params.semester);
    }
    if (params.department && params.department !== 'all') {
      courses = courses.filter(c => !c.department || c.department.toLowerCase() === params.department?.toLowerCase());
    }

    return courses.map(c => ({
      id: c.id,
      code: c.code,
      title: c.title,
      semester: c.semester,
      level: c.level,
      department: c.department || 'General',
      units: c.units || 3,
      university: (c.At || 'futo').toUpperCase()
    }));
  },

  // 2. Create Course
  async createCourse(agent: AgentContext, params: {
    code: string;
    title: string;
    semester: '1st' | '2nd';
    level: string;
    department?: string;
    units?: number;
  }) {
    if (!params.code || !params.title || !params.semester || !params.level) {
      throw new Error("Missing required fields: code, title, semester, level");
    }

    const courseData = {
      code: params.code.trim().toUpperCase(),
      title: params.title.trim(),
      semester: params.semester,
      level: String(params.level),
      department: params.department?.trim() || '',
      units: Number(params.units) || 3,
      disabled: false,
      At: agent.university,
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(serverDb, 'courses'), courseData);
    return {
      success: true,
      courseId: docRef.id,
      ...courseData
    };
  },

  // 3. List Notes for a Course
  async listNotes(agent: AgentContext, params: { courseId: string }) {
    if (!params.courseId) throw new Error("courseId is required");

    // Fetch course to check university
    const courseSnap = await getDoc(doc(serverDb, 'courses', params.courseId));
    if (!courseSnap.exists()) {
      throw new Error(`Course with ID ${params.courseId} not found`);
    }
    const courseData = courseSnap.data();
    assertUniversityAccess(agent, courseData.At || 'futo');

    const notesRef = collection(serverDb, 'notes');
    const q = query(notesRef, where('courseId', '==', params.courseId));
    const snap = await getDocs(q);

    return snap.docs.map(d => {
      const n = d.data();
      return {
        id: d.id,
        courseId: n.courseId,
        title: n.title,
        type: n.type || 'lecture',
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        authorId: n.authorId,
        contentLength: (n.content || '').length
      };
    });
  },

  // 4. Get Note Details
  async getNote(agent: AgentContext, params: { noteId: string }) {
    if (!params.noteId) throw new Error("noteId is required");
    const noteSnap = await getDoc(doc(serverDb, 'notes', params.noteId));
    if (!noteSnap.exists()) {
      throw new Error(`Note with ID ${params.noteId} not found`);
    }
    const noteData = noteSnap.data();
    assertUniversityAccess(agent, noteData.At || 'futo');

    return {
      id: noteSnap.id,
      ...noteData
    };
  },

  // 5. Create Note with Embedded Visual Preview
  async createNote(agent: AgentContext, params: {
    courseId: string;
    title: string;
    content: string;
    type?: 'lecture' | 'past_question';
  }) {
    if (!params.courseId || !params.title || !params.content) {
      throw new Error("Missing required fields: courseId, title, content");
    }

    // Verify course university
    const courseSnap = await getDoc(doc(serverDb, 'courses', params.courseId));
    if (!courseSnap.exists()) {
      throw new Error(`Course with ID ${params.courseId} not found`);
    }
    const courseData = courseSnap.data();
    assertUniversityAccess(agent, courseData.At || 'futo');

    // Auto-correct note LaTeX formatting, clean accidental question tags, and ensure official PLX format
    const cleanedInput = cleanNoteContentForLecture(params.content);
    const noteCorr = autoCorrectNoteContent(cleanedInput);
    const correctedContent = typeof noteCorr === 'object' && noteCorr.content ? noteCorr.content : String(cleanedInput);
    const plxContent = ensurePlxFormat(correctedContent, params.title.trim());

    const notePayload = {
      courseId: params.courseId,
      title: params.title.trim(),
      content: plxContent,
      type: params.type || 'lecture',
      authorId: agent.adminUid,
      At: agent.university,
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(serverDb, 'notes'), notePayload);

    // Render Student-view Preview Image
    const previewImageBase64 = await renderNotePreviewImage({
      title: notePayload.title,
      courseCode: courseData.code || 'COURSE',
      university: agent.university.toUpperCase(),
      content: plxContent
    });

    return {
      success: true,
      noteId: docRef.id,
      title: notePayload.title,
      courseId: notePayload.courseId,
      university: agent.university,
      status: 'published',
      previewImageBase64,
      previewMimeType: 'image/png',
      message: 'Note created and published successfully in official PLX format. Crosscheck the returned preview image for LaTeX accuracy.'
    };
  },

  // 6. Update Note with Embedded Visual Preview
  async updateNote(agent: AgentContext, params: {
    noteId: string;
    title?: string;
    content?: string;
  }) {
    if (!params.noteId) throw new Error("noteId is required");
    const noteRef = doc(serverDb, 'notes', params.noteId);
    const noteSnap = await getDoc(noteRef);
    if (!noteSnap.exists()) {
      throw new Error(`Note with ID ${params.noteId} not found`);
    }
    const existing = noteSnap.data();
    assertUniversityAccess(agent, existing.At || 'futo');

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (params.title) {
      updates.title = params.title.trim();
    }
    if (params.content !== undefined) {
      const cleanedInput = cleanNoteContentForLecture(params.content);
      const noteCorr = autoCorrectNoteContent(cleanedInput);
      const rawCorrected = typeof noteCorr === 'object' && noteCorr.content ? noteCorr.content : String(cleanedInput);
      updates.content = ensurePlxFormat(rawCorrected, updates.title || existing.title);
    }

    await updateDoc(noteRef, updates);

    const finalTitle = updates.title || existing.title;
    const finalContent = updates.content !== undefined ? updates.content : existing.content;

    // Fetch course code for banner
    let courseCode = 'COURSE';
    if (existing.courseId) {
      const cSnap = await getDoc(doc(serverDb, 'courses', existing.courseId));
      if (cSnap.exists()) {
        courseCode = cSnap.data().code || 'COURSE';
      }
    }

    const previewImageBase64 = await renderNotePreviewImage({
      title: finalTitle,
      courseCode,
      university: agent.university.toUpperCase(),
      content: finalContent
    });

    return {
      success: true,
      noteId: params.noteId,
      title: finalTitle,
      previewImageBase64,
      previewMimeType: 'image/png',
      message: 'Note updated. Crosscheck the embedded previewImageBase64 to verify visual layout and LaTeX equations.'
    };
  },

  // 7. Preview Note Image Only
  async previewNote(agent: AgentContext, params: { noteId: string }) {
    if (!params.noteId) throw new Error("noteId is required");
    const noteSnap = await getDoc(doc(serverDb, 'notes', params.noteId));
    if (!noteSnap.exists()) {
      throw new Error(`Note with ID ${params.noteId} not found`);
    }
    const noteData = noteSnap.data();
    assertUniversityAccess(agent, noteData.At || 'futo');

    let courseCode = 'COURSE';
    if (noteData.courseId) {
      const cSnap = await getDoc(doc(serverDb, 'courses', noteData.courseId));
      if (cSnap.exists()) {
        courseCode = cSnap.data().code || 'COURSE';
      }
    }

    const previewImageBase64 = await renderNotePreviewImage({
      title: noteData.title,
      courseCode,
      university: agent.university.toUpperCase(),
      content: noteData.content || ''
    });

    return {
      noteId: params.noteId,
      title: noteData.title,
      previewImageBase64,
      previewMimeType: 'image/png'
    };
  },

  // 8. Search Notes across the university by topic, keyword, or course code
  async searchNotes(agent: AgentContext, params: {
    query: string;
    level?: string;
    semester?: string;
    courseCode?: string;
    courseId?: string;
    limit?: number;
  }) {
    if (!params.query && !params.courseCode && !params.level) {
      throw new Error("At least one search filter (query, courseCode, or level) must be provided");
    }

    const isSuperAdmin = agent.level === '5' || agent.adminEmail.toLowerCase() === 'successugochukwuchi@gmail.com';
    const targetUni = agent.university;

    // Fetch university courses
    const coursesRef = collection(serverDb, 'courses');
    const coursesSnap = await getDocs(coursesRef);
    let courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (!isSuperAdmin) {
      courses = courses.filter(c => (c.At || 'futo').toLowerCase().trim() === targetUni);
    }

    const courseMap = new Map<string, any>();
    for (const c of courses) {
      courseMap.set(c.id, c);
    }

    // Fetch notes
    const notesRef = collection(serverDb, 'notes');
    const notesSnap = await getDocs(notesRef);

    const rawQuery = (params.query || '').trim().toLowerCase();
    const queryTerms = rawQuery.split(/\s+/).filter(t => t.length > 1);
    const normCourseFilter = params.courseCode ? params.courseCode.replace(/[\s\-_]+/g, '').toLowerCase() : null;

    const matches: Array<{
      noteId: string;
      title: string;
      courseCode: string;
      courseTitle: string;
      courseId: string;
      level: string;
      semester: string;
      university: string;
      snippet: string;
      relevanceScore: number;
      contentLength: number;
      updatedAt?: string;
    }> = [];

    for (const d of notesSnap.docs) {
      const n = d.data() as any;
      const course = n.courseId ? courseMap.get(n.courseId) : null;

      // University boundary check
      const noteUni = (n.At || (course ? course.At : 'futo') || 'futo').toLowerCase().trim();
      if (!isSuperAdmin && noteUni !== targetUni) {
        continue;
      }

      // If note has courseId, ensure course belongs to this university
      if (n.courseId && !isSuperAdmin && !courseMap.has(n.courseId)) {
        continue;
      }

      // Filter by courseId
      if (params.courseId && n.courseId !== params.courseId) {
        continue;
      }

      // Filter by level
      const courseLevel = course ? String(course.level || '') : String(n.level || '');
      if (params.level && courseLevel && !courseLevel.includes(String(params.level))) {
        continue;
      }

      // Filter by semester
      const courseSemester = course ? String(course.semester || '') : String(n.semester || '');
      if (params.semester && courseSemester && courseSemester !== params.semester) {
        continue;
      }

      // Filter by courseCode
      const courseCodeClean = course ? (course.code || '').replace(/[\s\-_]+/g, '').toLowerCase() : '';
      if (normCourseFilter && !courseCodeClean.includes(normCourseFilter)) {
        continue;
      }

      // Relevance Scoring with safe string handling
      const titleStr = typeof n.title === 'string' ? n.title : String(n.title || '');
      const contentStr = typeof n.content === 'string' ? n.content : (n.content ? JSON.stringify(n.content) : '');
      const titleLower = titleStr.toLowerCase();
      const contentLower = contentStr.toLowerCase();
      const courseCodeLower = course ? String(course.code || '').toLowerCase() : '';
      const courseTitleLower = course ? String(course.title || '').toLowerCase() : '';

      let score = 0;

      if (rawQuery) {
        // Exact match in note title
        if (titleLower.includes(rawQuery)) {
          score += 150;
        }
        // Course code match (e.g. MTH 101 or MTH101)
        if (courseCodeLower.replace(/[\s\-_]+/g, '').includes(rawQuery.replace(/[\s\-_]+/g, ''))) {
          score += 100;
        }
        // Course title match
        if (courseTitleLower.includes(rawQuery)) {
          score += 60;
        }
        // Exact phrase in content
        if (contentLower.includes(rawQuery)) {
          score += 50;
        }

        // Individual term matches
        for (const term of queryTerms) {
          if (titleLower.includes(term)) score += 35;
          if (courseCodeLower.includes(term)) score += 25;
          if (courseTitleLower.includes(term)) score += 15;
          if (contentLower.includes(term)) score += 10;
        }

        if (score === 0) continue;
      } else {
        score = 10;
      }

      // Extract surrounding snippet
      let snippet = '';
      if (contentStr) {
        let matchIdx = -1;
        if (rawQuery) {
          matchIdx = contentLower.indexOf(rawQuery);
          if (matchIdx === -1) {
            for (const term of queryTerms) {
              const idx = contentLower.indexOf(term);
              if (idx !== -1) {
                matchIdx = idx;
                break;
              }
            }
          }
        }

        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 60);
          const end = Math.min(contentStr.length, matchIdx + 140);
          const rawExcerpt = contentStr.substring(start, end).replace(/\s+/g, ' ').trim();
          snippet = (start > 0 ? '...' : '') + rawExcerpt + (end < contentStr.length ? '...' : '');
        } else {
          snippet = contentStr.substring(0, 160).replace(/\s+/g, ' ').trim() + (contentStr.length > 160 ? '...' : '');
        }
      }

      matches.push({
        noteId: d.id,
        title: titleStr || 'Untitled Note',
        courseCode: course ? course.code : (n.courseCode || 'UNKNOWN'),
        courseTitle: course ? course.title : '',
        courseId: n.courseId || '',
        level: courseLevel || 'N/A',
        semester: courseSemester || 'N/A',
        university: noteUni.toUpperCase(),
        snippet,
        relevanceScore: score,
        contentLength: contentStr.length,
        updatedAt: n.updatedAt || n.createdAt || ''
      });
    }

    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const limit = params.limit || 15;
    const finalResults = matches.slice(0, limit);

    return {
      success: true,
      query: params.query || '',
      university: targetUni.toUpperCase(),
      totalMatches: matches.length,
      returnedCount: finalResults.length,
      results: finalResults
    };
  },

  // 8. Create Question Sheet
  async createQuestionSheet(agent: AgentContext, params: {
    courseId: string;
    semester: '1st' | '2nd';
    academicLevel: string;
    year: string;
  }) {
    if (!params.courseId || !params.semester || !params.academicLevel || !params.year) {
      throw new Error("Missing required fields: courseId, semester, academicLevel, year");
    }

    const courseSnap = await getDoc(doc(serverDb, 'courses', params.courseId));
    if (!courseSnap.exists()) {
      throw new Error(`Course with ID ${params.courseId} not found`);
    }
    const courseData = courseSnap.data();
    assertUniversityAccess(agent, courseData.At || 'futo');

    const sheetData = {
      courseId: params.courseId,
      semester: params.semester,
      academicLevel: String(params.academicLevel),
      year: String(params.year).trim(),
      isAvailable: true,
      authorId: agent.adminUid,
      At: agent.university,
      questions: [] as any[],
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(serverDb, 'questionSheets'), sheetData);
    return {
      success: true,
      sheetId: docRef.id,
      ...sheetData
    };
  },

  // 9. List Question Sheets
  async listQuestionSheets(agent: AgentContext, params: { courseId: string }) {
    if (!params.courseId) throw new Error("courseId is required");
    const courseSnap = await getDoc(doc(serverDb, 'courses', params.courseId));
    if (!courseSnap.exists()) {
      throw new Error(`Course with ID ${params.courseId} not found`);
    }
    const courseData = courseSnap.data();
    assertUniversityAccess(agent, courseData.At || 'futo');

    const snap1 = await getDocs(query(collection(serverDb, 'questionSheets'), where('courseId', '==', params.courseId)));
    const snap2 = await getDocs(query(collection(serverDb, 'question_sheets'), where('courseId', '==', params.courseId)));

    const seenIds = new Set<string>();
    const results: any[] = [];

    for (const d of [...snap1.docs, ...snap2.docs]) {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        const data = d.data();
        results.push({
          id: d.id,
          courseId: data.courseId,
          semester: data.semester,
          academicLevel: data.academicLevel,
          year: data.year,
          isAvailable: data.isAvailable,
          totalQuestions: Array.isArray(data.questions) ? data.questions.length : 0,
          createdAt: data.createdAt
        });
      }
    }

    return results;
  },

  // 10. Get Question Sheet with Questions
  async getQuestionSheet(agent: AgentContext, params: { sheetId: string }) {
    if (!params.sheetId) throw new Error("sheetId is required");
    let sheetSnap = await getDoc(doc(serverDb, 'questionSheets', params.sheetId));
    if (!sheetSnap.exists()) {
      sheetSnap = await getDoc(doc(serverDb, 'question_sheets', params.sheetId));
    }
    if (!sheetSnap.exists()) {
      throw new Error(`Question sheet with ID ${params.sheetId} not found`);
    }
    const sheetData = sheetSnap.data();
    assertUniversityAccess(agent, sheetData.At || 'futo');

    let questions = Array.isArray(sheetData.questions) ? [...sheetData.questions] : [];

    // Also check questions collection if embedded array is empty
    if (questions.length === 0) {
      const qRef = collection(serverDb, 'questions');
      const qQuery = query(qRef, where('sheetId', '==', params.sheetId));
      const qSnap = await getDocs(qQuery);
      questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    }

    questions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    return {
      id: sheetSnap.id,
      sheet: sheetData,
      totalQuestions: questions.length,
      questions
    };
  },

  // 11. Upload Questions to Sheet (Batch)
  async uploadQuestions(agent: AgentContext, params: {
    sheetId: string;
    questions: Array<{
      text: string;
      correctAnswer: string;
      incorrectAnswers: string[];
      explanation?: string;
      order?: number;
    }>;
  }) {
    if (!params.sheetId || !Array.isArray(params.questions) || params.questions.length === 0) {
      throw new Error("sheetId and a non-empty questions array are required");
    }

    let isCamelCase = true;
    let sheetSnap = await getDoc(doc(serverDb, 'questionSheets', params.sheetId));
    if (!sheetSnap.exists()) {
      sheetSnap = await getDoc(doc(serverDb, 'question_sheets', params.sheetId));
      isCamelCase = false;
    }
    if (!sheetSnap.exists()) {
      throw new Error(`Question sheet ${params.sheetId} not found`);
    }
    const sheetData = sheetSnap.data();
    assertUniversityAccess(agent, sheetData.At || 'futo');

    const existingQuestions = Array.isArray(sheetData.questions) ? [...sheetData.questions] : [];
    let currentOrder = existingQuestions.length;

    const uploadedIds: string[] = [];
    const newItems: any[] = [];

    for (let qData of params.questions) {
      if (!qData.text || !qData.correctAnswer || !Array.isArray(qData.incorrectAnswers)) {
        continue;
      }

      currentOrder += 1;
      const qId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const qResult = autoCorrectQuestionData({
        text: stripUnderlineTags(qData.text),
        correctAnswer: stripUnderlineTags(qData.correctAnswer),
        incorrectAnswers: qData.incorrectAnswers.map(stripUnderlineTags),
        explanation: stripUnderlineTags(qData.explanation || '')
      });
      const corrected = qResult.data || qData;

      const payload = {
        id: qId,
        sheetId: params.sheetId,
        courseId: sheetData.courseId,
        text: stripUnderlineTags(corrected.text),
        correctAnswer: stripUnderlineTags(corrected.correctAnswer),
        incorrectAnswers: (corrected.incorrectAnswers || []).map(stripUnderlineTags),
        explanation: stripUnderlineTags(corrected.explanation || ''),
        order: qData.order !== undefined ? Number(qData.order) : currentOrder,
        authorId: agent.adminUid,
        createdAt: new Date().toISOString()
      };

      // 1. Dual-write to questions collection
      await setDoc(doc(serverDb, 'questions', qId), payload);
      newItems.push(payload);
      uploadedIds.push(qId);
    }

    // 2. Save directly to questionSheets document
    const updatedEmbeddedList = [...existingQuestions, ...newItems];
    const targetColl = isCamelCase ? 'questionSheets' : 'question_sheets';
    await updateDoc(doc(serverDb, targetColl, params.sheetId), {
      questions: updatedEmbeddedList
    });

    return {
      success: true,
      uploadedCount: uploadedIds.length,
      totalQuestionsInSheet: updatedEmbeddedList.length,
      uploadedIds,
      message: `Successfully uploaded ${uploadedIds.length} questions to ${targetColl}. Call preview_question_sheet to visually inspect questions in 20-question grid snapshots.`
    };
  },

  // 12. Update Specific Question
  async updateQuestion(agent: AgentContext, params: {
    questionId: string;
    text?: string;
    correctAnswer?: string;
    incorrectAnswers?: string[];
    explanation?: string;
    order?: number;
  }) {
    if (!params.questionId) throw new Error("questionId is required");
    const qRef = doc(serverDb, 'questions', params.questionId);
    const qSnap = await getDoc(qRef);
    if (!qSnap.exists()) {
      throw new Error(`Question with ID ${params.questionId} not found`);
    }
    const existing = qSnap.data();

    // Verify parent sheet university
    if (existing.sheetId) {
      let sheetSnap = await getDoc(doc(serverDb, 'questionSheets', existing.sheetId));
      if (!sheetSnap.exists()) {
        sheetSnap = await getDoc(doc(serverDb, 'question_sheets', existing.sheetId));
      }
      if (sheetSnap.exists()) {
        assertUniversityAccess(agent, sheetSnap.data().At || 'futo');

        // Also update embedded questions array on the sheet if present
        const sData = sheetSnap.data();
        if (Array.isArray(sData.questions)) {
          const updatedArr = sData.questions.map((q: any) => {
            if (q.id === params.questionId || q.text === existing.text) {
              return {
                ...q,
                text: stripUnderlineTags(params.text !== undefined ? params.text : q.text),
                correctAnswer: stripUnderlineTags(params.correctAnswer !== undefined ? params.correctAnswer : q.correctAnswer),
                incorrectAnswers: (params.incorrectAnswers !== undefined ? params.incorrectAnswers : q.incorrectAnswers || []).map(stripUnderlineTags),
                explanation: stripUnderlineTags(params.explanation !== undefined ? params.explanation : q.explanation),
                order: params.order !== undefined ? Number(params.order) : q.order
              };
            }
            return q;
          });
          const targetColl = sheetSnap.ref.parent.id;
          await updateDoc(doc(serverDb, targetColl, existing.sheetId), {
            questions: updatedArr
          });
        }
      }
    }

    const qResult = autoCorrectQuestionData({
      text: stripUnderlineTags(params.text !== undefined ? params.text : existing.text),
      correctAnswer: stripUnderlineTags(params.correctAnswer !== undefined ? params.correctAnswer : existing.correctAnswer),
      incorrectAnswers: (params.incorrectAnswers !== undefined ? params.incorrectAnswers : existing.incorrectAnswers || []).map(stripUnderlineTags),
      explanation: stripUnderlineTags(params.explanation !== undefined ? params.explanation : existing.explanation)
    });
    const corrected = qResult.data || existing;

    const updates: Record<string, any> = {
      text: stripUnderlineTags(corrected.text),
      correctAnswer: stripUnderlineTags(corrected.correctAnswer),
      incorrectAnswers: (corrected.incorrectAnswers || []).map(stripUnderlineTags),
      explanation: stripUnderlineTags(corrected.explanation || ''),
      updatedAt: new Date().toISOString()
    };

    if (params.order !== undefined) {
      updates.order = Number(params.order);
    }

    await updateDoc(qRef, updates);

    return {
      success: true,
      questionId: params.questionId,
      sheetId: existing.sheetId,
      updatedFields: updates
    };
  },

  // 13. Preview Question Sheet in Batches of 20 (Grid Style Photo)
  async previewQuestionSheet(agent: AgentContext, params: { sheetId: string; batchIndex?: number }) {
    if (!params.sheetId) throw new Error("sheetId is required");
    let sheetSnap = await getDoc(doc(serverDb, 'questionSheets', params.sheetId));
    if (!sheetSnap.exists()) {
      sheetSnap = await getDoc(doc(serverDb, 'question_sheets', params.sheetId));
    }
    if (!sheetSnap.exists()) {
      throw new Error(`Question sheet ${params.sheetId} not found`);
    }
    const sheetData = sheetSnap.data();
    assertUniversityAccess(agent, sheetData.At || 'futo');

    // Fetch Course details
    let courseCode = 'COURSE';
    if (sheetData.courseId) {
      const cSnap = await getDoc(doc(serverDb, 'courses', sheetData.courseId));
      if (cSnap.exists()) {
        courseCode = cSnap.data().code || 'COURSE';
      }
    }

    // Try embedded questions first, otherwise query collection
    let allQuestions = Array.isArray(sheetData.questions) && sheetData.questions.length > 0
      ? [...sheetData.questions]
      : [];

    if (allQuestions.length === 0) {
      const qRef = collection(serverDb, 'questions');
      const qQuery = query(qRef, where('sheetId', '==', params.sheetId));
      const snap = await getDocs(qQuery);
      allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    }
    allQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    const batchIndex = Math.max(0, Number(params.batchIndex) || 0);
    const startIndex = batchIndex * 20;
    const batchQuestions = allQuestions.slice(startIndex, startIndex + 20);

    if (batchQuestions.length === 0 && allQuestions.length > 0) {
      throw new Error(`Batch index ${batchIndex} is out of range. Sheet contains ${allQuestions.length} questions (${Math.ceil(allQuestions.length / 20)} batches total: 0 to ${Math.ceil(allQuestions.length / 20) - 1}).`);
    }

    const previewImageBase64 = await renderQuestionGridImage({
      sheetTitle: `${courseCode} CBT / Past Questions`,
      courseCode,
      semester: sheetData.semester || '1st',
      year: sheetData.year || 'Academic Year',
      batchIndex,
      totalQuestions: allQuestions.length,
      questions: batchQuestions
    });

    return {
      sheetId: params.sheetId,
      courseCode,
      batchIndex,
      totalBatches: Math.max(1, Math.ceil(allQuestions.length / 20)),
      batchQuestionsCount: batchQuestions.length,
      totalQuestions: allQuestions.length,
      startQuestionNumber: startIndex + 1,
      endQuestionNumber: startIndex + batchQuestions.length,
      previewImageBase64,
      previewMimeType: 'image/png',
      message: `Visual grid inspection snapshot generated for questions ${startIndex + 1} to ${startIndex + batchQuestions.length}. Inspect the previewImageBase64 to check questions, answer options (marked with ✓), and explanations.`
    };
  }
};
