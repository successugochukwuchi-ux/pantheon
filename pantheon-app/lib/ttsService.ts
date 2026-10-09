import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const VOICE_STORE_KEY = 'colearn_default_voice';

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  gender: string;
}

export const MICROSOFT_VOICES: TTSVoice[] = [
  { id: 'en-US-AriaNeural', name: 'Aria (US Female - Natural)', lang: 'en-US', gender: 'Female' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Natural)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Soft)', lang: 'en-US', gender: 'Female' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - Natural)', lang: 'en-GB', gender: 'Female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - Natural)', lang: 'en-GB', gender: 'Male' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne (Nigeria Female - Natural)', lang: 'en-NG', gender: 'Female' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo (Nigeria Male - Natural)', lang: 'en-NG', gender: 'Male' },
];

let activeSound: Audio.Sound | null = null;

export async function getDefaultVoice(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(VOICE_STORE_KEY);
    if (saved) return saved;
  } catch (e) {
    console.log('Error reading default voice from SecureStore:', e);
  }
  return 'en-US-AriaNeural';
}

export async function setDefaultVoice(voiceId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(VOICE_STORE_KEY, voiceId);
  } catch (e) {
    console.error('Error saving default voice to SecureStore:', e);
  }
}

let currentPlaybackAborted = false;
let currentDownloadResumables: FileSystem.DownloadResumable[] = [];

export async function stopSpeech(): Promise<void> {
  currentPlaybackAborted = true;

  // Cancel any active downloads
  for (const dr of currentDownloadResumables) {
    try {
      await dr.cancelAsync();
    } catch (e) {}
  }
  currentDownloadResumables = [];

  try {
    if (activeSound) {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
      activeSound = null;
    }
  } catch (e) {}

  try {
    if (Speech && typeof Speech.stop === 'function') {
      await Speech.stop();
    }
  } catch (e) {}
}

export async function pauseSpeech(): Promise<boolean> {
  try {
    if (activeSound) {
      const status = await activeSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await activeSound.pauseAsync();
        return true;
      }
    }
  } catch (e) {
    console.warn('Error pausing speech on mobile:', e);
  }
  return false;
}

export async function resumeSpeech(): Promise<boolean> {
  try {
    if (activeSound) {
      const status = await activeSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await activeSound.playAsync();
        return true;
      }
    }
  } catch (e) {
    console.warn('Error resuming speech on mobile:', e);
  }
  return false;
}

export interface SpeakOptions {
  voiceId?: string;
  rate?: string;
  onPreparing?: (progressPercent: number) => void;
  onStart?: () => void;
  onPlaybackProgress?: (playbackPercent: number) => void;
  onDone?: () => void;
  onError?: (err: any) => void;
}

/**
 * Converts mathematical formulas, Greek letters, and LaTeX/MathJax syntax to natural spoken English.
 * Covers algebra, calculus, matrices, trigonometry, physics/chemistry units, logic, and set theory.
 * Strips all raw backslashes and LaTeX formatting so the TTS sounds like an educated professor,
 * never pronouncing "backslash" or code syntax.
 */
export function cleanMathFormula(formula: string, isMathContext = false): string {
  if (!formula) return '';
  let m = formula;

  // 1. MathJax / MathML tags cleanup if raw MathML or tags are present
  m = m.replace(/<math[\s\S]*?>/gi, ' ').replace(/<\/math>/gi, ' ');
  m = m.replace(/<mrow[\s\S]*?>/gi, ' ').replace(/<\/mrow>/gi, ' ');
  m = m.replace(/<mfrac>\s*([\s\S]*?)\s*([\s\S]*?)\s*<\/mfrac>/gi, ' ($1 divided by $2) ');
  m = m.replace(/<[^>]+>/g, ' ');

  // 2. Matrices and multi-line equations
  m = m.replace(/\\begin\{(?:pmatrix|bmatrix|vmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{(?:pmatrix|bmatrix|vmatrix|Vmatrix|matrix)\}/gi, (_, content) => {
    const rows = content.split(/\\\\/).map((r: string) => r.replace(/&/g, ', ').trim()).filter(Boolean);
    return ` matrix with rows: ${rows.join('; and ')} `;
  });

  m = m.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/gi, (_, content) => {
    const cases = content.split(/\\\\/).map((c: string) => c.replace(/&/g, ', ').trim()).filter(Boolean);
    return ` cases: ${cases.join(', ')} `;
  });

  // Strip other layout wrappers and environments
  m = m.replace(/\\begin\{[a-zA-Z*]+\}([\s\S]*?)\\end\{[a-zA-Z*]+\}/g, '$1');
  m = m.replace(/\\left|\\right/g, '');
  m = m.replace(/\\text\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\mathrm\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\mathbf\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\textbf\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\textit\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\mathit\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\bm\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\boldsymbol\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\underline\s*\{([^}]+)\}/g, ' $1 ');
  m = m.replace(/\\overline\s*\{([^}]+)\}/g, ' $1 bar ');

  // Number sets
  m = m.replace(/\\mathbb\{R\}/g, ' real numbers ');
  m = m.replace(/\\mathbb\{C\}/g, ' complex numbers ');
  m = m.replace(/\\mathbb\{N\}/g, ' natural numbers ');
  m = m.replace(/\\mathbb\{Z\}/g, ' integers ');
  m = m.replace(/\\mathbb\{Q\}/g, ' rational numbers ');
  m = m.replace(/\\mathbb\{([^{}]+)\}/g, ' set $1 ');

  // Spacing commands & styling
  m = m.replace(/\\(?:quad|qquad|thickspace|medspace|thinspace|enspace)/g, ' ');
  m = m.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)/g, ' ');
  m = m.replace(/\\[,;:!]/g, ' ');

  // 3. Higher-order & partial derivatives & calculus
  m = m.replace(/\\frac\{d\^2(\w)\}\{d(\w)\^2\}/g, ' second derivative of $1 with respect to $2 ');
  m = m.replace(/\\frac\{d\^3(\w)\}\{d(\w)\^3\}/g, ' third derivative of $1 with respect to $2 ');
  m = m.replace(/\\frac\{d(\w)\}\{d(\w)\}/g, ' derivative of $1 with respect to $2 ');
  m = m.replace(/\\frac\{d\}\{d(\w)\}/g, ' derivative with respect to $1 of ');
  m = m.replace(/\\frac\{\\partial\^2\s*(\w)\}\{\\partial\s*(\w)\^2\}/g, ' second partial derivative of $1 with respect to $2 ');
  m = m.replace(/\\frac\{\\partial\s*(\w)\}\{\\partial\s*(\w)\}/g, ' partial derivative of $1 with respect to $2 ');
  m = m.replace(/\\frac\{\\Delta\s*(\w)\}\{\\Delta\s*(\w)\}/g, ' change in $1 over change in $2 ');
  m = m.replace(/\\Delta\s*(\w)/g, ' delta $1 ');

  // Binomial coefficients: \binom{n}{k} -> n choose k
  m = m.replace(/\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, ' $1 choose $2 ');

  // Fractions: recursively resolve \frac{num}{den} and \dfrac{num}{den} -> (num divided by den)
  let prev;
  do {
    prev = m;
    m = m.replace(/\\(?:frac|dfrac|tfrac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, ' ($1 divided by $2) ');
  } while (m !== prev);

  // Square roots and n-th roots
  m = m.replace(/\\sqrt\[3\]\s*\{([^{}]+)\}/g, ' cube root of $1 ');
  m = m.replace(/\\sqrt\[(\d+)\]\s*\{([^{}]+)\}/g, ' $1th root of $2 ');
  m = m.replace(/\\sqrt\s*\{([^{}]+)\}/g, ' square root of $1 ');
  m = m.replace(/\\sqrt\s*(\w)/g, ' square root of $1 ');

  // Limits
  m = m.replace(/\\lim_\{([^{}]+)\s*\\to\s*([^{}]+)\^([+-])\}/g, ' limit as $1 approaches $2 from the $3, ');
  m = m.replace(/\\lim_\{([^{}]+)\s*\\to\s*([^{}]+)\}/g, ' limit as $1 approaches $2, ');
  m = m.replace(/\\lim_\{([^{}]+)\}/g, ' limit as $1, ');

  // Integrals & Summations & Products
  m = m.replace(/\\oint_\{([^{}]+)\}\^\{([^{}]+)\}/g, ' contour integral from $1 to $2 of ');
  m = m.replace(/\\oint\b/g, ' contour integral ');
  m = m.replace(/\\iint\b/g, ' double integral ');
  m = m.replace(/\\iiint\b/g, ' triple integral ');
  m = m.replace(/\\int_\{([^{}]+)\}\^\{([^{}]+)\}/g, ' integral from $1 to $2 of ');
  m = m.replace(/\\int_\{([^{}]+)\}\^(\w)/g, ' integral from $1 to $2 of ');
  m = m.replace(/\\int\b/g, ' integral ');

  m = m.replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, ' sum from $1 to $2 of ');
  m = m.replace(/\\sum_\{([^{}]+)\}\^(\w)/g, ' sum from $1 to $2 of ');
  m = m.replace(/\\sum\b/g, ' sum ');

  m = m.replace(/\\prod_\{([^{}]+)\}\^\{([^{}]+)\}/g, ' product from $1 to $2 of ');
  m = m.replace(/\\prod_\{([^{}]+)\}\^(\w)/g, ' product from $1 to $2 of ');
  m = m.replace(/\\prod\b/g, ' product ');

  // Vectors, hats, bars, dots
  m = m.replace(/\\ddot\{(\w+)\}/g, ' $1 double dot ');
  m = m.replace(/\\dot\{(\w+)\}/g, ' $1 dot ');
  m = m.replace(/\\vec\{(\w+)\}/g, ' vector $1 ');
  m = m.replace(/\\hat\{(\w+)\}/g, ' unit vector $1 ');
  m = m.replace(/\\bar\{(\w+)\}/g, ' $1 bar ');

  // Powers and exponents
  m = m.replace(/(\b\w+)\^\{-1\}/g, '$1 inverse ');
  m = m.replace(/(\b\w+)\^2\b/g, '$1 squared ');
  m = m.replace(/(\b\w+)\^3\b/g, '$1 cubed ');
  m = m.replace(/(\b\w+)\^\{2\}/g, '$1 squared ');
  m = m.replace(/(\b\w+)\^\{3\}/g, '$1 cubed ');
  m = m.replace(/(\b\w+)\^\{(-?\d+)\}/g, '$1 to the power of $2 ');
  m = m.replace(/(\b\w+)\^\{([^{}]+)\}/g, '$1 to the power of $2 ');
  m = m.replace(/(\b\w+)\^([a-zA-Z0-9])/g, '$1 to the power of $2 ');

  // Subscripts: e.g. v_0 -> v naught, v_i -> v initial, v_f -> v final
  m = m.replace(/(\b[a-zA-Z])_0\b/g, '$1 naught ');
  m = m.replace(/(\b[a-zA-Z])_\{0\}/g, '$1 naught ');
  m = m.replace(/(\b[a-zA-Z])_i\b/g, '$1 initial ');
  m = m.replace(/(\b[a-zA-Z])_f\b/g, '$1 final ');
  m = m.replace(/(\b[a-zA-Z])_\{max\}/gi, '$1 max ');
  m = m.replace(/(\b[a-zA-Z])_\{min\}/gi, '$1 min ');
  m = m.replace(/(\b[a-zA-Z])_\{net\}/gi, '$1 net ');
  m = m.replace(/(\b[a-zA-Z])_\{total\}/gi, '$1 total ');
  m = m.replace(/(\b[a-zA-Z])_\{([^{}]+)\}/g, '$1 sub $2 ');
  m = m.replace(/(\b[a-zA-Z])_([a-zA-Z0-9])/g, '$1 sub $2 ');

  // Greek letters (lowercase and uppercase)
  const greek: Record<string, string> = {
    '\\alpha': 'alpha', '\\beta': 'beta', '\\gamma': 'gamma', '\\Gamma': 'gamma',
    '\\delta': 'delta', '\\Delta': 'delta', '\\epsilon': 'epsilon', '\\varepsilon': 'epsilon',
    '\\zeta': 'zeta', '\\eta': 'eta', '\\theta': 'theta', '\\vartheta': 'theta', '\\Theta': 'theta',
    '\\iota': 'iota', '\\kappa': 'kappa', '\\lambda': 'lambda', '\\Lambda': 'lambda',
    '\\mu': 'mu', '\\nu': 'nu', '\\xi': 'xi', '\\Xi': 'xi',
    '\\pi': 'pi', '\\varpi': 'pi', '\\Pi': 'pi', '\\rho': 'rho', '\\varrho': 'rho',
    '\\sigma': 'sigma', '\\varsigma': 'sigma', '\\Sigma': 'sigma',
    '\\tau': 'tau', '\\upsilon': 'upsilon', '\\phi': 'phi', '\\varphi': 'phi', '\\Phi': 'phi',
    '\\chi': 'chi', '\\psi': 'psi', '\\Psi': 'psi', '\\omega': 'omega', '\\Omega': 'ohms'
  };
  for (const [sym, word] of Object.entries(greek)) {
    const re = new RegExp(sym.replace('\\', '\\\\') + '\\b', 'g');
    m = m.replace(re, ` ${word} `);
  }

  // Trigonometry, inverse trig, hyperbolic
  m = m.replace(/\\arcsin\b|\\sin\^\{-1\}/g, ' arcsine of ');
  m = m.replace(/\\arccos\b|\\cos\^\{-1\}/g, ' arccosine of ');
  m = m.replace(/\\arctan\b|\\tan\^\{-1\}/g, ' arctangent of ');
  m = m.replace(/\\sinh\b/g, ' hyperbolic sine of ');
  m = m.replace(/\\cosh\b/g, ' hyperbolic cosine of ');
  m = m.replace(/\\tanh\b/g, ' hyperbolic tangent of ');
  m = m.replace(/\\sin\b/g, ' sine of ');
  m = m.replace(/\\cos\b/g, ' cosine of ');
  m = m.replace(/\\tan\b/g, ' tangent of ');
  m = m.replace(/\\cot\b/g, ' cotangent of ');
  m = m.replace(/\\sec\b/g, ' secant of ');
  m = m.replace(/\\csc\b/g, ' cosecant of ');
  m = m.replace(/\\ln\b/g, ' natural log of ');
  m = m.replace(/\\log_\{10\}\b|\\log_10\b/g, ' log base 10 of ');
  m = m.replace(/\\log_\{2\}\b|\\log_2\b/g, ' log base 2 of ');
  m = m.replace(/\\log_\{([^{}]+)\}/g, ' log base $1 of ');
  m = m.replace(/\\log\b/g, ' log of ');
  m = m.replace(/\\exp\b/g, ' exponential of ');

  // Logic, relations, and set operators
  m = m.replace(/\\implies\b|\\Longrightarrow\b/g, ' implies ');
  m = m.replace(/\\iff\b|\\Longleftrightarrow\b/g, ' if and only if ');
  m = m.replace(/\\to\b|\\rightarrow\b|\\longrightarrow\b/g, ' approaches ');
  m = m.replace(/\\leftarrow\b|\\longleftarrow\b/g, ' from ');
  m = m.replace(/\\rightleftharpoons\b|\\leftrightarrow\b/g, ' is in equilibrium with ');
  m = m.replace(/\\times\b/g, ' times ');
  m = m.replace(/\\cdot\b/g, ' times ');
  m = m.replace(/\\pm\b/g, ' plus or minus ');
  m = m.replace(/\\mp\b/g, ' minus or plus ');
  m = m.replace(/\\div\b/g, ' divided by ');
  m = m.replace(/\\neq\b/g, ' does not equal ');
  m = m.replace(/\\approx\b|\\approxeq\b|\\cong\b/g, ' is approximately ');
  m = m.replace(/\\equiv\b/g, ' is equivalent to ');
  m = m.replace(/\\sim\b/g, ' is roughly ');
  m = m.replace(/\\propto\b/g, ' is proportional to ');
  m = m.replace(/\\le\b|\\leq\b/g, ' is less than or equal to ');
  m = m.replace(/\\ge\b|\\geq\b/g, ' is greater than or equal to ');
  m = m.replace(/\\ll\b/g, ' is much less than ');
  m = m.replace(/\\gg\b/g, ' is much greater than ');
  m = m.replace(/\\infty\b/g, ' infinity ');
  m = m.replace(/\\circ\b|\\degree\b|\^\\circ/g, ' degrees ');
  m = m.replace(/\\partial\b/g, ' partial ');
  m = m.replace(/\\nabla\^2\b/g, ' Laplacian of ');
  m = m.replace(/\\nabla\b/g, ' del ');
  m = m.replace(/\\hbar\b/g, ' h bar ');
  m = m.replace(/\\in\b/g, ' in ');
  m = m.replace(/\\notin\b/g, ' not in ');
  m = m.replace(/\\subset\b/g, ' subset of ');
  m = m.replace(/\\subseteq\b/g, ' subset or equal to ');
  m = m.replace(/\\supset\b/g, ' superset of ');
  m = m.replace(/\\supseteq\b/g, ' superset or equal to ');
  m = m.replace(/\\cup\b/g, ' union ');
  m = m.replace(/\\cap\b/g, ' intersection ');
  m = m.replace(/\\emptyset\b|\\varnothing\b/g, ' empty set ');
  m = m.replace(/\\forall\b/g, ' for all ');
  m = m.replace(/\\exists\b/g, ' there exists ');
  m = m.replace(/\\neg\b/g, ' not ');
  m = m.replace(/\\land\b/g, ' and ');
  m = m.replace(/\\lor\b/g, ' or ');
  m = m.replace(/\\parallel\b/g, ' is parallel to ');
  m = m.replace(/\\perp\b/g, ' is perpendicular to ');
  m = m.replace(/\\angle\b/g, ' angle ');
  m = m.replace(/\\triangle\b/g, ' triangle ');
  m = m.replace(/\\dots\b|\\ldots\b|\\cdots\b|\\vdots\b|\\ddots\b/g, ' and so on ');

  // Units
  m = m.replace(/\\mu\s*F\b/g, ' microfarads ');
  m = m.replace(/\\mu\s*m\b/g, ' micrometers ');
  m = m.replace(/\\mu\s*s\b/g, ' microseconds ');
  m = m.replace(/\\mu\s*g\b/g, ' micrograms ');
  m = m.replace(/\\Omega\b/g, ' ohms ');

  // Norms and factorials
  m = m.replace(/\\\|([^{}|]+)\\\|/g, ' norm of $1 ');

  if (isMathContext) {
    // In explicit mathematical context ($...$, $$...$$, MathJax blocks):
    // 1. Numbers: e.g. 5!, 0!, 12!
    m = m.replace(/(\b\d+)!/g, ' $1 factorial ');
    // 2. Parenthesized expressions: e.g. (n+1)!, (n-k)!, (2n)!
    m = m.replace(/(\([^)]+\))!/g, ' $1 factorial ');
    // 3. Single-letter math variables: e.g. n!, k!, r!, x!, m!, a!, b!
    // Multi-letter English words like "Hello!", "Welcome!", "Important!" are NEVER matched
    m = m.replace(/(?<=[\s(=+\-*/^]|^)([a-zA-Z])!(?=[^a-zA-Z]|$)/g, ' $1 factorial ');
  } else {
    // Outside explicit math delimiters (general conversation, greetings, prose):
    // Only numbers or explicit parenthesized math expressions like 5! or (n-1)!
    // Regular English words (e.g. "Hello!", "Welcome!", "Nice!") are NEVER pronounced as factorial
    m = m.replace(/(\b\d+)!/g, ' $1 factorial ');
    m = m.replace(/(\([^)]+\))!/g, ' $1 factorial ');
    // Single lowercase math variables commonly used for factorials preceded by math operators (=, +, -, *)
    m = m.replace(/(?<=[=+\-*/]\s*)([a-km-z])!(?=[^a-zA-Z]|$)/gi, ' $1 factorial ');
  }

  // Remove any remaining backslash followed by letters (e.g. \displaystyle, \over)
  m = m.replace(/\\([a-zA-Z]+)/g, ' $1 ');

  // ABSOLUTE BACKSLASH KILL-SWITCH: remove all solitary backslashes completely
  m = m.replace(/\\/g, ' ');

  // Clean brackets and curly braces
  m = m.replace(/[{}]/g, ' ');

  // Clean multiple whitespace
  m = m.replace(/\s{2,}/g, ' ');

  return m.trim();
}

/**
 * Converts LaTeX formulas to phonetically clean English for TTS
 */
export function convertLatexToSpeakable(text: string): string {
  if (!text) return '';
  let s = text;

  // 1. Normalize MathJax script wrappers
  s = s.replace(/<script\s+type=["']math\/tex;?\s*(?:mode=display)?["']>([\s\S]*?)<\/script>/gi, ' $$ $1 $$ ');

  // 2. Normalize block delimiters: \[...\] and \\[...\\] to $$...$$
  s = s.replace(/\\\\\[([\s\S]+?)\\\\\]/g, ' $$ $1 $$ ');
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, ' $$ $1 $$ ');

  // 3. Normalize inline delimiters: \(...\) and \\(...\\) to $...$
  s = s.replace(/\\\\\(([\s\S]+?)\\\\\)/g, ' $ $1 $ ');
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, ' $ $1 $ ');

  // 4. Process math inside $$ ... $$ and $ ... $ (explicit mathematical context)
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
    return ` ${cleanMathFormula(formula, true)} `;
  });
  s = s.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (_, formula) => {
    return ` ${cleanMathFormula(formula, true)} `;
  });

  // 5. Process any remaining bare math/LaTeX formulas that were outside delimiters
  s = cleanMathFormula(s, false);

  // Guarantee no remaining stray backslashes survive
  s = s.replace(/\\/g, ' ');

  return s;
}

/**
 * Strips code blocks, ASCII diagrams, SVG graphics, and visual layout lines
 * so TTS does NOT attempt to pronounce diagrams.
 */
export function stripDiagramsAndCleanForTTS(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Convert LaTeX math to spoken text
  cleaned = convertLatexToSpeakable(cleaned);

  // 2. Strip base64 image data & long base64 chunks
  cleaned = cleaned.replace(/data:image\/[a-zA-Z0-9+-]+;base64,[A-Za-z0-9+/=]+/g, '');
  cleaned = cleaned.replace(/\b[A-Za-z0-9+/=]{100,}\b/g, '');

  // 3. Strip SVG markup completely
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // 4. Strip raw HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // 5. Strip fenced code blocks & diagram blocks (e.g. ```mermaid ... ``` or ```python ... ``` or ```ascii ... ```)
  cleaned = cleaned.replace(/```(?:mermaid|diagram|ascii|drawio|plantuml|python|javascript|typescript|js|ts|json|html|css|cpp|java|c|csharp)?[\s\S]*?```/gi, (match) => {
    if (/mermaid|diagram|drawio|plantuml|ascii/i.test(match)) {
      return ' [Diagram] ';
    }
    return ' ';
  });
  cleaned = cleaned.replace(/~~~[\s\S]*?~~~/g, ' ');

  // 6. Strip Markdown images ![alt](url) -> replace with "Image showing alt" if alt exists
  cleaned = cleaned.replace(/!\[(.*?)\]\(.*?\)/g, (_, alt) => {
    return alt && alt.trim() ? `Image: ${alt.trim()}.` : '';
  });

  // 7. Strip LaTeX diagram drawing environments (e.g. tikzpicture, circuitikz, matrix, pmatrix, bmatrix, etc.)
  cleaned = cleaned.replace(/\\begin\{(tikzpicture|circuitikz|pgfplots|forest|matrix|pmatrix|bmatrix|vmatrix|align\*?)\}[\s\S]*?\\end\{\1\}/gi, ' ');

  // 8. Remove ASCII art & box-drawing characters and diagram lines
  const lines = cleaned.split('\n');
  const nonDiagramLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    // Check for box-drawing characters (Unicode 2500 - 257F)
    if (/[\u2500-\u257F\u2580-\u259F]/.test(trimmed)) {
      return false; // ASCII / Box-drawing line
    }

    // Check ratio of diagram symbols (+, -, |, =, >, <, *, #, /, \, _, ~, ^)
    const symbolMatches = trimmed.match(/[+\-|=></\\*#.:_~^]/g);
    const symbolCount = symbolMatches ? symbolMatches.length : 0;
    const totalChars = trimmed.length;

    // If line contains diagram borders (+---+ or |   | or +--->) or >40% symbol ratio
    if (totalChars >= 3 && (symbolCount / totalChars) > 0.40 && /[+|=>]/.test(trimmed)) {
      return false; // ASCII diagram line
    }

    // Pure repetition lines like "-------------------" or "==================="
    if (/^[+\-|*=_~#.]{3,}$/.test(trimmed)) {
      return false;
    }

    return true;
  });

  cleaned = nonDiagramLines.join('\n');

  // 9. Clean up markdown headers, bold, italics, bullets, inline code
  cleaned = cleaned
    .replace(/#+\s+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 10. Strip all emojis, pictographs, symbols, and variation selectors so TTS never pronounces emoji names
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}\u{200D}\u{20E3}]/gu, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const c1 = b1 >> 2;
    const c2 = ((b1 & 3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 15) << 2) | (b3 >> 6);
    const c4 = b3 & 63;

    base64 += chars[c1] + chars[c2];
    base64 += i + 1 < len ? chars[c3] : '=';
    base64 += i + 2 < len ? chars[c4] : '=';
  }
  return base64;
}

const getBackendUrls = (): string[] => {
  const urls: string[] = [];

  // Always prioritize the primary production backend URL for mobile
  urls.push('https://colearn-backend-tzo9.onrender.com');

  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    urls.push(process.env.EXPO_PUBLIC_BACKEND_URL);
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    const origin = window.location.origin;
    if (!origin.includes(':8081') && !origin.includes(':19000') && !origin.includes(':8082')) {
      urls.push(origin);
    }
  }

  return Array.from(new Set(urls.filter(Boolean)));
};

function splitTextToSentences(text: string): string[] {
  return text
    .replace(/([.?!;])\s+/g, "$1|")
    .split("|")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function splitTextIntoChunks(text: string, maxChunkLength = 1000): string[] {
  if (text.length <= maxChunkLength) return [text];

  const sentences = splitTextToSentences(text);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > maxChunkLength) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length > maxChunkLength) {
        let remaining = sentence;
        while (remaining.length > maxChunkLength) {
          chunks.push(remaining.substring(0, maxChunkLength).trim());
          remaining = remaining.substring(maxChunkLength);
        }
        currentChunk = remaining;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function speakText(
  rawText: string,
  options?: SpeakOptions
): Promise<void> {
  await stopSpeech();

  currentPlaybackAborted = false;
  currentDownloadResumables = [];

  // Strip diagrams and clean text before synthesizing speech
  const text = stripDiagramsAndCleanForTTS(rawText);

  if (!text || !text.trim()) {
    options?.onDone?.();
    return;
  }

  const voice = options?.voiceId || (await getDefaultVoice());
  const chunks = splitTextIntoChunks(text, 1000);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    options?.onDone?.();
    return;
  }

  const fileUris: (string | null)[] = new Array(totalChunks).fill(null);
  const downloadPromises: (Promise<{ uri: string; source: string }> | null)[] = new Array(totalChunks).fill(null);

  // Helper to start downloading a specific chunk
  const startDownloadingChunk = (index: number) => {
    if (index >= totalChunks || downloadPromises[index] || currentPlaybackAborted) return;

    const tempFileUri = `${FileSystem.cacheDirectory}colearn_tts_${index}_${Date.now()}.mp3`;

    const downloadPromise = (async (): Promise<{ uri: string; source: string }> => {
      const backendUrls = getBackendUrls();
      let lastError: any = null;

      for (const baseUrl of backendUrls) {
        if (currentPlaybackAborted) throw new Error('Aborted');

        // 1. Primary Method: POST FileSystem downloadAsync
        try {
          const result = await FileSystem.downloadAsync(
            `${baseUrl}/api/tts`,
            tempFileUri,
            {
              httpMethod: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: chunks[index], voice, rate: options?.rate }),
            }
          );

          if (result && result.status === 200) {
            const info = await FileSystem.getInfoAsync(result.uri);
            if (info.exists && info.size > 100) {
              fileUris[index] = result.uri;
              if (index === 0) options?.onPreparing?.(99);
              return { uri: result.uri, source: `${baseUrl} (POST FileSystem)` };
            }
          }
        } catch (e: any) {
          lastError = e;
          console.warn(`Mobile TTS POST FileSystem chunk ${index} failed on ${baseUrl}:`, e);
        }

        if (currentPlaybackAborted) throw new Error('Aborted');

        // 2. Secondary Method: GET FileSystem downloadAsync
        try {
          const getTtsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(chunks[index])}&voice=${encodeURIComponent(voice)}${options?.rate ? `&rate=${encodeURIComponent(options.rate)}` : ''}`;
          const result = await FileSystem.downloadAsync(
            getTtsUrl,
            tempFileUri
          );

          if (result && result.status === 200) {
            const info = await FileSystem.getInfoAsync(result.uri);
            if (info.exists && info.size > 100) {
              fileUris[index] = result.uri;
              if (index === 0) options?.onPreparing?.(99);
              return { uri: result.uri, source: `${baseUrl} (GET FileSystem)` };
            }
          }
        } catch (e: any) {
          lastError = e;
          console.warn(`Mobile TTS GET FileSystem chunk ${index} failed on ${baseUrl}:`, e);
        }

        if (currentPlaybackAborted) throw new Error('Aborted');

        // 3. Fallback: fetch ArrayBuffer / Blob
        try {
          const res = await fetch(`${baseUrl}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunks[index], voice, rate: options?.rate }),
          });

          if (res.ok) {
            if (Platform.OS === 'web') {
              const blob = await res.blob();
              const uri = URL.createObjectURL(blob);
              fileUris[index] = uri;
              if (index === 0) options?.onPreparing?.(99);
              return { uri, source: `${baseUrl} (Web Blob)` };
            } else {
              const arrayBuffer = await res.arrayBuffer();
              if (arrayBuffer && arrayBuffer.byteLength > 100) {
                const base64Str = uint8ToBase64(new Uint8Array(arrayBuffer));
                await FileSystem.writeAsStringAsync(tempFileUri, base64Str, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                fileUris[index] = tempFileUri;
                if (index === 0) options?.onPreparing?.(99);
                return { uri: tempFileUri, source: `${baseUrl} (Fetch Base64)` };
              }
            }
          }
        } catch (e: any) {
          lastError = e;
          console.warn(`Mobile TTS Fetch chunk ${index} failed on ${baseUrl}:`, e);
        }
      }

      const errorMsg = lastError?.message || `Failed to download Edge TTS chunk ${index} across all servers`;
      throw new Error(errorMsg);
    })();

    downloadPromises[index] = downloadPromise;
  };

  try {
    options?.onPreparing?.(0);
    // Start downloading the first chunk immediately
    startDownloadingChunk(0);

    if (totalChunks > 1) {
      startDownloadingChunk(1);
    }

    let currentIndex = 0;

    while (currentIndex < totalChunks) {
      if (currentPlaybackAborted) return;

      startDownloadingChunk(currentIndex);

      let uri = '';
      let chunkResult: { uri: string; source: string } | null = null;

      try {
        chunkResult = await downloadPromises[currentIndex]!;
        uri = chunkResult.uri;
      } catch (err: any) {
        const errorDetail = err?.message || String(err);
        console.warn(`Edge TTS failed for chunk ${currentIndex}:`, errorDetail);

        if (currentPlaybackAborted) return;

        // Fallback to native Speech
        await new Promise<void>((resolve) => {
          Speech.speak(chunks[currentIndex], {
            language: 'en',
            rate: 0.9,
            onStart: () => {
              if (currentIndex === 0) {
                options?.onPreparing?.(100);
                options?.onStart?.();
              }
            },
            onDone: () => resolve(),
            onStopped: () => resolve(),
            onError: () => resolve(),
          });
        });
        currentIndex++;
        continue;
      }

      if (currentPlaybackAborted) return;

      if (currentIndex + 1 < totalChunks) {
        startDownloadingChunk(currentIndex + 1);
      }

      let sound: Audio.Sound | null = null;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const result = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true }
        );
        sound = result.sound;
        activeSound = sound;
      } catch (playInitErr: any) {
        const errorDetail = playInitErr?.message || String(playInitErr);
        console.warn(`Audio.Sound.createAsync failed for chunk ${currentIndex}:`, errorDetail);

        if (currentPlaybackAborted) return;

        await new Promise<void>((resolve) => {
          Speech.speak(chunks[currentIndex], {
            language: 'en',
            rate: 0.9,
            onStart: () => {
              if (currentIndex === 0) {
                options?.onPreparing?.(100);
                options?.onStart?.();
              }
            },
            onDone: () => resolve(),
            onStopped: () => resolve(),
            onError: () => resolve(),
          });
        });
        currentIndex++;
        continue;
      }

      if (sound) {
        if (currentIndex === 0) {
          options?.onPreparing?.(100);
          options?.onStart?.();
        }

        await new Promise<void>((resolve) => {
          sound!.setOnPlaybackStatusUpdate(async (status) => {
            if (currentPlaybackAborted) {
              sound!.unloadAsync().catch(() => {});
              resolve();
              return;
            }

            if (status.isLoaded) {
              if (status.durationMillis && status.durationMillis > 0) {
                const chunkWeight = 100 / totalChunks;
                const currentChunkProgress = (status.positionMillis / status.durationMillis) * chunkWeight;
                const overallPct = Math.min(100, Math.round(currentIndex * chunkWeight + currentChunkProgress));
                options?.onPlaybackProgress?.(overallPct);
              }
              if (status.didJustFinish) {
                await sound!.unloadAsync().catch(() => {});
                if (activeSound === sound) activeSound = null;
                resolve();
              }
            } else if (status.error) {
              console.warn("Playback status update error:", status.error);
              sound!.unloadAsync().catch(() => {});
              if (activeSound === sound) activeSound = null;
              resolve();
            }
          });
        });
      }

      currentIndex++;
    }

    if (!currentPlaybackAborted) {
      options?.onDone?.();
    }
  } catch (err: any) {
    console.error('Sequential Mobile TTS error:', err);
    options?.onError?.(err);
  } finally {
    for (let i = 0; i < totalChunks; i++) {
      const tempFileUri = `${FileSystem.cacheDirectory}colearn_tts_${i}.mp3`;
      try {
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
      } catch (e) {}
    }
  }
}

