import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { 
  autoCorrectLatexSyntax, 
  autoCorrectMathExpression, 
  autoCorrectFractions, 
  autoCorrectRoots,
  balanceCurlyBraces 
} from '../lib/latexAutoCorrect';

interface SafeMathRendererProps {
  math: string;
  block?: boolean;
}

export const SafeMathRenderer: React.FC<SafeMathRendererProps> = ({ math, block = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Clean and autocorrect math expression
        const content = autoCorrectMathExpression(math);
        katex.render(content, containerRef.current, {
          displayMode: block,
          throwOnError: false,
          strict: false,
          errorColor: 'inherit',
          trust: true,
        });
      } catch (err) {
        console.error('KaTeX error:', err);
        containerRef.current.textContent = math;
      }
    }
  }, [math, block]);

  return (
    <span 
      ref={containerRef} 
      className={block ? "block w-full text-center overflow-x-auto my-2" : "inline-block"} 
    />
  );
};

export const formatPLXFormatting = (text: string): string => {
  if (!text) return '';
  let processed = text;
  // Process PLX bold <B>, italic <I>, and underline <U> (case-insensitive)
  processed = processed.replace(/<B>([\s\S]*?)<\/B>/gi, '<strong class="font-bold font-semibold">$1</strong>');
  processed = processed.replace(/<I>([\s\S]*?)<\/I>/gi, '<em class="italic">$1</em>');
  processed = processed.replace(/<U>([\s\S]*?)<\/U>/gi, '<u class="underline decoration-1 underline-offset-2">$1</u>');
  // Also process bracketed versions [B], [I], [U] for backward compatibility
  processed = processed.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<strong class="font-bold font-semibold">$1</strong>');
  processed = processed.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<em class="italic">$1</em>');
  processed = processed.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<u class="underline decoration-1 underline-offset-2">$1</u>');
  return processed;
};

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
 * Repairs broken, unclosed, or naked LaTeX environments (cases, aligned, matrix, array)
 * and wraps them in display math $$...$$
 */
export function repairAndWrapLatexEnvironments(text: string): string {
  if (!text) return '';
  let str = text;

  // Match any \begin{environment}
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
      // Missing \end{envName}: find where it ends or read to end of formula
      const sliceRest = str.slice(beginIndex + match[0].length);
      const nextBreak = sliceRest.search(/\n\s*\n|(?:\.\s+[A-Z])|$$/);
      const cutAt = nextBreak !== -1 ? nextBreak : sliceRest.length;
      envContent = sliceRest.slice(0, cutAt);
      envFullLength = match[0].length + cutAt;
    }

    // Clean envContent:
    // 1. Remove stray internal $ (e.g. 2x^2$ -> 2x^2)
    let cleanedContent = envContent.replace(/\$/g, '');
    // 2. Decode entities
    cleanedContent = decodeHtmlEntities(cleanedContent);
    // 3. For 'cases', ensure line breaks between branches:
    if (envName === 'cases') {
      cleanedContent = cleanedContent.replace(/([0-9a-zA-Z\)\}])\s*(?<!\\\\)\s+(?=(?:-?\d|[a-zA-Z0-9_\(\)]+)\s*,\s*&)/g, '$1 \\\\ ');
      cleanedContent = cleanedContent.replace(/(?<!\\\\)\s*\n\s*/g, ' \\\\ ');
    }

    const reconstructedEnv = `\\begin{${envName}}${cleanedContent}\\end{${envName}}`;

    // Check if there is an equation prefix right before \begin{...}
    // e.g. "f(x) = " or "y = "
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
 * Balances unclosed single dollar signs
 */
function balanceMathDelimiters(str: string): string {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '$' && (i === 0 || str[i - 1] !== '\\')) {
      if (str[i + 1] === '$') {
        i++; // skip $$
      } else {
        count++;
      }
    }
  }
  if (count % 2 !== 0) {
    return str + '$';
  }
  return str;
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
 * Recursively normalizes LaTeX fractions (\frac, frac, \dfrac, \tfrac, frac(num,den), \frac 1 2)
 * into standard \frac{num}{den}
 */
export function normalizeLatexFractions(str: string): string {
  let s = str;

  // 1. Handle frac(num, den) and \frac(num, den) format
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*\(\s*([^,\)]+)\s*,\s*([^\)]+)\s*\)/g, (_, num, den) => {
    return `\\frac{${num.trim()}}{${den.trim()}}`;
  });

  // 2. Handle single character/digit fractions: \frac 1 2, frac 1 2, \frac12, frac12, \frac 3 4
  s = s.replace(/\\?(?:frac|dfrac|tfrac)\s*([0-9a-zA-Z])\s*([0-9a-zA-Z])(?![0-9a-zA-Z])/g, (_, num, den) => {
    return `\\frac{${num}}{${den}}`;
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
        const num = normalizeLatexFractions(numRes.content).trim();
        const den = normalizeLatexFractions(denRes.content).trim();
        result += `\\frac{${num}}{${den}}`;
        lastIndex = denRes.endIndex + 1;
        fracRegex.lastIndex = lastIndex;
        continue;
      }
    }

    // If no denominator brace, handle single token e.g. \frac{1}2 or \frac{1}x
    const nextTokenMatch = /^\s*([0-9a-zA-Z\(\)]+)/.exec(s.slice(numRes.endIndex + 1));
    if (nextTokenMatch) {
      result += s.slice(lastIndex, fracStart);
      const num = normalizeLatexFractions(numRes.content).trim();
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

  // 4. Handle bare multi-token fractions like 'frac a/b' or 'frac -1/2'
  result = result.replace(/\\?(?:frac|dfrac|tfrac)\s*(-?\d+|[a-zA-Z0-9_\(\)]+)\s*\/\s*([a-zA-Z0-9_\(\)]+)/g, '\\frac{$1}{$2}');

  return result;
}

/**
 * Normalizes square roots (\sqrt{content}, sqrt{content}, \sqrt[n]{content})
 */
export function normalizeLatexRoots(str: string): string {
  let s = str;

  // 1. Handle n-th roots: \sqrt[n]{...} or sqrt[n]{...}
  s = s.replace(/\\?sqrt\[([0-9a-zA-Z]+)\]\s*\{/g, (match, root) => {
    return `__NROOT_${root}__{`;
  });

  // 2. Balanced braces for \sqrt{...} or sqrt{...}
  let result = '';
  const rootRegex = /\\?sqrt\s*\{/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = rootRegex.exec(s)) !== null) {
    const rootStart = match.index;
    const openIndex = match.index + match[0].length - 1;
    const res = extractBalancedBraces(s, openIndex);
    if (!res) {
      result += s.slice(lastIndex, rootStart);
      lastIndex = rootStart + match[0].length;
      continue;
    }

    result += s.slice(lastIndex, rootStart);
    result += `\\sqrt{${normalizeLatexRoots(res.content)}}`;
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
    return m;
  });

  // Handle single character roots: \sqrt x or sqrt x
  result = result.replace(/\\?sqrt\s*([a-zA-Z0-9])/g, '\\sqrt{$1}');

  return result;
}

/**
 * Wraps bare, undelimited LaTeX commands and mathematical expressions in $...$
 * so that remarkMath and rehypeKatex correctly parse them in ReactMarkdown.
 */
function wrapNakedMathInText(plainText: string): string {
  if (!plainText) return '';
  let str = plainText;

  // 1. Normalize fractions and roots first
  str = normalizeLatexFractions(str);
  str = normalizeLatexRoots(str);

  // 2. Wrap \frac{...}{...} that are not already enclosed in $...$
  // Use balanced brace matching to accurately find \frac{num}{den}
  let fracWrapped = '';
  const fracPattern = /\\frac\s*\{/g;
  let fracMatch: RegExpExecArray | null;
  let fracLastIdx = 0;

  while ((fracMatch = fracPattern.exec(str)) !== null) {
    const startIdx = fracMatch.index;
    const numOpen = fracMatch.index + fracMatch[0].length - 1;
    const numRes = extractBalancedBraces(str, numOpen);
    if (!numRes) {
      fracWrapped += str.slice(fracLastIdx, startIdx + fracMatch[0].length);
      fracLastIdx = startIdx + fracMatch[0].length;
      continue;
    }

    let denOpen = numRes.endIndex + 1;
    while (denOpen < str.length && /\s/.test(str[denOpen])) denOpen++;

    if (str[denOpen] === '{') {
      const denRes = extractBalancedBraces(str, denOpen);
      if (denRes) {
        fracWrapped += str.slice(fracLastIdx, startIdx);
        // Include any attached prefix like ± or - or d/dx if immediately adjacent
        const fullFrac = str.slice(startIdx, denRes.endIndex + 1);
        fracWrapped += `$${fullFrac}$`;
        fracLastIdx = denRes.endIndex + 1;
        fracPattern.lastIndex = fracLastIdx;
        continue;
      }
    }

    fracWrapped += str.slice(fracLastIdx, numRes.endIndex + 1);
    fracLastIdx = numRes.endIndex + 1;
  }
  fracWrapped += str.slice(fracLastIdx);
  str = fracWrapped;

  // 3. Wrap \sqrt{...} or \sqrt[n]{...} not already in $
  str = str.replace(/(?<!\$)\\sqrt(?:\[[0-9a-zA-Z]+\])?\{[^{}]+\}(?!\$)/g, (m) => `$${m}$`);

  // 4. Wrap common Greek letters and LaTeX symbols when used as math
  // (e.g. \theta, \alpha, \beta, \pi, \pm, \times, \div, \leq, \geq, \neq, \approx, \int, \sum, \partial, \infty)
  const mathSymbolRegex = /(?<!\$)\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|pm|mp|times|div|cdot|leq|le|geq|ge|neq|ne|approx|equiv|propto|infty|partial|nabla|int|sum|prod|lim|degree|to|rightarrow|leftarrow|leftrightarrow|in|notin|subset|cup|cap)(?![a-zA-Z])(?:\s*=\s*[^,.\s;]+|\s*\([^)]+\)|\s*\^[0-9a-zA-Z]+|\s*_[0-9a-zA-Z]+)?(?!\$)/g;
  str = str.replace(mathSymbolRegex, (m) => `$${m.trim()}$`);

  // 5. Wrap standalone superscripts or math variables with powers (e.g. x^2, x^3, 10^{-3}, 10^8)
  str = str.replace(/(?<![a-zA-Z0-9\$\\])([a-zA-Z0-9]+(?:\^[0-9a-zA-Z]+|\^\{[^{}]+\}))(?![a-zA-Z0-9\$])/g, (_, m) => `$${m}$`);

  // 6. Clean up any accidental double dollar signs or nested delimiters
  str = str.replace(/\${2,}/g, '$$');

  // 7. Strip any remaining stray 'frac' keywords that weren't part of any valid formula
  str = str.replace(/\bfrac\b\s*/gi, '');

  return str;
}

/**
 * Prepares raw question or note content with LaTeX math, formulas, and PLX formatting
 * for pristine KaTeX rendering inside ReactMarkdown.
 */
export const prepareMarkdownMath = (text: string): string => {
  if (!text) return '';
  
  // 1. Format PLX bold, italics, and underline tags first
  let processed = formatPLXFormatting(text);

  // 2. Run master LaTeX syntax auto-corrector (unclosed $, bare fractions, unbalanced braces, environments, unicode symbols)
  processed = autoCorrectLatexSyntax(processed);

  return processed;
};

