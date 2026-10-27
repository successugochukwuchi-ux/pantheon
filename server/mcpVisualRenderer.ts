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
 * Strips basic markdown markers for clean SVG text rendering while preserving structure
 */
function cleanMarkdownForSvg(md: string): string {
  if (!md) return '';
  let text = decodeHtmlEntities(md);
  // Format inline LaTeX formulas: $...$ -> clean unicode math
  text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => formatLatexToUnicodeMath(math));
  // Replace HTML bold/italic/underline tags
  text = text.replace(/<[B|b]>([\s\S]*?)<\/[B|b]>/gi, '$1');
  text = text.replace(/<[I|i]>([\s\S]*?)<\/[I|i]>/gi, '$1');
  text = text.replace(/<[U|u]>([\s\S]*?)<\/[U|u]>/gi, '$1');
  // Strip bold/italic markdown
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  return text;
}

/**
 * Word wrap helper for SVG text
 */
function wrapText(text: string, maxCharsPerLine: number = 75): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine.length === 0 ? '' : ' ') + word;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

export interface NoteRenderOptions {
  title: string;
  courseCode?: string;
  university?: string;
  content: string;
}

interface TableRow {
  isHeader: boolean;
  cells: string[];
}

/**
 * Generates an image representing the student reading view of a lecture note
 * Supports: Headings (H1-H4), KaTeX math blocks, markdown tables, blockquotes, lists, code blocks
 */
/**
 * Converts common LaTeX math expressions to clear, readable Unicode mathematical notation
 * for pristine SVG rendering without unparsed raw backslashes
 */
export function formatLatexToUnicodeMath(latex: string): string {
  if (!latex) return '';
  let s = latex;

  // Fractions: \frac{a}{b} -> (a)/(b)
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  // Square root: \sqrt{x} -> √(x), \sqrt[n]{x} -> ⁿ√(x)
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)');
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  
  // Integrals & Summations & Limits
  s = s.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫_{$1}^{$2}');
  s = s.replace(/\\int/g, '∫');
  s = s.replace(/\\iint/g, '∬');
  s = s.replace(/\\iiint/g, '∭');
  s = s.replace(/\\oint/g, '∮');
  s = s.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑_{$1}^{$2}');
  s = s.replace(/\\sum/g, '∑');
  s = s.replace(/\\prod/g, '∏');
  s = s.replace(/\\lim_\{([^}]+)\}/g, 'lim_{$1}');

  // Greek letters
  const greek: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
    '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π',
    '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ',
    '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω'
  };
  for (const [cmd, sym] of Object.entries(greek)) {
    s = s.split(cmd).join(sym);
  }

  // Operators & symbols
  const syms: Record<string, string> = {
    '\\partial': '∂', '\\nabla': '∇', '\\infty': '∞', '\\pm': '±', '\\mp': '∓',
    '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\leq': '≤', '\\geq': '≥',
    '\\neq': '≠', '\\approx': '≈', '\\sim': '~', '\\equiv': '≡',
    '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\notin': '∉',
    '\\subset': '⊂', '\\subseteq': '⊆', '\\cup': '∪', '\\cap': '∩',
    '\\rightarrow': '→', '\\to': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
    '\\therefore': '∴', '\\because': '∵', '\\hbar': 'ℏ'
  };
  for (const [cmd, sym] of Object.entries(syms)) {
    s = s.split(cmd).join(sym);
  }

  // Superscript shortcuts
  s = s.replace(/\^2\b/g, '²');
  s = s.replace(/\^3\b/g, '³');
  s = s.replace(/\^0\b/g, '⁰');
  s = s.replace(/\^1\b/g, '¹');
  s = s.replace(/\^\{([^}]+)\}/g, '^($1)');
  s = s.replace(/\_\{([^}]+)\}/g, '_($1)');

  // Clean remaining braces and commands
  s = s.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  s = s.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  s = s.replace(/\\text\{([^}]+)\}/g, '$1');
  s = s.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  s = s.replace(/\\mathit\{([^}]+)\}/g, '$1');
  s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');

  return s.trim();
}

/**
 * Normalizes content from NoteBuilder JSON blocks or PLX markup into standard Markdown
 */
export function normalizeToMarkdown(content: string): string {
  if (!content) return '';
  let str = content.trim();

  // If content is JSON array of NoteBlocks
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
        return parsed.map((b: any) => {
          if (b.type === 'h1') return `# ${b.content}`;
          if (b.type === 'h2') return `## ${b.content}`;
          if (b.type === 'h3') return `### ${b.content}`;
          if (b.type === 'h4') return `#### ${b.content}`;
          if (b.type === 'math') return `$$\n${b.content}\n$$`;
          if (b.type === 'table') {
            try {
              const grid = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
              if (Array.isArray(grid)) {
                return grid.map((row: any[], rIdx: number) => {
                  const line = `| ${row.join(' | ')} |`;
                  if (rIdx === 0) {
                    const sep = `| ${row.map(() => '---').join(' | ')} |`;
                    return `${line}\n${sep}`;
                  }
                  return line;
                }).join('\n');
              }
            } catch {
              return b.content;
            }
          }
          if (b.type === 'bullet-list') {
            return b.content.split('\n').map((l: string) => `- ${l}`).join('\n');
          }
          if (b.type === 'numbered-list') {
            return b.content.split('\n').map((l: string, i: number) => `${i + 1}. ${l}`).join('\n');
          }
          return b.content;
        }).join('\n\n');
      }
    } catch {
      // not json, continue
    }
  }

  // If content has PLX tags (<PLX>, <H1>, <H2>, <MATH>, <TABLE>, <LIST>, <ORDERED>)
  if (str.includes('<H1>') || str.includes('<H2>') || str.includes('<MATH>') || str.includes('<TABLE>') || str.includes('<PLX>')) {
    const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(str);
    if (plxMatch) str = plxMatch[1].trim();

    str = str.replace(/<H1>([\s\S]*?)<\/H1>/gi, (_, c) => `# ${c.trim()}`);
    str = str.replace(/<H2>([\s\S]*?)<\/H2>/gi, (_, c) => `## ${c.trim()}`);
    str = str.replace(/<MATH>([\s\S]*?)<\/MATH>/gi, (_, c) => `$$\n${c.trim()}\n$$`);
    str = str.replace(/<TABLE>([\s\S]*?)<\/TABLE>/gi, (_, c) => {
      const rows = c.trim().split('\n').map((r: string) => r.trim()).filter((r: string) => r.length > 0);
      if (rows.length === 0) return '';
      return rows.map((r: string, rIdx: number) => {
        const cells = r.includes('|') ? r.split('|').map((s: string) => s.trim()) : r.split(',').map((s: string) => s.trim());
        const rowStr = `| ${cells.join(' | ')} |`;
        if (rIdx === 0) {
          const sep = `| ${cells.map(() => '---').join(' | ')} |`;
          return `${rowStr}\n${sep}`;
        }
        return rowStr;
      }).join('\n');
    });
    str = str.replace(/<LIST>([\s\S]*?)<\/LIST>/gi, (_, c) => {
      return c.trim().split('\n').map((l: string) => `- ${l.trim()}`).join('\n');
    });
    str = str.replace(/<ORDERED>([\s\S]*?)<\/ORDERED>/gi, (_, c) => {
      return c.trim().split('\n').map((l: string, i: number) => `${i + 1}. ${l.trim()}`).join('\n');
    });
  }

  return str;
}

export async function renderNotePreviewImage(options: NoteRenderOptions): Promise<string> {
  const { title, courseCode = 'COURSE', university = 'COLEARN ACADEMIC', content } = options;
  
  const width = 1100;
  let currentY = 180;
  const elements: string[] = [];

  // Normalize NoteBuilder blocks, PLX tags, or raw markdown
  const normalized = normalizeToMarkdown(content);

  // Parse markdown content into structured blocks
  const rawLines = normalized.split('\n');
  type BlockItem = 
    | { type: 'h1'; text: string }
    | { type: 'h2'; text: string }
    | { type: 'h3'; text: string }
    | { type: 'h4'; text: string }
    | { type: 'math_block'; text: string }
    | { type: 'bullet'; text: string }
    | { type: 'numbered'; text: string; num: string }
    | { type: 'quote'; text: string }
    | { type: 'code_block'; lines: string[] }
    | { type: 'table'; rows: TableRow[] }
    | { type: 'paragraph'; text: string };

  const blocks: BlockItem[] = [];

  let inMathBlock = false;
  let mathBuffer: string[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  let inTable = false;
  let tableRows: TableRow[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // 1. Code blocks (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code_block', lines: [...codeBuffer] });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 2. Math blocks ($$)
    if (trimmed.startsWith('$$')) {
      if (inMathBlock) {
        mathBuffer.push(trimmed.replace(/\$\$/g, ''));
        blocks.push({ type: 'math_block', text: mathBuffer.join(' ') });
        mathBuffer = [];
        inMathBlock = false;
      } else {
        inMathBlock = true;
        const remaining = trimmed.replace(/^\$\$/, '');
        if (remaining.endsWith('$$') && remaining.length > 2) {
          blocks.push({ type: 'math_block', text: remaining.replace(/\$\$$/, '') });
          inMathBlock = false;
        } else if (remaining) {
          mathBuffer.push(remaining);
        }
      }
      continue;
    }
    if (inMathBlock) {
      mathBuffer.push(trimmed);
      continue;
    }

    // 3. Tables (| Cell | Cell |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Check if separator line (| --- | --- |)
      const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(trimmed);
      if (isSeparator) {
        // Marks that preceding row was header
        if (tableRows.length > 0) {
          tableRows[0].isHeader = true;
        }
        continue;
      }

      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      tableRows.push({
        isHeader: false,
        cells
      });
      inTable = true;
      continue;
    } else if (inTable) {
      // End of table
      if (tableRows.length > 0) {
        blocks.push({ type: 'table', rows: [...tableRows] });
      }
      tableRows = [];
      inTable = false;
    }

    if (!trimmed) continue;

    // 4. Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: trimmed.slice(5).trim() });
    } else if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', text: trimmed.slice(2).trim() });
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        blocks.push({ type: 'numbered', num: match[1], text: match[2].trim() });
      } else {
        blocks.push({ type: 'paragraph', text: trimmed });
      }
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'bullet', text: trimmed.slice(2).trim() });
    } else {
      blocks.push({ type: 'paragraph', text: trimmed });
    }
  }

  // Flush any lingering table or code
  if (inTable && tableRows.length > 0) {
    blocks.push({ type: 'table', rows: [...tableRows] });
  }
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ type: 'code_block', lines: [...codeBuffer] });
  }

  // Cap lines to reasonable preview height (up to ~60 blocks)
  const renderedBlocks = blocks.slice(0, 55);

  for (const block of renderedBlocks) {
    if (block.type === 'h1') {
      currentY += 28;
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 45);
      for (const l of wrapped) {
        elements.push(`<text x="60" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(l)}</text>`);
        currentY += 32;
      }
      elements.push(`<line x1="60" y1="${currentY - 10}" x2="1040" y2="${currentY - 10}" stroke="#e2e8f0" stroke-width="1.5" />`);
      currentY += 14;
    } else if (block.type === 'h2') {
      currentY += 22;
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 50);
      for (const l of wrapped) {
        elements.push(`<text x="60" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="20" font-weight="600" fill="#1e293b">${escapeXml(l)}</text>`);
        currentY += 28;
      }
      currentY += 10;
    } else if (block.type === 'h3') {
      currentY += 16;
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 55);
      for (const l of wrapped) {
        elements.push(`<text x="60" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="17" font-weight="600" fill="#334155">${escapeXml(l)}</text>`);
        currentY += 24;
      }
      currentY += 6;
    } else if (block.type === 'h4') {
      currentY += 14;
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 60);
      for (const l of wrapped) {
        elements.push(`<text x="60" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600" fill="#475569">${escapeXml(l)}</text>`);
        currentY += 22;
      }
      currentY += 6;
    } else if (block.type === 'math_block') {
      currentY += 12;
      const cleanFormula = formatLatexToUnicodeMath(decodeHtmlEntities(block.text));
      elements.push(`
        <rect x="60" y="${currentY}" width="980" height="54" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <text x="550" y="${currentY + 34}" font-family="JetBrains Mono, monospace" font-size="16" font-weight="600" fill="#0f172a" text-anchor="middle">
          ${escapeXml(cleanFormula)}
        </text>
      `);
      currentY += 70;
    } else if (block.type === 'table') {
      currentY += 14;
      const tableX = 60;
      const tableWidth = 980;
      const rows = block.rows;
      const colCount = Math.max(...rows.map(r => r.cells.length), 1);
      const colWidth = Math.floor(tableWidth / colCount);
      const rowHeight = 36;
      const tableHeight = rows.length * rowHeight;

      // Table outer box
      elements.push(`
        <rect x="${tableX}" y="${currentY}" width="${tableWidth}" height="${tableHeight}" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
      `);

      // Rows
      rows.forEach((row, rIdx) => {
        const rowY = currentY + rIdx * rowHeight;
        if (row.isHeader || rIdx === 0) {
          elements.push(`<rect x="${tableX}" y="${rowY}" width="${tableWidth}" height="${rowHeight}" rx="5" fill="#f1f5f9"/>`);
        } else if (rIdx % 2 === 1) {
          elements.push(`<rect x="${tableX}" y="${rowY}" width="${tableWidth}" height="${rowHeight}" fill="#fafafa"/>`);
        }

        // Horizontal line between rows
        if (rIdx > 0) {
          elements.push(`<line x1="${tableX}" y1="${rowY}" x2="${tableX + tableWidth}" y2="${rowY}" stroke="#e2e8f0" stroke-width="1"/>`);
        }

        // Cells
        row.cells.forEach((cellText, cIdx) => {
          const cellX = tableX + cIdx * colWidth;
          if (cIdx > 0) {
            elements.push(`<line x1="${cellX}" y1="${currentY}" x2="${cellX}" y2="${currentY + tableHeight}" stroke="#e2e8f0" stroke-width="1"/>`);
          }
          const cleanCell = cleanMarkdownForSvg(cellText).slice(0, 35);
          const isH = row.isHeader || rIdx === 0;
          elements.push(`
            <text x="${cellX + 12}" y="${rowY + 23}" font-family="Plus Jakarta Sans, sans-serif" font-size="${isH ? '13' : '12'}" font-weight="${isH ? '700' : '400'}" fill="${isH ? '#0f172a' : '#334155'}">
              ${escapeXml(cleanCell)}
            </text>
          `);
        });
      });

      currentY += tableHeight + 20;
    } else if (block.type === 'quote') {
      currentY += 12;
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 70);
      const qHeight = wrapped.length * 24 + 20;
      elements.push(`
        <rect x="60" y="${currentY}" width="980" height="${qHeight}" rx="6" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
        <line x1="60" y1="${currentY}" x2="60" y2="${currentY + qHeight}" stroke="#3b82f6" stroke-width="5"/>
      `);
      let textY = currentY + 24;
      for (const line of wrapped) {
        elements.push(`<text x="80" y="${textY}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-style="italic" fill="#1e40af">${escapeXml(line)}</text>`);
        textY += 24;
      }
      currentY += qHeight + 14;
    } else if (block.type === 'code_block') {
      currentY += 12;
      const cLines = block.lines.slice(0, 10);
      const cHeight = cLines.length * 22 + 28;
      elements.push(`
        <rect x="60" y="${currentY}" width="980" height="${cHeight}" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      `);
      let codeY = currentY + 26;
      for (const line of cLines) {
        elements.push(`<text x="80" y="${codeY}" font-family="JetBrains Mono, monospace" font-size="13" fill="#38bdf8">${escapeXml(line)}</text>`);
        codeY += 22;
      }
      currentY += cHeight + 16;
    } else if (block.type === 'numbered') {
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 70);
      elements.push(`
        <rect x="64" y="${currentY - 14}" width="22" height="20" rx="4" fill="#e0e7ff"/>
        <text x="75" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700" fill="#3730a3" text-anchor="middle">${escapeXml(block.num)}</text>
      `);
      for (let i = 0; i < wrapped.length; i++) {
        elements.push(`<text x="96" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" fill="#334155">${escapeXml(wrapped[i])}</text>`);
        currentY += 24;
      }
      currentY += 6;
    } else if (block.type === 'bullet') {
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 70);
      elements.push(`<circle cx="72" cy="${currentY - 5}" r="3.5" fill="#3b82f6" />`);
      for (let i = 0; i < wrapped.length; i++) {
        elements.push(`<text x="90" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" fill="#334155">${escapeXml(wrapped[i])}</text>`);
        currentY += 24;
      }
      currentY += 6;
    } else {
      const wrapped = wrapText(cleanMarkdownForSvg(block.text), 75);
      for (const l of wrapped) {
        elements.push(`<text x="60" y="${currentY}" font-family="Plus Jakarta Sans, sans-serif" font-size="15" fill="#334155">${escapeXml(l)}</text>`);
        currentY += 24;
      }
      currentY += 10;
    }
  }

  if (blocks.length > 55) {
    elements.push(`
      <rect x="60" y="${currentY + 10}" width="980" height="40" rx="6" fill="#e2e8f0" opacity="0.6"/>
      <text x="550" y="${currentY + 35}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">
        + ${blocks.length - 55} more blocks in full note...
      </text>
    `);
    currentY += 60;
  }

  const height = Math.max(currentY + 60, 500);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#f8fafc"/>

  <!-- Top Banner (Student Reading View Bar) -->
  <rect x="0" y="0" width="${width}" height="130" fill="url(#headerGrad)"/>
  
  <!-- University & Badge -->
  <rect x="60" y="26" width="130" height="26" rx="6" fill="#3b82f6"/>
  <text x="125" y="44" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">
    ${escapeXml(courseCode.toUpperCase())}
  </text>
  
  <text x="210" y="44" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600" fill="#94a3b8" letter-spacing="1">
    ${escapeXml(university.toUpperCase())} · STUDENT READING PREVIEW
  </text>

  <!-- Note Title -->
  <text x="60" y="96" font-family="Plus Jakarta Sans, sans-serif" font-size="28" font-weight="800" fill="#ffffff">
    ${escapeXml(title)}
  </text>

  <!-- Content Elements -->
  ${elements.join('\n')}

  <!-- Footer Watermark -->
  <rect x="0" y="${height - 40}" width="${width}" height="40" fill="#0f172a"/>
  <text x="60" y="${height - 16}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" fill="#94a3b8">
    CoLearn MCP Inspection Engine · Verified Student Reading View
  </text>
  <text x="${width - 60}" y="${height - 16}" font-family="JetBrains Mono, monospace" font-size="12" fill="#64748b" text-anchor="end">
    ${new Date().toISOString().split('T')[0]}
  </text>
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
 * Generates a 20-question grid-style photo preview showing Question, Options, and Explanation
 */
export async function renderQuestionGridImage(options: QuestionGridOptions): Promise<string> {
  const { sheetTitle, courseCode, semester, year, batchIndex, totalQuestions, questions } = options;

  const width = 1600;
  const colWidth = 730;
  const colGap = 40;
  const startX = 50;
  const startY = 160;

  // We arrange 2 columns (left column Q1-Q10, right column Q11-Q20)
  const itemsPerCol = 10;
  const leftColItems = questions.slice(0, itemsPerCol);
  const rightColItems = questions.slice(itemsPerCol, 20);

  function renderCard(q: QuestionItem, index: number, x: number, y: number, cardHeight: number): string {
    const qNum = batchIndex * 20 + index + 1;
    const cleanText = cleanMarkdownForSvg(q.text);
    const qLines = wrapText(cleanText, 70).slice(0, 3); // Max 3 lines for question text

    // Combine and label options
    const allOptions = [
      { letter: 'A', text: q.correctAnswer, isCorrect: true },
      ...(q.incorrectAnswers || []).map((ans, i) => ({
        letter: String.fromCharCode(66 + i),
        text: ans,
        isCorrect: false
      }))
    ];

    // Option rows
    let optY = y + 36 + qLines.length * 20;
    const optionElements: string[] = [];

    for (const opt of allOptions.slice(0, 4)) {
      const isCorrect = opt.isCorrect;
      const bg = isCorrect ? '#ecfdf5' : '#f8fafc';
      const border = isCorrect ? '#10b981' : '#e2e8f0';
      const textColor = isCorrect ? '#065f46' : '#334155';
      const labelBadge = isCorrect ? '#059669' : '#64748b';
      const badgeText = isCorrect ? `${opt.letter} ✓` : opt.letter;
      const optTextSnippet = cleanMarkdownForSvg(opt.text).slice(0, 65);

      optionElements.push(`
        <rect x="${x + 14}" y="${optY}" width="${colWidth - 28}" height="28" rx="5" fill="${bg}" stroke="${border}" stroke-width="${isCorrect ? '1.5' : '1'}"/>
        <rect x="${x + 18}" y="${optY + 4}" width="${isCorrect ? 34 : 22}" height="20" rx="3" fill="${labelBadge}"/>
        <text x="${x + 20 + (isCorrect ? 15 : 9)}" y="${optY + 18}" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">
          ${escapeXml(badgeText)}
        </text>
        <text x="${x + 60}" y="${optY + 18}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="${isCorrect ? '600' : '400'}" fill="${textColor}">
          ${escapeXml(optTextSnippet)}
        </text>
      `);
      optY += 34;
    }

    // Explanation Box
    let expElement = '';
    if (q.explanation) {
      const expSnippet = cleanMarkdownForSvg(q.explanation).slice(0, 130);
      const expLines = wrapText(expSnippet, 75).slice(0, 2);
      expElement = `
        <rect x="${x + 14}" y="${optY + 4}" width="${colWidth - 28}" height="42" rx="5" fill="#fefce8" stroke="#fef08a" stroke-width="1"/>
        <text x="${x + 22}" y="${optY + 20}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700" fill="#854d0e">EXPLANATION:</text>
        <text x="${x + 22}" y="${optY + 36}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#713f12">
          ${escapeXml(expLines.join(' '))}
        </text>
      `;
    }

    return `
      <!-- Card Box -->
      <rect x="${x}" y="${y}" width="${colWidth}" height="${cardHeight - 12}" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      
      <!-- Card Header with Q Number -->
      <rect x="${x}" y="${y}" width="${colWidth}" height="32" rx="10" fill="#f1f5f9"/>
      <rect x="${x + 12}" y="${y + 5}" width="48" height="22" rx="4" fill="#0f172a"/>
      <text x="${x + 36}" y="${y + 20}" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#38bdf8" text-anchor="middle">
        Q${qNum}
      </text>
      
      <!-- Question Prompt Lines -->
      ${qLines.map((l, i) => `
        <text x="${x + 16}" y="${y + 54 + (i * 20)}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="600" fill="#0f172a">
          ${escapeXml(l)}
        </text>
      `).join('\n')}

      <!-- Options -->
      ${optionElements.join('\n')}

      <!-- Explanation -->
      ${expElement}
    `;
  }

  const cardHeight = 245;
  const leftCards: string[] = [];
  const rightCards: string[] = [];

  leftColItems.forEach((q, idx) => {
    const y = startY + idx * cardHeight;
    leftCards.push(renderCard(q, idx, startX, y, cardHeight));
  });

  rightColItems.forEach((q, idx) => {
    const y = startY + idx * cardHeight;
    rightCards.push(renderCard(q, idx + 10, startX + colWidth + colGap, y, cardHeight));
  });

  const maxRows = Math.max(leftColItems.length, rightColItems.length, 1);
  const totalHeight = startY + maxRows * cardHeight + 80;

  const totalBatches = Math.max(1, Math.ceil(totalQuestions / 20));
  const currentBatchNum = batchIndex + 1;
  const startQNum = batchIndex * 20 + 1;
  const endQNum = Math.min(totalQuestions, batchIndex * 20 + questions.length);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="gridHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="#f8fafc"/>

  <!-- Header Banner -->
  <rect x="0" y="0" width="${width}" height="120" fill="url(#gridHeadGrad)"/>
  
  <!-- Left Header Badges -->
  <rect x="${startX}" y="24" width="140" height="28" rx="6" fill="#3b82f6"/>
  <text x="${startX + 70}" y="43" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">
    ${escapeXml(courseCode.toUpperCase())}
  </text>
  
  <text x="${startX + 160}" y="43" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="600" fill="#94a3b8">
    ${escapeXml(sheetTitle)} · ${escapeXml(semester)} Semester ${escapeXml(year)}
  </text>

  <!-- Batch & Progress Indicators -->
  <text x="${startX}" y="92" font-family="Plus Jakarta Sans, sans-serif" font-size="24" font-weight="800" fill="#ffffff">
    Question Sheet Visual Inspection (Batch ${currentBatchNum} of ${totalBatches})
  </text>

  <rect x="${width - 320}" y="36" width="270" height="48" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="${width - 185}" y="65" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#10b981" text-anchor="middle">
    Showing Questions ${startQNum} - ${endQNum} / ${totalQuestions}
  </text>

  <!-- Left Column Questions -->
  ${leftCards.join('\n')}

  <!-- Right Column Questions -->
  ${rightCards.join('\n')}

  <!-- Bottom Footer -->
  <rect x="0" y="${totalHeight - 50}" width="${width}" height="50" fill="#0f172a"/>
  <text x="${startX}" y="${totalHeight - 20}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#94a3b8">
    CoLearn MCP Inspection Protocol · 20-Question Grid Batch Inspector
  </text>
  <text x="${width - startX}" y="${totalHeight - 20}" font-family="JetBrains Mono, monospace" font-size="13" fill="#64748b" text-anchor="end">
    Batch ${currentBatchNum}/${totalBatches} · Total ${totalQuestions} questions
  </text>
</svg>
  `;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
