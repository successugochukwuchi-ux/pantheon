import katex from 'katex';
import { NoteBlock } from '../types';
import { parsePlxStringToBlocks, isTableDividerLine } from './plxParser';
import { autoCorrectMathExpression, autoCorrectLatexSyntax } from './latexAutoCorrect';

export type PlxIssueSeverity = 'error' | 'warning';
export type PlxIssueCategory =
  | 'structure'
  | 'syntax'
  | 'latex'
  | 'table'
  | 'question'
  | 'accent'
  | 'compatibility';

export interface PlxIssue {
  severity: PlxIssueSeverity;
  category: PlxIssueCategory;
  code: string;
  line: number;
  column?: number;
  tag?: string;
  message: string;
  snippet?: string;
  suggestion?: string;
}

export interface PlxVerifyOptions {
  /** Target context: 'note' (LectureNotes/NoteBuilder), 'study-material' (forbids <QUES>), or 'questions' (AdminPanel CBT/Past Questions) */
  mode?: 'note' | 'study-material' | 'questions';
  /** Whether to check 2-space indentation strictly (default: true, emitted as warning) */
  checkIndentation?: boolean;
}

export interface PlxVerificationResult {
  valid: boolean;
  errors: PlxIssue[];
  warnings: PlxIssue[];
  issues: PlxIssue[];
  summary: {
    totalBlocks: number;
    byType: Record<string, number>;
    mathExpressionsChecked: number;
    mathErrors: number;
    questionsCount: number;
    tablesCount: number;
    hasRootPlxTag: boolean;
  };
  /** Exact blocks produced by website's runtime plxParser.ts */
  runtimeBlocks: NoteBlock[];
  /** Exact blocks produced by NoteBuilder.tsx (.plx upload flow with accent compilation & CSV parser) */
  noteBuilderBlocks: NoteBlock[];
  /** Exact questions extracted by AdminPanel.tsx (<QUES> sheet/video importer) */
  adminQuestions: Array<{
    text: string;
    correctAnswer: string;
    incorrectAnswers: string[];
    explanation: string;
  }>;
}

const SUPPORTED_TOP_LEVEL_TAGS = [
  'H1',
  'H2',
  'TEXT',
  'B',
  'I',
  'U',
  'MATH',
  'LIST',
  'ORDERED',
  'TABLE',
  'VIDEO',
  'DIAGRAM',
  'QUES',
] as const;

const TEXT_BEARING_TAGS = new Set([
  'H1',
  'H2',
  'TEXT',
  'B',
  'I',
  'U',
  'LIST',
  'ORDERED',
]);

/**
 * Exact RFC-4180 / pipe CSV parser from src/components/NoteBuilder.tsx
 */
export function parseNoteBuilderCsvRow(rowText: string): string[] {
  const trimmedRow = rowText.trim();

  if (trimmedRow.includes('|')) {
    let cleaned = trimmedRow;
    if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
    if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
    if (/^[|:\s-]+$/.test(cleaned)) {
      return [];
    }
    return cleaned.split('|').map((cell) => cell.trim());
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < trimmedRow.length; i++) {
    const char = trimmedRow[i];
    if (char === '"') {
      if (inQuotes && i + 1 < trimmedRow.length && trimmedRow[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Exact <A>...</A> accent shorthand compiler from src/components/NoteBuilder.tsx
 */
export function compilePlxAccentShortcuts(text: string): string {
  if (!text) return text;

  const hasATags = /<A[\s\S]*?>[\s\S]*?<\/A>|\[A\][\s\S]*?\[\/A\]/i.test(text);
  if (!hasATags) return text;

  const protectEnglishHybridWords = (str: string) => {
    const placeholders: Record<string, string> = {};
    let counter = 0;
    const englishHybridRegex =
      /\b[a-zA-Z]-(business|commerce|learning|mail|book|ticket|banking|government|wallet|scooter|cigarette|reader|waste|signature|filing|level|class|cycle|structure|type|system|learning|driven|cards?|forms?|games?|solutions?)s?\b/gi;

    const processed = str.replace(englishHybridRegex, (match) => {
      const key = `__ENG_HYBRID_${counter++}__`;
      placeholders[key] = match;
      return key;
    });

    const restore = (s: string): string => {
      let result = s;
      for (const [key, original] of Object.entries(placeholders)) {
        result = result.replaceAll(key, original);
      }
      return result;
    };

    return { processed, restore };
  };

  const transformAccentsOnly = (inputStr: string): string => {
    if (!inputStr) return inputStr;
    const pattern = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|<[^>]+>)/g;
    const parts = inputStr.split(pattern);

    const safeReplaceUnderdot = (s: string, char: string, replacement: string): string => {
      const regexInsideWord = new RegExp(`${char}\\.(?=[a-zA-Z])`, 'g');
      let output = s.replace(regexInsideWord, replacement);
      const regexStandalone = new RegExp(
        `(^|\\s|[()[\\]{}"',;])(${char})\\.(?=\\s|$|[()[\\]{}"',;?!])`,
        'g'
      );
      output = output.replace(regexStandalone, `$1${replacement}`);
      return output;
    };

    const safeReplaceUmlaut = (
      s: string,
      char: string,
      replacement: string,
      charUpper: string,
      replacementUpper: string
    ): string => {
      const regexInsideWord = new RegExp(`${char}:(?=[a-zA-Z])`, 'g');
      const regexInsideWordUpper = new RegExp(`${charUpper}:(?=[a-zA-Z])`, 'g');
      let output = s.replace(regexInsideWord, replacement);
      output = output.replace(regexInsideWordUpper, replacementUpper);

      const blacklist = new Set([
        'the', 'use', 'one', 'are', 'see', 'fee', 'ice', 'age', 'tie',
        'lie', 'pie', 'toe', 'due', 'cue', 'bye', 'owe', 'she',
      ]);

      const regexEndWord = new RegExp(`\\b([a-zA-Z]+)(${char}):(?![a-zA-Z])`, 'g');
      output = output.replace(regexEndWord, (match, prefix, suffixChar) => {
        const fullWord = (prefix + suffixChar).toLowerCase();
        if (blacklist.has(fullWord) || fullWord.length > 3) return match;
        return prefix + replacement;
      });

      const regexEndWordUpper = new RegExp(`\\b([a-zA-Z]+)(${charUpper}):(?![a-zA-Z])`, 'g');
      output = output.replace(regexEndWordUpper, (match, prefix, suffixChar) => {
        const fullWord = (prefix + suffixChar).toLowerCase();
        if (blacklist.has(fullWord) || fullWord.length > 3) return match;
        return prefix + replacementUpper;
      });

      return output;
    };

    const safeReplaceMacron = (
      s: string,
      char: string,
      replacement: string,
      charUpper: string,
      replacementUpper: string
    ): string => {
      const regexEnd = new RegExp(`${char}-(?![a-zA-Z])`, 'g');
      const regexEndUpper = new RegExp(`${charUpper}-(?![a-zA-Z])`, 'g');
      let output = s.replace(regexEnd, replacement);
      output = output.replace(regexEndUpper, replacementUpper);

      const protectedWords =
        '(?:business|commerce|learning|mail|book|ticket|banking|government|wallet|scooter|cigarette|reader|waste|signature|filing|level|class|cycle|structure|type|system|learning|driven|card|form|game|solution)s?';
      const regexStandalone = new RegExp(
        `(^|\\s|[()[\\]{}"',;])(${char})-(?=[a-zA-Z])(?!(?:${protectedWords})\\b)`,
        'gi'
      );

      output = output.replace(regexStandalone, (_match, prefix, charMatch) => {
        const isUpper = charMatch === charUpper;
        return prefix + (isUpper ? replacementUpper : replacement);
      });

      return output;
    };

    const safeReplaceAcute = (
      s: string,
      char: string,
      replacement: string,
      charUpper: string,
      replacementUpper: string
    ): string => {
      const regexEnd = new RegExp(`${char}'(?![a-zA-Z])`, 'g');
      const regexEndUpper = new RegExp(`${charUpper}'(?![a-zA-Z])`, 'g');
      let output = s.replace(regexEnd, replacement);
      output = output.replace(regexEndUpper, replacementUpper);

      const regexInside = new RegExp(`${char}'([a-zA-Z]+)`, 'g');
      output = output.replace(regexInside, (match, suffix) => {
        if (['s', 't', 'd', 've', 're', 'll', 'm'].includes(suffix.toLowerCase())) return match;
        return replacement + suffix;
      });

      const regexInsideUpper = new RegExp(`${charUpper}'([a-zA-Z]+)`, 'g');
      output = output.replace(regexInsideUpper, (match, suffix) => {
        if (['s', 't', 'd', 've', 're', 'll', 'm'].includes(suffix.toLowerCase())) return match;
        return replacementUpper + suffix;
      });

      return output;
    };

    const safeReplaceCircumflex = (
      s: string,
      char: string,
      replacement: string,
      charUpper: string,
      replacementUpper: string
    ): string => {
      const mathSucceeding = /[-0-9{}()[\]+*\/=_$]/;

      const regex = new RegExp(`${char}\\^(.?)`, 'g');
      let output = s.replace(regex, (match, nextChar) => {
        if (!nextChar) return replacement;
        if (mathSucceeding.test(nextChar)) return match;
        return replacement + nextChar;
      });

      const regexUpper = new RegExp(`${charUpper}\\^(.?)`, 'g');
      output = output.replace(regexUpper, (match, nextChar) => {
        if (!nextChar) return replacementUpper;
        if (mathSucceeding.test(nextChar)) return match;
        return replacementUpper + nextChar;
      });

      return output;
    };

    const processedParts = parts.map((part, index) => {
      if (index % 2 === 1) return part;

      const { processed: resProtected, restore } = protectEnglishHybridWords(part);
      let res = resProtected;

      res = res.replace(/o\.'|ọ'/g, 'ọ́');
      res = res.replace(/u\.'|ụ'/g, 'ụ́');
      res = res.replace(/i\.'|ị'/g, 'ị́');
      res = res.replace(/e\.'|ẹ'/g, 'ẹ́');
      res = res.replace(/O\.'|Ọ'/g, 'Ọ́');
      res = res.replace(/U\.'|Ụ'/g, 'Ụ́');
      res = res.replace(/I\.'|Ị'/g, 'Ị́');
      res = res.replace(/E\.'|Ẹ'/g, 'Ẹ́');

      res = res.replace(/o\.`|ọ`/g, 'ọ̀');
      res = res.replace(/u\.`|ụ`/g, 'ụ̀');
      res = res.replace(/i\.`|ị`/g, 'ị̀');
      res = res.replace(/e\.`|ẹ`/g, 'ẹ̀');
      res = res.replace(/O\.`|Ọ`/g, 'Ọ̀');
      res = res.replace(/U\.`|Ụ`/g, 'Ụ̀');
      res = res.replace(/I\.`|Ị`/g, 'Ị̀');
      res = res.replace(/E\.`|Ẹ`/g, 'Ẹ̀');

      res = res.replace(/o\.-|ọ-/g, 'ọ̄');
      res = res.replace(/e\.-|ẹ-/g, 'ẹ̄');
      res = res.replace(/O\.-|Ọ-/g, 'Ọ̄');
      res = res.replace(/E\.-|Ẹ-/g, 'Ẹ̄');

      res = safeReplaceUmlaut(res, 'e', 'ë', 'E', 'Ë');
      res = safeReplaceUmlaut(res, 'i', 'ï', 'I', 'Ï');
      res = safeReplaceUmlaut(res, 'u', 'ü', 'U', 'Ü');

      res = safeReplaceUnderdot(res, 'o', 'ọ');
      res = safeReplaceUnderdot(res, 'O', 'Ọ');
      res = safeReplaceUnderdot(res, 'u', 'ụ');
      res = safeReplaceUnderdot(res, 'U', 'Ụ');
      res = safeReplaceUnderdot(res, 'i', 'ị');
      res = safeReplaceUnderdot(res, 'I', 'Ị');
      res = safeReplaceUnderdot(res, 'e', 'ẹ');
      res = safeReplaceUnderdot(res, 'E', 'Ẹ');
      res = safeReplaceUnderdot(res, 's', 'ṣ');
      res = safeReplaceUnderdot(res, 'S', 'Ṣ');
      res = safeReplaceUnderdot(res, 'n', 'ṅ');
      res = safeReplaceUnderdot(res, 'N', 'Ṅ');

      res = res.replace(/n~/g, 'ñ');
      res = res.replace(/N~/g, 'Ñ');

      res = safeReplaceAcute(res, 'a', 'á', 'A', 'Á');
      res = safeReplaceAcute(res, 'e', 'é', 'E', 'É');
      res = safeReplaceAcute(res, 'i', 'í', 'I', 'Í');
      res = safeReplaceAcute(res, 'o', 'ó', 'O', 'Ó');
      res = safeReplaceAcute(res, 'u', 'ú', 'U', 'Ú');
      res = safeReplaceAcute(res, 'm', 'ḿ', 'M', 'Ḿ');
      res = safeReplaceAcute(res, 'n', 'ń', 'N', 'Ń');

      res = res.replace(/a`/g, 'à');
      res = res.replace(/e`/g, 'è');
      res = res.replace(/i`/g, 'ì');
      res = res.replace(/o`/g, 'ò');
      res = res.replace(/u`/g, 'ù');
      res = res.replace(/A`/g, 'À');
      res = res.replace(/E`/g, 'È');
      res = res.replace(/I`/g, 'Ì');
      res = res.replace(/O`/g, 'Ò');
      res = res.replace(/U`/g, 'Ù');

      res = safeReplaceMacron(res, 'a', 'ā', 'A', 'Ā');
      res = safeReplaceMacron(res, 'e', 'ē', 'E', 'Ē');
      res = safeReplaceMacron(res, 'i', 'ī', 'I', 'Ī');
      res = safeReplaceMacron(res, 'o', 'ō', 'O', 'Ō');
      res = safeReplaceMacron(res, 'u', 'ū', 'U', 'Ū');
      res = safeReplaceMacron(res, 'm', 'm̄', 'M', 'M̄');
      res = safeReplaceMacron(res, 'n', 'n̄', 'N', 'N̄');

      res = res.replace(/c,/g, 'ç');
      res = res.replace(/C,/g, 'Ç');

      res = safeReplaceCircumflex(res, 'a', 'â', 'A', 'Â');
      res = safeReplaceCircumflex(res, 'e', 'ê', 'E', 'Ê');
      res = safeReplaceCircumflex(res, 'i', 'î', 'I', 'Î');
      res = safeReplaceCircumflex(res, 'o', 'ô', 'O', 'Ô');
      res = safeReplaceCircumflex(res, 'u', 'û', 'U', 'Û');

      res = res.replace(/(?<![a-zA-Z])oe(?![a-zA-Z])/g, 'œ');
      res = res.replace(/(?<![a-zA-Z])ae(?![a-zA-Z])/g, 'æ');
      res = res.replace(/(?<![a-zA-Z])OE(?![a-zA-Z])/g, 'Œ');
      res = res.replace(/(?<![a-zA-Z])AE(?![a-zA-Z])/g, 'Æ');

      return restore(res);
    });

    return processedParts.join('');
  };

  const aTagRegex = /<A>([\s\S]*?)<\/A>|\[A\]([\s\S]*?)\[\/A\]/gi;
  return text.replace(aTagRegex, (_match, p1, p2) => {
    const rawContent = p1 !== undefined ? p1 : p2;
    return transformAccentsOnly(rawContent);
  });
}

function getLineNumber(source: string, charIndex: number): number {
  if (charIndex <= 0) return 1;
  let line = 1;
  const limit = Math.min(charIndex, source.length);
  for (let i = 0; i < limit; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function snippetAt(str: string, maxLen = 90): string {
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
}

/**
 * Validates a single pure KaTeX expression (without $ delimiters)
 * and checks website-specific latexAutoCorrect quirks.
 */
function validateMathExpression(
  rawExpr: string,
  displayMode: boolean,
  baseLine: number,
  tag: string,
  issues: PlxIssue[],
  stats: { checked: number; errors: number }
) {
  const expr = rawExpr.trim();
  if (!expr) {
    issues.push({
      severity: 'error',
      category: 'latex',
      code: 'LATEX_EMPTY_MATH',
      line: baseLine,
      tag,
      message: `Empty ${displayMode ? 'display' : 'inline'} math expression.`,
      suggestion: 'Remove empty math delimiters or add a valid LaTeX expression.',
    });
    stats.errors++;
    return;
  }

  stats.checked++;

  // 1. Check for \ce{...} (mhchem is NOT loaded in SafeMathRenderer / MathMarkdown KaTeX!)
  if (/\\ce\s*\{/.test(expr)) {
    issues.push({
      severity: 'error',
      category: 'latex',
      code: 'LATEX_UNSUPPORTED_MHCHEM',
      line: baseLine,
      tag,
      message:
        '\\ce{...} (mhchem) is NOT supported by CoLearn’s KaTeX renderer (`SafeMathRenderer` / `MathMarkdown` do not load mhchem).',
      snippet: snippetAt(expr),
      suggestion:
        'Rewrite chemical formulas using standard LaTeX math/text, e.g. `\\text{H}_2\\text{O}` and `\\rightarrow` or `\\rightleftharpoons`.',
    });
    stats.errors++;
  }

  // 2. Check for `\\` immediately followed by a letter (e.g. `\\c` in a matrix)
  // because autoCorrectMathExpression runs `m.replace(/\\\\([a-zA-Z]+)/g, '\\$1')`!
  const doubleSlashLetterMatch = /\\\\([a-zA-Z]+)/.exec(expr);
  if (doubleSlashLetterMatch) {
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_DOUBLE_BACKSLASH_COMMAND',
      line: baseLine,
      tag,
      message: `Double backslash followed immediately by letters (\`\\\\${doubleSlashLetterMatch[1]}\`) will be collapsed to \`\\${doubleSlashLetterMatch[1]}\` by CoLearn's LaTeX auto-corrector.`,
      snippet: snippetAt(expr),
      suggestion:
        'If this is a matrix/cases row break (`\\\\`), add a space or newline after `\\\\`. If this is a JSON-escaped command, use a single backslash (`\\`).',
    });
  }

  // 3. Check unbalanced curly braces in raw expression
  let depth = 0;
  let braceBroken = false;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '\\' && i + 1 < expr.length) {
      i++;
      continue;
    }
    if (expr[i] === '{') depth++;
    else if (expr[i] === '}') {
      depth--;
      if (depth < 0) {
        braceBroken = true;
        break;
      }
    }
  }
  if (braceBroken || depth !== 0) {
    issues.push({
      severity: 'error',
      category: 'latex',
      code: 'LATEX_UNBALANCED_BRACES',
      line: baseLine,
      tag,
      message:
        depth > 0
          ? `Unclosed curly brace(s) in LaTeX (${depth} missing \`}\`).`
          : 'Stray closing curly brace \`}\` without matching \`{\` in LaTeX.',
      snippet: snippetAt(expr),
      suggestion: 'Ensure every `{` has a matching `}` inside the formula.',
    });
    stats.errors++;
  }

  // 4. Check double superscript/subscript without grouping (x^2^3 or a_1_2)
  if (/[a-zA-Z0-9\}\)]+\^[0-9a-zA-Z]+\^[0-9a-zA-Z]+/.test(expr) || /[a-zA-Z0-9\}\)]+_[0-9a-zA-Z]+_[0-9a-zA-Z]+/.test(expr)) {
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_DOUBLE_SCRIPT',
      line: baseLine,
      tag,
      message: 'Double superscript or subscript without grouping braces (e.g. `x^2^3`).',
      snippet: snippetAt(expr),
      suggestion: 'Group the inner script with braces, e.g. `{x^2}^3` or `x^{2^3}`.',
    });
  }

  // 5. Check unescaped % or & outside matrix/cases/aligned
  if (/(?<!\\)%/.test(expr)) {
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_UNESCAPED_PERCENT',
      line: baseLine,
      tag,
      message: 'Unescaped `%` inside LaTeX math acts as a TeX comment and hides the rest of the formula.',
      snippet: snippetAt(expr),
      suggestion: 'Escape percentage signs inside math as `\\%`.',
    });
  }
  if (
    /(?<!\\)&/.test(expr) &&
    !/\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|align|array)\}/.test(expr)
  ) {
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_UNESCAPED_AMPERSAND',
      line: baseLine,
      tag,
      message: 'Unescaped `&` outside a matrix/aligned/cases environment.',
      snippet: snippetAt(expr),
      suggestion: 'Escape `&` as `\\&` or wrap alignment inside `\\begin{aligned}...\\end{aligned}`.',
    });
  }

  // 6. Real KaTeX validation on RAW expression
  let rawFailed = false;
  let rawErrorMsg = '';
  try {
    katex.renderToString(expr, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
      trust: true,
      output: 'html',
    });
  } catch (err: any) {
    rawFailed = true;
    rawErrorMsg = err?.message || String(err);
  }

  if (rawFailed) {
    // Also check if website's autoCorrectMathExpression rescues it
    const healed = autoCorrectMathExpression(expr);
    let healedPasses = false;
    let healedErrMsg = '';
    try {
      katex.renderToString(healed, {
        displayMode,
        throwOnError: true,
        strict: 'ignore',
        trust: true,
        output: 'html',
      });
      healedPasses = true;
    } catch (err2: any) {
      healedErrMsg = err2?.message || String(err2);
    }

    issues.push({
      severity: 'error',
      category: 'latex',
      code: healedPasses ? 'LATEX_KATEX_RAW_ERROR_HEALABLE' : 'LATEX_KATEX_PARSE_ERROR',
      line: baseLine,
      tag,
      message: healedPasses
        ? `KaTeX syntax error in source LaTeX (${rawErrorMsg}). Website auto-healer partially rewrites it to \`${healed}\`, but source should be fixed.`
        : `KaTeX parse error: ${rawErrorMsg}${healedErrMsg && healedErrMsg !== rawErrorMsg ? ` (Still fails after auto-correct: ${healedErrMsg})` : ''}`,
      snippet: snippetAt(expr),
      suggestion: healedPasses
        ? `Replace with clean LaTeX, e.g.: ${healed}`
        : 'Fix the LaTeX command, missing argument, or mismatched delimiter/environment.',
    });
    stats.errors++;
  }
}

/**
 * Validates all inline ($...$), display ($$...$$), legacy (\( \), \[ \]),
 * and bare LaTeX inside any text-bearing PLX field.
 */
function validateInlineLatexInText(
  text: string,
  baseLine: number,
  tag: string,
  issues: PlxIssue[],
  stats: { checked: number; errors: number }
) {
  if (!text) return;

  // Check for legacy \( ... \) or \[ ... \]
  if (/\\\(|\\\[/.test(text)) {
    const idx = text.search(/\\\(|\\\[/);
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_LEGACY_DELIMITERS',
      line: baseLine + getLineNumber(text, idx) - 1,
      tag,
      message: 'Found `\\(...\\)` or `\\[...\\]` delimiters. Standard PLX uses `$...$` for inline math and `<MATH>...</MATH>` (or `$$...$$`) for block math.',
      snippet: snippetAt(text.slice(Math.max(0, idx - 10), idx + 50)),
      suggestion: 'Convert `\\(...\\)` to `$...$` and `\\[...\\]` to `<MATH>...</MATH>`.',
    });
  }

  // Mask $$...$$ blocks and validate them
  const maskedLines = text.replace(/\$\$([\s\S]*?)\$\$/g, (full, inner, offset) => {
    const exprLine = baseLine + getLineNumber(text, offset) - 1;
    validateMathExpression(inner, true, exprLine, tag, issues, stats);
    // Preserve newline count so line numbers remain accurate
    return full.replace(/[^\n]/g, ' ');
  });

  // Check for unclosed $$
  const leftoverDoubleDollar = maskedLines.indexOf('$$');
  if (leftoverDoubleDollar !== -1) {
    issues.push({
      severity: 'error',
      category: 'latex',
      code: 'LATEX_UNCLOSED_DISPLAY_DOLLARS',
      line: baseLine + getLineNumber(maskedLines, leftoverDoubleDollar) - 1,
      tag,
      message: 'Unclosed `$$` display math delimiter.',
      snippet: snippetAt(maskedLines.slice(leftoverDoubleDollar)),
      suggestion: 'Close the block with `$$`, or use `<MATH>...</MATH>` for display equations.',
    });
    stats.errors++;
  }

  // Check per-line single $ delimiters (SafeMathRenderer inline math regex does NOT cross newlines!)
  const lines = maskedLines.split('\n');
  let openSingleDollarLine: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const currentLine = baseLine + i;

    // Find unescaped single $ on this line
    const dollarPositions: number[] = [];
    for (let c = 0; c < lineText.length; c++) {
      if (lineText[c] === '$' && (c === 0 || lineText[c - 1] !== '\\')) {
        if (lineText[c + 1] === '$') {
          c++; // skip $$
        } else {
          dollarPositions.push(c);
        }
      }
    }

    if (dollarPositions.length % 2 !== 0) {
      if (openSingleDollarLine === null) {
        openSingleDollarLine = currentLine;
      } else {
        // An inline $ opened on an earlier line and closed on this line -> multi-line inline math!
        issues.push({
          severity: 'error',
          category: 'latex',
          code: 'LATEX_MULTILINE_INLINE_DOLLAR',
          line: openSingleDollarLine,
          tag,
          message: `Inline \`$...$\` math starts on line ${openSingleDollarLine} and closes on line ${currentLine}. CoLearn's inline math parser (\`(?<!\\\\)\\$(?!\\$)([^\\$\\n]+?)(?<!\\\\)\\$\`) does NOT match across newlines.`,
          snippet: snippetAt(lines[openSingleDollarLine - baseLine]),
          suggestion: 'Keep inline `$...$` on a single line, or use `<MATH>...</MATH>` for multi-line equations.',
        });
        stats.errors++;
        openSingleDollarLine = null;
        continue;
      }
    }

    // Validate all paired single $...$ on this line
    for (let p = 0; p + 1 < dollarPositions.length; p += 2) {
      const start = dollarPositions[p] + 1;
      const end = dollarPositions[p + 1];
      const inner = lineText.slice(start, end);
      const trimmed = inner.trim();

      // Skip obvious currency phrases like "$50 and fee is $20" (matches SafeMathRenderer)
      if (/^\d+(?:\.\d{2})?\s+(?:and|or|plus|minus|to)\s+\d+(?:\.\d{2})?$/i.test(trimmed)) {
        continue;
      }

      validateMathExpression(inner, false, currentLine, tag, issues, stats);
    }
  }

  if (openSingleDollarLine !== null) {
    issues.push({
      severity: 'error',
      category: 'latex',
      code: 'LATEX_UNCLOSED_INLINE_DOLLAR',
      line: openSingleDollarLine,
      tag,
      message: 'Unclosed `$` inline math delimiter on this line.',
      snippet: snippetAt(lines[openSingleDollarLine - baseLine]),
      suggestion: 'Add the missing closing `$`, or escape literal currency signs as `\\$`.',
    });
    stats.errors++;
  }

  // Strip valid $...$ and check for bare unwrapped LaTeX commands in plain prose
  const plainTextOnly = maskedLines.replace(/(?<!\\)\$(?!\$)([^\$\n]+?)(?<!\\)\$/g, (m) =>
    m.replace(/[^\n]/g, ' ')
  );

  const bareCmdRegex =
    /\\(frac|dfrac|tfrac|sqrt|sum|prod|int|lim|sin|cos|tan|alpha|beta|gamma|delta|theta|pi|lambda|mu|sigma|omega|Delta|Omega|times|div|pm|leq|geq|neq|approx|infty|partial|nabla|begin)\b/g;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bareCmdRegex.exec(plainTextOnly)) !== null) {
    const cmdLine = baseLine + getLineNumber(plainTextOnly, bareMatch.index) - 1;
    issues.push({
      severity: 'warning',
      category: 'latex',
      code: 'LATEX_BARE_COMMAND',
      line: cmdLine,
      tag,
      message: `Bare LaTeX command \`\\${bareMatch[1]}\` found outside \`$...$\` or \`<MATH>\`.`,
      snippet: snippetAt(plainTextOnly.slice(Math.max(0, bareMatch.index - 15), bareMatch.index + 45)),
      suggestion: 'Explicitly wrap inline math expressions inside `$...$` or use `<MATH>...</MATH>`.',
    });
  }
}

/**
 * Checks for unclosed <B>, <I>, <U>, <A> (and bracket equivalents) in text fields
 */
function checkInlineTagBalance(text: string, baseLine: number, tag: string, issues: PlxIssue[]) {
  const inlineTags = ['B', 'I', 'U', 'A'] as const;
  for (const it of inlineTags) {
    const openRe = new RegExp(`<${it}(?:\\s[^>]*)?>`, 'gi');
    const closeRe = new RegExp(`</${it}>`, 'gi');
    const opens = [...text.matchAll(openRe)];
    const closes = [...text.matchAll(closeRe)];
    if (opens.length !== closes.length) {
      const firstMismatch = opens[0]?.index ?? closes[0]?.index ?? 0;
      issues.push({
        severity: 'error',
        category: 'syntax',
        code: 'UNBALANCED_INLINE_TAG',
        line: baseLine + getLineNumber(text, firstMismatch) - 1,
        tag,
        message: `Unbalanced inline <${it}> tag inside <${tag}> (${opens.length} opening vs ${closes.length} closing).`,
        snippet: snippetAt(text.slice(firstMismatch, firstMismatch + 60)),
        suggestion: `Ensure every <${it}> has a matching </${it}>.`,
      });
    }
  }
}

/**
 * Verifies a PLX document using the exact parsing rules of:
 * 1. src/lib/plxParser.ts (parsePlxStringToBlocks)
 * 2. src/components/NoteBuilder.tsx (handleMagicUpload + parseCSVRow + applyAccentShortcuts)
 * 3. src/pages/AdminPanel.tsx (<QUES> sheet/video importer)
 * 4. src/components/SafeMathRenderer.tsx + src/lib/latexAutoCorrect.ts + KaTeX
 */
export function verifyPlxDocument(
  rawInput: string,
  options: PlxVerifyOptions = {}
): PlxVerificationResult {
  const mode = options.mode ?? 'note';
  const checkIndentation = options.checkIndentation ?? true;
  const issues: PlxIssue[] = [];
  const mathStats = { checked: 0, errors: 0 };

  const source = typeof rawInput === 'string' ? rawInput : String(rawInput ?? '');
  const trimmed = source.trim();

  if (!trimmed) {
    issues.push({
      severity: 'error',
      category: 'structure',
      code: 'EMPTY_DOCUMENT',
      line: 1,
      message: 'PLX document is empty.',
      suggestion: 'Wrap content inside <PLX>...</PLX> with at least one supported block tag.',
    });
    return {
      valid: false,
      errors: issues,
      warnings: [],
      issues,
      summary: {
        totalBlocks: 0,
        byType: {},
        mathExpressionsChecked: 0,
        mathErrors: 0,
        questionsCount: 0,
        tablesCount: 0,
        hasRootPlxTag: false,
      },
      runtimeBlocks: [],
      noteBuilderBlocks: [],
      adminQuestions: [],
    };
  }

  // 1. Check markdown code fences wrapping output
  if (/^```/m.test(trimmed)) {
    const fenceIdx = source.indexOf('```');
    issues.push({
      severity: 'error',
      category: 'structure',
      code: 'MARKDOWN_CODE_FENCE',
      line: getLineNumber(source, fenceIdx),
      message: 'Markdown code fence (```) detected. PLX files must contain raw PLX markup without ```plx or ``` wrappers.',
      snippet: snippetAt(source.slice(fenceIdx, fenceIdx + 50)),
      suggestion: 'Remove leading and trailing ``` code fences so the file starts with <PLX> and ends with </PLX>.',
    });
  }

  // 2. Check root <PLX>...</PLX>
  const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(source);
  const hasRootPlxTag = Boolean(plxMatch);

  if (!plxMatch) {
    const hasOpen = /<PLX>/i.test(source);
    const hasClose = /<\/PLX>/i.test(source);
    issues.push({
      severity: 'error',
      category: 'structure',
      code: hasOpen ? 'MISSING_CLOSING_PLX' : hasClose ? 'MISSING_OPENING_PLX' : 'MISSING_ROOT_PLX',
      line: hasOpen ? getLineNumber(source, source.search(/<PLX>/i)) : 1,
      message: hasOpen
        ? 'Missing closing </PLX> root tag. Website upload (`handleMagicUpload` & `AdminPanel`) will reject this file.'
        : hasClose
          ? 'Missing opening <PLX> root tag.'
          : 'Missing root <PLX>...</PLX> wrapper tags. Website upload (`NoteBuilder` & `AdminPanel`) strictly requires <PLX>...</PLX>.',
      suggestion: 'Wrap the entire document starting with <PLX> on line 1 and ending with </PLX>.',
    });
  } else {
    // Check multiple <PLX> tags
    const allPlxOpens = [...source.matchAll(/<PLX>/gi)];
    if (allPlxOpens.length > 1) {
      issues.push({
        severity: 'error',
        category: 'structure',
        code: 'MULTIPLE_ROOT_PLX',
        line: getLineNumber(source, allPlxOpens[1].index || 0),
        message: 'Multiple <PLX> root tags detected. Only the first <PLX>...</PLX> block will be parsed on upload.',
        suggestion: 'Combine everything into a single <PLX>...</PLX> root container.',
      });
    }

    // Check stray content outside <PLX>...</PLX>
    const beforePlx = source.slice(0, plxMatch.index).trim();
    if (beforePlx && !beforePlx.startsWith('```')) {
      issues.push({
        severity: 'warning',
        category: 'structure',
        code: 'PREAMBLE_OUTSIDE_PLX',
        line: 1,
        message: 'Text found before the opening <PLX> tag. It will be ignored by the parser.',
        snippet: snippetAt(beforePlx),
        suggestion: 'Remove preamble text so <PLX> is the very first token in the file.',
      });
    }

    const afterPlxStart = plxMatch.index + plxMatch[0].length;
    const afterPlx = source.slice(afterPlxStart).trim();
    if (afterPlx && !afterPlx.startsWith('```')) {
      issues.push({
        severity: 'warning',
        category: 'structure',
        code: 'POSTAMBLE_OUTSIDE_PLX',
        line: getLineNumber(source, afterPlxStart),
        message: 'Text found after the closing </PLX> tag. It will be ignored by the parser.',
        snippet: snippetAt(afterPlx),
        suggestion: 'Remove trailing commentary after </PLX>.',
      });
    }
  }

  // Exact inner region used by the website parsers
  const innerOffset = plxMatch ? plxMatch.index + '<PLX>'.length : 0;
  const innerRaw = plxMatch ? plxMatch[1] : source;

  // 3. Run the exact website top-level tag regex and inspect any gaps between matched tags!
  const tagRegex =
    /<(H1|H2|TEXT|B|I|U|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  let cursor = 0;
  let matchedBlockCount = 0;
  const byType: Record<string, number> = {};
  const noteBuilderBlocks: NoteBlock[] = [];
  const adminQuestions: PlxVerificationResult['adminQuestions'] = [];
  let nbIdx = 1;

  const inspectGap = (gapText: string, gapStartOffsetInInner: number) => {
    const trimmedGap = gapText.trim();
    if (!trimmedGap) return;

    const gapLine = getLineNumber(source, innerOffset + gapStartOffsetInInner + gapText.search(/\S/));

    // Diagnose what went wrong in this unparsed gap
    const openUnknown = /<([a-zA-Z0-9_-]+)(?:\s[^>]*)?>/.exec(trimmedGap);
    if (openUnknown) {
      const foundTag = openUnknown[1];
      const upper = foundTag.toUpperCase();
      if ((SUPPORTED_TOP_LEVEL_TAGS as readonly string[]).includes(upper)) {
        // Valid tag name that didn't match tagRegex! Why? Either unclosed or invalid attribute format!
        const hasClosing = new RegExp(`</${upper}>`, 'i').test(trimmedGap);
        if (!hasClosing) {
          issues.push({
            severity: 'error',
            category: 'syntax',
            code: 'UNCLOSED_OR_MISMATCHED_TAG',
            line: gapLine,
            tag: upper,
            message: `Unclosed or mismatched <${foundTag}> tag — no matching </${foundTag}> found (or wrong attribute syntax). This block and possibly subsequent content will fail to parse.`,
            snippet: snippetAt(trimmedGap),
            suggestion: `Ensure <${upper}> has a matching </${upper}> closing tag and only uses \`="value"\` if an attribute is needed (e.g. \`<QUES ="1">\`).`,
          });
        } else {
          issues.push({
            severity: 'error',
            category: 'syntax',
            code: 'INVALID_TAG_ATTRIBUTE',
            line: gapLine,
            tag: upper,
            message: `Tag <${foundTag}> failed to match PLX parser because of unsupported attribute syntax.`,
            snippet: snippetAt(openUnknown[0]),
            suggestion: `Remove custom attributes like id="..." or class="...". Only \`<QUES ="1">\` (nameless \`="value"\`) is supported by PLX regex.`,
          });
        }
      } else {
        issues.push({
          severity: 'error',
          category: 'syntax',
          code: 'UNSUPPORTED_TAG',
          line: gapLine,
          tag: foundTag,
          message: `Unsupported top-level tag <${foundTag}>. Supported PLX tags are: ${SUPPORTED_TOP_LEVEL_TAGS.join(', ')}.`,
          snippet: snippetAt(trimmedGap),
          suggestion: `Replace <${foundTag}> with a supported PLX tag such as <H2>, <TEXT>, <LIST>, <MATH>, <TABLE>, <DIAGRAM>, or <QUES>.`,
        });
      }
    } else if (/^<\/([a-zA-Z0-9_-]+)>/i.test(trimmedGap)) {
      const closeMatch = /^<\/([a-zA-Z0-9_-]+)>/i.exec(trimmedGap)!;
      issues.push({
        severity: 'error',
        category: 'syntax',
        code: 'STRAY_CLOSING_TAG',
        line: gapLine,
        tag: closeMatch[1].toUpperCase(),
        message: `Stray closing tag </${closeMatch[1]}> without a matching opening tag.`,
        snippet: snippetAt(trimmedGap),
        suggestion: `Remove the stray </${closeMatch[1]}> or add its opening <${closeMatch[1]}> tag.`,
      });
    } else {
      issues.push({
        severity: 'error',
        category: 'structure',
        code: 'UNWRAPPED_CONTENT',
        line: gapLine,
        message: 'Text found directly inside <PLX> outside any block tag (<H1>, <H2>, <TEXT>, etc.). The website parser skips content outside block tags.',
        snippet: snippetAt(trimmedGap),
        suggestion: 'Wrap this text inside <TEXT>...</TEXT> (or <H1>/<H2>/<LIST>).',
      });
    }
  };

  while ((match = tagRegex.exec(innerRaw)) !== null) {
    if (match.index > cursor) {
      inspectGap(innerRaw.slice(cursor, match.index), cursor);
    }
    cursor = match.index + match[0].length;
    matchedBlockCount++;

    const rawTagName = match[1];
    const tagName = rawTagName.toUpperCase();
    const attr = match[2] || '';
    const rawInner = match[3];
    const tagOpenEnd = match[0].indexOf('>') + 1;
    const tagStartLine = getLineNumber(source, innerOffset + match.index);
    const contentStartLine = getLineNumber(source, innerOffset + match.index + tagOpenEnd);

    byType[tagName] = (byType[tagName] || 0) + 1;

    // Case-sensitivity compatibility check (AdminPanel uses uppercase-only [A-Z0-9_]+)
    if (rawTagName !== tagName) {
      issues.push({
        severity: 'warning',
        category: 'compatibility',
        code: 'NON_UPPERCASE_TAG',
        line: tagStartLine,
        tag: tagName,
        message: `Tag <${rawTagName}> is not uppercase. \`AdminPanel.tsx\` uses a case-sensitive uppercase regex; standardize to <${tagName}>...</${tagName}>.`,
        suggestion: `Rename <${rawTagName}>...</${rawTagName}> to <${tagName}>...</${tagName}>.`,
      });
    }

    // Check attribute space compatibility for AdminPanel (`\s+=\s*"`)
    const openTagHeader = match[0].slice(0, tagOpenEnd);
    if (attr && /<[A-Z]+\s*=/i.test(openTagHeader) && !/<[A-Z]+\s+=/i.test(openTagHeader)) {
      issues.push({
        severity: 'warning',
        category: 'compatibility',
        code: 'MISSING_SPACE_BEFORE_EQUALS',
        line: tagStartLine,
        tag: tagName,
        message: `No space before \`=\` in \`<${tagName}="${attr}">\`. \`AdminPanel.tsx\` requires a space before \`=\` (\`<${tagName} ="${attr}">\`).`,
        suggestion: `Format as \`<${tagName} ="${attr}">\`.`,
      });
    }

    // Indentation check (optional warning)
    if (checkIndentation) {
      const openLineText = source.split('\n')[tagStartLine - 1] || '';
      if (hasRootPlxTag && !openLineText.startsWith('  ')) {
        issues.push({
          severity: 'warning',
          category: 'structure',
          code: 'INDENTATION_OUTER_BLOCK',
          line: tagStartLine,
          tag: tagName,
          message: `Top-level <${tagName}> should be indented by 2 spaces inside <PLX>.`,
          suggestion: `Indent <${tagName}> and </${tagName}> with 2 spaces.`,
        });
      }
    }

    // Empty content check
    if (!rawInner.trim()) {
      issues.push({
        severity: 'error',
        category: 'structure',
        code: 'EMPTY_TAG_CONTENT',
        line: tagStartLine,
        tag: tagName,
        message: `<${tagName}> block is empty.`,
        suggestion: `Add valid content inside <${tagName}>...</${tagName}> or remove the empty tag.`,
      });
      continue;
    }

    // Strip common indentation exactly as NoteBuilder.handleMagicUpload does
    const rawLines = rawInner.split('\n');
    const nonEmptyLines = rawLines.filter((l) => l.trim().length > 0);
    const minIndent = nonEmptyLines.reduce((min, l) => {
      const m = l.match(/^(\s*)/);
      return m ? Math.min(min, m[1].length) : min;
    }, Infinity);
    const dedentedInner =
      minIndent !== Infinity && minIndent > 0
        ? rawLines.map((l) => l.slice(minIndent)).join('\n').trim()
        : rawInner.trim();

    // Also compute line number offset after leading blank lines
    const leadingNewlinesMatch = rawInner.match(/^\s*\n/);
    const effectiveContentLine = leadingNewlinesMatch
      ? contentStartLine + (rawInner.slice(0, rawInner.search(/\S/)).match(/\n/g)?.length || 0)
      : contentStartLine;

    // Check inline formatting tags balance in text tags
    if (TEXT_BEARING_TAGS.has(tagName) || tagName === 'QUES') {
      checkInlineTagBalance(dedentedInner, effectiveContentLine, tagName, issues);

      // Check for raw accent shortcuts used outside <A>...</A>
      const withoutATags = dedentedInner.replace(/<A>[\s\S]*?<\/A>|\[A\][\s\S]*?\[\/A\]/gi, '');
      const rawShorthandMatch = /\b[a-zA-Z]*(?:[ouieOU]\.[`'\-]|[ouiesnOUIESN]\.(?=[a-zA-Z]|\s|$))/.exec(
        withoutATags
      );
      if (rawShorthandMatch && !/\.com|\.ng|\.org|\.edu|e\.g\.|i\.e\./i.test(rawShorthandMatch[0])) {
        issues.push({
          severity: 'warning',
          category: 'accent',
          code: 'ACCENT_SHORTHAND_OUTSIDE_A_TAG',
          line: effectiveContentLine + getLineNumber(withoutATags, rawShorthandMatch.index) - 1,
          tag: tagName,
          message: `Possible CoLearn accent shorthand \`${rawShorthandMatch[0]}\` found outside <A>...</A>. Shorthands are ONLY compiled inside <A>...</A>.`,
          suggestion: `Wrap accented/diacritic words in <A>...</A>, e.g. <A>${rawShorthandMatch[0]}</A>.`,
        });
      }
    }

    // Tag-specific validation
    if (tagName === 'MATH') {
      if (/\$\$?/.test(dedentedInner)) {
        issues.push({
          severity: 'error',
          category: 'latex',
          code: 'DOLLAR_IN_MATH_TAG',
          line: effectiveContentLine,
          tag: 'MATH',
          message: '<MATH> block must NOT contain `$` or `$$` delimiters.',
          snippet: snippetAt(dedentedInner),
          suggestion: 'Remove `$` / `$$` inside <MATH>...</MATH> and write raw LaTeX directly.',
        });
        mathStats.errors++;
      }

      validateMathExpression(dedentedInner, true, effectiveContentLine, 'MATH', issues, mathStats);

      noteBuilderBlocks.push({
        id: String(nbIdx++),
        type: 'math',
        content: dedentedInner,
      });
    } else if (tagName === 'TABLE') {
      const tableLines = dedentedInner.split('\n').filter((r) => r.trim().length > 0);
      let hasDivider = false;
      const parsedRows: string[][] = [];

      tableLines.forEach((rowText, rIdx) => {
        const rowLine = effectiveContentLine + rIdx;
        if (isTableDividerLine(rowText)) {
          hasDivider = true;
          return;
        }
        const cells = parseNoteBuilderCsvRow(rowText);
        if (cells.length === 0) return;

        // Validate LaTeX in each cell
        cells.forEach((cell) => {
          const compiledCell = compilePlxAccentShortcuts(cell);
          validateInlineLatexInText(compiledCell, rowLine, 'TABLE', issues, mathStats);
        });

        parsedRows.push(cells.map((c) => compilePlxAccentShortcuts(c)));
      });

      if (hasDivider) {
        issues.push({
          severity: 'warning',
          category: 'table',
          code: 'TABLE_MARKDOWN_DIVIDER',
          line: effectiveContentLine,
          tag: 'TABLE',
          message: 'Markdown divider line (e.g. `|---|---|`) found inside <TABLE>. Official CoLearn PLX tables use clean CSV without divider lines.',
          suggestion: 'Remove the `|---|---|` divider row (or use comma-separated CSV rows).',
        });
      }

      if (parsedRows.length < 2) {
        issues.push({
          severity: 'warning',
          category: 'table',
          code: 'TABLE_TOO_FEW_ROWS',
          line: effectiveContentLine,
          tag: 'TABLE',
          message: `<TABLE> has only ${parsedRows.length} row(s). A table usually needs a header row and at least one data row.`,
        });
      } else {
        const expectedCols = parsedRows[0].length;
        parsedRows.forEach((row, rIdx) => {
          if (row.length !== expectedCols) {
            issues.push({
              severity: 'error',
              category: 'table',
              code: 'TABLE_COLUMN_MISMATCH',
              line: effectiveContentLine + rIdx,
              tag: 'TABLE',
              message: `Table row ${rIdx + 1} has ${row.length} column(s), expected ${expectedCols} matching the header row. (Often caused by an unquoted comma inside a CSV cell.)`,
              snippet: snippetAt(tableLines[rIdx] || ''),
              suggestion: 'Wrap cells containing commas in double quotes ("e.g., value") or use pipe `|` delimiters consistently.',
            });
          }
        });
      }

      noteBuilderBlocks.push({
        id: String(nbIdx++),
        type: 'table',
        content: JSON.stringify(parsedRows.length > 0 ? parsedRows : [['']]),
      });
    } else if (tagName === 'QUES') {
      if (mode === 'study-material') {
        issues.push({
          severity: 'warning',
          category: 'question',
          code: 'QUES_IN_STUDY_MATERIAL',
          line: tagStartLine,
          tag: 'QUES',
          message: '<QUES> tag found in study-material mode. `StudyMaterials.tsx` sets `forbidQuestionTagsInNotes: true`, which strips <QUES> blocks.',
          suggestion: 'Remove <QUES> for Study Materials, or convert to <TEXT>/<LIST> if intended as a readable example.',
        });
      }

      // Check for paired <COR>...</COR>, <INC>...</INC>, <EXP>...</EXP> (unsupported by NoteBuilder & AdminPanel!)
      if (/<\/(COR|INC|EXP)>/i.test(dedentedInner)) {
        const badPair = /<\/(COR|INC|EXP)>/i.exec(dedentedInner)!;
        issues.push({
          severity: 'error',
          category: 'question',
          code: 'QUES_PAIRED_SUBTAG_UNSUPPORTED',
          line: effectiveContentLine + getLineNumber(dedentedInner, badPair.index) - 1,
          tag: 'QUES',
          message: `Found closing </${badPair[1].toUpperCase()}> subtag. \`NoteBuilder.tsx\` and \`AdminPanel.tsx\` ONLY parse self-contained attribute syntax \`<${badPair[1].toUpperCase()} ="...">\`.`,
          suggestion: `Use attribute syntax: \`<COR ="answer">\`, \`<INC ="wrong">\`, \`<EXP ="why">\`.`,
        });
      }

      // Check for unescaped double quotes inside <COR ="...">, <INC ="...">, <EXP ="...">
      // e.g. <EXP ="He said "hello"">
      const subTagLines = dedentedInner.split('\n');
      subTagLines.forEach((line, lIdx) => {
        const subTagStart = /^\s*<(COR|INC|EXP)\s*=\s*"/i.exec(line);
        if (subTagStart) {
          const restAfterOpenQuote = line.slice(subTagStart[0].length);
          // Expected: ends with `">` (and no unescaped `"` before the final `">`)
          const firstQuoteIdx = restAfterOpenQuote.indexOf('"');
          const lastClosingIdx = restAfterOpenQuote.lastIndexOf('">');
          if (lastClosingIdx === -1) {
            issues.push({
              severity: 'error',
              category: 'question',
              code: 'QUES_SUBTAG_UNCLOSED_QUOTE',
              line: effectiveContentLine + lIdx,
              tag: subTagStart[1].toUpperCase(),
              message: `<${subTagStart[1].toUpperCase()} ="..."> is missing its closing \`">\` (or spans across multiple lines without closing).`,
              snippet: snippetAt(line),
              suggestion: `Keep <${subTagStart[1].toUpperCase()} ="..."> on one line ending with \`">\`.`,
            });
          } else if (firstQuoteIdx !== -1 && firstQuoteIdx < lastClosingIdx) {
            issues.push({
              severity: 'error',
              category: 'question',
              code: 'QUES_SUBTAG_INNER_DOUBLE_QUOTE',
              line: effectiveContentLine + lIdx,
              tag: subTagStart[1].toUpperCase(),
              message: `Inner double quote \`"\` inside <${subTagStart[1].toUpperCase()} ="..."> truncates the text at the first quote when parsed by \`([^"]*)\`.`,
              snippet: snippetAt(line),
              suggestion: `Replace inner double quotes \`"\` with single quotes \`'\` inside <${subTagStart[1].toUpperCase()} ="...">.`,
            });
          }
        }
      });

      const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(dedentedInner);
      const incMatches = [...dedentedInner.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
      const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(dedentedInner);

      const firstSubTag = dedentedInner.search(/<(COR|INC|EXP)/i);
      const questionBody =
        firstSubTag === -1 ? dedentedInner.trim() : dedentedInner.substring(0, firstSubTag).trim();

      if (!questionBody) {
        issues.push({
          severity: 'error',
          category: 'question',
          code: 'QUES_MISSING_BODY',
          line: effectiveContentLine,
          tag: 'QUES',
          message: '<QUES> has no question prompt text before <COR>/<INC>/<EXP>.',
          suggestion: 'Place the question stem before the <COR ="..."> tag.',
        });
      } else {
        // AdminPanel.tsx uses processedContent.indexOf('<') after converting <B> -> **!
        const withoutBold = questionBody.replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**');
        const ltIdx = withoutBold.indexOf('<');
        if (ltIdx !== -1) {
          const ltLine = effectiveContentLine + getLineNumber(questionBody, ltIdx) - 1;
          issues.push({
            severity: mode === 'questions' ? 'error' : 'warning',
            category: 'compatibility',
            code: 'QUES_RAW_LT_TRUNCATION',
            line: ltLine,
            tag: 'QUES',
            message:
              'Character `<` found inside <QUES> question body (e.g. `$x < 5$` or `<I>`/`<U>`). `AdminPanel.tsx` splits question text at the first `<` (`indexOf("<")`), which will truncate the question!',
            snippet: snippetAt(withoutBold.slice(Math.max(0, ltIdx - 10), ltIdx + 30)),
            suggestion:
              'Inside <QUES>, use `\\lt` instead of `<` in LaTeX (e.g. `$x \\lt 5$`), and avoid `<I>`/`<U>` inside <QUES> prompts when targeting CBT Question Sheets.',
          });
        }
      }

      const corVal = corMatch ? (corMatch[1] || corMatch[2] || '').trim() : '';
      const incVals = incMatches.map((m) => (m[1] || m[2] || '').trim()).filter(Boolean);
      const expVal = expMatch ? (expMatch[1] || expMatch[2] || '').trim() : '';

      if (!corVal) {
        issues.push({
          severity: 'error',
          category: 'question',
          code: 'QUES_MISSING_COR',
          line: effectiveContentLine,
          tag: 'QUES',
          message: '<QUES> is missing a non-empty `<COR ="...">` correct answer.',
          suggestion: 'Add `<COR ="Your correct answer">`.',
        });
      }

      if (incVals.length === 0) {
        issues.push({
          severity: 'error',
          category: 'question',
          code: 'QUES_MISSING_INC',
          line: effectiveContentLine,
          tag: 'QUES',
          message: '<QUES> has no `<INC ="...">` incorrect options.',
          suggestion: 'Add 3 `<INC ="...">` distractors.',
        });
      } else if (incVals.length > 3) {
        issues.push({
          severity: 'warning',
          category: 'question',
          code: 'QUES_TOO_MANY_INC',
          line: effectiveContentLine,
          tag: 'QUES',
          message: `<QUES> has ${incVals.length} <INC> options; \`AdminPanel.tsx\` only imports the first 3 incorrect answers.`,
          suggestion: 'Limit <INC> tags to 3 per question for consistent CBT rendering.',
        });
      }

      if (!expVal) {
        issues.push({
          severity: 'warning',
          category: 'question',
          code: 'QUES_MISSING_EXP',
          line: effectiveContentLine,
          tag: 'QUES',
          message: '<QUES> is missing an `<EXP ="...">` explanation.',
          suggestion: 'Add `<EXP ="Brief explanation of why the answer is correct">`.',
        });
      }

      // Validate inline LaTeX in all question parts
      const compiledQ = compilePlxAccentShortcuts(
        questionBody
          .replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**')
          .replace(/<I>([\s\S]*?)<\/I>/gi, '*$1*')
          .replace(/<U>([\s\S]*?)<\/U>/gi, '<u>$1</u>')
      );
      const compiledCor = compilePlxAccentShortcuts(corVal);
      const compiledIncs = incVals.map((v) => compilePlxAccentShortcuts(v));
      const compiledExp = compilePlxAccentShortcuts(expVal);

      validateInlineLatexInText(compiledQ, effectiveContentLine, 'QUES (stem)', issues, mathStats);
      if (compiledCor) {
        const corLine = corMatch
          ? effectiveContentLine + getLineNumber(dedentedInner, corMatch.index) - 1
          : effectiveContentLine;
        validateInlineLatexInText(compiledCor, corLine, 'QUES (<COR>)', issues, mathStats);
      }
      incMatches.forEach((im, idxInc) => {
        const val = compiledIncs[idxInc];
        if (val) {
          const incLine = effectiveContentLine + getLineNumber(dedentedInner, im.index || 0) - 1;
          validateInlineLatexInText(val, incLine, 'QUES (<INC>)', issues, mathStats);
        }
      });
      if (compiledExp) {
        const expLine = expMatch
          ? effectiveContentLine + getLineNumber(dedentedInner, expMatch.index) - 1
          : effectiveContentLine;
        validateInlineLatexInText(compiledExp, expLine, 'QUES (<EXP>)', issues, mathStats);
      }

      const qData = {
        question: compiledQ,
        correct: compiledCor,
        incorrect: compiledIncs,
        explanation: compiledExp,
      };
      noteBuilderBlocks.push({
        id: String(nbIdx++),
        type: 'question',
        content: JSON.stringify(qData),
        settings: attr ? { questionId: attr } : undefined,
      });

      if (questionBody && corVal) {
        adminQuestions.push({
          text: questionBody.replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**'),
          correctAnswer: corVal,
          incorrectAnswers: incVals.slice(0, 3),
          explanation: expVal,
        });
      }
    } else {
      // H1, H2, TEXT, B, I, U, LIST, ORDERED, VIDEO, DIAGRAM
      let bContent = dedentedInner
        .replace(/<B>([\s\S]*?)<\/B>/gi, '**$1**')
        .replace(/<I>([\s\S]*?)<\/I>/gi, '*$1*')
        .replace(/<U>([\s\S]*?)<\/U>/gi, '<u>$1</u>')
        .replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '**$1**')
        .replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '*$1*')
        .replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<u>$1</u>');

      if (tagName === 'B') bContent = `**${bContent}**`;
      else if (tagName === 'I') bContent = `*${bContent}*`;
      else if (tagName === 'U') bContent = `<u>${bContent}</u>`;

      if (TEXT_BEARING_TAGS.has(tagName)) {
        bContent = compilePlxAccentShortcuts(bContent);
      }

      if (tagName === 'TEXT') {
        // Check for raw markdown headings inside <TEXT>
        if (/^#{1,6}\s+/m.test(bContent)) {
          issues.push({
            severity: 'warning',
            category: 'structure',
            code: 'MARKDOWN_HEADING_IN_TEXT',
            line: effectiveContentLine,
            tag: 'TEXT',
            message: 'Markdown heading (`#` or `##`) found inside <TEXT>. Use <H1> or <H2> tags instead.',
            suggestion: 'Move headings into dedicated <H1>...</H1> or <H2>...</H2> tags.',
          });
        }
        // Check for unwrapped pipe table inside <TEXT>
        const tLines = bContent.split('\n').map((l) => l.trim()).filter(Boolean);
        if (tLines.length >= 2 && tLines.filter((l) => l.includes('|')).length >= tLines.length - 1) {
          issues.push({
            severity: 'warning',
            category: 'table',
            code: 'UNWRAPPED_PIPE_TABLE_IN_TEXT',
            line: effectiveContentLine,
            tag: 'TEXT',
            message: 'Pipe table detected inside <TEXT>. `NoteBuilder` will treat it as plain text instead of a table block.',
            suggestion: 'Wrap tabular data inside <TABLE>...</TABLE> using CSV format.',
          });
        }
      }

      if (tagName === 'LIST') {
        const listLines = bContent.split('\n').map((l) => l.trim()).filter(Boolean);
        const badItems = listLines.filter((l) => !l.startsWith('- ') && !l.startsWith('* ') && !l.startsWith('-') && !l.startsWith('*'));
        if (badItems.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'structure',
            code: 'LIST_MISSING_BULLET_PREFIX',
            line: effectiveContentLine,
            tag: 'LIST',
            message: 'Some <LIST> lines do not start with `- `. `NoteBuilder` relies on `- ` prefixes for Markdown bullets.',
            snippet: snippetAt(badItems[0]),
            suggestion: 'Prefix every item inside <LIST> with `- `.',
          });
        }
      }

      if (tagName === 'ORDERED') {
        const ordLines = bContent.split('\n').map((l) => l.trim()).filter(Boolean);
        const badItems = ordLines.filter((l) => !/^\d+\.\s+/.test(l));
        if (badItems.length > 0) {
          issues.push({
            severity: 'warning',
            category: 'structure',
            code: 'ORDERED_MISSING_NUMBER_PREFIX',
            line: effectiveContentLine,
            tag: 'ORDERED',
            message: 'Some <ORDERED> lines do not start with `1. `, `2. `, etc.',
            snippet: snippetAt(badItems[0]),
            suggestion: 'Prefix every item inside <ORDERED> with sequential numbers like `1. `, `2. `.',
          });
        }
      }

      if (tagName === 'VIDEO') {
        if (!/^https?:\/\/\S+$/i.test(bContent.trim())) {
          issues.push({
            severity: 'warning',
            category: 'structure',
            code: 'VIDEO_INVALID_URL',
            line: effectiveContentLine,
            tag: 'VIDEO',
            message: '<VIDEO> content does not look like a valid http(s) URL.',
            snippet: snippetAt(bContent),
            suggestion: 'Provide a direct YouTube or video URL inside <VIDEO>...</VIDEO>.',
          });
        }
      }

      // Validate inline LaTeX in text-bearing tags
      if (TEXT_BEARING_TAGS.has(tagName)) {
        validateInlineLatexInText(bContent, effectiveContentLine, tagName, issues, mathStats);
      }

      const typeMap: Record<string, NoteBlock['type']> = {
        H1: 'h1',
        H2: 'h2',
        TEXT: 'text',
        B: 'text',
        I: 'text',
        U: 'text',
        LIST: 'bullet-list',
        ORDERED: 'numbered-list',
        VIDEO: 'video',
        DIAGRAM: 'diagram',
      };

      noteBuilderBlocks.push({
        id: String(nbIdx++),
        type: typeMap[tagName] || 'text',
        content: bContent,
        settings: attr ? { questionId: attr } : undefined,
      });
    }
  }

  // Check trailing gap after last matched tag
  if (cursor < innerRaw.length) {
    inspectGap(innerRaw.slice(cursor), cursor);
  }

  if (matchedBlockCount === 0) {
    issues.push({
      severity: 'error',
      category: 'structure',
      code: 'NO_VALID_PLX_BLOCKS',
      line: 1,
      message: 'No valid PLX block tags (<H1>, <H2>, <TEXT>, <MATH>, <LIST>, <ORDERED>, <TABLE>, <QUES>, etc.) were parsed.',
      suggestion: 'Ensure content inside <PLX>...</PLX> uses properly closed supported PLX tags.',
    });
  }

  if (mode === 'questions' && (byType['QUES'] || 0) === 0) {
    issues.push({
      severity: 'error',
      category: 'question',
      code: 'NO_QUES_BLOCKS_IN_QUESTION_MODE',
      line: 1,
      message: 'Question mode requires at least one valid <QUES>...</QUES> block for AdminPanel import.',
    });
  }

  // Run exact runtime parser from src/lib/plxParser.ts
  const runtimeBlocks = parsePlxStringToBlocks(source, {
    forbidQuestionTagsInNotes: mode === 'study-material',
  });

  // Ensure errors sort before warnings, then by line number
  const sortedIssues = [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return a.line - b.line;
  });

  const errors = sortedIssues.filter((i) => i.severity === 'error');
  const warnings = sortedIssues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues: sortedIssues,
    summary: {
      totalBlocks: noteBuilderBlocks.length,
      byType,
      mathExpressionsChecked: mathStats.checked,
      mathErrors: mathStats.errors,
      questionsCount: byType['QUES'] || 0,
      tablesCount: byType['TABLE'] || 0,
      hasRootPlxTag,
    },
    runtimeBlocks,
    noteBuilderBlocks,
    adminQuestions,
  };
}

/**
 * Helper to check if autoCorrectLatexSyntax produces cleanly renderable KaTeX
 * for diagnostics comparison.
 */
export function previewAutoCorrectedLatex(rawText: string): string {
  return autoCorrectLatexSyntax(rawText);
}
