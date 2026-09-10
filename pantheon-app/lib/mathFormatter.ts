/**
 * High-fidelity mathematical and LaTeX formatting utility for React Native text.
 * Converts LaTeX formulas, Greek letters, sub/superscripts, fractions, and symbols
 * into clean, readable Unicode text for questions and answer options.
 */

// Greek letter dictionary (lowercase & uppercase)
const GREEK_MAP: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
  epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ',
  sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
  phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

// Math symbols & operators dictionary
const SYMBOL_MAP: Record<string, string> = {
  pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷',
  approx: '≈', neq: '≠', ne: '≠', leq: '≤', le: '≤',
  geq: '≥', ge: '≥', infty: '∞', propto: '∝', sim: '∼',
  partial: '∂', nabla: '∇', to: '→', rightarrow: '→',
  leftarrow: '←', Leftarrow: '⇐', Rightarrow: '⇒',
  leftrightarrow: '↔', Leftrightarrow: '⇔',
  hbar: 'ℏ', degree: '°', circ: '°',
  forall: '∀', exists: '∃', in: '∈', notin: '∉',
  subset: '⊂', cup: '∪', cap: '∩',
  int: '∫', oint: '∮', sum: '∑', prod: '∏',
  quad: '  ', qquad: '    ', ',': ' ', ';': ' ',
};

// Superscript mapping table
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 't': 'ᵗ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'm': 'ᵐ', 'k': 'ᵏ', 'r': 'ʳ', 's': 'ˢ', 'v': 'ᵛ',
  '/': '/',
};

// Subscript mapping table
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'n': 'ₙ',
  'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'm': 'ₘ', 'p': 'ₚ',
  's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ',
};

function toSuperscript(str: string): string {
  return str.split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
}

function toSubscript(str: string): string {
  return str.split('').map(c => SUBSCRIPT_MAP[c] || c).join('');
}

/**
 * Transforms LaTeX mathematical syntax inside a single expression into formatted Unicode.
 */
function formatMathExpression(expr: string): string {
  if (!expr) return '';
  let s = expr.trim();

  // Strip enclosing math delimiters
  s = s.replace(/^\\$\\$?/, '').replace(/\\$\\$?$/, '');
  s = s.replace(/^\\\(/, '').replace(/\\\)$/, '');
  s = s.replace(/^\\\[/, '').replace(/\\\]$/, '');

  // 1. Text and font wrappers: \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, etc.
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|bm|textbf|textit)\s*\{([^}]*)\}/g, '$1');

  // 2. Bracket commands \left( \right) etc.
  s = s.replace(/\\left\s*([(\[{|])/g, '$1');
  s = s.replace(/\\right\s*([)\]}|])/g, '$1');
  s = s.replace(/\\left\./g, '');
  s = s.replace(/\\right\./g, '');

  // 3. Fractions: common single fractions, then general fractions
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{1\}\s*\{2\}/g, '½');
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{1\}\s*\{3\}/g, '⅓');
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{2\}\s*\{3\}/g, '⅔');
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{1\}\s*\{4\}/g, '¼');
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{3\}\s*\{4\}/g, '¾');

  // General fractions: \frac{a}{b} -> (a/b) or a/b
  s = s.replace(/\\(?:frac|cfrac|dfrac)\s*\{([^}]*)\}\s*\{([^}]*)\}/g, (_m, num, den) => {
    const cleanNum = formatMathExpression(num);
    const cleanDen = formatMathExpression(den);
    // If simple single tokens, use num/den without outer parens
    if (/^[a-zA-Z0-9α-ωΑ-Ω]+$/.test(cleanNum) && /^[a-zA-Z0-9α-ωΑ-Ω]+$/.test(cleanDen)) {
      return `${cleanNum}/${cleanDen}`;
    }
    return `(${cleanNum}/${cleanDen})`;
  });

  // 4. Square roots: \sqrt[n]{x} or \sqrt{x}
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^}]*)\}/g, (_m, n, content) => {
    return `${toSuperscript(n)}√(${formatMathExpression(content)})`;
  });
  s = s.replace(/\\sqrt\s*\{([^}]*)\}/g, (_m, content) => {
    const clean = formatMathExpression(content);
    if (/^[a-zA-Z0-9α-ωΑ-Ω]+$/.test(clean)) {
      return `√${clean}`;
    }
    return `√(${clean})`;
  });

  // 5. Greek letters
  for (const [key, val] of Object.entries(GREEK_MAP)) {
    const re = new RegExp(`\\\\${key}(?![a-zA-Z])`, 'g');
    s = s.replace(re, val);
  }

  // 6. Math symbols & operators
  for (const [key, val] of Object.entries(SYMBOL_MAP)) {
    const re = new RegExp(`\\\\${key}(?![a-zA-Z])`, 'g');
    s = s.replace(re, val);
  }

  // 7. Degree symbols: ^\circ or ^{\circ}
  s = s.replace(/\^\{?\\circ\}?/g, '°');

  // 8. Superscripts with braces: ^{...}
  s = s.replace(/\^\{([^}]*)\}/g, (_m, p) => toSuperscript(p));

  // Superscripts without braces: ^2, ^n, etc.
  s = s.replace(/\^([0-9a-zA-Z\+\-\=]+)/g, (_m, p) => toSuperscript(p));

  // 9. Subscripts with braces: _{...}
  s = s.replace(/_\{([^}]*)\}/g, (_m, p) => toSubscript(p));

  // Subscripts without braces: _2, _x, etc.
  s = s.replace(/_([0-9a-zA-Z\+\-\=]+)/g, (_m, p) => toSubscript(p));

  // 10. Clean residual curly braces
  s = s.replace(/\{/g, '').replace(/\}/g, '');

  // 11. Normalize multiple spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Primary function to format any question or answer option string.
 * Handles both purely mathematical strings and sentences with embedded inline LaTeX ($...$ or \(...\)).
 */
export function formatMathText(text: string): string {
  if (typeof text !== 'string') return '';
  let processed = text;

  // Clean PLX / HTML tags
  processed = processed
    .replace(/<B>([\s\S]*?)<\/B>/gi, '$1')
    .replace(/<I>([\s\S]*?)<\/I>/gi, '$1')
    .replace(/<U>([\s\S]*?)<\/U>/gi, '$1')
    .replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '$1')
    .replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '$1')
    .replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '$1')
    .replace(/<[^>]+>/g, '');

  // If the whole string is enclosed in math delimiters: $...$ or $$...$$
  const trimmed = processed.trim();
  if (
    (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
    (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length > 2) ||
    (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) ||
    (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'))
  ) {
    return formatMathExpression(trimmed);
  }

  // Handle display math blocks $$...$$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    return ' ' + formatMathExpression(math) + ' ';
  });

  // Handle inline math $...$
  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_match, math) => {
    return formatMathExpression(math);
  });

  // Handle LaTeX inline delimiters \( ... \)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
    return formatMathExpression(math);
  });

  // Handle LaTeX display delimiters \[ ... \]
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
    return ' ' + formatMathExpression(math) + ' ';
  });

  // If there are still raw unescaped LaTeX commands in text (like \theta or \frac{a}{b})
  if (/\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|Delta|Omega|frac|sqrt|times|approx|pm|to)/.test(processed)) {
    processed = formatMathExpression(processed);
  }

  return processed.trim();
}
