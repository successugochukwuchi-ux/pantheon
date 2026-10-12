import React, { useMemo } from 'react';
import { Text, TextProps, TextStyle, StyleProp, StyleSheet, Platform } from 'react-native';

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  '/': '⁄', '.': '⋅', '*': '⁎', '′': '′',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ',
  'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ',
  'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
  'α': 'ᵅ', 'β': 'ᵝ', 'γ': 'ᵞ', 'δ': 'ᵟ', 'ε': 'ᵋ',
  'θ': 'ᶿ', 'ι': 'ᶥ', 'φ': 'ᵠ', 'χ': 'ᵡ',
  '½': '¹⁄₂', '⅓': '¹⁄₃', '⅔': '²⁄₃', '¼': '¹⁄₄', '¾': '³⁄₄',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
  'β': 'ᵦ', 'γ': 'ᵧ', 'ρ': 'ᵨ', 'φ': 'ᵩ', 'χ': 'ᵪ',
};

// Internal markers for subscripts/superscripts that don't have dedicated Unicode codepoints
export const SUB_OPEN = '\uFFF9';
export const SUB_CLOSE = '\uFFFA';
export const SUP_OPEN = '\uFFFB';
export const SUP_CLOSE = '\uFFFC';

export function stripInternalMathMarkers(str: string): string {
  if (!str) return '';
  return str
    .replace(/\uFFF9([\s\S]*?)\uFFFA/g, '$1')
    .replace(/\uFFFB([\s\S]*?)\uFFFC/g, '^($1)');
}

export function toSuperscript(str: string): string {
  if (!str) return '';
  const cleaned = stripInternalMathMarkers(str).trim();
  if (!cleaned) return '';

  const chars = cleaned.split('');
  const allSupported = chars.every(ch => ch === ' ' || ch === ',' || SUPERSCRIPTS[ch] !== undefined);
  if (allSupported) {
    return chars.map(ch => (ch === ' ' ? '' : SUPERSCRIPTS[ch] || ch)).join('');
  }

  return `${SUP_OPEN}${cleaned}${SUP_CLOSE}`;
}

export function toSubscript(str: string): string {
  if (!str) return '';
  const cleaned = stripInternalMathMarkers(str).trim();
  if (!cleaned) return '';

  const chars = cleaned.split('');
  const allSupported = chars.every(ch => ch === ' ' || ch === ',' || SUBSCRIPTS[ch] !== undefined);
  if (allSupported) {
    return chars.map(ch => (ch === ' ' ? '' : SUBSCRIPTS[ch] || ch)).join('');
  }

  return `${SUB_OPEN}${cleaned}${SUB_CLOSE}`;
}

/**
 * Extracts balanced curly braces starting at a given index
 */
export function extractBalancedBraces(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (startIndex < 0 || startIndex >= str.length || str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '\\' && (str[i + 1] === '{' || str[i + 1] === '}')) {
      i++;
      continue;
    }
    if (str[i] === '{') {
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(startIndex + 1, i),
          endIndex: i,
        };
      }
    }
  }
  // If unclosed brace at the end of the formula, take up to the end of string
  return {
    content: str.slice(startIndex + 1),
    endIndex: str.length - 1,
  };
}

/**
 * Decodes HTML entities like &amp;, &lt;, &gt;, &quot;, &#39;, &nbsp; into real characters
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Replaces 1-argument LaTeX commands like \text{...}, \mathbf{...}, \boxed{...}, \vec{...}
 * using balanced braces so nested { ... } inside them never break parsing.
 */
function replaceOneArgCommands(
  str: string,
  cmdPattern: string,
  transform: (cmd: string, argContent: string) => string
): string {
  const regex = new RegExp(`\\\\(${cmdPattern})\\*?\\s*\\{`, 'g');
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    const startIdx = match.index;
    const cmdName = match[1];
    const openBraceIdx = match.index + match[0].length - 1;
    const extracted = extractBalancedBraces(str, openBraceIdx);
    if (!extracted) continue;

    result += str.slice(lastIndex, startIdx);
    result += transform(cmdName, extracted.content);
    lastIndex = extracted.endIndex + 1;
    regex.lastIndex = lastIndex;
  }

  result += str.slice(lastIndex);
  return result;
}

/**
 * Replaces 2-argument LaTeX commands like \frac{a}{b}, \binom{n}{k}, \overset{a}{b}, \textcolor{c}{t}
 * using balanced braces.
 */
function replaceTwoArgCommands(
  str: string,
  cmdPattern: string,
  transform: (cmd: string, arg1: string, arg2: string) => string
): string {
  const regex = new RegExp(`\\\\?(${cmdPattern})\\s*\\{`, 'g');
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(str)) !== null) {
    const startIdx = match.index;
    const fullMatch = match[0];
    const cmdName = match[1];

    // If matched without leading backslash, ensure it's not part of a longer word (e.g. "fraction")
    if (!fullMatch.startsWith('\\') && startIdx > 0 && /[a-zA-Z]/.test(str[startIdx - 1])) {
      continue;
    }

    const open1 = match.index + fullMatch.length - 1;
    const res1 = extractBalancedBraces(str, open1);
    if (!res1) continue;

    let open2 = res1.endIndex + 1;
    while (open2 < str.length && /\s/.test(str[open2])) open2++;

    if (open2 < str.length && str[open2] === '{') {
      const res2 = extractBalancedBraces(str, open2);
      if (res2) {
        result += str.slice(lastIndex, startIdx);
        result += transform(cmdName, res1.content, res2.content);
        lastIndex = res2.endIndex + 1;
        regex.lastIndex = lastIndex;
        continue;
      }
    }

    // Single-token second argument e.g. \frac{1}2 or \frac{1}x
    const nextToken = /^\s*([0-9a-zA-Z()]+)/.exec(str.slice(res1.endIndex + 1));
    if (nextToken && /^(?:frac|dfrac|tfrac|cfrac)$/.test(cmdName)) {
      result += str.slice(lastIndex, startIdx);
      result += transform(cmdName, res1.content, nextToken[1]);
      lastIndex = res1.endIndex + 1 + nextToken[0].length;
      regex.lastIndex = lastIndex;
      continue;
    }
  }

  result += str.slice(lastIndex);
  return result;
}

/**
 * Recursively parses LaTeX fractions (\frac{num}{den}, \dfrac, \tfrac, \cfrac, frac{num}{den}, etc.)
 */
function processLatexFractions(str: string, depth: number): string {
  let s = str;

  // 1. Handle frac(num, den) format
  s = s.replace(/\\?(?:frac|dfrac|tfrac|cfrac)\s*\(\s*([^,\)]+)\s*,\s*([^\)]+)\s*\)/g, (_, num, den) => {
    const n = formatLatexFormula(num, depth + 1);
    const d = formatLatexFormula(den, depth + 1);
    return `${n} / ${d}`;
  });

  // 2. Handle single character/digit fractions: \frac 1 2, frac 1 2, \frac12
  s = s.replace(/\\(?:frac|dfrac|tfrac|cfrac)\s*([0-9a-zA-Z])\s*([0-9a-zA-Z])(?![0-9a-zA-Z{])/g, (_, num, den) => {
    if (num === '1' && den === '2') return '½';
    if (num === '1' && den === '4') return '¼';
    if (num === '3' && den === '4') return '¾';
    if (num === '1' && den === '3') return '⅓';
    if (num === '2' && den === '3') return '⅔';
    return `${num}/${den}`;
  });

  // 3. Handle balanced-brace fractions: \frac{num}{den}, \dfrac{num}{den}, \tfrac{num}{den}, frac{num}{den}
  s = replaceTwoArgCommands(s, 'frac|dfrac|tfrac|cfrac', (_, rawNum, rawDen) => {
    const num = formatLatexFormula(rawNum, depth + 1).trim();
    const den = formatLatexFormula(rawDen, depth + 1).trim();

    if ((num === 'dy' || num === 'd y') && (den === 'dx' || den === 'd x')) return 'dy/dx';
    if (num === 'd' && (den === 'dx' || den === 'd x')) return 'd/dx';
    if (num === 'd' && (den === 'dt' || den === 'd t')) return 'd/dt';
    if (num === '∂y' && den === '∂x') return '∂y/∂x';
    if (num === '∂' && den === '∂x') return '∂/∂x';
    if (num === '1' && den === '2') return '½';
    if (num === '1' && den === '4') return '¼';
    if (num === '3' && den === '4') return '¾';
    if (num === '1' && den === '3') return '⅓';
    if (num === '2' && den === '3') return '⅔';

    const cleanNum = stripInternalMathMarkers(num);
    const cleanDen = stripInternalMathMarkers(den);
    const isRadicalDen = cleanDen.startsWith('√') || cleanDen.startsWith('∛') || cleanDen.startsWith('∜');
    const needsNumParens =
      /[+\-]/.test(cleanNum.slice(1)) &&
      !cleanNum.startsWith('(') &&
      !cleanNum.startsWith('[') &&
      !/^-?\d+(\.\d+)?$/.test(cleanNum);
    const needsDenParens =
      !isRadicalDen &&
      (/[+\-*/]/.test(cleanDen.slice(1)) || /\s/.test(cleanDen)) &&
      !cleanDen.startsWith('(') &&
      !cleanDen.startsWith('[') &&
      !/^-?[0-9a-zA-Z₀-₉⁰-⁹ₐ-ₓ]+$/.test(cleanDen);

    const numPart = needsNumParens ? `(${num})` : num;
    const denPart = needsDenParens ? `(${den})` : den;
    return `${numPart} / ${denPart}`;
  });

  // 4. Handle any remaining bare fraction patterns
  s = s.replace(/\\?(?:frac|dfrac|tfrac|cfrac)\s*(-?\d+|[a-zA-Z0-9_()]+)\s*(?:\\sqrt|√)/g, '$1 / √');
  s = s.replace(/\\?(?:frac|dfrac|tfrac|cfrac)\s*(-?\d+|[a-zA-Z0-9_()]+)\s*\/\s*([a-zA-Z0-9_()]+)/g, '$1 / $2');
  s = s.replace(/\\(?:frac|dfrac|tfrac|cfrac)\s+/g, '');

  return s;
}

/**
 * Recursively parses LaTeX roots (\sqrt{content}, \sqrt[n]{content}, sqrt{content}) using balanced braces
 */
function processLatexRoots(str: string, depth: number): string {
  // 1. Handle n-th roots: \sqrt[n]{...} or sqrt[n]{...}
  const nthRegex = /\\?sqrt\s*\[([^\]]+)\]\s*\{/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = nthRegex.exec(str)) !== null) {
    const startIdx = match.index;
    const fullMatch = match[0];
    if (!fullMatch.startsWith('\\') && startIdx > 0 && /[a-zA-Z]/.test(str[startIdx - 1])) {
      continue;
    }
    const rootIndexRaw = match[1].trim();
    const openBraceIdx = match.index + fullMatch.length - 1;
    const extracted = extractBalancedBraces(str, openBraceIdx);
    if (!extracted) continue;

    result += str.slice(lastIndex, startIdx);
    const formattedIndex = formatLatexFormula(rootIndexRaw, depth + 1);
    const formattedInner = formatLatexFormula(extracted.content, depth + 1);
    const rootPrefix =
      formattedIndex === '3'
        ? '∛'
        : formattedIndex === '4'
        ? '∜'
        : `${toSuperscript(formattedIndex)}√`;
    const needsParens = formattedInner.length > 1 && !formattedInner.startsWith('(');
    result += needsParens ? `${rootPrefix}(${formattedInner})` : `${rootPrefix}${formattedInner}`;
    lastIndex = extracted.endIndex + 1;
    nthRegex.lastIndex = lastIndex;
  }
  result += str.slice(lastIndex);

  // 2. Handle square roots with balanced braces: \sqrt{...} or sqrt{...}
  const sqrtRegex = /\\?sqrt\s*\{/g;
  let s2 = '';
  lastIndex = 0;
  while ((match = sqrtRegex.exec(result)) !== null) {
    const startIdx = match.index;
    const fullMatch = match[0];
    if (!fullMatch.startsWith('\\') && startIdx > 0 && /[a-zA-Z]/.test(result[startIdx - 1])) {
      continue;
    }
    const openBraceIdx = match.index + fullMatch.length - 1;
    const extracted = extractBalancedBraces(result, openBraceIdx);
    if (!extracted) continue;

    s2 += result.slice(lastIndex, startIdx);
    const formattedInner = formatLatexFormula(extracted.content, depth + 1).trim();
    const isSingleAtom = /^[0-9a-zA-Zα-ωΑ-Ω₀-₉⁰-⁹]+$/.test(stripInternalMathMarkers(formattedInner)) && formattedInner.length <= 2;
    s2 += isSingleAtom ? `√${formattedInner}` : `√(${formattedInner})`;
    lastIndex = extracted.endIndex + 1;
    sqrtRegex.lastIndex = lastIndex;
  }
  s2 += result.slice(lastIndex);

  // 3. Handle single-token roots without braces: \sqrt x, \sqrt 2
  s2 = s2.replace(/\\sqrt\s*([0-9a-zA-Zα-ωΑ-Ω])/g, '√$1');

  return s2;
}

/**
 * Processes superscripts (^{...} and ^x) and subscripts (_{...} and _x) using balanced braces
 */
function processSubAndSuperscripts(str: string, depth: number): string {
  let s = str;

  // 1. Balanced-brace superscripts: ^{...}
  let resSup = '';
  let lastIdx = 0;
  const supBraceRegex = /\^\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = supBraceRegex.exec(s)) !== null) {
    const startIdx = match.index;
    const openIdx = match.index + match[0].length - 1;
    const extracted = extractBalancedBraces(s, openIdx);
    if (!extracted) continue;

    resSup += s.slice(lastIdx, startIdx);
    const rawInner = extracted.content.trim();
    if (rawInner === '\\circ' || rawInner === '∘' || rawInner === 'o') {
      resSup += '°';
    } else if (rawInner === '\\prime' || rawInner === "'") {
      resSup += '′';
    } else if (rawInner === '\\prime\\prime' || rawInner === "''") {
      resSup += '″';
    } else {
      const formattedInner = formatLatexFormula(rawInner, depth + 1);
      resSup += toSuperscript(formattedInner);
    }
    lastIdx = extracted.endIndex + 1;
    supBraceRegex.lastIndex = lastIdx;
  }
  resSup += s.slice(lastIdx);
  s = resSup;

  // 2. Balanced-brace subscripts: _{...}
  let resSub = '';
  lastIdx = 0;
  const subBraceRegex = /_\s*\{/g;

  while ((match = subBraceRegex.exec(s)) !== null) {
    const startIdx = match.index;
    const openIdx = match.index + match[0].length - 1;
    const extracted = extractBalancedBraces(s, openIdx);
    if (!extracted) continue;

    resSub += s.slice(lastIdx, startIdx);
    const formattedInner = formatLatexFormula(extracted.content.trim(), depth + 1);
    resSub += toSubscript(formattedInner);
    lastIdx = extracted.endIndex + 1;
    subBraceRegex.lastIndex = lastIdx;
  }
  resSub += s.slice(lastIdx);
  s = resSub;

  // 3. Unbraced superscripts: ^\circ, ^\prime, ^-1, ^2, ^n, ^x
  s = s.replace(/\^\\circ\b/g, '°');
  s = s.replace(/\^\\prime\b/g, '′');
  s = s.replace(/\^(-?[0-9a-zA-Z+\-=()])/g, (_, exp) => toSuperscript(exp));

  // 4. Unbraced subscripts: _0, _1, _n, _x, _i, _y, _A
  s = s.replace(/_(-?[0-9a-zA-Z+\-=()])/g, (_, sub) => toSubscript(sub));

  return s;
}

/**
 * Formats chemical notation inside \ce{...}
 */
function formatChemicalFormula(raw: string, depth: number): string {
  let c = raw.trim();
  c = c.replace(/<=>|<-->|\\rightleftharpoons/g, ' ⇌ ');
  c = c.replace(/-->|->|\\rightarrow|\\to/g, ' → ');
  c = c.replace(/<--|<-\s*|\\leftarrow/g, ' ← ');
  c = processSubAndSuperscripts(c, depth + 1);
  // Charge notations like SO4^2- or Fe^3+
  c = c.replace(/\^(\d*[+\-])/g, (_, chg) => toSuperscript(chg));
  // Subscript numbers after element symbols: H2O -> H₂O, CO2 -> CO₂, H2SO4 -> H₂SO₄
  c = c.replace(/([A-Za-z)\]])(\d+)/g, (_, el, digits) => `${el}${toSubscript(digits)}`);
  return formatLatexFormula(c, depth + 1);
}

/**
 * Converts a LaTeX math formula into clean, readable Unicode mathematical notation
 */
export function formatLatexFormula(formula: string, depth = 0): string {
  if (!formula) return '';
  if (depth > 12) return formula;

  let f = formula.trim();

  // Strip outer math delimiters if included
  if ((f.startsWith('$$') && f.endsWith('$$')) || (f.startsWith('\\[') && f.endsWith('\\]'))) {
    f = f.slice(2, -2).trim();
  } else if ((f.startsWith('\\(') && f.endsWith('\\)'))) {
    f = f.slice(2, -2).trim();
  } else if (f.startsWith('$') && f.endsWith('$') && f.length >= 2) {
    f = f.slice(1, -1).trim();
  }

  // Decode HTML entities (&amp;, &lt;, &gt;, etc.)
  f = decodeHtmlEntities(f);

  // Normalize JSON double-escaped backslashes before LaTeX commands (e.g. \\frac -> \frac, \\theta -> \theta)
  // while preserving \\ when used as a row break (followed by space, newline, or end)
  f = f.replace(/\\\\([a-zA-Z]{2,}|[\(\[\)\]])/g, '\\$1');

  // Strip any accidental internal dollar signs
  f = f.replace(/(?<!\\)\$/g, '');
  f = f.replace(/\\\$/g, '$');

  // ── 1. Handle LaTeX Environments (\begin{...} ... \end{...}) ──
  // Cases: \begin{cases} ... \end{cases}
  f = f.replace(/\\begin\{(?:d|r)?cases\}([\s\S]*?)(?:\\end\{(?:d|r)?cases\}|$)/g, (_, content) => {
    const rows = content
      .split(/\\\\|\n/)
      .map((line: string) => {
        const parts = line.split('&').map((p: string) => formatLatexFormula(p.trim(), depth + 1)).filter(Boolean);
        return parts.join(',  ');
      })
      .filter(Boolean);
    return rows.length > 1 ? rows.map((r: string) => `{ ${r}`).join('\n') : `{ ${rows.join(' ; ')} }`;
  });

  // Aligned / Equation / Gather / Multline / Split environments
  f = f.replace(
    /\\begin\{(?:aligned|align\*?|eqnarray\*?|gather\*?|multline\*?|split|equation\*?)\}([\s\S]*?)(?:\\end\{(?:aligned|align\*?|eqnarray\*?|gather\*?|multline\*?|split|equation\*?)\}|$)/g,
    (_, content) => {
      const rows = content
        .split(/\\\\|\n/)
        .map((line: string) => {
          const cleanedLine = line.replace(/&/g, ' ').trim();
          return cleanedLine ? formatLatexFormula(cleanedLine, depth + 1) : '';
        })
        .filter(Boolean);
      return rows.join('\n');
    }
  );

  // Matrices: \begin{matrix}, \begin{pmatrix}, \begin{bmatrix}, \begin{vmatrix}, \begin{Bmatrix}, \begin{Vmatrix}
  f = f.replace(
    /\\begin\{(p|b|B|v|V|small)?matrix\}([\s\S]*?)(?:\\end\{(?:p|b|B|v|V|small)?matrix\}|$)/g,
    (_, kind, content) => {
      const openBracket = kind === 'p' ? '(' : kind === 'B' ? '{' : kind === 'v' ? '|' : kind === 'V' ? '‖' : '[';
      const closeBracket = kind === 'p' ? ')' : kind === 'B' ? '}' : kind === 'v' ? '|' : kind === 'V' ? '‖' : ']';
      const rows = content
        .split(/\\\\|\n/)
        .map((r: string) => {
          const cells = r
            .split('&')
            .map((c: string) => formatLatexFormula(c.trim(), depth + 1))
            .filter(Boolean);
          return cells.length > 0 ? `${openBracket} ${cells.join(',  ')} ${closeBracket}` : '';
        })
        .filter(Boolean);
      return rows.length > 1 ? rows.join('\n') : rows.join(' ');
    }
  );

  // Array environment: \begin{array}{cc} ... \end{array}
  f = f.replace(/\\begin\{array\}(?:\{[^{}]*\})?([\s\S]*?)(?:\\end\{array\}|$)/g, (_, content) => {
    const rows = content
      .replace(/\\hline/g, '')
      .split(/\\\\|\n/)
      .map((r: string) => {
        const cells = r
          .split('&')
          .map((c: string) => formatLatexFormula(c.trim(), depth + 1))
          .filter(Boolean);
        return cells.join('  |  ');
      })
      .filter(Boolean);
    return rows.join('\n');
  });

  // ── 2. Delimiters & Sizing Modifiers ──
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\s*\\\|/g, '‖');
  f = f.replace(/\\(?:lVert|rVert)\b/g, '‖');
  f = f.replace(/\\\|/g, '‖');
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\s*\|/g, '|');
  f = f.replace(/\\(?:lvert|rvert)\b/g, '|');
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\s*\\\{/g, '{');
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\s*\\\}/g, '}');
  f = f.replace(/\\\{/g, '__LBRACE_ESC__').replace(/\\\}/g, '__RBRACE_ESC__');
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\s*([()[\]./])/g, (_, d) => (d === '.' ? '' : d));
  f = f.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr|biggl|biggr|middle)\b/g, '');
  f = f.replace(/\\langle\b/g, '⟨').replace(/\\rangle\b/g, '⟩');
  f = f.replace(/\\lfloor\b/g, '⌊').replace(/\\rfloor\b/g, '⌋');
  f = f.replace(/\\lceil\b/g, '⌈').replace(/\\rceil\b/g, '⌉');

  // ── 3. Chemical Equations (\ce{...}) ──
  f = replaceOneArgCommands(f, 'ce', (_, content) => formatChemicalFormula(content, depth + 1));

  // ── 4. Blackboard Bold (\mathbb{R}, etc.) ──
  f = replaceOneArgCommands(f, 'mathbb', (_, content) => {
    const c = content.trim();
    const bb: Record<string, string> = {
      R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', H: 'ℍ', F: '𝔽', P: 'ℙ', E: '𝔼',
    };
    return bb[c] || formatLatexFormula(c, depth + 1);
  });
  f = f.replace(/\\mathbb\s+([RNZQCHFPE])\b/g, (_, c) => {
    const bb: Record<string, string> = {
      R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', H: 'ℍ', F: '𝔽', P: 'ℙ', E: '𝔼',
    };
    return bb[c] || c;
  });

  // ── 5. Two-Argument Commands (\binom, \overset, \underset, \stackrel, \textcolor) ──
  f = replaceTwoArgCommands(f, 'binom|dbinom|tbinom', (_, n, k) => {
    return `(${formatLatexFormula(n, depth + 1)} C ${formatLatexFormula(k, depth + 1)})`;
  });
  f = replaceTwoArgCommands(f, 'overset|stackrel', (_, top, base) => {
    const t = formatLatexFormula(top, depth + 1).trim();
    const b = formatLatexFormula(base, depth + 1).trim();
    return `${b}${toSuperscript(t)}`;
  });
  f = replaceTwoArgCommands(f, 'underset', (_, bot, base) => {
    const sub = formatLatexFormula(bot, depth + 1).trim();
    const b = formatLatexFormula(base, depth + 1).trim();
    return `${b}${toSubscript(sub)}`;
  });
  f = replaceTwoArgCommands(f, 'textcolor', (_, _color, text) => {
    return formatLatexFormula(text, depth + 1);
  });

  // ── 6. One-Argument Text, Styling, Box, Cancel, and Accent Commands (Balanced Braces) ──
  f = replaceOneArgCommands(
    f,
    'text|textbf|textit|textrm|texttt|textsf|mbox|hbox|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathfrak|mathscr|bm|boldsymbol|operatorname|boxed|cancel|bcancel|xcancel|underline',
    (_, content) => formatLatexFormula(content, depth + 1)
  );

  f = replaceOneArgCommands(f, 'vec|overrightarrow', (_, content) => `${formatLatexFormula(content, depth + 1)}\u20D7`);
  f = replaceOneArgCommands(f, 'bar|overline', (_, content) => `${formatLatexFormula(content, depth + 1)}\u0305`);
  f = replaceOneArgCommands(f, 'hat|widehat', (_, content) => `${formatLatexFormula(content, depth + 1)}\u0302`);
  f = replaceOneArgCommands(f, 'tilde|widetilde', (_, content) => `${formatLatexFormula(content, depth + 1)}\u0303`);
  f = replaceOneArgCommands(f, 'dot', (_, content) => `${formatLatexFormula(content, depth + 1)}\u0307`);
  f = replaceOneArgCommands(f, 'ddot', (_, content) => `${formatLatexFormula(content, depth + 1)}\u0308`);
  f = replaceOneArgCommands(f, 'pmod', (_, content) => ` (mod ${formatLatexFormula(content, depth + 1)})`);
  f = replaceOneArgCommands(f, 'xrightarrow', (_, content) => ` →(${formatLatexFormula(content, depth + 1)}) `);
  f = replaceOneArgCommands(f, 'xleftarrow', (_, content) => ` ←(${formatLatexFormula(content, depth + 1)}) `);
  f = replaceOneArgCommands(f, 'phantom|hphantom|vphantom|hspace|vspace|color|tag', () => ' ');

  // ── 7. Process Fractions & Roots (Recursive Balanced Braces) ──
  f = processLatexFractions(f, depth);
  f = processLatexRoots(f, depth);

  // Handle {n \choose k}
  f = f.replace(/\{([^{}]+)\\choose([^{}]+)\}/g, (_, n, k) => {
    return `(${formatLatexFormula(n, depth + 1).trim()} C ${formatLatexFormula(k, depth + 1).trim()})`;
  });

  // ── 8. Primes & Degrees ──
  f = f.replace(/\\prime\\prime\\prime/g, '‴');
  f = f.replace(/\\prime\\prime/g, '″');
  f = f.replace(/\\prime\b/g, '′');
  f = f.replace(/'''/g, '‴');
  f = f.replace(/''/g, '″');
  f = f.replace(/\^\{\\circ\}|\^\\circ\b|\\degree\b|\\circ\b/g, '°');

  // ── 9. Inverse Trig & Standard Math Functions ──
  f = f.replace(/\\?(cos|sin|tan|sec|csc|cot|sinh|cosh|tanh)\s*\^\s*\{\s*-1\s*\}/g, '$1⁻¹');
  f = f.replace(/\\?(cos|sin|tan|sec|csc|cot|sinh|cosh|tanh)\s*\^\s*-1\b/g, '$1⁻¹');
  f = f.replace(
    /\\(arcsin|arccos|arctan|arcsec|arccsc|arccot|sinh|cosh|tanh|coth|sech|csch|sin|cos|tan|csc|sec|cot|ln|log|lg|exp|det|dim|ker|im|rank|tr|trace|span|gcd|lcm|mod|bmod|max|min|sup|inf|arg|deg|Pr|hom|limsup|liminf|lim)(?![a-zA-Z])/g,
    '$1'
  );

  // ── 10. Greek Letters (Lowercase & Uppercase) ──
  const greekLower: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
    epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
    pi: 'π', varpi: 'π', rho: 'ρ', varrho: 'ρ',
    sigma: 'σ', varsigma: 'σ', tau: 'τ', upsilon: 'υ',
    phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  };
  for (const [tex, sym] of Object.entries(greekLower)) {
    f = f.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
  }

  const greekUpper: Record<string, string> = {
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
    Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
    Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  for (const [tex, sym] of Object.entries(greekUpper)) {
    f = f.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
  }

  // ── 11. Mathematical Operators, Arrows, Set & Logic Symbols ──
  const symbols: Record<string, string> = {
    Longleftrightarrow: '⇔', Longrightarrow: '⇒', Longleftarrow: '⇐',
    longleftrightarrow: '↔', longrightarrow: '→', longleftarrow: '←',
    rightleftharpoons: '⇌', leftrightharpoons: '⇌',
    leftrightarrow: '↔', rightarrow: '→', leftarrow: '←',
    Leftrightarrow: '⇔', Rightarrow: '⇒', Leftarrow: '⇐',
    mapsto: '↦', longmapsto: '↦', hookrightarrow: '↪', hookleftarrow: '↩',
    uparrow: '↑', downarrow: '↓', updownarrow: '↕',
    Uparrow: '⇑', Downarrow: '⇓', nearrow: '↗', searrow: '↘', swarrow: '↙', nwarrow: '↖',
    implies: '⇒', impliedby: '⇐', iff: '⇔', to: '→',
    subseteq: '⊆', subsetneq: '⊊', supseteq: '⊇', nsubseteq: '⊈',
    subset: '⊂', supset: '⊃', notin: '∉', ni: '∋', in: '∈',
    bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂',
    cup: '∪', cap: '∩', setminus: ' ∖ ', smallsetminus: ' ∖ ',
    varnothing: '∅', emptyset: '∅',
    nexists: '∄', forall: '∀', exists: '∃', complement: '∁',
    neg: '¬', lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨',
    oplus: '⊕', otimes: '⊗', odot: '⊙', ominus: '⊖',
    parallel: '∥', nparallel: '∦', perp: '⊥', mid: '∣', nmid: '∤',
    vdash: '⊢', models: '⊨', triangleq: '≜',
    measuredangle: '∡', angle: '∠', triangle: '△', square: '□', Box: '□', diamond: '◇', Diamond: '◇',
    therefore: '∴', because: '∵',
    iiint: '∭', iint: '∬', oint: '∮', int: '∫',
    coprod: '∐', prod: '∏', sum: '∑',
    approx: '≈', approxeq: '≈', equiv: '≡', propto: '∝', varpropto: '∝',
    simeq: '≃', backsimeq: '≃', cong: '≅', ncong: '≇', sim: '∼',
    leqslant: '≤', leq: '≤', le: '≤',
    geqslant: '≥', geq: '≥', ge: '≥',
    neq: '≠', ne: '≠', ll: '≪', gg: '≫',
    cdots: '···', ldots: '…', dots: '…', ddots: '⋱', vdots: '⋮',
    times: '×', div: '÷', cdot: '·', centerdot: '·', bullet: '•', ast: '∗', star: '⋆',
    pm: '±', mp: '∓',
    infty: '∞', partial: '∂', nabla: '∇',
    aleph: 'ℵ', hbar: 'ℏ', ell: 'ℓ', wp: '℘', Re: 'ℜ', Im: 'ℑ',
    dagger: '†', daggers: '‡', ddagger: '‡',
  };
  for (const [tex, sym] of Object.entries(symbols)) {
    f = f.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
  }

  // Handle \not= -> ≠, \not\in -> ∉, \not\equiv -> ≢, \not\subset -> ⊄
  f = f.replace(/\\not\s*=/g, '≠');
  f = f.replace(/\\not\s*(?:\\in|∈)/g, '∉');
  f = f.replace(/\\not\s*(?:\\equiv|≡)/g, '≢');
  f = f.replace(/\\not\s*(?:\\subset|⊂)/g, '⊄');
  f = f.replace(/\\not\s*(?:\\subseteq|⊆)/g, '⊈');

  // ── 12. Process Superscripts & Subscripts (Balanced Braces & Single Tokens) ──
  f = processSubAndSuperscripts(f, depth);

  // ── 13. Spacing, Layout Directives & Escaped Characters ──
  f = f.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle|limits|nolimits|nonumber|notag)\b/g, '');
  f = f.replace(/\\(?:quad|qquad|thickspace|medspace|thinspace|enspace)\b/g, ' ');
  f = f.replace(/\\[,;:! ]/g, ' ');
  f = f.replace(/\\%/g, '%').replace(/\\&/g, '&').replace(/\\#/g, '#').replace(/\\_/g, '_');

  // Handle LaTeX row breaks \\ (convert to newline)
  f = f.replace(/\\\\\s*/g, '\n');

  // Remove any remaining backslashes before words or symbols
  f = f.replace(/\\([a-zA-Z]+)/g, '$1');
  f = f.replace(/\\/g, '');

  // Clean stray unescaped curly braces
  let prevBrace = '';
  while (prevBrace !== f && /\{([^{}]*)\}/.test(f)) {
    prevBrace = f;
    f = f.replace(/\{([^{}]*)\}/g, '$1');
  }
  f = f.replace(/[{}]/g, '');

  // Restore intentionally escaped braces \{ and \}
  f = f.replace(/__LBRACE_ESC__/g, '{').replace(/__RBRACE_ESC__/g, '}');

  // Compress horizontal whitespace while preserving intentional equation newlines
  f = f
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && idx < arr.length - 1))
    .join('\n')
    .trim();

  return f;
}

/**
 * Helper to clean any LaTeX syntax or bare math keywords (like \frac, \sqrt, symbols, powers)
 * from plain text segments that were not enclosed in $...$ delimiters.
 */
export function cleanPlainTextMathArtifacts(text: string): string {
  if (!text) return '';
  let str = decodeHtmlEntities(text);

  // Normalize JSON double-escaped backslashes before LaTeX commands
  str = str.replace(/\\\\([a-zA-Z]{2,}|[\(\[\)\]])/g, '\\$1');

  // Strip stray unescaped $ signs
  str = str.replace(/(?<!\\)\$/g, '');
  str = str.replace(/\\\$/g, '$');

  // If the plain text contains any LaTeX backslash commands, braces with ^/_, or environments, run formatLatexFormula on those parts
  if (/\\[a-zA-Z]{2,}|\^\{|_\{|\^[0-9a-zA-Z+\-]|_[0-9a-zA-Z]|\b(?:frac|dfrac|tfrac|sqrt)\s*[\{(]/.test(str)) {
    // Blackboard bold sets
    str = replaceOneArgCommands(str, 'mathbb', (_, content) => {
      const c = content.trim();
      const bb: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', H: 'ℍ' };
      return bb[c] || c;
    });

    // One-arg text/box/accent commands
    str = replaceOneArgCommands(
      str,
      'text|textbf|textit|textrm|texttt|mathrm|mathbf|mathit|mathcal|bm|boldsymbol|operatorname|boxed|cancel|underline',
      (_, content) => formatLatexFormula(content)
    );
    str = replaceOneArgCommands(str, 'vec|overrightarrow', (_, content) => `${formatLatexFormula(content)}\u20D7`);
    str = replaceOneArgCommands(str, 'bar|overline', (_, content) => `${formatLatexFormula(content)}\u0305`);
    str = replaceOneArgCommands(str, 'hat|widehat', (_, content) => `${formatLatexFormula(content)}\u0302`);
    str = replaceTwoArgCommands(str, 'binom|dbinom|tbinom', (_, n, k) => `(${formatLatexFormula(n)} C ${formatLatexFormula(k)})`);

    // Fractions & Roots with balanced braces
    str = processLatexFractions(str, 0);
    str = processLatexRoots(str, 0);

    // Superscripts & Subscripts
    str = processSubAndSuperscripts(str, 0);
  }

  // Replace any remaining backslash symbols (Greek letters, operators, arrows)
  if (str.includes('\\')) {
    str = str.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*([()[\]|])/g, '$1');
    str = str.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
    str = str.replace(/\\[,;:!]/g, ' ');
    str = str.replace(/\\(?:quad|qquad)\b/g, '  ');

    const inlineSymbols: Record<string, string> = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
      zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ',
      lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ',
      sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
      Longleftrightarrow: '⇔', Longrightarrow: '⇒', Longleftarrow: '⇐',
      leftrightarrow: '↔', rightarrow: '→', leftarrow: '←',
      Leftrightarrow: '⇔', Rightarrow: '⇒', Leftarrow: '⇐',
      implies: '⇒', iff: '⇔', to: '→', mapsto: '↦', rightleftharpoons: '⇌',
      subseteq: '⊆', supseteq: '⊇', subset: '⊂', supset: '⊃', notin: '∉', in: '∈',
      cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
      forall: '∀', exists: '∃', nexists: '∄', neg: '¬', land: '∧', lor: '∨',
      leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
      approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
      pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', bullet: '•', circ: '°', degree: '°',
      infty: '∞', partial: '∂', nabla: '∇', perp: '⊥', parallel: '∥', angle: '∠', triangle: '△',
      therefore: '∴', because: '∵', int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏',
      cdots: '···', ldots: '…', dots: '…',
    };
    for (const [tex, sym] of Object.entries(inlineSymbols)) {
      str = str.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
    }

    // Strip remaining backslashes on math function names
    str = str.replace(
      /\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|det|dim|ker|max|min|sup|inf|lim)(?![a-zA-Z])/g,
      '$1'
    );
    str = str.replace(/\\([a-zA-Z]+)/g, '$1');
    str = str.replace(/\\/g, '');
  }

  // Clean stray curly braces left over from LaTeX
  str = str.replace(/\{([^{}\n]*)\}/g, '$1');

  return str;
}

export interface MathSegment {
  isMath: boolean;
  text: string;
}

/**
 * Protects currency amounts like "$50" or "$1,200.00" when followed by space + words
 * so they don't get paired with another "$" as an inline math delimiter.
 */
function protectCurrencyDollars(str: string): { text: string; restore: (s: string) => string } {
  const placeholders: string[] = [];
  // Count non-escaped single dollar signs
  const singleDollarMatches = str.match(/(?<!\\|\$)\$(?!\$)/g) || [];
  if (singleDollarMatches.length === 0) {
    return { text: str, restore: s => s };
  }

  // A currency $ is followed by digits and then immediately by end-of-line, punctuation, or whitespace + English word (not math operators or closing $)
  const processed = str.replace(
    /(?<!\\|\$)\$(\d[\d,]*(?:\.\d+)?)(?=(?:$|[.,;!?)]|\s+(?:and|or|to|for|per|each|in|of|at|from|with|was|is|are|were|million|billion|thousand|[a-zA-Z]{3,})\b)(?![^\n$]*\$))/g,
    (_, amount) => {
      const idx = placeholders.length;
      placeholders.push(`$${amount}`);
      return `@@CURR_DLR_${idx}@@`;
    }
  );

  return {
    text: processed,
    restore: (s: string) => s.replace(/@@CURR_DLR_(\d+)@@/g, (_, i) => placeholders[Number(i)] || ''),
  };
}

/**
 * Pre-wraps naked balanced-brace LaTeX commands (\frac{...}{...}, \sqrt{...}, \begin{...}...\end{...})
 * in $...$ or $$...$$ while leaving already-delimited math untouched.
 */
export function autoWrapLatexMath(text: string): string {
  if (!text) return '';

  let s = decodeHtmlEntities(String(text));

  // Normalize JSON double-escaped backslashes before LaTeX commands and delimiters
  s = s.replace(/\\\\([a-zA-Z]{2,}|[\(\[\)\]])/g, '\\$1');

  // Convert \( ... \) -> $ ... $ and \[ ... \] -> $$ ... $$
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.replace(/\s*\n\s*/g, ' ')}$`);

  // Protect existing $$...$$, $...$, and `...` spans
  const protectedChunks: string[] = [];
  const placeholder = '___PX_MTH_HLD_';

  const protect = (chunk: string) => {
    const id = `${placeholder}${protectedChunks.length}___`;
    protectedChunks.push(chunk);
    return id;
  };

  s = s.replace(/(\$\$[\s\S]+?\$\$|`[^`\n]+`)/g, m => protect(m));

  // Wrap naked top-level environments (\begin{aligned}...\end{aligned}, \begin{cases}...\end{cases}, etc.) in $$...$$
  s = s.replace(
    /\\begin\{(aligned|align\*?|eqnarray\*?|gather\*?|multline\*?|split|equation\*?|cases|dcases|rcases|(?:p|b|B|v|V|small)?matrix|array)\}[\s\S]*?\\end\{\1\}/g,
    m => protect(`$$${m}$$`)
  );

  // Protect single-line $...$ spans
  const currency = protectCurrencyDollars(s);
  s = currency.text;

  // Heal unclosed single $ on a line before protecting $...$
  s = s
    .split('\n')
    .map(line => {
      const dollars = line.match(/(?<!\\)\$/g) || [];
      if (dollars.length % 2 !== 0) {
        return `${line}$`;
      }
      return line;
    })
    .join('\n');

  s = s.replace(/\$[^\$\n]+?\$/g, m => protect(m));

  // Wrap naked balanced-brace fractions: \frac{...}{...}, \dfrac{...}{...}, \tfrac{...}{...}
  let fracWrapped = '';
  const fracRegex = /\\(?:frac|dfrac|tfrac|cfrac)\s*\{/g;
  let fMatch: RegExpExecArray | null;
  let lastIdx = 0;

  while ((fMatch = fracRegex.exec(s)) !== null) {
    const startIdx = fMatch.index;
    const open1 = fMatch.index + fMatch[0].length - 1;
    const res1 = extractBalancedBraces(s, open1);
    if (!res1) continue;

    let open2 = res1.endIndex + 1;
    while (open2 < s.length && /\s/.test(s[open2])) open2++;
    if (open2 < s.length && s[open2] === '{') {
      const res2 = extractBalancedBraces(s, open2);
      if (res2) {
        fracWrapped += s.slice(lastIdx, startIdx);
        fracWrapped += protect(`$${s.slice(startIdx, res2.endIndex + 1)}$`);
        lastIdx = res2.endIndex + 1;
        fracRegex.lastIndex = lastIdx;
        continue;
      }
    }
  }
  fracWrapped += s.slice(lastIdx);
  s = fracWrapped;

  // Wrap naked balanced-brace roots: \sqrt[n]{...} and \sqrt{...}
  let rootWrapped = '';
  const rootRegex = /\\sqrt(?:\s*\[[^\]]+\])?\s*\{/g;
  lastIdx = 0;
  while ((fMatch = rootRegex.exec(s)) !== null) {
    const startIdx = fMatch.index;
    const open1 = fMatch.index + fMatch[0].length - 1;
    const res1 = extractBalancedBraces(s, open1);
    if (!res1) continue;

    rootWrapped += s.slice(lastIdx, startIdx);
    rootWrapped += protect(`$${s.slice(startIdx, res1.endIndex + 1)}$`);
    lastIdx = res1.endIndex + 1;
    rootRegex.lastIndex = lastIdx;
  }
  rootWrapped += s.slice(lastIdx);
  s = rootWrapped;

  // Wrap naked \boxed{...}, \binom{...}{...}, \vec{...}, \overline{...}, \hat{...}
  s = replaceOneArgCommands(s, 'boxed|vec|overrightarrow|bar|overline|hat|widehat|ce', (cmd, content) =>
    protect(`$\\${cmd}{${content}}$`)
  );
  s = replaceTwoArgCommands(s, 'binom|dbinom|tbinom', (cmd, a, b) =>
    protect(`$\\${cmd}{${a}}{${b}}$`)
  );

  // Wrap naked sums, integrals, products, limits with sub/superscripts
  s = s.replace(
    /\\(?:sum|prod|int|iint|iiint|oint|lim)(?:\s*_\s*\{[^{}]*\}|\s*_[0-9a-zA-Z]+)?(?:\s*\^\s*\{[^{}]*\}|\s*\^[0-9a-zA-Z+\-]+)?/g,
    m => protect(`$${m}$`)
  );

  // Wrap naked Greek letters and common math operators
  s = s.replace(
    /(^|[^\w$\\])(\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|approx|times|div|pm|mp|cdot|leq|le|geq|ge|neq|ne|equiv|propto|infty|partial|nabla|to|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|implies|iff|forall|exists|in|notin|subset|subseteq|cup|cap|emptyset|varnothing|perp|parallel|angle|triangle|therefore|because))(?=[^\w$\\]|$)/g,
    (_, pre, sym) => `${pre}${protect(`$${sym}$`)}`
  );

  // Restore protected chunks (iteratively in case of nested protection)
  let prevRestore = '';
  while (prevRestore !== s && s.includes(placeholder)) {
    prevRestore = s;
    s = s.replace(new RegExp(`${placeholder}(\\d+)___`, 'g'), (_, idx) => {
      return protectedChunks[Number(idx)] || '';
    });
  }

  s = currency.restore(s);
  return s;
}

/**
 * Splits input text into plain text segments and formatted inline math segments
 */
export function parseMathSegments(text: string): MathSegment[] {
  if (!text) return [];
  const str = autoWrapLatexMath(String(text));

  const segments: MathSegment[] = [];
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      const plainChunk = str.slice(lastIndex, match.index);
      segments.push({
        isMath: false,
        text: cleanPlainTextMathArtifacts(plainChunk),
      });
    }
    const raw = match[0];
    segments.push({
      isMath: true,
      text: formatLatexFormula(raw),
    });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < str.length) {
    const plainChunk = str.slice(lastIndex);
    segments.push({
      isMath: false,
      text: cleanPlainTextMathArtifacts(plainChunk),
    });
  }

  // If no delimited math was found, check if entire text is a math formula
  if (segments.length === 1 && !segments[0].isMath) {
    const rawText = String(text);
    const hasLatexCommands =
      /\\(frac|dfrac|tfrac|sqrt|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|pm|times|div|leq|le|geq|ge|neq|ne|approx|int|sum|partial|degree|infty|to|rightarrow|in|notin|sin|cos|tan|log|ln)(?![a-zA-Z])/.test(
        rawText
      );
    const hasBareFrac = /\\?frac\s*(?:\{|\(|-?\d+|[a-zA-Z0-9_()]+)/.test(rawText);
    const hasMathPrimes = /f'|f''|f'''|y'|y''|g'|g''/.test(rawText);
    const hasSubSuper = /\^[0-9a-zA-Z{]|_[0-9a-zA-Z{]|cos\^|sin\^|tan\^/.test(rawText);

    if (hasLatexCommands || hasBareFrac || hasMathPrimes || hasSubSuper) {
      return [
        {
          isMath: true,
          text: formatLatexFormula(rawText),
        },
      ];
    }
  }

  return segments;
}

/**
 * Renders a formatted string that may contain internal subscript/superscript markers
 * (\uFFF9...\uFFFA for subscript, \uFFFB...\uFFFC for superscript) as nested React Native <Text> nodes.
 */
export function renderTextWithScripts(
  text: string,
  keyPrefix: string,
  baseFontSize = 15
): React.ReactNode {
  if (!text) return null;
  if (!text.includes(SUB_OPEN) && !text.includes(SUP_OPEN)) {
    return text;
  }

  const parts = text.split(/(\uFFF9[\s\S]*?\uFFFA|\uFFFB[\s\S]*?\uFFFC)/g);
  const subSize = Math.max(9.5, Math.round(baseFontSize * 0.72));

  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith(SUB_OPEN) && part.endsWith(SUB_CLOSE)) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={`${keyPrefix}-sub-${idx}`}
          style={{ fontSize: subSize, lineHeight: Math.round(baseFontSize * 1.1) }}
        >
          {inner}
        </Text>
      );
    }
    if (part.startsWith(SUP_OPEN) && part.endsWith(SUP_CLOSE)) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={`${keyPrefix}-sup-${idx}`}
          style={{ fontSize: subSize, lineHeight: Math.round(baseFontSize * 1.1) }}
        >
          ^({inner})
        </Text>
      );
    }
    return part;
  });
}

/**
 * Parses a string containing mixed plain text and LaTeX formulas
 * and returns the full formatted plain text representation.
 */
export function renderMathTextString(text: string): string {
  if (!text) return '';
  try {
    const segments = parseMathSegments(text);
    return stripInternalMathMarkers(segments.map(s => s.text).join('')).trim();
  } catch {
    return stripInternalMathMarkers(String(text));
  }
}

export interface MathTextProps extends TextProps {
  text?: string;
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  mathStyle?: StyleProp<TextStyle>;
  mathColor?: string;
}

/**
 * Universal MathText component for React Native.
 * Accurately parses and renders inline and display LaTeX math with
 * clean mathematical typography for formulas and variables.
 */
export function MathText({ text, children, style, mathStyle, mathColor, ...props }: MathTextProps) {
  const content = useMemo(() => {
    if (typeof text === 'string') return text;
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
      return children
        .map(c => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
        .join('');
    }
    if (children != null) return String(children);
    return '';
  }, [text, children]);

  const segments = useMemo(() => {
    try {
      return parseMathSegments(content);
    } catch {
      return [{ isMath: false, text: String(content || '') }];
    }
  }, [content]);

  const flatStyle = StyleSheet.flatten(style) || {};
  const baseFontSize = typeof flatStyle.fontSize === 'number' ? flatStyle.fontSize : 15;
  const inheritedColor = flatStyle.color;
  const effectiveMathColor = mathColor || inheritedColor;

  return (
    <Text style={style} {...props}>
      {segments.map((seg: MathSegment, idx: number) => {
        if (seg.isMath) {
          return (
            <Text
              key={idx}
              style={[
                styles.inlineMath,
                effectiveMathColor ? { color: effectiveMathColor } : undefined,
                mathStyle,
              ]}
            >
              {renderTextWithScripts(seg.text, `m-${idx}`, baseFontSize)}
            </Text>
          );
        }
        const parts = seg.text.split(/(\*\*[\s\S]+?\*\*)/g);
        return (
          <Text key={idx} style={inheritedColor ? { color: inheritedColor } : undefined}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return (
                  <Text
                    key={`${idx}-${pIdx}`}
                    style={[styles.boldText, inheritedColor ? { color: inheritedColor } : undefined]}
                  >
                    {renderTextWithScripts(part.slice(2, -2), `b-${idx}-${pIdx}`, baseFontSize)}
                  </Text>
                );
              }
              return (
                <Text
                  key={`${idx}-${pIdx}`}
                  style={inheritedColor ? { color: inheritedColor } : undefined}
                >
                  {renderTextWithScripts(part, `t-${idx}-${pIdx}`, baseFontSize)}
                </Text>
              );
            })}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  inlineMath: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
  },
  boldText: {
    fontWeight: '700',
  },
});

