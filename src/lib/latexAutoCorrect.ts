/**
 * CoLearn LaTeX Auto-Correction Engine
 * 
 * Automatically corrects and heals:
 * - Unclosed inline and display math delimiters (unclosed $ or $$)
 * - Missing backslashes on LaTeX commands (frac, dfrac, sqrt, alpha, beta, etc.)
 * - Unbalanced curly braces within LaTeX commands ({ ... })
 * - LaTeX environment repairs (\begin{cases}, \begin{aligned}, etc. without matching \end)
 * - Bare LaTeX formulas and expressions in plain text (wrapping in $...$)
 * - Unicode math characters to proper LaTeX equivalents (±, ×, ÷, ≤, ≥, ≠, √, etc.)
 * - Unescaped % characters inside math formulas (% -> \%)
 * - Double superscripts/subscripts (x^2^3 -> {x^2}^3)
 * - JSON serialization artifacts (\\\\frac -> \frac)
 */

/**
 * Decodes HTML entities into real characters
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
 * Replaces common Unicode mathematical characters with standard LaTeX macros
 */
export function normalizeUnicodeMathSymbols(str: string): string {
  if (!str) return '';
  return str
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/±/g, '\\pm ')
    .replace(/∓/g, '\\mp ')
    .replace(/≤/g, '\\leq ')
    .replace(/≥/g, '\\geq ')
    .replace(/≠/g, '\\neq ')
    .replace(/≈/g, '\\approx ')
    .replace(/≡/g, '\\equiv ')
    .replace(/∝/g, '\\propto ')
    .replace(/∞/g, '\\infty ')
    .replace(/√/g, '\\sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/½/g, '\\frac{1}{2}')
    .replace(/¼/g, '\\frac{1}{4}')
    .replace(/¾/g, '\\frac{3}{4}')
    .replace(/⅓/g, '\\frac{1}{3}')
    .replace(/⅔/g, '\\frac{2}{3}')
    .replace(/π/g, '\\pi ')
    .replace(/θ/g, '\\theta ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
    .replace(/δ/g, '\\delta ')
    .replace(/λ/g, '\\lambda ')
    .replace(/μ/g, '\\mu ')
    .replace(/σ/g, '\\sigma ')
    .replace(/Δ/g, '\\Delta ')
    .replace(/Ω/g, '\\Omega ')
    .replace(/∑/g, '\\sum ')
    .replace(/∫/g, '\\int ')
    .replace(/∂/g, '\\partial ')
    .replace(/∇/g, '\\nabla ')
    .replace(/([0-9]+)\s*°\s*C\b/g, (_, num) => `$${num}^\\circ\\text{C}$`)
    .replace(/([0-9]+)\s*°(?!\w)/g, (_, num) => `$${num}^\\circ$`);
}

/**
 * Extracts balanced curly braces starting from a given index
 */
export function extractBalancedBraces(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++; // skip escaped braces like \{ or \}
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
  return null;
}

/**
 * Balances curly braces inside a pure LaTeX string by ensuring every open '{'
 * has a closing '}' and removing stray un-opened '}'.
 */
export function balanceCurlyBraces(latex: string): string {
  if (!latex) return '';
  let depth = 0;
  let result = '';

  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === '\\' && i + 1 < latex.length) {
      result += ch + latex[i + 1];
      i++;
      continue;
    }
    if (ch === '{') {
      depth++;
      result += ch;
    } else if (ch === '}') {
      if (depth > 0) {
        depth--;
        result += ch;
      }
      // If depth is 0, ignore the extra stray '}'
    } else {
      result += ch;
    }
  }

  // Append any missing closing braces
  while (depth > 0) {
    result += '}';
    depth--;
  }

  return result;
}

/**
 * Normalizes all variations of LaTeX fractions (\frac, frac, \dfrac, \tfrac, frac 1 2, frac 1/2)
 * into standard \frac{num}{den} with balanced braces
 */
export function autoCorrectFractions(str: string): string {
  if (!str) return '';
  let s = str;

  // 1. Handle frac(num, den) and \frac(num, den)
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*\(\s*([^,\)]+)\s*,\s*([^\)]+)\s*\)/gi, (_, num, den) => {
    return `\\frac{${num.trim()}}{${den.trim()}}`;
  });

  // 2. Handle frac a/b or \frac a/b (e.g. frac 1/2, \frac -3/4)
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*\/\s*([a-zA-Z0-9_\(\)]+)/gi, (_, num, den) => {
    return `\\frac{${num}}{${den}}`;
  });

  // 3. Handle single character/digit fractions: \frac 1 2, frac 1 2, \frac12, frac12
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*([0-9a-zA-Z])\s*([0-9a-zA-Z])(?![0-9a-zA-Z])/gi, (_, num, den) => {
    return `\\frac{${num}}{${den}}`;
  });

  // 4. Handle balanced braces for \frac{num}{den} or frac{num}{den}
  let result = '';
  const fracRegex = /\\?(?:frac|dfrac|tfrac)\s*\{/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = fracRegex.exec(s)) !== null) {
    const fracStart = match.index;
    const numOpen = match.index + match[0].length - 1;
    const numRes = extractBalancedBraces(s, numOpen);

    if (!numRes) {
      // Unclosed numerator brace! E.g. \frac{1 or \frac{x+1
      // Find where numerator ends (next space, operator, or end of string)
      const rest = s.slice(numOpen + 1);
      const boundaryMatch = /[\s\+\-\*\=\$\n]/.exec(rest);
      const numEnd = boundaryMatch ? numOpen + 1 + boundaryMatch.index : s.length;
      const numContent = s.slice(numOpen + 1, numEnd);
      result += s.slice(lastIndex, fracStart);
      result += `\\frac{${autoCorrectFractions(numContent)}}{1}`;
      lastIndex = numEnd;
      fracRegex.lastIndex = lastIndex;
      continue;
    }

    let denOpen = numRes.endIndex + 1;
    while (denOpen < s.length && /\s/.test(s[denOpen])) denOpen++;

    if (s[denOpen] === '{') {
      const denRes = extractBalancedBraces(s, denOpen);
      if (denRes) {
        result += s.slice(lastIndex, fracStart);
        const num = autoCorrectFractions(numRes.content).trim();
        const den = autoCorrectFractions(denRes.content).trim();
        result += `\\frac{${num}}{${den}}`;
        lastIndex = denRes.endIndex + 1;
        fracRegex.lastIndex = lastIndex;
        continue;
      } else {
        // Denominator brace unclosed e.g. \frac{1}{2
        const rest = s.slice(denOpen + 1);
        const boundaryMatch = /[\s\+\-\*\=\$\n]/.exec(rest);
        const denEnd = boundaryMatch ? denOpen + 1 + boundaryMatch.index : s.length;
        const denContent = s.slice(denOpen + 1, denEnd);
        result += s.slice(lastIndex, fracStart);
        result += `\\frac{${autoCorrectFractions(numRes.content).trim()}}{${autoCorrectFractions(denContent).trim()}}`;
        lastIndex = denEnd;
        fracRegex.lastIndex = lastIndex;
        continue;
      }
    }

    // Single token denominator e.g. \frac{1}2 or \frac{1}x
    const nextTokenMatch = /^\s*([0-9a-zA-Z\(\)]+)/.exec(s.slice(numRes.endIndex + 1));
    if (nextTokenMatch) {
      result += s.slice(lastIndex, fracStart);
      const num = autoCorrectFractions(numRes.content).trim();
      const den = nextTokenMatch[1].trim();
      result += `\\frac{${num}}{${den}}`;
      lastIndex = numRes.endIndex + 1 + nextTokenMatch[0].length;
      fracRegex.lastIndex = lastIndex;
      continue;
    }

    result += s.slice(lastIndex, numRes.endIndex + 1);
    lastIndex = numRes.endIndex + 1;
  }
  result += s.slice(lastIndex);

  return result;
}

/**
 * Normalizes roots (\sqrt, sqrt, \sqrt[n]{...}) with balanced braces
 */
export function autoCorrectRoots(str: string): string {
  if (!str) return '';
  let s = str;

  // 1. Handle n-th roots: \sqrt[n]{...} or sqrt[n]{...}
  s = s.replace(/\\?sqrt\[([0-9a-zA-Z]+)\]\s*\{/gi, (_, root) => `__NROOT_${root}__{`);

  let result = '';
  const rootRegex = /\\?sqrt\s*\{/gi;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = rootRegex.exec(s)) !== null) {
    const rootStart = match.index;
    const openIndex = match.index + match[0].length - 1;
    const res = extractBalancedBraces(s, openIndex);
    if (!res) {
      // Unclosed root brace e.g. \sqrt{x+1
      const rest = s.slice(openIndex + 1);
      const boundaryMatch = /[\s\+\-\*\=\$\n]/.exec(rest);
      const rootEnd = boundaryMatch ? openIndex + 1 + boundaryMatch.index : s.length;
      result += s.slice(lastIndex, rootStart);
      result += `\\sqrt{${autoCorrectRoots(s.slice(openIndex + 1, rootEnd))}}`;
      lastIndex = rootEnd;
      rootRegex.lastIndex = lastIndex;
      continue;
    }

    result += s.slice(lastIndex, rootStart);
    result += `\\sqrt{${autoCorrectRoots(res.content)}}`;
    lastIndex = res.endIndex + 1;
    rootRegex.lastIndex = lastIndex;
  }
  result += s.slice(lastIndex);

  // Restore n-th roots
  result = result.replace(/__NROOT_([0-9a-zA-Z]+)__\{/g, (m, root, offset) => {
    const openIdx = offset + m.length - 1;
    const res = extractBalancedBraces(result, openIdx);
    if (res) {
      return `\\sqrt[${root}]{${res.content}}`;
    }
    return `\\sqrt[${root}]{`;
  });

  // Single character roots e.g. \sqrt x or sqrt x
  result = result.replace(/\\?sqrt\s*([a-zA-Z0-9])(?![a-zA-Z0-9\{])/gi, '\\sqrt{$1}');

  return result;
}

/**
 * Normalizes missing backslashes on Greek letters and mathematical operators
 */
export function autoCorrectMissingBackslashes(str: string): string {
  if (!str) return '';
  let s = str;

  // Greek letters (lowercase & uppercase)
  const greekLetters = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega';
  const greekRegex = new RegExp(`(?<![\\\\a-zA-Z0-9])(${greekLetters})(?![a-zA-Z0-9])`, 'g');
  s = s.replace(greekRegex, '\\$1');

  // Math operators & symbols
  const operators = 'times|div|pm|mp|cdot|leq|geq|neq|approx|equiv|propto|infty|partial|nabla|int|sum|prod|lim';
  const opRegex = new RegExp(`(?<![\\\\a-zA-Z0-9])(${operators})(?![a-zA-Z0-9])`, 'g');
  s = s.replace(opRegex, '\\$1');

  // Trig and log functions before parens or braces or numbers
  const funcs = 'sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp';
  const funcRegex = new RegExp(`(?<![\\\\a-zA-Z0-9])(${funcs})(?=\\s*[\\(\\{\\\\0-9a-zA-Z])`, 'g');
  s = s.replace(funcRegex, '\\$1');

  return s;
}

/**
 * Auto-corrects pure math expression (content inside $...$ or $$...$$ or pure math block)
 */
export function autoCorrectMathExpression(math: string): string {
  if (!math) return '';
  let m = math.trim();

  // Strip outer delimiters if present
  m = m.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();

  // 1. Normalize escaped backslashes from JSON stringify
  m = m.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // Strip any accidental internal dollar signs
  m = m.replace(/\$/g, '');

  // 2. Normalize Unicode symbols
  m = normalizeUnicodeMathSymbols(m);

  // 3. Normal fractions & roots
  m = autoCorrectFractions(m);
  m = autoCorrectRoots(m);

  // 4. Missing backslashes
  m = autoCorrectMissingBackslashes(m);

  // 5. Escape unescaped % signs inside math
  m = m.replace(/(?<!\\)%/g, '\\%');

  // Escape unescaped & unless inside matrix/aligned/cases environments
  if (!/\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|align|array)\}/.test(m)) {
    m = m.replace(/(?<!\\)&/g, '\\&');
  }

  // 6. Fix double superscripts / subscripts: x^2^3 -> {x^2}^3
  m = m.replace(/([a-zA-Z0-9_\}\)]+)\^([0-9a-zA-Z]+)\^([0-9a-zA-Z]+)/g, '{$1^{$2}}^{$3}');
  m = m.replace(/([a-zA-Z0-9_\}\)]+)_([0-9a-zA-Z]+)_([0-9a-zA-Z]+)/g, '{$1_{$2}}_{$3}');

  // 7. Balance curly braces
  m = balanceCurlyBraces(m);

  // 8. Clean double backslashes that were meant to be single on commands
  m = m.replace(/\\\\(frac|sqrt|alpha|beta|theta|pi|times|div|pm|leq|geq|neq|approx|infty|sum|int|text)/g, '\\$1');

  return m.trim();
}

/**
 * Repairs LaTeX environments (\begin{cases}, \begin{aligned}, etc.)
 */
export function autoRepairLatexEnvironments(text: string): string {
  if (!text) return '';
  let str = text;

  const envRegex = /\\begin\{([a-zA-Z*]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = envRegex.exec(str)) !== null) {
    const envName = match[1];
    const beginIndex = match.index;
    const endTag = `\\end{${envName}}`;
    const endIndex = str.indexOf(endTag, beginIndex);

    let envContent = '';
    let envFullLength = 0;

    if (endIndex !== -1) {
      envContent = str.slice(beginIndex + match[0].length, endIndex);
      envFullLength = (endIndex + endTag.length) - beginIndex;
    } else {
      // Missing \end{envName}: find where it ends or read to end of block
      const sliceRest = str.slice(beginIndex + match[0].length);
      const nextBreak = sliceRest.search(/\n\s*\n|(?:\.\s+[A-Z])|$$/);
      const cutAt = nextBreak !== -1 ? nextBreak : sliceRest.length;
      envContent = sliceRest.slice(0, cutAt);
      envFullLength = match[0].length + cutAt;
    }

    let cleanedContent = envContent.replace(/\$/g, '');
    cleanedContent = decodeHtmlEntities(cleanedContent);

    if (envName === 'cases') {
      cleanedContent = cleanedContent.replace(/([0-9a-zA-Z\)\}])\s*(?<!\\\\)\s+(?=(?:-?\d|[a-zA-Z0-9_\(\)]+)\s*,\s*&)/g, '$1 \\\\ ');
      cleanedContent = cleanedContent.replace(/(?<!\\\\)\s*\n\s*/g, ' \\\\ ');
    }

    const reconstructedEnv = `\\begin{${envName}}${cleanedContent}\\end{${envName}}`;

    const beforeText = str.slice(0, beginIndex);
    const prefixMatch = /(?:[a-zA-Z]\s*\([^)]*\)|[a-zA-Z])\s*=\s*$/.exec(beforeText);
    let replaceStart = beginIndex;
    let fullMathBlock = '';

    if (prefixMatch) {
      replaceStart = beginIndex - prefixMatch[0].length;
      fullMathBlock = `$$\n${prefixMatch[0]}${reconstructedEnv}\n$$`;
    } else {
      fullMathBlock = `$$\n${reconstructedEnv}\n$$`;
    }

    const isInsideDollars = beforeText.endsWith('$') || beforeText.endsWith('$$');
    if (isInsideDollars) {
      str = str.slice(0, beginIndex) + reconstructedEnv + str.slice(beginIndex + envFullLength);
      envRegex.lastIndex = beginIndex + reconstructedEnv.length;
    } else {
      str = str.slice(0, replaceStart) + fullMathBlock + str.slice(beginIndex + envFullLength);
      envRegex.lastIndex = replaceStart + fullMathBlock.length;
    }
  }

  return str;
}

/**
 * Intelligent closure and balancing for inline LaTeX dollar signs ($...$).
 * 
 * Heuristic:
 * If an opening $ is followed by math content and then encounters:
 * 1) Common English connecting words (where, when, if, is, are, and, or, for, with, then, given that, such that, in, at, to, by, of, which, as)
 * 2) Punctuation followed by space or capital letter (. , ? ! ;)
 * 3) Newlines (\n)
 * 4) End of text
 * without having found a closing $, it automatically closes the math block right before that transition.
 */
export function autoCloseInlineMathDollars(str: string): string {
  if (!str) return '';

  // Check if string contains any single dollar signs
  if (!str.includes('$')) return str;

  let result = '';
  let inMath = false;
  let inBlockMath = false;
  let mathBuffer = '';

  for (let i = 0; i < str.length; i++) {
    // Check for double dollar $$
    if (str[i] === '$' && str[i + 1] === '$') {
      if (inMath) {
        // Force close single math before double dollar
        result += '$' + autoCorrectMathExpression(mathBuffer) + '$';
        inMath = false;
        mathBuffer = '';
      }
      if (inBlockMath) {
        result += autoCorrectMathExpression(mathBuffer) + '$$';
        inBlockMath = false;
        mathBuffer = '';
      } else {
        result += '$$';
        inBlockMath = true;
      }
      i++; // skip next $
      continue;
    }

    // Check for single dollar $
    if (str[i] === '$' && (i === 0 || str[i - 1] !== '\\')) {
      if (inBlockMath) {
        // Inside block math, single $ is likely a stray or internal delimiter, just append
        mathBuffer += '$';
        continue;
      }

      if (inMath) {
        // Proper closing dollar!
        result += autoCorrectMathExpression(mathBuffer) + '$';
        inMath = false;
        mathBuffer = '';
      } else {
        // Opening dollar!
        result += '$';
        inMath = true;
        mathBuffer = '';
      }
      continue;
    }

    if (inMath) {
      // Check if we hit an obvious boundary indicating an unclosed $
      const rest = str.slice(i);
      
      // 1. Boundary: newline
      if (str[i] === '\n') {
        result += autoCorrectMathExpression(mathBuffer) + '$\n';
        inMath = false;
        mathBuffer = '';
        continue;
      }

      // 2. Boundary: sentence punctuation followed by space (. , ; ? !)
      const punctMatch = /^[,\.;\?!]\s+/.exec(rest);
      if (punctMatch && mathBuffer.trim().length > 0) {
        result += autoCorrectMathExpression(mathBuffer) + '$';
        inMath = false;
        mathBuffer = '';
        result += str[i];
        continue;
      }

      // 3. Boundary: common English transition words
      const englishTransitionMatch = /^\s+(where|when|if|is|are|was|were|and|or|for|with|then|such that|given that|given|in|at|to|by|of|which|as|find|calculate|determine|solve|evaluate|hence|therefore)\b/i.exec(rest);
      if (englishTransitionMatch && mathBuffer.trim().length > 0) {
        result += autoCorrectMathExpression(mathBuffer) + '$';
        inMath = false;
        mathBuffer = '';
        result += str[i];
        continue;
      }

      mathBuffer += str[i];
    } else if (inBlockMath) {
      mathBuffer += str[i];
    } else {
      result += str[i];
    }
  }

  // If still in math at the end of the string, auto-close!
  if (inMath) {
    result += autoCorrectMathExpression(mathBuffer) + '$';
  } else if (inBlockMath) {
    result += autoCorrectMathExpression(mathBuffer) + '$$';
  }

  return result;
}

/**
 * Wraps bare, undelimited LaTeX commands and mathematical expressions in $...$
 * using a strict tokenized approach that guarantees no nested dollar signs ($...$...$)
 * can ever be created.
 */
export function wrapBareLatexInDollars(plainText: string): string {
  if (!plainText) return '';
  let str = plainText;

  // 1. Normalize fractions and roots first
  str = autoCorrectFractions(str);
  str = autoCorrectRoots(str);

  const tokens: string[] = [];
  const makeToken = (math: string) => {
    const idx = tokens.length;
    tokens.push(math);
    return `___COLEARN_MATH_TOKEN_${idx}___`;
  };

  // 2. Tokenize any existing valid math blocks ($$..$$ and $..$)
  let s = str.replace(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g, (m) => {
    const isBlock = m.startsWith('$$');
    const inner = isBlock ? m.slice(2, -2) : m.slice(1, -1);
    const cleaned = autoCorrectMathExpression(inner);
    return makeToken(isBlock ? `$$${cleaned}$$` : `$${cleaned}$`);
  });

  // 3. Tokenize complete balanced fractions: \frac{...}{...}
  s = s.replace(/(\\frac\{[^{}]+\}\s*\{[^{}]+\})/gi, (_, frac) => {
    return makeToken(`$${frac}$`);
  });

  // 4. Tokenize complete square roots: \sqrt{...} or \sqrt[n]{...}
  s = s.replace(/(\\sqrt(?:\[[0-9a-zA-Z]+\])?\{[^{}]+\})/gi, (_, sqrt) => {
    return makeToken(`$${sqrt}$`);
  });

  // 5. Tokenize trig/log functions with arguments: e.g. \sin\theta = 0.5, \cos^2\theta, \log_2(x)
  const trigRegex = /\\(?:sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp)(?:\^[0-9a-zA-Z]+|\^\{[^{}]+\}|_[0-9a-zA-Z]+|_\{\w+\})?\s*(?:\\[a-zA-Z]+|[0-9a-zA-Z\(\)]+)(?:\s*=\s*-?[0-9a-zA-Z\/\.]+(?:\s*[^,\s;\)]+)?)?/g;
  s = s.replace(trigRegex, (m) => makeToken(`$${m.trim()}$`));

  // 6. Tokenize Greek letters & operators with optional operands
  const mathSymbols = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|times|div|pm|mp|cdot|leq|geq|neq|approx|equiv|propto|infty|partial|nabla|int|sum|prod|lim';
  const symRegex = new RegExp(`(\\\\(${mathSymbols})(?![a-zA-Z])(?:\\s*[=+\\-*/]\\s*[^,\\.\\s;]+|\\s*\\([^)]+\\)|\\s*\\^[0-9a-zA-Z]+|\\s*_[0-9a-zA-Z]+)?)`, 'g');
  s = s.replace(symRegex, (m) => makeToken(`$${m.trim()}$`));

  // 7. Tokenize bare powers on variables or numbers: e.g. x^2, 10^-3, 10^{3}
  s = s.replace(/(?<![a-zA-Z0-9\$\\])([a-zA-Z0-9]+(?:\^[0-9a-zA-Z]+|\^\{[^{}]+\}))(?![a-zA-Z0-9\$])/g, (_, pow) => {
    return makeToken(`$${pow}$`);
  });

  // 8. Restore all tokens in one pass
  let restored = s.replace(/___COLEARN_MATH_TOKEN_(\d+)___/g, (_, i) => tokens[parseInt(i, 10)]);

  // 9. Clean up accidental multiple dollar signs
  restored = restored.replace(/\${3,}/g, '$$');
  restored = restored.replace(/\$\s*\$/g, '');

  return restored;
}

/**
 * Universal Master Auto-Corrector for any string that may contain text, markdown,
 * PLX markup, and LaTeX formulas.
 */
export function autoCorrectLatexSyntax(input: string): string {
  if (!input) return '';

  // 1. Decode entities
  let text = decodeHtmlEntities(input);

  // 2. Normalize JSON escaping backslashes: \\\\frac -> \frac, \\sqrt -> \sqrt
  text = text.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // 3. Normalize Unicode math symbols (±, ×, ÷, etc.)
  text = normalizeUnicodeMathSymbols(text);

  // 4. Convert LaTeX standard delimiters \( \) to $ and \[ \] to $$
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // 5. Repair LaTeX environments (cases, aligned, matrix)
  text = autoRepairLatexEnvironments(text);

  // 6. Auto-close unclosed inline math dollar signs ($...$)
  text = autoCloseInlineMathDollars(text);

  // 7. Wrap any remaining naked LaTeX formulas (bare fractions, roots, Greek letters)
  // Process non-math parts vs math parts
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let finalResult = '';

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plainChunk = text.slice(lastIndex, match.index);
      finalResult += wrapBareLatexInDollars(plainChunk);
    }

    const rawMath = match[0];
    const isBlock = rawMath.startsWith('$$');
    let mathInner = isBlock ? rawMath.slice(2, -2) : rawMath.slice(1, -1);

    mathInner = autoCorrectMathExpression(mathInner);

    finalResult += isBlock ? `$$${mathInner}$$` : `$${mathInner}$`;
    lastIndex = match.index + rawMath.length;
  }

  if (lastIndex < text.length) {
    const plainChunk = text.slice(lastIndex);
    finalResult += wrapBareLatexInDollars(plainChunk);
  }

  // 8. Clean up accidental multiple dollar signs like $$$ or empty $ $
  finalResult = finalResult.replace(/\${3,}/g, '$$');
  finalResult = finalResult.replace(/\$\s*\$/g, '');

  return finalResult;
}

/**
 * Auto-corrects an array of NoteBlock objects
 */
export function autoCorrectNoteBlocks(blocks: any[]): { blocks: any[]; changed: boolean } {
  let changed = false;

  const correctedBlocks = blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;

    const blockType = block.type;
    let content = block.content;
    let blockChanged = false;

    if (typeof content !== 'string') return block;

    if (blockType === 'math') {
      const corrected = autoCorrectMathExpression(content);
      if (corrected !== content) {
        content = corrected;
        blockChanged = true;
      }
    } else if (blockType === 'table') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          let tableChanged = false;
          const correctedTable = parsed.map((row) => {
            if (Array.isArray(row)) {
              return row.map((cell) => {
                if (typeof cell === 'string') {
                  const correctedCell = autoCorrectLatexSyntax(cell);
                  if (correctedCell !== cell) tableChanged = true;
                  return correctedCell;
                }
                return cell;
              });
            }
            return row;
          });
          if (tableChanged) {
            content = JSON.stringify(correctedTable);
            blockChanged = true;
          }
        }
      } catch {
        const corrected = autoCorrectLatexSyntax(content);
        if (corrected !== content) {
          content = corrected;
          blockChanged = true;
        }
      }
    } else if (blockType === 'question') {
      try {
        const q = JSON.parse(content);
        let qChanged = false;

        const newQ = { ...q };
        if (typeof q.question === 'string') {
          const c = autoCorrectLatexSyntax(q.question);
          if (c !== q.question) { newQ.question = c; qChanged = true; }
        }
        if (typeof q.correct === 'string') {
          const c = autoCorrectLatexSyntax(q.correct);
          if (c !== q.correct) { newQ.correct = c; qChanged = true; }
        }
        if (Array.isArray(q.incorrect)) {
          const newInc = q.incorrect.map((inc: any) => {
            if (typeof inc === 'string') {
              const c = autoCorrectLatexSyntax(inc);
              if (c !== inc) qChanged = true;
              return c;
            }
            return inc;
          });
          newQ.incorrect = newInc;
        }
        if (typeof q.explanation === 'string') {
          const c = autoCorrectLatexSyntax(q.explanation);
          if (c !== q.explanation) { newQ.explanation = c; qChanged = true; }
        }

        if (qChanged) {
          content = JSON.stringify(newQ);
          blockChanged = true;
        }
      } catch {
        const corrected = autoCorrectLatexSyntax(content);
        if (corrected !== content) {
          content = corrected;
          blockChanged = true;
        }
      }
    } else {
      // Text-based blocks: text, h1, h2, bullet-list, numbered-list, diagram, video
      const corrected = autoCorrectLatexSyntax(content);
      if (corrected !== content) {
        content = corrected;
        blockChanged = true;
      }
    }

    if (blockChanged) {
      changed = true;
      return { ...block, content };
    }
    return block;
  });

  return { blocks: correctedBlocks, changed };
}

/**
 * Auto-corrects note content string (handles JSON-stringified NoteBlock[] or raw markdown)
 */
export function autoCorrectNoteContent(content: string): { content: string; changed: boolean } {
  if (!content) return { content: '', changed: false };

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const res = autoCorrectNoteBlocks(parsed);
      return {
        content: res.changed ? JSON.stringify(res.blocks) : content,
        changed: res.changed
      };
    }
  } catch {
    // Plain text or markdown
  }

  const corrected = autoCorrectLatexSyntax(content);
  return {
    content: corrected,
    changed: corrected !== content
  };
}

/**
 * Auto-corrects past question document data
 */
export function autoCorrectQuestionData(qData: any): { data: any; changed: boolean } {
  if (!qData || typeof qData !== 'object') return { data: qData, changed: false };

  let changed = false;
  const updated = { ...qData };

  if (typeof qData.text === 'string') {
    const c = autoCorrectLatexSyntax(qData.text);
    if (c !== qData.text) {
      updated.text = c;
      changed = true;
    }
  }

  if (typeof qData.question === 'string') {
    const c = autoCorrectLatexSyntax(qData.question);
    if (c !== qData.question) {
      updated.question = c;
      changed = true;
    }
  }

  if (typeof qData.correctAnswer === 'string') {
    const c = autoCorrectLatexSyntax(qData.correctAnswer);
    if (c !== qData.correctAnswer) {
      updated.correctAnswer = c;
      changed = true;
    }
  }

  if (Array.isArray(qData.incorrectAnswers)) {
    const newInc = qData.incorrectAnswers.map((ans: any) => {
      if (typeof ans === 'string') {
        const c = autoCorrectLatexSyntax(ans);
        if (c !== ans) changed = true;
        return c;
      }
      return ans;
    });
    if (changed) {
      updated.incorrectAnswers = newInc;
    }
  }

  // Also handle options array if present e.g. [{ label, text }] or string[]
  if (Array.isArray(qData.options)) {
    const newOpts = qData.options.map((opt: any) => {
      if (typeof opt === 'string') {
        const c = autoCorrectLatexSyntax(opt);
        if (c !== opt) changed = true;
        return c;
      } else if (opt && typeof opt === 'object' && typeof opt.text === 'string') {
        const c = autoCorrectLatexSyntax(opt.text);
        if (c !== opt.text) {
          changed = true;
          return { ...opt, text: c };
        }
      }
      return opt;
    });
    if (changed) {
      updated.options = newOpts;
    }
  }

  if (typeof qData.explanation === 'string') {
    const c = autoCorrectLatexSyntax(qData.explanation);
    if (c !== qData.explanation) {
      updated.explanation = c;
      changed = true;
    }
  }

  return { data: updated, changed };
}
