import { NoteBlock } from '../types';

/**
 * Checks whether a line is a markdown table divider (e.g. |---|---| or :---:)
 */
export function isTableDividerLine(line: string): boolean {
  const l = line.trim();
  return /^[\s|:-]+$/.test(l) && l.includes('-');
}

/**
 * Parses a table string (CSV or backward-compatible pipe table) into a 2D string array.
 * Markdown divider lines (|---|---|) are filtered out automatically.
 */
export function parseTableLinesToGrid(tableText: string): string[][] {
  if (!tableText) return [];

  const rawLines = tableText
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .filter(r => !isTableDividerLine(r));

  return rawLines.map(r => {
    let cells: string[];
    if (r.includes('|')) {
      cells = r.split('|').map(c => c.trim());
      if (cells.length > 1 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    } else {
      // Split by comma, respecting double-quoted strings if present
      const matches = r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (matches && matches.length > 0) {
        cells = matches.map(c => c.replace(/^"|"$/g, '').trim());
      } else {
        cells = r.split(',').map(c => c.trim());
      }
    }
    return cells;
  });
}

/**
 * Converts any pipe-delimited table text into clean CSV format.
 * Eliminates markdown pipe tables in favor of official CoLearn CSV tables.
 */
export function convertPipeTableToCsv(tableText: string): string {
  const grid = parseTableLinesToGrid(tableText);
  return grid
    .map(row => row.map(cell => (cell.includes(',') ? `"${cell}"` : cell)).join(', '))
    .join('\n');
}

/**
 * Robust PLX parser that converts PLX v4.0 markup (or legacy JSON block strings)
 * into a typed NoteBlock[] array for native rendering across CoLearn web and mobile.
 */
export function parsePlxStringToBlocks(content: string, options?: { forbidQuestionTagsInNotes?: boolean }): NoteBlock[] {
  if (!content) return [];
  const str = content.trim();

  // 1. Try parsing as JSON array if previously stored in legacy block format
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
        return parsed.map((b, i) => {
          if (b.type === 'table' && typeof b.content === 'string') {
            try {
              JSON.parse(b.content); // already JSON
            } catch {
              b.content = JSON.stringify(parseTableLinesToGrid(b.content));
            }
          }
          return { id: b.id || String(i + 1), ...b };
        });
      }
    } catch {
      // Fall through to PLX tag extraction
    }
  }

  // 2. Extract content from root <PLX>...</PLX> tags if present
  const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(str);
  const text = plxMatch ? plxMatch[1].trim() : str;

  const tagRegex = /<(H1|H2|TEXT|B|I|U|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
  const resultBlocks: NoteBlock[] = [];
  let match: RegExpExecArray | null;
  let idx = 1;

  while ((match = tagRegex.exec(text)) !== null) {
    const tagName = match[1].toUpperCase();
    const attr = match[2] || '';
    const bContent = match[3].trim();

    if (tagName === 'TABLE') {
      const rows = parseTableLinesToGrid(bContent);
      resultBlocks.push({
        id: String(idx++),
        type: 'table',
        content: JSON.stringify(rows)
      });
    } else if (tagName === 'QUES') {
      // In lecture notes, question tags can be omitted or stripped if requested
      if (options?.forbidQuestionTagsInNotes) {
        continue;
      }

      const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(bContent) || /<COR>([\s\S]*?)<\/COR>/i.exec(bContent);
      const incMatches = [...bContent.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)].concat([...bContent.matchAll(/<INC>([\s\S]*?)<\/INC>/gi)]);
      const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(bContent) || /<EXP>([\s\S]*?)<\/EXP>/i.exec(bContent);

      const firstSubTag = bContent.search(/<(COR|INC|EXP)/i);
      const questionBody = firstSubTag === -1 ? bContent.trim() : bContent.substring(0, firstSubTag).trim();

      const corVal = corMatch ? (corMatch[1] || corMatch[2] || '').trim() : '';
      const incVals = incMatches.map(m => (m[1] || m[2] || '').trim()).filter(Boolean);
      const expVal = expMatch ? (expMatch[1] || expMatch[2] || '').trim() : '';

      const qData = {
        question: questionBody,
        correct: corVal,
        incorrect: incVals,
        explanation: expVal
      };

      resultBlocks.push({
        id: String(idx++),
        type: 'question',
        content: JSON.stringify(qData),
        settings: attr ? { questionId: attr } : undefined
      });
    } else if (tagName === 'TEXT') {
      // Check if TEXT contains an unwrapped markdown pipe table
      const lines = bContent.split('\n').map(l => l.trim()).filter(Boolean);
      const isPipeTable = lines.length >= 2 && lines.filter(l => l.includes('|')).length >= lines.length - 1;

      if (isPipeTable) {
        const rows = parseTableLinesToGrid(bContent);
        resultBlocks.push({
          id: String(idx++),
          type: 'table',
          content: JSON.stringify(rows)
        });
      } else {
        resultBlocks.push({
          id: String(idx++),
          type: 'text',
          content: bContent
        });
      }
    } else if (tagName === 'LIST') {
      // Normalize bullet list items
      const items = bContent
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => (l.startsWith('-') || l.startsWith('*') ? l : `- ${l}`))
        .join('\n');

      resultBlocks.push({
        id: String(idx++),
        type: 'bullet-list',
        content: items
      });
    } else if (tagName === 'ORDERED') {
      // Normalize ordered list items
      const items = bContent
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map((l, i) => (/^\d+\./.test(l) ? l : `${i + 1}. ${l}`))
        .join('\n');

      resultBlocks.push({
        id: String(idx++),
        type: 'numbered-list',
        content: items
      });
    } else {
      const typeMap: Record<string, NoteBlock['type']> = {
        'H1': 'h1',
        'H2': 'h2',
        'MATH': 'math',
        'VIDEO': 'video',
        'DIAGRAM': 'diagram'
      };

      let finalContent = bContent;
      if (tagName === 'B') finalContent = `**${bContent}**`;
      else if (tagName === 'I') finalContent = `*${bContent}*`;
      else if (tagName === 'U') finalContent = `<u>${bContent}</u>`;

      resultBlocks.push({
        id: String(idx++),
        type: typeMap[tagName] || 'text',
        content: finalContent
      });
    }
  }

  // If no matching tags were found, handle plain text or standalone table
  if (resultBlocks.length === 0 && text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const isPipeTable = lines.length >= 2 && lines.filter(l => l.includes('|')).length >= lines.length - 1;

    if (isPipeTable) {
      const rows = parseTableLinesToGrid(text);
      resultBlocks.push({ id: String(idx++), type: 'table', content: JSON.stringify(rows) });
    } else {
      resultBlocks.push({ id: '1', type: 'text', content: text });
    }
  }

  return resultBlocks;
}
