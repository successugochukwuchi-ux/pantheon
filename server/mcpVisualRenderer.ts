import sharp from 'sharp';
import katex from 'katex';
import fs from 'fs';
import path from 'path';
import { decodeHtmlEntities } from '../src/lib/latexAutoCorrect.js';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Load KaTeX CSS for embedded SVG rendering
let cachedKatexCss = '';
function getKatexCss(): string {
  if (cachedKatexCss) return cachedKatexCss;
  try {
    const cssPath = path.join(process.cwd(), 'node_modules', 'katex', 'dist', 'katex.min.css');
    if (fs.existsSync(cssPath)) {
      cachedKatexCss = fs.readFileSync(cssPath, 'utf8');
    }
  } catch (err) {
    console.warn('[MCP Renderer] Could not load local katex.min.css:', err);
  }
  return cachedKatexCss;
}

/**
 * Renders LaTeX math via KaTeX into HTML spans.
 * If LaTeX contains invalid commands or syntax errors, KaTeX outputs a red error span.
 */
function renderMathToHtml(math: string, displayMode: boolean = false): string {
  if (!math) return '';
  try {
    return katex.renderToString(math.trim(), {
      displayMode,
      throwOnError: false,
      errorColor: '#f87171',
      strict: false,
      trust: true
    });
  } catch (err: any) {
    return `<span class="katex-error" style="color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); padding: 2px 6px; border-radius: 4px; font-family: monospace;">${escapeXml(math)}</span>`;
  }
}

/**
 * Escapes ampersands and converts inline math ($...$) and PLX text tags (<B>, <I>, <U>) into HTML
 */
function processInlineMathAndTags(text: string): string {
  if (!text) return '';
  let html = text;

  // Escape bare ampersands that aren't XML entities
  html = html.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/gi, '&amp;');

  // Process PLX text tags
  html = html.replace(/<B>([\s\S]*?)<\/B>/gi, '<strong>$1</strong>');
  html = html.replace(/<I>([\s\S]*?)<\/I>/gi, '<em>$1</em>');
  html = html.replace(/<U>([\s\S]*?)<\/U>/gi, '<u>$1</u>');

  // Process Markdown bold/italic
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');

  // Process inline LaTeX math $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    return renderMathToHtml(math, false);
  });

  return html;
}

export interface NoteRenderOptions {
  title: string;
  courseCode?: string;
  university?: string;
  content: string;
}

/**
 * Generates a high-fidelity image representing the exact website student reading view of a lecture note.
 * Parses PLX tags (<PLX>, <H1>, <H2>, <TEXT>, <MATH>, <TABLE>, <LIST>, <ORDERED>, <QUES>) and renders KaTeX math.
 * Any LaTeX syntax errors are rendered in bright RED, matching the web student reading view.
 */
export async function renderNotePreviewImage(options: NoteRenderOptions): Promise<string> {
  const { title, courseCode = 'COURSE', university = 'COLEARN ACADEMIC', content } = options;
  
  const width = 1000;
  const katexCss = getKatexCss();

  let str = content ? content.trim() : '';
  const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(str);
  if (plxMatch) str = plxMatch[1].trim();

  const blocksHtml: string[] = [];
  let blockCount = 0;

  // If content contains explicit PLX tags
  if (str.includes('<H1>') || str.includes('<H2>') || str.includes('<MATH>') || str.includes('<TABLE>') || str.includes('<TEXT>') || str.includes('<QUES>')) {
    const tagRegex = /<(H1|H2|TEXT|MATH|TABLE|LIST|ORDERED|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = tagRegex.exec(str)) !== null) {
      blockCount++;
      const tagName = match[1].toUpperCase();
      const attr = match[2] || '';
      const body = match[3].trim();

      if (tagName === 'H1') {
        blocksHtml.push(`<h1 style="font-size: 22px; font-weight: 800; color: #38bdf8; margin: 22px 0 10px 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">${processInlineMathAndTags(body)}</h1>`);
      } else if (tagName === 'H2') {
        blocksHtml.push(`<h2 style="font-size: 17px; font-weight: 700; color: #818cf8; margin: 18px 0 8px 0;">${processInlineMathAndTags(body)}</h2>`);
      } else if (tagName === 'TEXT') {
        const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
        const isPipeTable = lines.length >= 2 && lines.filter(l => l.includes('|')).length >= lines.length - 1;

        if (isPipeTable) {
          const rawRows = lines.filter(r => !(/^[\s|:-]+$/.test(r) && r.includes('-')));
          let tableRowsHtml = '';
          rawRows.forEach((r, rowIdx) => {
            let cells = r.includes('|') ? r.split('|').map(c => c.trim()) : r.split(',').map(c => c.trim());
            if (cells.length > 1 && cells[0] === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
            
            const isHeader = rowIdx === 0;
            const cellTag = isHeader ? 'th' : 'td';
            const bg = isHeader ? '#1e293b' : (rowIdx % 2 === 1 ? '#0f172a' : '#141d2e');
            const color = isHeader ? '#38bdf8' : '#e2e8f0';
            const weight = isHeader ? '700' : '400';

            const cellsHtml = cells.map(c => `<${cellTag} style="padding: 10px 14px; border: 1px solid #334155; background: ${bg}; color: ${color}; font-weight: ${weight}; font-size: 13px; text-align: left;">${processInlineMathAndTags(c)}</${cellTag}>`).join('');
            tableRowsHtml += `<tr>${cellsHtml}</tr>`;
          });
          blocksHtml.push(`<table style="width: 100%; border-collapse: collapse; margin: 14px 0; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">${tableRowsHtml}</table>`);
        } else {
          blocksHtml.push(`<p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 8px 0;">${processInlineMathAndTags(body)}</p>`);
        }
      } else if (tagName === 'MATH') {
        const renderedMath = renderMathToHtml(body, true);
        blocksHtml.push(`<div style="background: #090d16; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; margin: 12px 0; text-align: center; overflow-x: auto;">${renderedMath}</div>`);
      } else if (tagName === 'TABLE') {
        const rawRows = body.split('\n')
          .map(r => r.trim())
          .filter(r => r.length > 0)
          .filter(r => !(/^[\s|:-]+$/.test(r) && r.includes('-')));

        let tableRowsHtml = '';
        rawRows.forEach((r, rowIdx) => {
          let cells = r.includes('|') ? r.split('|').map(c => c.trim()) : r.split(',').map(c => c.trim());
          if (cells.length > 1 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();

          const isHeader = rowIdx === 0;
          const cellTag = isHeader ? 'th' : 'td';
          const bg = isHeader ? '#1e293b' : (rowIdx % 2 === 1 ? '#0f172a' : '#141d2e');
          const color = isHeader ? '#38bdf8' : '#e2e8f0';
          const weight = isHeader ? '700' : '400';

          const cellsHtml = cells.map(c => `<${cellTag} style="padding: 10px 14px; border: 1px solid #334155; background: ${bg}; color: ${color}; font-weight: ${weight}; font-size: 13px; text-align: left;">${processInlineMathAndTags(c)}</${cellTag}>`).join('');
          tableRowsHtml += `<tr>${cellsHtml}</tr>`;
        });
        blocksHtml.push(`<table style="width: 100%; border-collapse: collapse; margin: 14px 0; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">${tableRowsHtml}</table>`);
      } else if (tagName === 'LIST' || tagName === 'ORDERED') {
        const isOrdered = tagName === 'ORDERED';
        const listTag = isOrdered ? 'ol' : 'ul';
        const items = body.split('\n').map(i => i.trim()).filter(i => i.length > 0);
        const itemsHtml = items.map(i => `<li style="margin-bottom: 6px; font-size: 14px; color: #cbd5e1;">${processInlineMathAndTags(i.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''))}</li>`).join('');
        blocksHtml.push(`<${listTag} style="padding-left: 24px; margin: 10px 0;">${itemsHtml}</${listTag}>`);
      } else if (tagName === 'QUES') {
        const corMatch = /<COR>([\s\S]*?)<\/COR>/i.exec(body);
        const incMatches = [...body.matchAll(/<INC>([\s\S]*?)<\/INC>/gi)].map(m => m[1]);
        const expMatch = /<EXP>([\s\S]*?)<\/EXP>/i.exec(body);
        
        const firstSub = body.search(/<(COR|INC|EXP)/i);
        const qPrompt = firstSub !== -1 ? body.substring(0, firstSub).trim() : body;

        let optionsHtml = '';
        if (corMatch) {
          optionsHtml += `<div style="display: flex; align-items: center; gap: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; color: #34d399; font-size: 13px; font-weight: 600;"><span style="background: #059669; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">A ✓</span> ${processInlineMathAndTags(corMatch[1].trim())}</div>`;
        }
        incMatches.forEach((inc, i) => {
          const letter = String.fromCharCode(66 + i);
          optionsHtml += `<div style="display: flex; align-items: center; gap: 10px; background: #0f172a; border: 1px solid #1e293b; padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; color: #94a3b8; font-size: 13px;"><span style="background: #334155; color: #f8fafc; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${letter}</span> ${processInlineMathAndTags(inc.trim())}</div>`;
        });

        let expHtml = '';
        if (expMatch) {
          expHtml = `<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.25); padding: 12px 14px; border-radius: 8px; margin-top: 10px; font-size: 12px; color: #fef08a;"><strong style="color: #eab308; display: block; margin-bottom: 4px;">EXPLANATION:</strong> ${processInlineMathAndTags(expMatch[1].trim())}</div>`;
        }

        blocksHtml.push(`
          <div style="background: #0f172a; border: 1px solid #2563eb; border-radius: 10px; padding: 16px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px;">Question ${attr ? `#${attr}` : ''}</div>
            <div style="font-size: 15px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">${processInlineMathAndTags(qPrompt)}</div>
            ${optionsHtml}
            ${expHtml}
          </div>
        `);
      }
    }
  }

  // Fallback if raw Markdown without PLX tags was provided
  if (blocksHtml.length === 0) {
    const lines = str.split('\n');
    let inMath = false;
    let mathBuf: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('$$')) {
        if (inMath) {
          mathBuf.push(trimmed.replace(/\$\$/g, ''));
          blocksHtml.push(`<div style="background: #090d16; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; margin: 12px 0; text-align: center;">${renderMathToHtml(mathBuf.join(' '), true)}</div>`);
          mathBuf = [];
          inMath = false;
        } else {
          inMath = true;
          const rem = trimmed.replace(/^\$\$/, '');
          if (rem.endsWith('$$') && rem.length > 2) {
            blocksHtml.push(`<div style="background: #090d16; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; margin: 12px 0; text-align: center;">${renderMathToHtml(rem.replace(/\$\$$/, ''), true)}</div>`);
            inMath = false;
          } else if (rem) {
            mathBuf.push(rem);
          }
        }
        continue;
      }
      if (inMath) {
        mathBuf.push(trimmed);
        continue;
      }

      if (!trimmed) continue;
      blockCount++;

      if (trimmed.startsWith('# ')) {
        blocksHtml.push(`<h1 style="font-size: 22px; font-weight: 800; color: #38bdf8; margin: 22px 0 10px 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">${processInlineMathAndTags(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith('## ')) {
        blocksHtml.push(`<h2 style="font-size: 17px; font-weight: 700; color: #818cf8; margin: 18px 0 8px 0;">${processInlineMathAndTags(trimmed.slice(3))}</h2>`);
      } else {
        blocksHtml.push(`<p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 8px 0;">${processInlineMathAndTags(trimmed)}</p>`);
      }
    }
  }

  // Calculate dynamic container height based on rendered blocks
  const contentHeight = Math.max(600, Math.min(3500, 200 + blocksHtml.length * 85));

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${contentHeight}" viewBox="0 0 ${width} ${contentHeight}">
    <foreignObject x="0" y="0" width="${width}" height="${contentHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 28px; width: 100%; height: 100%; box-sizing: border-box;">
        <style>
          /*<![CDATA[*/
          ${katexCss}
          .katex-error { color: #f87171 !important; background: rgba(239, 68, 68, 0.15) !important; padding: 2px 6px !important; border-radius: 4px !important; border: 1px solid rgba(239, 68, 68, 0.4) !important; font-family: monospace !important; }
          /*]]>*/
        </style>
        <div style="background: #141d2e; border: 1px solid #243044; border-radius: 14px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #243044; padding-bottom: 14px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #2563eb; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px;">${escapeXml(courseCode.toUpperCase())}</span>
              <span style="font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 0.5px;">${escapeXml(university.toUpperCase())} · STUDENT READING VIEW</span>
            </div>
            <span style="font-size: 11px; font-family: monospace; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.2);">PLX FORMAT VERIFIED</span>
          </div>
          <h1 style="font-size: 26px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0;">${processInlineMathAndTags(title)}</h1>
          ${blocksHtml.join('')}
        </div>
      </div>
    </foreignObject>
  </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

export interface QuestionItem {
  id?: string;
  order?: number;
  text: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  explanation?: string;
}

export interface QuestionGridOptions {
  sheetTitle: string;
  courseCode: string;
  semester: string;
  year: string;
  batchIndex: number;
  totalQuestions: number;
  questions: QuestionItem[];
}

/**
 * Generates a 20-question grid-style photo preview matching the website student CBT view.
 * Shows Question Prompts with KaTeX math, Option pills with green correct badge, and Yellow Explanation callout boxes.
 * Invalid LaTeX syntax errors are rendered in bright RED box/text.
 */
export async function renderQuestionGridImage(options: QuestionGridOptions): Promise<string> {
  const { sheetTitle, courseCode, semester, year, batchIndex, totalQuestions, questions } = options;

  const width = 1200;
  const katexCss = getKatexCss();

  const totalBatches = Math.max(1, Math.ceil(totalQuestions / 20));
  const currentBatchNum = batchIndex + 1;
  const startQNum = batchIndex * 20 + 1;
  const endQNum = Math.min(totalQuestions, batchIndex * 20 + questions.length);

  const questionCardsHtml = questions.slice(0, 20).map((q, idx) => {
    const qNum = batchIndex * 20 + idx + 1;

    const allOptions = [
      { letter: 'A', text: q.correctAnswer, isCorrect: true },
      ...(q.incorrectAnswers || []).map((ans, i) => ({
        letter: String.fromCharCode(66 + i),
        text: ans,
        isCorrect: false
      }))
    ];

    let optionsHtml = '';
    for (const opt of allOptions.slice(0, 4)) {
      const isCorrect = opt.isCorrect;
      const bg = isCorrect ? 'rgba(16, 185, 129, 0.1)' : '#0f172a';
      const border = isCorrect ? 'rgba(16, 185, 129, 0.3)' : '#1e293b';
      const textColor = isCorrect ? '#34d399' : '#cbd5e1';
      const badgeBg = isCorrect ? '#059669' : '#334155';
      const badgeText = isCorrect ? `${opt.letter} ✓` : opt.letter;

      optionsHtml += `
        <div style="display: flex; align-items: center; gap: 10px; background: ${bg}; border: 1px solid ${border}; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; color: ${textColor}; font-size: 12px;">
          <span style="background: ${badgeBg}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; shrink: 0;">${badgeText}</span>
          <span>${processInlineMathAndTags(opt.text)}</span>
        </div>
      `;
    }

    let expHtml = '';
    if (q.explanation) {
      expHtml = `
        <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.25); padding: 10px 12px; border-radius: 6px; margin-top: 8px; font-size: 11px; color: #fef08a;">
          <strong style="color: #eab308; display: block; margin-bottom: 2px;">EXPLANATION:</strong>
          ${processInlineMathAndTags(q.explanation)}
        </div>
      `;
    }

    return `
      <div style="background: #141d2e; border: 1px solid #243044; border-radius: 10px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: #0f172a; border: 1px solid #38bdf8; color: #38bdf8; font-family: monospace; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">Q${qNum}</span>
        </div>
        <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 10px; line-height: 1.4;">${processInlineMathAndTags(q.text)}</div>
        ${optionsHtml}
        ${expHtml}
      </div>
    `;
  }).join('');

  const gridRows = Math.ceil(Math.min(20, questions.length) / 2);
  const totalHeight = Math.max(700, 180 + gridRows * 260);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
    <foreignObject x="0" y="0" width="${width}" height="${totalHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 24px; width: 100%; height: 100%; box-sizing: border-box;">
        <style>
          /*<![CDATA[*/
          ${katexCss}
          .katex-error { color: #f87171 !important; background: rgba(239, 68, 68, 0.15) !important; padding: 2px 6px !important; border-radius: 4px !important; border: 1px solid rgba(239, 68, 68, 0.4) !important; font-family: monospace !important; }
          /*]]>*/
        </style>
        
        <!-- Header Banner -->
        <div style="background: #141d2e; border: 1px solid #243044; border-radius: 12px; padding: 18px 24px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="background: #2563eb; color: #ffffff; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px;">${escapeXml(courseCode.toUpperCase())}</span>
              <span style="font-size: 13px; font-weight: 600; color: #94a3b8;">${escapeXml(sheetTitle)} · ${escapeXml(semester)} Semester ${escapeXml(year)}</span>
            </div>
            <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0;">Question Sheet Visual Inspection (Batch ${currentBatchNum} of ${totalBatches})</h1>
          </div>
          <div style="background: #0f172a; border: 1px solid #10b981; padding: 8px 16px; border-radius: 8px; text-align: right;">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #34d399;">Questions ${startQNum} - ${endQNum} / ${totalQuestions}</span>
          </div>
        </div>

        <!-- 2 Column Question Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          ${questionCardsHtml}
        </div>
      </div>
    </foreignObject>
  </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
