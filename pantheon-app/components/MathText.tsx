import React, { useMemo } from 'react';
import { Text, TextProps, TextStyle, StyleProp, StyleSheet, Platform } from 'react-native';

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ',
  'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
  'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ',
  'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ',
  't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
};

function toSuperscript(str: string): string {
  return str.split('').map(ch => SUPERSCRIPTS[ch] || ch).join('');
}

function toSubscript(str: string): string {
  return str.split('').map(ch => SUBSCRIPTS[ch] || ch).join('');
}

/**
 * Extracts balanced curly braces starting at a given index
 */
function extractBalancedBraces(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
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
  return null;
}

/**
 * Recursively parses LaTeX fractions (\frac{num}{den}, frac{num}{den}, frac(num,den), \frac 1 2, etc.) using balanced braces
 */
function processLatexFractions(str: string): string {
  let s = str;

  // 1. Handle frac(num, den) format
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*\(\s*([^,\)]+)\s*,\s*([^\)]+)\s*\)/g, (_, num, den) => {
    return `${num.trim()} / ${den.trim()}`;
  });

  // 2. Handle single character/digit fractions: \frac 1 2, frac 1 2, \frac12, frac12
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*([0-9a-zA-Z])\s*([0-9a-zA-Z])(?![0-9a-zA-Z])/g, (_, num, den) => {
    if (num === '1' && den === '2') return '½';
    if (num === '1' && den === '4') return '¼';
    if (num === '3' && den === '4') return '¾';
    if (num === '1' && den === '3') return '⅓';
    if (num === '2' && den === '3') return '⅔';
    return `${num}/${den}`;
  });

  // 3. Handle fractions with balanced braces: \frac{num}{den} or frac{num}{den}
  let result = '';
  const fracRegex = /\\?(?:frac|dfrac|tfrac)\s*\{/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = fracRegex.exec(s)) !== null) {
    const fracStart = match.index;
    const numOpen = match.index + match[0].length - 1;
    const numRes = extractBalancedBraces(s, numOpen);
    if (!numRes) {
      // If broken brace, skip past frac
      result += s.slice(lastIndex, fracStart);
      lastIndex = fracStart + match[0].length;
      continue;
    }

    let denOpen = numRes.endIndex + 1;
    while (denOpen < s.length && /\s/.test(s[denOpen])) denOpen++;

    if (s[denOpen] === '{') {
      const denRes = extractBalancedBraces(s, denOpen);
      if (denRes) {
        result += s.slice(lastIndex, fracStart);
        const num = processLatexFractions(numRes.content).trim();
        const den = processLatexFractions(denRes.content).trim();

        // Specific derivatives & common fractions
        if ((num === 'dy' || num === '\\text{dy}') && (den === 'dx' || den === '\\text{dx}')) {
          result += 'dy/dx';
        } else if ((num === 'd' || num === '\\text{d}') && (den === 'dx' || den === '\\text{dx}')) {
          result += 'd/dx';
        } else if ((num === '\\partial y' || num === '∂y') && (den === '\\partial x' || den === '∂x')) {
          result += '∂y/∂x';
        } else if (num === '1' && den === '2') {
          result += '½';
        } else if (num === '1' && den === '4') {
          result += '¼';
        } else if (num === '3' && den === '4') {
          result += '¾';
        } else if (num === '1' && den === '3') {
          result += '⅓';
        } else if (num === '2' && den === '3') {
          result += '⅔';
        } else {
          const isRadical = den.startsWith('\\sqrt') || den.startsWith('√');
          const needsNumParens = /[+\- ]/.test(num) && !num.startsWith('(') && !/^-?\d+$/.test(num);
          const needsDenParens = !isRadical && /[+\- *\/]/.test(den) && !den.startsWith('(');
          const numPart = needsNumParens ? `(${num})` : num;
          const denPart = needsDenParens ? `(${den})` : den;
          result += `${numPart} / ${denPart}`;
        }

        lastIndex = denRes.endIndex + 1;
        fracRegex.lastIndex = lastIndex;
        continue;
      }
    }

    // If no denominator brace, handle single token or value as den e.g. \frac{1}2 or \frac{1}x
    const nextTokenMatch = /^\s*([0-9a-zA-Z\(\)]+)/.exec(s.slice(numRes.endIndex + 1));
    if (nextTokenMatch) {
      result += s.slice(lastIndex, fracStart);
      const num = processLatexFractions(numRes.content).trim();
      const den = nextTokenMatch[1].trim();
      result += `${num} / ${den}`;
      lastIndex = numRes.endIndex + 1 + nextTokenMatch[0].length;
      fracRegex.lastIndex = lastIndex;
      continue;
    }

    // Fallback: just output the numerator content
    result += s.slice(lastIndex, fracStart);
    result += processLatexFractions(numRes.content).trim();
    lastIndex = numRes.endIndex + 1;
    fracRegex.lastIndex = lastIndex;
  }
  result += s.slice(lastIndex);

  // 4. Handle any remaining bare fractions like 'frac-3√(1 - 9x²)', 'frac-1/2', 'frac 3/4'
  result = result.replace(/\\?(?:frac|dfrac|tfrac)\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*(?:\\sqrt|√)/g, '$1 / √');
  result = result.replace(/\\?(?:frac|dfrac|tfrac)\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*\/\s*([a-zA-Z0-9_\(\)]+)/g, '$1 / $2');
  result = result.replace(/\\?(?:frac|dfrac|tfrac)\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s+([a-zA-Z0-9_\(\)]+)/g, '($1 / $2)');
  // Clean up any lone leftover 'frac' keyword
  result = result.replace(/\\?(?:frac|dfrac|tfrac)\s*/g, '');

  return result;
}

/**
 * Parses LaTeX square roots (\sqrt{content}, sqrt{content}, and \sqrt[n]{content}) using balanced braces
 */
function processLatexRoots(str: string): string {
  // First handle n-th roots: \sqrt[n]{...} or sqrt[n]{...}
  let s = str.replace(/\\?sqrt\[([0-9a-zA-Z]+)\]\s*\{/g, (match, root) => {
    return `__NROOT_${root}__{`;
  });

  // Balanced braces for square roots: \sqrt{...} or sqrt{...}
  let result = '';
  const rootRegex = /\\?sqrt\s*\{/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = rootRegex.exec(s)) !== null) {
    const rootStart = match.index;
    const openIndex = match.index + match[0].length - 1;
    const res = extractBalancedBraces(s, openIndex);
    if (!res) continue;

    result += s.slice(lastIndex, rootStart);
    result += `√(${processLatexRoots(res.content)})`;
    lastIndex = res.endIndex + 1;
    rootRegex.lastIndex = lastIndex;
  }
  result += s.slice(lastIndex);

  // Restore n-th roots
  result = result.replace(/__NROOT_([0-9a-zA-Z]+)__\{/g, (m, root, offset) => {
    const openIdx = offset + m.length - 1;
    const res = extractBalancedBraces(result, openIdx);
    if (res) {
      const rootSym = root === '3' ? '∛' : root === '4' ? '∜' : `${toSuperscript(root)}√`;
      return `${rootSym}(${res.content})`;
    }
    return m;
  });

  // Handle single character roots: \sqrt x or sqrt x -> √x
  result = result.replace(/\\?sqrt\s*([a-zA-Z0-9])/g, '√$1');

  return result;
}

/**
 * Converts a LaTeX math formula into clean, readable Unicode mathematical notation
 */
export function formatLatexFormula(formula: string): string {
  if (!formula) return '';
  let f = formula.trim();

  // Strip math delimiters if included
  if ((f.startsWith('$$') && f.endsWith('$$')) || (f.startsWith('\\[') && f.endsWith('\\]'))) {
    f = f.slice(2, -2).trim();
  } else if ((f.startsWith('$') && f.endsWith('$')) || (f.startsWith('\\(') && f.endsWith('\\)'))) {
    f = f.slice(1, -1).trim();
  }

  // Normalize JSON double-backslashes (e.g. \\le -> \le, \\frac -> \frac)
  f = f.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // Primes: \prime, '', ''', etc.
  f = f.replace(/\\prime\\prime\\prime/g, '‴');
  f = f.replace(/\\prime\\prime/g, '″');
  f = f.replace(/\\prime/g, '′');
  f = f.replace(/'''/g, '‴');
  f = f.replace(/''/g, '″');
  f = f.replace(/'/g, '′');

  // Remove styling tags
  f = f.replace(/\\(mathrm|mathbf|mathit|textbf|textit|text|bm|boldsymbol)\s*\{([^}]+)\}/g, '$2');
  f = f.replace(/\\left|\\right/g, '');
  f = f.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)/g, '');
  f = f.replace(/\\(?:quad|qquad|thickspace|medspace|thinspace|enspace)/g, ' ');
  f = f.replace(/\\[,;:!]/g, ' ');

  // 1. Process Fractions with Balanced Braces
  f = processLatexFractions(f);

  // 2. Handle bare fractions (e.g. 'frac-3√(1 - 9x²)', 'frac-1/...', '\frac 1 2')
  f = f.replace(/\\?frac\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*(?:\\sqrt|√)/g, '$1 / √');
  f = f.replace(/\\?frac\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*\/\s*/g, '$1 / ');
  f = f.replace(/\\?(?:frac|dfrac|tfrac)\s+([0-9a-zA-Z])\s+([0-9a-zA-Z])/g, '$1/$2');

  // 3. Process Roots with Balanced Braces
  f = processLatexRoots(f);

  // 4. Binomial coefficients: \binom{n}{k} -> (n C k)
  f = f.replace(/\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1 C $2)');

  // 5. Greek lowercase
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

  // 6. Greek uppercase
  const greekUpper: Record<string, string> = {
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
    Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
    Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  for (const [tex, sym] of Object.entries(greekUpper)) {
    f = f.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
  }

  // 7. Operators & Relations
  const symbols: Record<string, string> = {
    Longleftrightarrow: '⇔', Longrightarrow: '⇒', longleftarrow: '←',
    longrightarrow: '→', rightleftharpoons: '⇌',
    leftrightarrow: '↔', rightarrow: '→', leftarrow: '←',
    implies: '⇒', iff: '⇔',
    subseteq: '⊆', supseteq: '⊇', varnothing: '∅', emptyset: '∅',
    nexists: '∄', forall: '∀', exists: '∃',
    parallel: '∥', triangle: '△',
    iiint: '∭', iint: '∬', oint: '∮',
    approx: '≈', equiv: '≡', propto: '∝', infty: '∞',
    subset: '⊂', supset: '⊃', notin: '∉',
    cdots: '···', ldots: '...', ddots: '⋱', vdots: '⋮',
    times: '×', cdot: '·', partial: '∂', nabla: '∇',
    angle: '∠',
    leq: '≤', le: '≤', geq: '≥', ge: '≥',
    neq: '≠', ne: '≠',
    sim: '∼', circ: '°',
    pm: '±', mp: '∓', div: '÷',
    hbar: 'ħ', ell: 'ℓ', to: '→',
    cup: '∪', cap: '∩',
    neg: '¬', land: '∧', lor: '∨', perp: '⊥',
    sum: '∑', prod: '∏', int: '∫',
    in: '∈',
  };
  for (const [tex, sym] of Object.entries(symbols)) {
    f = f.replace(new RegExp('\\\\' + tex + '(?![a-zA-Z])', 'g'), sym);
  }

  // 8. Inverse Trigonometric & Logarithmic functions (e.g. cos^{-1} -> cos⁻¹, \cos^{-1} -> cos⁻¹)
  f = f.replace(/\\?(?:cos|sin|tan|sec|csc|cot)\^\{-1\}/g, (m) => {
    const base = m.replace(/\\|\^\{-1\}/g, '');
    return `${base}⁻¹`;
  });
  f = f.replace(/\\?(?:cos|sin|tan|sec|csc|cot)\^-1/g, (m) => {
    const base = m.replace(/\\|\^-1/g, '');
    return `${base}⁻¹`;
  });

  // General functions: sin, cos, tan, log, ln, lim, exp, etc.
  f = f.replace(/\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|det|dim|ker|max|min|lim)(?![a-zA-Z])/g, '$1');

  // Degree symbol: ^{\circ}, ^\circ, or \degree
  f = f.replace(/\^\{\\circ\}|\^\\circ|\\degree/g, '°');

  // 9. Superscripts with balanced braces & basic forms
  f = f.replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp));
  f = f.replace(/\^(-?[0-9a-zA-Z]+)/g, (_, exp) => toSuperscript(exp));

  // 10. Subscripts with balanced braces & basic forms
  f = f.replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub));
  f = f.replace(/_(-?[0-9a-zA-Z]+)/g, (_, sub) => toSubscript(sub));

  // 11. Vectors & Hats & Bars
  f = f.replace(/\\vec\s*\{([^{}]+)\}/g, '$1⃗');
  f = f.replace(/\\bar\s*\{([^{}]+)\}/g, '$1̄');
  f = f.replace(/\\hat\s*\{([^{}]+)\}/g, '$1̂');
  f = f.replace(/\\dot\s*\{([^{}]+)\}/g, '$1̇');
  f = f.replace(/\\ddot\s*\{([^{}]+)\}/g, '$1̈');

  // 12. Remove any remaining backslashes before words or symbols
  f = f.replace(/\\([a-zA-Z]+)/g, '$1');
  f = f.replace(/\\/g, '');

  // 13. Clean empty or stray curly braces
  f = f.replace(/\{([^{}]*)\}/g, '$1');
  f = f.replace(/[\{\}]/g, '');

  // Compress extra whitespace
  f = f.replace(/\s{2,}/g, ' ').trim();

  return f;
}

/**
 * Helper to clean any LaTeX syntax or bare math keywords (like frac, \frac, \sqrt, symbols)
 * from plain text segments that were not parsed as formal inline math blocks.
 */
function cleanPlainTextMathArtifacts(text: string): string {
  if (!text) return '';
  let str = text;

  // 1. Process any leftover fractions
  str = processLatexFractions(str);

  // 2. Process any leftover roots
  str = processLatexRoots(str);

  // 3. Common symbols mapping
  const commonSymbols: Record<string, string> = {
    '\\pm': '±', 'pm': '±',
    '\\times': '×',
    '\\div': '÷',
    '\\cdot': '·',
    '\\leq': '≤', 'le': '≤',
    '\\geq': '≥', 'ge': '≥',
    '\\neq': '≠', 'ne': '≠',
    '\\approx': '≈',
    '\\to': '→',
    '\\rightarrow': '→',
    '\\leftarrow': '←',
    '\\infty': '∞',
    '\\partial': '∂',
    '\\nabla': '∇',
    '\\degree': '°',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\theta': 'θ',
    '\\lambda': 'λ',
    '\\mu': 'μ',
    '\\pi': 'π',
    '\\sigma': 'σ',
    '\\omega': 'ω',
    '\\Delta': 'Δ',
    '\\Sigma': 'Σ',
    '\\Omega': 'Ω',
  };
  for (const [key, val] of Object.entries(commonSymbols)) {
    const escaped = key.replace(/\\/g, '\\\\');
    str = str.replace(new RegExp(escaped + '(?![a-zA-Z])', 'g'), val);
  }

  // 4. Superscripts & Subscripts in plain text
  str = str.replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp));
  str = str.replace(/\^(-?[0-9a-zA-Z]+)/g, (_, exp) => toSuperscript(exp));
  str = str.replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub));
  str = str.replace(/_(-?[0-9a-zA-Z]+)/g, (_, sub) => toSubscript(sub));

  // 5. Clean stray backslashes and braces
  str = str.replace(/\\([a-zA-Z]+)/g, '$1');
  str = str.replace(/\\/g, '');
  str = str.replace(/[\{\}]/g, '');

  return str;
}

export interface MathSegment {
  isMath: boolean;
  text: string;
}

/**
 * Splits input text into plain text segments and formatted inline math segments
 */
export function parseMathSegments(text: string): MathSegment[] {
  if (!text) return [];
  let str = String(text);

  // Normalize JSON escaped backslashes (\\frac -> \frac)
  str = str.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // Pre-wrap any naked fractions, roots or math blocks if not already wrapped in $
  // e.g. \frac{a}{b}, frac{a}{b}, \dfrac{...}{...}, \tfrac{...}{...}
  str = str.replace(/(?<!\$)(?:\\?(?:frac|dfrac|tfrac)\s*\{[^{}]+\}\s*\{[^{}]+\})(?!\$)/g, (m) => `$${m}$`);
  str = str.replace(/(?<!\$)(?:\\?(?:frac|dfrac|tfrac)\s*\([^,\)]+,\s*[^\)]+\))(?!\$)/g, (m) => `$${m}$`);
  str = str.replace(/(?<!\$)(?:\\?sqrt(?:\[[0-9a-zA-Z]+\])?\s*\{[^{}]+\})(?!\$)/g, (m) => `$${m}$`);

  const segments: MathSegment[] = [];

  // Match $$...$$, $...$, \[...\], \(...\)
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
    const rawText = segments[0].text;
    const hasLatexCommands = /\\(frac|dfrac|tfrac|sqrt|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|pm|times|div|leq|le|geq|ge|neq|ne|approx|int|sum|partial|degree|infty|to|rightarrow|in|notin|sin|cos|tan|log|ln)(?![a-zA-Z])/.test(rawText);
    const hasBareFrac = /\\?frac\s*(?:\{|\(|-?\d+|[a-zA-Z0-9_\(\)]+)/.test(rawText);
    const hasMathPrimes = /f'|f''|f'''|y'|y''|g'|g''/.test(rawText);
    const hasSubSuper = /\^[0-9a-zA-Z{]|_[0-9a-zA-Z{]|cos\^|sin\^|tan\^/.test(rawText);

    if (hasLatexCommands || hasBareFrac || hasMathPrimes || hasSubSuper) {
      return [{
        isMath: true,
        text: formatLatexFormula(rawText),
      }];
    }
  }

  return segments;
}

/**
 * Parses a string containing mixed plain text and LaTeX formulas
 * and returns the full formatted plain text representation.
 */
export function renderMathTextString(text: string): string {
  if (!text) return '';
  try {
    const segments = parseMathSegments(text);
    return segments.map(s => s.text).join('').trim();
  } catch (e) {
    return String(text);
  }
}

export interface MathTextProps extends TextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  mathStyle?: StyleProp<TextStyle>;
}

/**
 * Universal MathText component for React Native.
 * Accurately parses and renders inline and display LaTeX math with
 * elegant mathematical serif typography for formulas and variables.
 */
export function MathText({ text, style, mathStyle, ...props }: MathTextProps) {
  const segments = useMemo(() => {
    try {
      return parseMathSegments(text);
    } catch (e) {
      return [{ isMath: false, text: String(text || '') }];
    }
  }, [text]);

  return (
    <Text style={style} {...props}>
      {segments.map((seg: MathSegment, idx: number) => {
        if (seg.isMath) {
          return (
            <Text
              key={idx}
              style={[
                styles.inlineMath,
                mathStyle,
              ]}
            >
              {seg.text}
            </Text>
          );
        }
        return <Text key={idx}>{seg.text}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  inlineMath: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
  },
});
