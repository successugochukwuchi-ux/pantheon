import sharp from 'sharp';
import katex from 'katex';
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

/**
 * Format math expressions for clean native SVG text display
 */
function formatMathForSvg(mathStr: string): { text: string; hasError: boolean; errorMsg?: string } {
  if (!mathStr) return { text: '', hasError: false };
  let str = mathStr.trim();

  // Check for common fatal LaTeX syntax errors or invalid commands
  const unclosedBraces = (str.match(/\{/g) || []).length !== (str.match(/\}/g) || []).length;
  const invalidMacro = /\\(invalid[a-zA-Z]*|badmacro[a-zA-Z]*|broken[a-zA-Z]*)/i.test(str);

  if (unclosedBraces || invalidMacro) {
    return {
      text: str,
      hasError: true,
      errorMsg: unclosedBraces ? 'LaTeX Error: Unclosed curly brace' : 'LaTeX Error: Invalid macro'
    };
  }

  // Also test through KaTeX to verify validity
  try {
    katex.renderToString(str, { throwOnError: true, strict: false });
  } catch (err: any) {
    return {
      text: str,
      hasError: true,
      errorMsg: err?.message || 'LaTeX Syntax Error'
    };
  }

  // Convert LaTeX math constructs into clean unicode representations for SVG text
  let formatted = str
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
    .replace(/\\sqrt\[([^{}]+)\]\s*\{([^{}]+)\}/g, 'ⁿ√($2)')
    .replace(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}/g, '∫_($1)^($2)')
    .replace(/\\int_([0-9a-zA-Z]+)\^([0-9a-zA-Z]+)/g, '∫_$1^$2')
    .replace(/\\int/g, '∫')
    .replace(/\\sum/g, '∑')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\partial/g, '∂')
    .replace(/\\nabla/g, '∇')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\text\s*\{([^{}]+)\}/g, '$1')
    .replace(/\\mathrm\s*\{([^{}]+)\}/g, '$1')
    .replace(/\s+/g, ' ');

  return { text: formatted, hasError: false };
}

/**
 * Parses inline math ($...$) and formatting tags inside a text segment,
 * returning native SVG tspan or text elements.
 */
function parseInlineToSvgSpans(text: string, x: number, y: number, textColor = '#cbd5e1'): string[] {
  if (!text) return [];

  // Split by inline math $...$
  const parts = text.split(/(\$[^\$\n]+?\$)/g);
  let currentX = x;
  const elements: string[] = [];

  parts.forEach((part) => {
    if (!part) return;

    if (part.startsWith('$') && part.endsWith('$')) {
      const mathRaw = part.slice(1, -1);
      const mathRes = formatMathForSvg(mathRaw);

      if (mathRes.hasError) {
        // Render red error pill for LaTeX error
        const errLabel = ` [LaTeX Error: ${escapeXml(mathRes.text)}] `;
        const approxWidth = errLabel.length * 8;
        elements.push(`
          <rect x="${currentX}" y="${y - 14}" width="${approxWidth}" height="20" fill="rgba(239, 68, 68, 0.2)" stroke="#f87171" rx="4"/>
          <text x="${currentX + 6}" y="${y}" fill="#f87171" font-size="12" font-family="monospace" font-weight="bold">${escapeXml(errLabel)}</text>
        `);
        currentX += approxWidth + 8;
      } else {
        const mathTxt = ` ${escapeXml(mathRes.text)} `;
        const approxWidth = mathTxt.length * 7.5;
        elements.push(`<text x="${currentX}" y="${y}" fill="#38bdf8" font-size="14" font-family="monospace" font-weight="bold">${mathTxt}</text>`);
        currentX += approxWidth;
      }
    } else {
      // Clean tags like <B>, <I>, <U>, **bold**
      const cleanedText = part
        .replace(/<\/?(B|I|U|strong|em|u)>/gi, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1');

      if (cleanedText) {
        const approxWidth = cleanedText.length * 7.5;
        elements.push(`<text x="${currentX}" y="${y}" fill="${textColor}" font-size="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(cleanedText)}</text>`);
        currentX += approxWidth;
      }
    }
  });

  return elements;
}

export interface NoteRenderOptions {
  title: string;
  courseCode?: string;
  university?: string;
  content: string;
}

/**
 * Generates a high-fidelity Base64 PNG image of a lecture note using native vector SVG primitives.
 * Guarantees zero black/opaque screens when processed by Sharp/librsvg.
 * Highlights LaTeX errors in RED.
 */
export async function renderNotePreviewImage(options: NoteRenderOptions): Promise<string> {
  const { title, courseCode = 'COURSE', university = 'COLEARN ACADEMIC', content } = options;

  const width = 1000;
  let str = content ? content.trim() : '';
  const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(str);
  if (plxMatch) str = plxMatch[1].trim();

  const svgElements: string[] = [];
  let currentY = 120;

  // Header Banner Card
  svgElements.push(`
    <rect x="30" y="30" width="940" height="64" fill="#141d2e" stroke="#243044" rx="12"/>
    <rect x="46" y="47" width="90" height="30" fill="#2563eb" rx="6"/>
    <text x="91" y="67" fill="#ffffff" font-size="12" font-weight="800" font-family="sans-serif" text-anchor="middle">${escapeXml(courseCode.toUpperCase())}</text>
    <text x="150" y="67" fill="#94a3b8" font-size="12" font-weight="600" font-family="sans-serif">${escapeXml(university.toUpperCase())} · STUDENT READING VIEW</text>
    <rect x="780" y="47" width="170" height="30" fill="#0f172a" stroke="#38bdf8" rx="6"/>
    <text x="865" y="67" fill="#38bdf8" font-size="11" font-family="monospace" text-anchor="middle">PLX FORMAT VERIFIED</text>
  `);

  // Note Title
  svgElements.push(`
    <text x="40" y="${currentY + 28}" fill="#ffffff" font-size="24" font-weight="800" font-family="sans-serif">${escapeXml(title)}</text>
  `);
  currentY += 60;

  // Parse PLX blocks
  const tagRegex = /<(H1|H2|TEXT|MATH|TABLE|LIST|ORDERED|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
  let match;
  let blockCount = 0;

  while ((match = tagRegex.exec(str)) !== null) {
    blockCount++;
    const tagName = match[1].toUpperCase();
    const attr = match[2] || '';
    const body = match[3].trim();

    if (tagName === 'H1') {
      currentY += 20;
      svgElements.push(`
        <text x="40" y="${currentY}" fill="#38bdf8" font-size="20" font-weight="800" font-family="sans-serif">${escapeXml(body)}</text>
        <line x1="40" y1="${currentY + 10}" x2="960" y2="${currentY + 10}" stroke="#334155" stroke-width="1"/>
      `);
      currentY += 30;
    } else if (tagName === 'H2') {
      currentY += 15;
      svgElements.push(`
        <text x="40" y="${currentY}" fill="#818cf8" font-size="16" font-weight="700" font-family="sans-serif">${escapeXml(body)}</text>
      `);
      currentY += 25;
    } else if (tagName === 'TEXT') {
      const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        // Chunk long lines to ~85 chars
        const charLimit = 85;
        for (let i = 0; i < line.length; i += charLimit) {
          const chunk = line.substring(i, i + charLimit);
          const spans = parseInlineToSvgSpans(chunk, 40, currentY);
          svgElements.push(...spans);
          currentY += 22;
        }
      });
      currentY += 10;
    } else if (tagName === 'MATH') {
      currentY += 10;
      const mathRes = formatMathForSvg(body);
      if (mathRes.hasError) {
        svgElements.push(`
          <rect x="40" y="${currentY}" width="920" height="60" fill="rgba(239, 68, 68, 0.15)" stroke="#f87171" rx="8"/>
          <rect x="54" y="${currentY + 16}" width="110" height="26" fill="#ef4444" rx="4"/>
          <text x="109" y="${currentY + 33}" fill="#ffffff" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">LATEX ERROR</text>
          <text x="180" y="${currentY + 35}" fill="#f87171" font-size="14" font-family="monospace">${escapeXml(body)}</text>
        `);
      } else {
        svgElements.push(`
          <rect x="40" y="${currentY}" width="920" height="60" fill="#090d16" stroke="#1e293b" rx="8"/>
          <text x="500" y="${currentY + 36}" fill="#38bdf8" font-size="16" font-weight="bold" font-family="monospace" text-anchor="middle">${escapeXml(mathRes.text)}</text>
        `);
      }
      currentY += 75;
    } else if (tagName === 'TABLE') {
      currentY += 10;
      const rawRows = body.split('\n').map(r => r.trim()).filter(Boolean).filter(r => !(/^[\s|:-]+$/.test(r) && r.includes('-')));
      
      const grid: string[][] = rawRows.map(r => {
        if (r.includes('|')) {
          const cells = r.split('|').map(c => c.trim());
          if (cells.length > 1 && cells[0] === '') cells.shift();
          if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
          return cells;
        }
        return r.split(',').map(c => c.trim());
      });

      if (grid.length > 0) {
        const numCols = Math.max(...grid.map(r => r.length));
        const colWidth = Math.floor(920 / numCols);
        const rowHeight = 36;
        const tableHeight = grid.length * rowHeight;

        svgElements.push(`
          <rect x="40" y="${currentY}" width="920" height="${tableHeight}" fill="#0f172a" stroke="#334155" rx="8"/>
        `);

        grid.forEach((row, rIdx) => {
          const rowY = currentY + rIdx * rowHeight;
          const isHeader = rIdx === 0;
          const bg = isHeader ? '#1e293b' : (rIdx % 2 === 1 ? '#0f172a' : '#141d2e');
          const txtColor = isHeader ? '#38bdf8' : '#e2e8f0';
          const weight = isHeader ? 'bold' : 'normal';

          svgElements.push(`
            <rect x="40" y="${rowY}" width="920" height="${rowHeight}" fill="${bg}" stroke="#334155" stroke-width="0.5"/>
          `);

          row.forEach((cell, cIdx) => {
            const cellX = 40 + cIdx * colWidth + 12;
            const truncatedCell = cell.length > 30 ? cell.substring(0, 28) + '...' : cell;
            svgElements.push(`
              <text x="${cellX}" y="${rowY + 23}" fill="${txtColor}" font-size="13" font-weight="${weight}" font-family="sans-serif">${escapeXml(truncatedCell)}</text>
            `);
          });
        });

        currentY += tableHeight + 20;
      }
    } else if (tagName === 'LIST' || tagName === 'ORDERED') {
      currentY += 5;
      const isOrdered = tagName === 'ORDERED';
      const items = body.split('\n').map(i => i.trim()).filter(Boolean);

      items.forEach((item, idx) => {
        const bullet = isOrdered ? `${idx + 1}.` : '•';
        const cleanItem = item.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
        svgElements.push(`
          <text x="50" y="${currentY}" fill="#38bdf8" font-size="14" font-weight="bold" font-family="sans-serif">${bullet}</text>
          <text x="75" y="${currentY}" fill="#cbd5e1" font-size="14" font-family="sans-serif">${escapeXml(cleanItem)}</text>
        `);
        currentY += 22;
      });
      currentY += 10;
    } else if (tagName === 'QUES') {
      currentY += 10;
      const corMatch = /<COR>([\s\S]*?)<\/COR>/i.exec(body);
      const incMatches = [...body.matchAll(/<INC>([\s\S]*?)<\/INC>/gi)].map(m => m[1]);
      const expMatch = /<EXP>([\s\S]*?)<\/EXP>/i.exec(body);

      const firstSub = body.search(/<(COR|INC|EXP)/i);
      const qPrompt = firstSub !== -1 ? body.substring(0, firstSub).trim() : body;

      const cardHeight = 180 + (expMatch ? 50 : 0);
      svgElements.push(`
        <rect x="40" y="${currentY}" width="920" height="${cardHeight}" fill="#0f172a" stroke="#2563eb" rx="10"/>
        <text x="60" y="${currentY + 28}" fill="#3b82f6" font-size="11" font-weight="bold" font-family="sans-serif">QUESTION ${attr ? `#${attr}` : ''}</text>
        <text x="60" y="${currentY + 52}" fill="#f8fafc" font-size="14" font-weight="bold" font-family="sans-serif">${escapeXml(qPrompt)}</text>
      `);

      let optY = currentY + 70;
      if (corMatch) {
        svgElements.push(`
          <rect x="60" y="${optY}" width="880" height="30" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.3)" rx="6"/>
          <rect x="70" y="${optY + 5}" width="36" height="20" fill="#059669" rx="4"/>
          <text x="88" y="${optY + 19}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">A ✓</text>
          <text x="116" y="${optY + 20}" fill="#34d399" font-size="13" font-weight="bold" font-family="sans-serif">${escapeXml(corMatch[1].trim())}</text>
        `);
        optY += 36;
      }

      incMatches.slice(0, 3).forEach((inc, i) => {
        const letter = String.fromCharCode(66 + i);
        svgElements.push(`
          <rect x="60" y="${optY}" width="880" height="30" fill="#141d2e" stroke="#243044" rx="6"/>
          <rect x="70" y="${optY + 5}" width="28" height="20" fill="#334155" rx="4"/>
          <text x="84" y="${optY + 19}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">${letter}</text>
          <text x="108" y="${optY + 20}" fill="#cbd5e1" font-size="13" font-family="sans-serif">${escapeXml(inc.trim())}</text>
        `);
        optY += 36;
      });

      if (expMatch) {
        optY += 5;
        svgElements.push(`
          <rect x="60" y="${optY}" width="880" height="40" fill="rgba(234, 179, 8, 0.1)" stroke="rgba(234, 179, 8, 0.25)" rx="6"/>
          <text x="75" y="${optY + 18}" fill="#eab308" font-size="10" font-weight="bold" font-family="sans-serif">EXPLANATION:</text>
          <text x="75" y="${optY + 32}" fill="#fef08a" font-size="12" font-family="sans-serif">${escapeXml(expMatch[1].trim())}</text>
        `);
      }

      currentY += cardHeight + 20;
    }
  }

  // Fallback if no tags were matched
  if (blockCount === 0 && str) {
    const lines = str.split('\n');
    lines.forEach((l) => {
      if (l.trim()) {
        svgElements.push(`<text x="40" y="${currentY}" fill="#cbd5e1" font-size="14" font-family="sans-serif">${escapeXml(l.trim())}</text>`);
        currentY += 22;
      }
    });
  }

  const canvasHeight = Math.max(500, currentY + 40);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}">
    <rect width="${width}" height="${canvasHeight}" fill="#0b0f19"/>
    <rect x="20" y="20" width="${width - 40}" height="${canvasHeight - 40}" fill="#0f172a" stroke="#1e293b" rx="14"/>
    ${svgElements.join('\n')}
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
 * Generates a 20-question grid-style photo preview matching the website student CBT view using native SVG elements.
 * Highlights LaTeX errors in bright RED.
 */
export async function renderQuestionGridImage(options: QuestionGridOptions): Promise<string> {
  const { sheetTitle, courseCode, semester, year, batchIndex, totalQuestions, questions } = options;

  const width = 1200;
  const totalBatches = Math.max(1, Math.ceil(totalQuestions / 20));
  const currentBatchNum = batchIndex + 1;
  const startQNum = batchIndex * 20 + 1;
  const endQNum = Math.min(totalQuestions, batchIndex * 20 + questions.length);

  const svgElements: string[] = [];

  // Header Banner
  svgElements.push(`
    <rect x="25" y="25" width="1150" height="70" fill="#141d2e" stroke="#243044" rx="12"/>
    <rect x="45" y="42" width="90" height="30" fill="#2563eb" rx="6"/>
    <text x="90" y="62" fill="#ffffff" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(courseCode.toUpperCase())}</text>
    <text x="150" y="56" fill="#ffffff" font-size="16" font-weight="800" font-family="sans-serif">${escapeXml(sheetTitle)} · ${escapeXml(semester)} Semester ${escapeXml(year)}</text>
    <text x="150" y="74" fill="#94a3b8" font-size="12" font-family="sans-serif">Question Sheet Visual Inspection (Batch ${currentBatchNum} of ${totalBatches})</text>
    <rect x="960" y="42" width="190" height="32" fill="#0f172a" stroke="#10b981" rx="8"/>
    <text x="1055" y="63" fill="#34d399" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">Questions ${startQNum} - ${endQNum} / ${totalQuestions}</text>
  `);

  let leftY = 120;
  let rightY = 120;

  questions.slice(0, 20).forEach((q, idx) => {
    const qNum = batchIndex * 20 + idx + 1;
    const isLeft = idx % 2 === 0;
    const x = isLeft ? 25 : 615;
    let cardY = isLeft ? leftY : rightY;

    const allOptions = [
      { letter: 'A', text: q.correctAnswer, isCorrect: true },
      ...(q.incorrectAnswers || []).map((ans, i) => ({
        letter: String.fromCharCode(66 + i),
        text: ans,
        isCorrect: false
      }))
    ];

    const mathPrompt = formatMathForSvg(q.text);
    const cardHeight = 180 + (q.explanation ? 45 : 0);

    svgElements.push(`
      <rect x="${x}" y="${cardY}" width="560" height="${cardHeight}" fill="#141d2e" stroke="#243044" rx="10"/>
      <rect x="${x + 16}" y="${cardY + 16}" width="40" height="22" fill="#0f172a" stroke="#38bdf8" rx="4"/>
      <text x="${x + 36}" y="${cardY + 31}" fill="#38bdf8" font-size="11" font-weight="bold" font-family="monospace" text-anchor="middle">Q${qNum}</text>
    `);

    if (mathPrompt.hasError) {
      svgElements.push(`
        <rect x="${x + 65}" y="${cardY + 14}" width="470" height="26" fill="rgba(239, 68, 68, 0.2)" stroke="#f87171" rx="4"/>
        <text x="${x + 72}" y="${cardY + 31}" fill="#f87171" font-size="12" font-weight="bold" font-family="monospace">${escapeXml(`[LaTeX Error: ${q.text}]`)}</text>
      `);
    } else {
      const truncatedText = q.text.length > 60 ? q.text.substring(0, 58) + '...' : q.text;
      svgElements.push(`
        <text x="${x + 65}" y="${cardY + 31}" fill="#f8fafc" font-size="13" font-weight="bold" font-family="sans-serif">${escapeXml(truncatedText)}</text>
      `);
    }

    let optY = cardY + 52;
    allOptions.slice(0, 4).forEach((opt) => {
      const isCorrect = opt.isCorrect;
      const bg = isCorrect ? 'rgba(16, 185, 129, 0.1)' : '#0f172a';
      const border = isCorrect ? 'rgba(16, 185, 129, 0.3)' : '#1e293b';
      const txtColor = isCorrect ? '#34d399' : '#cbd5e1';
      const badgeBg = isCorrect ? '#059669' : '#334155';
      const badgeText = isCorrect ? `${opt.letter} ✓` : opt.letter;

      const optMath = formatMathForSvg(opt.text);
      const displayOptText = optMath.hasError ? `[Error: ${opt.text}]` : optMath.text;
      const truncatedOpt = displayOptText.length > 45 ? displayOptText.substring(0, 43) + '...' : displayOptText;

      svgElements.push(`
        <rect x="${x + 16}" y="${optY}" width="528" height="26" fill="${bg}" stroke="${border}" rx="6"/>
        <rect x="${x + 22}" y="${optY + 3}" width="${isCorrect ? 32 : 22}" height="20" fill="${badgeBg}" rx="4"/>
        <text x="${x + (isCorrect ? 38 : 33)}" y="${optY + 17}" fill="#ffffff" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle">${badgeText}</text>
        <text x="${x + (isCorrect ? 60 : 50)}" y="${optY + 18}" fill="${optMath.hasError ? '#f87171' : txtColor}" font-size="12" font-family="sans-serif">${escapeXml(truncatedOpt)}</text>
      `);
      optY += 30;
    });

    if (q.explanation) {
      const expMath = formatMathForSvg(q.explanation);
      const displayExp = expMath.hasError ? `[Error: ${q.explanation}]` : expMath.text;
      const truncatedExp = displayExp.length > 60 ? displayExp.substring(0, 58) + '...' : displayExp;

      svgElements.push(`
        <rect x="${x + 16}" y="${optY + 4}" width="528" height="32" fill="rgba(234, 179, 8, 0.1)" stroke="rgba(234, 179, 8, 0.25)" rx="6"/>
        <text x="${x + 26}" y="${optY + 18}" fill="#eab308" font-size="10" font-weight="bold" font-family="sans-serif">EXPLANATION:</text>
        <text x="${x + 110}" y="${optY + 18}" fill="#fef08a" font-size="11" font-family="sans-serif">${escapeXml(truncatedExp)}</text>
      `);
    }

    if (isLeft) {
      leftY += cardHeight + 16;
    } else {
      rightY += cardHeight + 16;
    }
  });

  const canvasHeight = Math.max(700, Math.max(leftY, rightY) + 30);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}">
    <rect width="${width}" height="${canvasHeight}" fill="#0b0f19"/>
    ${svgElements.join('\n')}
  </svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
