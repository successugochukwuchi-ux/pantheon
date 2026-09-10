import React, { useMemo } from 'react';
import { Text, TextProps, TextStyle, StyleProp } from 'react-native';

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
 * Converts a LaTeX math formula into clean, readable Unicode mathematical notation
 */
export function formatLatexFormula(formula: string): string {
  if (!formula) return '';
  let f = formula.trim();

  // Strip math delimiters if included
  if ((f.startsWith('$$') && f.endsWith('$$')) || (f.startsWith('//[') && f.endsWith('//]'))) {
    f = f.slice(2, -2).trim();
  } else if ((f.startsWith('$') && f.endsWith('$')) || (f.startsWith('\\(') && f.endsWith('\\)'))) {
    f = f.slice(1, -1).trim();
  }

  // Remove styling and formatting tags
  f = f.replace(/\\(mathrm|mathbf|mathit|textbf|textit|text|bm|boldsymbol)\s*\{([^}]+)\}/g, '$2');
  f = f.replace(/\\left|\\right/g, '');
  f = f.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)/g, '');
  f = f.replace(/\\(?:quad|qquad|thickspace|medspace|thinspace|enspace)/g, ' ');
  f = f.replace(/\\[,;:!]/g, ' ');

  // Common fraction mappings
  f = f.replace(/\\frac\s*\{1\}\s*\{2\}/g, '½');
  f = f.replace(/\\frac\s*\{1\}\s*\{4\}/g, '¼');
  f = f.replace(/\\frac\s*\{3\}\s*\{4\}/g, '¾');
  f = f.replace(/\\frac\s*\{1\}\s*\{3\}/g, '⅓');
  f = f.replace(/\\frac\s*\{2\}\s*\{3\}/g, '⅔');
  f = f.replace(/\\frac\s*\{1\}\s*\{8\}/g, '⅛');

  // Fractions recursively: \frac{a}{b} -> (a)/(b) or a/b
  let prev;
  do {
    prev = f;
    f = f.replace(/\\(?:frac|dfrac|tfrac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, num, den) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      const needsNumParens = /[+\- ]/.test(cleanNum);
      const needsDenParens = /[+\- *\/]/.test(cleanDen);
      const numPart = needsNumParens ? `(${cleanNum})` : cleanNum;
      const denPart = needsDenParens ? `(${cleanDen})` : cleanDen;
      return `${numPart}/${denPart}`;
    });
  } while (f !== prev);

  // Square roots and n-th roots
  f = f.replace(/\\sqrt\[3\]\s*\{([^{}]+)\}/g, '∛($1)');
  f = f.replace(/\\sqrt\[4\]\s*\{([^{}]+)\}/g, '∜($1)');
  f = f.replace(/\\sqrt\[([0-9a-zA-Z]+)\]\s*\{([^{}]+)\}/g, (_, root, content) => `${toSuperscript(root)}√(${content})`);
  f = f.replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)');
  f = f.replace(/\\sqrt\s*([a-zA-Z0-9])/g, '√$1');

  // Binomial: \binom{n}{k} -> (n choose k)
  f = f.replace(/\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1 C $2)');

  // Greek lowercase
  const greekLower: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
    '\\theta': 'θ', '\\vartheta': 'θ', '\\iota': 'ι', '\\kappa': 'κ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
    '\\pi': 'π', '\\varpi': 'π', '\\rho': 'ρ', '\\varrho': 'ρ',
    '\\sigma': 'σ', '\\varsigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
    '\\phi': 'φ', '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ',
    '\\omega': 'ω',
  };
  for (const [tex, sym] of Object.entries(greekLower)) {
    f = f.replace(new RegExp(tex.replace('\\', '\\\\') + '\\b', 'g'), sym);
  }

  // Greek uppercase
  const greekUpper: Record<string, string> = {
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
    '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  };
  for (const [tex, sym] of Object.entries(greekUpper)) {
    f = f.replace(new RegExp(tex.replace('\\', '\\\\') + '\\b', 'g'), sym);
  }

  // Operators & Relations
  const symbols: Record<string, string> = {
    '\\pm': '±', '\\mp': '∓', '\\times': '×', '\\cdot': '·', '\\div': '÷',
    '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥',
    '\\neq': '≠', '\\ne': '≠', '\\approx': '≈', '\\equiv': '≡',
    '\\sim': '∼', '\\propto': '∝', '\\infty': '∞', '\\circ': '°',
    '\\partial': '∂', '\\nabla': '∇', '\\hbar': 'ħ', '\\ell': 'ℓ',
    '\\to': '→', '\\rightarrow': '→', '\\longrightarrow': '→',
    '\\leftarrow': '←', '\\longleftarrow': '←', '\\leftrightarrow': '↔',
    '\\rightleftharpoons': '⇌', '\\implies': '⇒', '\\Longrightarrow': '⇒',
    '\\iff': '⇔', '\\Longleftrightarrow': '⇔',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
    '\\supset': '⊃', '\\supseteq': '⊇', '\\cup': '∪', '\\cap': '∩',
    '\\emptyset': '∅', '\\varnothing': '∅',
    '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
    '\\neg': '¬', '\\land': '∧', '\\lor': '∨',
    '\\perp': '⊥', '\\parallel': '∥', '\\angle': '∠', '\\triangle': '△',
    '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
    '\\iint': '∬', '\\iiint': '∭',
    '\\ldots': '...', '\\cdots': '···', '\\ddots': '⋱', '\\vdots': '⋮',
  };
  for (const [tex, sym] of Object.entries(symbols)) {
    f = f.replace(new RegExp(tex.replace('\\', '\\\\') + '\\b', 'g'), sym);
  }

  // Functions: sin, cos, tan, log, ln, lim, exp, etc.
  f = f.replace(/\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|det|dim|ker|max|min|lim)\b/g, '$1');

  // Superscript powers: x^{...} and x^...
  f = f.replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp));
  f = f.replace(/\^([0-9a-zA-Z\+\-\(\)]+)/g, (_, exp) => toSuperscript(exp));

  // Subscripts: x_{...} and x_...
  f = f.replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub));
  f = f.replace(/_([0-9a-zA-Z\+\-\(\)]+)/g, (_, sub) => toSubscript(sub));

  // Vectors & Hats & Bars
  f = f.replace(/\\vec\s*\{([^{}]+)\}/g, '$1⃗');
  f = f.replace(/\\bar\s*\{([^{}]+)\}/g, '$1̄');
  f = f.replace(/\\hat\s*\{([^{}]+)\}/g, '$1̂');
  f = f.replace(/\\dot\s*\{([^{}]+)\}/g, '$1̇');
  f = f.replace(/\\ddot\s*\{([^{}]+)\}/g, '$1̈');

  // Degree symbol: ^{\circ} or \degree
  f = f.replace(/\^\{\\circ\}|\\degree/g, '°');

  // Remove any remaining backslashes before words or symbols
  f = f.replace(/\\([a-zA-Z]+)/g, '$1');
  f = f.replace(/\\/g, '');

  // Clean empty or stray curly braces
  f = f.replace(/\{([^{}]*)\}/g, '$1');
  f = f.replace(/[\{\}]/g, '');

  // Compress extra whitespace
  f = f.replace(/\s{2,}/g, ' ').trim();

  return f;
}

/**
 * Parses a string containing mixed plain text and LaTeX formulas
 * (both delimited $...$, $$...$$, \(...\), \[...\], or bare LaTeX strings)
 */
export function renderMathTextString(text: string): string {
  if (!text) return '';
  let str = String(text);

  // 1. Replace display math: $$...$$ or \[...\]
  str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => ` ${formatLatexFormula(math)} `);
  str = str.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => ` ${formatLatexFormula(math)} `);

  // 2. Replace inline math: $...$ or \(...\)
  str = str.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_, math) => formatLatexFormula(math));
  str = str.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => formatLatexFormula(math));

  // 3. If there are still LaTeX commands like \frac, \sqrt, \alpha without $ delimiters:
  if (/\\(frac|sqrt|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|pm|times|div|leq|geq|neq|approx|int|sum|partial)\b/.test(str)) {
    str = formatLatexFormula(str);
  }

  // Clean stray multiple spaces
  str = str.replace(/[ \t]{2,}/g, ' ');

  return str.trim();
}

interface MathTextProps extends TextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

export function MathText({ text, style, ...props }: MathTextProps) {
  const formatted = useMemo(() => renderMathTextString(text), [text]);

  return (
    <Text style={style} {...props}>
      {formatted}
    </Text>
  );
}
