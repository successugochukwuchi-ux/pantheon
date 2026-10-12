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

// Monotonically increasing session ID guarantees no two TTS playbacks can ever overlap
let activeSessionId = 0;
let activeSound: Audio.Sound | null = null;
const allActiveSounds = new Set<Audio.Sound>();
let currentDownloadResumables: FileSystem.DownloadResumable[] = [];
let currentAbortControllers: AbortController[] = [];
const stopListeners = new Set<(newSessionId: number) => void>();

export function addSpeechStopListener(listener: (newSessionId: number) => void): () => void {
  stopListeners.add(listener);
  return () => {
    stopListeners.delete(listener);
  };
}

export const onSpeechStopListener = addSpeechStopListener;

export function getActiveSpeechSessionId(): number {
  return activeSessionId;
}

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

async function cleanupAllSoundsAndDownloads(): Promise<void> {
  // Cancel any active fetch AbortControllers
  const controllers = [...currentAbortControllers];
  currentAbortControllers = [];
  for (const ctrl of controllers) {
    try {
      ctrl.abort();
    } catch {}
  }

  // Cancel any active FileSystem downloads
  const resumables = [...currentDownloadResumables];
  currentDownloadResumables = [];
  for (const dr of resumables) {
    try {
      await dr.cancelAsync();
    } catch {}
  }

  // Stop and unload every tracked Audio.Sound instance so nothing can overlap
  const soundsToStop = Array.from(allActiveSounds);
  allActiveSounds.clear();
  if (activeSound && !soundsToStop.includes(activeSound)) {
    soundsToStop.push(activeSound);
  }
  activeSound = null;

  await Promise.all(
    soundsToStop.map(async (s) => {
      try {
        await s.stopAsync();
      } catch {}
      try {
        await s.unloadAsync();
      } catch {}
    })
  );

  try {
    if (Speech && typeof Speech.stop === 'function') {
      await Speech.stop();
    }
  } catch {}

  try {
    if (typeof window !== 'undefined' && (window as any).speechSynthesis) {
      (window as any).speechSynthesis.cancel();
    }
  } catch {}
}

export async function stopSpeech(): Promise<void> {
  const nextId = ++activeSessionId;
  stopListeners.forEach((cb) => {
    try {
      cb(nextId);
    } catch {}
  });
  await cleanupAllSoundsAndDownloads();
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
    // Only inside explicit mathematical context ($...$, $$...$$, \[...\], \(...\), or math blocks):
    m = m.replace(/(\b\d+)!/g, ' $1 factorial ');
    m = m.replace(/(\([^)]+\))!/g, ' $1 factorial ');
    m = m.replace(/(?<=[\s(=+\-*/^]|^)([a-zA-Z])!(?=[^a-zA-Z]|$)/g, ' $1 factorial ');
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

  // 5. Process any remaining bare math/LaTeX commands that were outside delimiters
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

  // 5. Strip fenced code blocks & diagram blocks
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

  // 7. Strip LaTeX diagram drawing environments
  cleaned = cleaned.replace(/\\begin\{(tikzpicture|circuitikz|pgfplots|forest|matrix|pmatrix|bmatrix|vmatrix|align\*?)\}[\s\S]*?\\end\{\1\}/gi, ' ');

  // 8. Remove ASCII art & box-drawing characters and diagram lines
  const lines = cleaned.split('\n');
  const nonDiagramLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (/[\u2500-\u257F\u2580-\u259F]/.test(trimmed)) {
      return false;
    }

    const symbolMatches = trimmed.match(/[+\-|=></\\*#.:_~^]/g);
    const symbolCount = symbolMatches ? symbolMatches.length : 0;
    const totalChars = trimmed.length;

    if (totalChars >= 3 && (symbolCount / totalChars) > 0.40 && /[+|=>]/.test(trimmed)) {
      return false;
    }

    if (/^[+\-|*=_~#.]{3,}$/.test(trimmed)) {
      return false;
    }

    return true;
  });

  cleaned = nonDiagramLines.join('\n');

  // 9. Clean up markdown headers, bold, italics, bullets, inline code, and convert ! to period outside math so native/edge TTS never says "exclamation mark" or "factorial"
  cleaned = cleaned
    .replace(/#+\s+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!+/g, '.')
    // Convert line breaks into natural sentence boundaries if the line didn't end with punctuation
    .replace(/([^\.\?\!\;\:\s])\s*\n+/g, '$1. ')
    .replace(/\n+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 10. Strip all emojis, pictographs, symbols, and variation selectors
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}\u{200D}\u{20E3}]/gu, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

/**
 * Extracts clean, speakable text from a Lecture Note's content (supports JSON blocks, <PLX> tags, and Markdown).
 */
export function extractSpeakableNoteText(
  noteContent?: string | null,
  noteTitle?: string | null,
  noteSummary?: string | null
): string {
  const rawContent = noteContent || '';
  if (!rawContent.trim()) {
    return `${noteTitle || 'Study Note'}. ${noteSummary || ''}`.trim();
  }

  let extracted = '';

  try {
    const parsed = JSON.parse(rawContent);
    if (Array.isArray(parsed)) {
      const parts = parsed
        .map((b: any) => {
          if (!b) return '';
          const type = b.type || '';
          if (
            type === 'h1' ||
            type === 'h2' ||
            type === 'h3' ||
            type === 'h4' ||
            type === 'text' ||
            type === 'paragraph' ||
            type === 'callout' ||
            type === 'quote' ||
            type === 'bullet-list' ||
            type === 'numbered-list' ||
            type === 'list'
          ) {
            return b.content || '';
          }
          if (type === 'math' && b.content) {
            const c = b.content.trim();
            return c.startsWith('$') ? c : `$$${c}$$`;
          }
          if (type === 'table' && b.content) {
            try {
              const rows = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
              if (Array.isArray(rows)) {
                return 'Table: ' + rows.map((r: any) => (Array.isArray(r) ? r.join(', ') : String(r))).join('. ');
              }
            } catch {
              return b.content || '';
            }
          }
          if (type === 'diagram' || type === 'image') {
            const caption = b.settings?.caption || b.settings?.description || b.settings?.alt || '';
            return caption.trim() ? `Diagram showing: ${caption.trim()}.` : '';
          }
          if (type === 'question' && b.content) {
            try {
              const q = typeof b.content === 'string' ? JSON.parse(b.content) : b.content;
              return `Question: ${q.question || ''}. Correct answer: ${q.correct || ''}. ${q.explanation ? `Explanation: ${q.explanation}` : ''}`;
            } catch {
              return '';
            }
          }
          if (typeof b.content === 'string' && !b.content.startsWith('http') && !b.content.startsWith('data:')) {
            return b.content;
          }
          return '';
        })
        .map((p: string) => p.trim())
        .filter(Boolean);

      extracted = parts.join('. ');
    }
  } catch {
    if (rawContent.includes('<PLX>') || rawContent.includes('</PLX>')) {
      const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(rawContent);
      const body = plxMatch ? plxMatch[1].trim() : rawContent.trim();
      const tagRegex = /<(H1|H2|TEXT|B|I|U|MATH|LIST|ORDERED|TABLE|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
      const plxParts: string[] = [];
      let match;
      while ((match = tagRegex.exec(body)) !== null) {
        const tag = match[1].toUpperCase();
        const inner = (match[3] || '').trim();
        if (!inner) continue;
        if (tag === 'MATH') {
          plxParts.push(inner.startsWith('$') ? inner : `$$${inner}$$`);
        } else if (tag === 'QUES') {
          const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(inner);
          const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(inner);
          const firstSub = inner.search(/<(COR|INC|EXP)/i);
          const qBody = firstSub === -1 ? inner : inner.substring(0, firstSub).trim();
          const cor = corMatch ? (corMatch[1] || corMatch[2] || '') : '';
          const exp = expMatch ? (expMatch[1] || expMatch[2] || '') : '';
          plxParts.push(`Question: ${qBody}. ${cor ? `Answer: ${cor}.` : ''} ${exp ? `Explanation: ${exp}.` : ''}`);
        } else {
          plxParts.push(inner);
        }
      }
      extracted = plxParts.length > 0 ? plxParts.join('. ') : rawContent;
    } else {
      extracted = rawContent;
    }
  }

  if (!extracted.trim()) {
    extracted = `${noteTitle || 'Study Note'}. ${noteSummary || ''}`;
  }

  return stripDiagramsAndCleanForTTS(extracted);
}

const getBackendUrls = (): string[] => {
  const urls: string[] = [];

  // Always prioritize the primary production Render backend URL for mobile
  urls.push('https://colearn-backend-tzo9.onrender.com');

  if (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_BACKEND_URL) {
    urls.push((process.env as any).EXPO_PUBLIC_BACKEND_URL);
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    const origin = window.location.origin;
    if (!origin.includes(':8081') && !origin.includes(':19000') && !origin.includes(':8082')) {
      urls.push(origin);
    }
  }

  return Array.from(new Set(urls.filter(Boolean).map(u => u.replace(/\/+$/, ''))));
};

function splitTextToSentences(text: string): string[] {
  return text
    .replace(/([.?!;]+)\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Splits a single long sentence into small speakable clauses <= maxLen characters,
 * breaking at commas, colons, dashes, conjunctions, or word boundaries.
 */
function splitLongSentenceIntoSmallParts(sentence: string, maxLen: number): string[] {
  const results: string[] = [];
  const clauses = sentence
    .split(/(?<=[,:\-—;])\s+|\s+(?=(?:and|or|but|because|where|which|that|while|whereas|therefore|however)\b)/i)
    .map(c => c.trim())
    .filter(Boolean);

  let current = '';
  for (const clause of clauses) {
    const candidate = current ? `${current} ${clause}` : clause;
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current.trim().length > 0) {
        results.push(current.trim());
        current = '';
      }
      if (clause.length <= maxLen) {
        current = clause;
      } else {
        // Split at word boundaries so we never slice a word in half
        let remaining = clause.trim();
        while (remaining.length > maxLen) {
          let splitAt = remaining.lastIndexOf(' ', maxLen);
          if (splitAt <= 0) splitAt = maxLen;
          results.push(remaining.substring(0, splitAt).trim());
          remaining = remaining.substring(splitAt).trim();
        }
        current = remaining;
      }
    }
  }

  if (current.trim().length > 0) {
    results.push(current.trim());
  }

  return results;
}

/**
 * Splits text into small, fast-synthesizing chunks for the orderly Render queue:
 * - Chunk 0: max ~95 chars (synthesizes on Render & downloads in ~150-220ms for near-instant start)
 * - Chunk 1: max ~135 chars
 * - Chunks 2+: max ~165 chars (small 1-2 sentence chunks that download in the background queue)
 */
export function splitTextIntoChunks(text: string): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  const getTargetMaxLen = (chunkIdx: number): number => {
    if (chunkIdx === 0) return 95;
    if (chunkIdx === 1) return 135;
    return 165;
  };

  if (clean.length <= getTargetMaxLen(0)) return [clean];

  const sentences = splitTextToSentences(clean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const targetLimit = getTargetMaxLen(chunks.length);
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

    if (candidate.length <= targetLimit) {
      currentChunk = candidate;
    } else {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const nextLimit = getTargetMaxLen(chunks.length);
      if (sentence.length <= nextLimit) {
        currentChunk = sentence;
      } else {
        const subParts = splitLongSentenceIntoSmallParts(sentence, nextLimit);
        for (let i = 0; i < subParts.length - 1; i++) {
          chunks.push(subParts[i]);
        }
        currentChunk = subParts[subParts.length - 1] || '';
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

// Persistent LRU cache of downloaded chunk audio files (key -> local fileUri or blobUrl)
const MAX_CACHED_CHUNKS = 80;
const chunkAudioCache = new Map<string, string>();
const inFlightChunkDownloads = new Map<string, Promise<string>>();
let chunkFileCounter = 0;

function getChunkCacheKey(voice: string, rate: string | undefined, chunkText: string): string {
  return `${voice}|${rate || ''}|${chunkText}`;
}

async function storeChunkInCache(key: string, uri: string): Promise<void> {
  if (chunkAudioCache.has(key)) {
    chunkAudioCache.delete(key);
  }
  chunkAudioCache.set(key, uri);

  if (chunkAudioCache.size > MAX_CACHED_CHUNKS) {
    const oldestKey = chunkAudioCache.keys().next().value;
    if (oldestKey) {
      const oldUri = chunkAudioCache.get(oldestKey);
      chunkAudioCache.delete(oldestKey);
      if (oldUri && Platform.OS !== 'web') {
        FileSystem.deleteAsync(oldUri, { idempotent: true }).catch(() => {});
      }
    }
  }
}

/**
 * Helper to POST JSON to Render /api/tts via XMLHttpRequest blob + FileReader
 */
function downloadPostTTSViaXHR(
  url: string,
  payload: { text: string; voice: string; rate?: string },
  targetFileUri: string,
  isStale: () => boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isStale()) {
      reject(new Error('Aborted'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.responseType = 'blob';
    xhr.timeout = 14000;

    xhr.onload = () => {
      if (isStale()) {
        reject(new Error('Aborted'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        const blob = xhr.response;
        if (Platform.OS === 'web') {
          resolve(URL.createObjectURL(blob));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            if (isStale()) {
              reject(new Error('Aborted'));
              return;
            }
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            if (!base64Data || base64Data.length < 100) {
              reject(new Error('Empty audio payload from XHR'));
              return;
            }
            await FileSystem.writeAsStringAsync(targetFileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            resolve(targetFileUri);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('FileReader failed on TTS blob'));
        reader.readAsDataURL(blob);
      } else {
        reject(new Error(`HTTP ${xhr.status} from ${url}`));
      }
    };

    xhr.onerror = () => reject(new Error(`XHR network error for ${url}`));
    xhr.ontimeout = () => reject(new Error(`XHR timeout for ${url}`));

    try {
      xhr.send(JSON.stringify(payload));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads a single small TTS chunk from Render (or returns immediately if cached / in-flight).
 */
async function downloadChunkFromRender(
  chunkText: string,
  voice: string,
  rate: string | undefined,
  isStale: () => boolean,
  onProgress?: (pct: number) => void
): Promise<string> {
  const cacheKey = getChunkCacheKey(voice, rate, chunkText);

  // 1. Check completed cache first for 0ms instant hit
  const cachedUri = chunkAudioCache.get(cacheKey);
  if (cachedUri) {
    if (Platform.OS === 'web') {
      onProgress?.(99);
      return cachedUri;
    }
    try {
      const info = await FileSystem.getInfoAsync(cachedUri);
      if (info.exists && (info.size === undefined || info.size > 100)) {
        onProgress?.(99);
        return cachedUri;
      }
    } catch {}
    chunkAudioCache.delete(cacheKey);
  }

  // 2. Check if this exact chunk is already downloading in-flight (e.g. from prefetchNoteAudio)
  const existingInFlight = inFlightChunkDownloads.get(cacheKey);
  if (existingInFlight) {
    try {
      const uri = await existingInFlight;
      if (isStale()) throw new Error('Aborted');
      onProgress?.(99);
      return uri;
    } catch (e) {
      if (isStale()) throw new Error('Aborted');
      // If the in-flight prefetch failed, fall through to fresh download
    }
  }

  const downloadTask = (async (): Promise<string> => {
    const backendUrls = getBackendUrls();
    let lastError: any = null;

    for (const baseUrl of backendUrls) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (isStale()) throw new Error('Aborted');

        const fileId = `${++chunkFileCounter}_${Date.now()}`;

        // Primary Native Method: Direct binary stream download via FileSystem.createDownloadResumable
        if (Platform.OS !== 'web' && FileSystem.cacheDirectory) {
          const getFileUri = `${FileSystem.cacheDirectory}colearn_tts_q_${fileId}.mp3`;
          let timeoutId: any = null;
          let downloadResumable: FileSystem.DownloadResumable | null = null;

          try {
            if (attempt === 0) onProgress?.(35);
            const getTtsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(chunkText)}&voice=${encodeURIComponent(voice)}${rate ? `&rate=${encodeURIComponent(rate)}` : ''}`;
            downloadResumable = FileSystem.createDownloadResumable(getTtsUrl, getFileUri);
            currentDownloadResumables.push(downloadResumable);

            const timeoutPromise = new Promise<null>((_, reject) => {
              timeoutId = setTimeout(() => {
                if (downloadResumable) {
                  downloadResumable.cancelAsync().catch(() => {});
                }
                reject(new Error('Render GET TTS timeout'));
              }, 12000);
            });

            const result = await Promise.race([
              downloadResumable.downloadAsync(),
              timeoutPromise,
            ]);

            if (timeoutId) clearTimeout(timeoutId);
            currentDownloadResumables = currentDownloadResumables.filter(d => d !== downloadResumable);

            if (isStale()) {
              FileSystem.deleteAsync(getFileUri, { idempotent: true }).catch(() => {});
              throw new Error('Aborted');
            }

            if (result && result.status >= 200 && result.status < 300) {
              const info = await FileSystem.getInfoAsync(result.uri);
              if (info.exists && (info.size === undefined || info.size > 100)) {
                onProgress?.(99);
                await storeChunkInCache(cacheKey, result.uri);
                return result.uri;
              }
            }
            FileSystem.deleteAsync(getFileUri, { idempotent: true }).catch(() => {});
          } catch (e: any) {
            if (timeoutId) clearTimeout(timeoutId);
            if (downloadResumable) {
              currentDownloadResumables = currentDownloadResumables.filter(d => d !== downloadResumable);
            }
            FileSystem.deleteAsync(getFileUri, { idempotent: true }).catch(() => {});
            if (isStale()) throw new Error('Aborted');
            lastError = e;
          }
        }

        if (isStale()) throw new Error('Aborted');

        // Secondary Method: POST /api/tts via XMLHttpRequest Blob
        const postFileUri = `${FileSystem.cacheDirectory || ''}colearn_tts_post_q_${fileId}.mp3`;
        try {
          onProgress?.(60);
          const uri = await downloadPostTTSViaXHR(
            `${baseUrl}/api/tts`,
            { text: chunkText, voice, rate },
            postFileUri,
            isStale
          );
          if (isStale()) {
            if (Platform.OS !== 'web') {
              FileSystem.deleteAsync(postFileUri, { idempotent: true }).catch(() => {});
            }
            throw new Error('Aborted');
          }
          onProgress?.(99);
          await storeChunkInCache(cacheKey, uri);
          return uri;
        } catch (e: any) {
          if (Platform.OS !== 'web') {
            FileSystem.deleteAsync(postFileUri, { idempotent: true }).catch(() => {});
          }
          if (isStale()) throw new Error('Aborted');
          lastError = e;
        }
      }
    }

    throw lastError || new Error('Failed to download TTS chunk from Render');
  })();

  inFlightChunkDownloads.set(cacheKey, downloadTask);
  try {
    return await downloadTask;
  } finally {
    if (inFlightChunkDownloads.get(cacheKey) === downloadTask) {
      inFlightChunkDownloads.delete(cacheKey);
    }
  }
}

/**
 * Pre-warms the Render TTS backend and silently pre-downloads the first 2 small chunks
 * of a note into the cache so playback starts instantaneously when the student taps "Listen".
 */
export async function prefetchNoteAudio(
  rawText: string,
  voiceId?: string,
  rate?: string
): Promise<void> {
  try {
    if (!rawText || !rawText.trim()) return;
    const cleaned = stripDiagramsAndCleanForTTS(rawText);
    if (!cleaned) return;

    const chunks = splitTextIntoChunks(cleaned);
    if (chunks.length === 0) return;

    const voice = voiceId || (await getDefaultVoice());

    // Download Chunk 0 first so it is cached on disk ready for 0ms playback
    await downloadChunkFromRender(chunks[0], voice, rate, () => false);

    // Then silently pre-download Chunk 1 in order
    if (chunks.length > 1) {
      await downloadChunkFromRender(chunks[1], voice, rate, () => false);
    }
  } catch {
    // Silent background prefetch — ignore network errors when offline
  }
}

interface QueuedChunkItem {
  index: number;
  text: string;
  status: 'pending' | 'downloading' | 'ready' | 'failed';
  uri?: string;
  downloadPromise?: Promise<string>;
  preloadedSound?: Audio.Sound | null;
  preloadPromise?: Promise<Audio.Sound | null>;
}

export async function speakText(
  rawText: string,
  optionsOrOnDone?: SpeakOptions | (() => void)
): Promise<void> {
  const options: SpeakOptions | undefined =
    typeof optionsOrOnDone === 'function'
      ? { onDone: optionsOrOnDone }
      : optionsOrOnDone;

  // Increment session ID and stop all previous speech/downloads immediately
  const mySessionId = ++activeSessionId;
  stopListeners.forEach((cb) => {
    try {
      cb(mySessionId);
    } catch {}
  });
  await cleanupAllSoundsAndDownloads();

  const isStale = () => mySessionId !== activeSessionId;

  // Strip diagrams and clean text before synthesizing speech
  const text = stripDiagramsAndCleanForTTS(rawText);

  if (!text || !text.trim()) {
    if (!isStale()) options?.onDone?.();
    return;
  }

  const voice = options?.voiceId || (await getDefaultVoice());
  if (isStale()) return;

  // Break lecture note into small chunks for fast generation & orderly queueing
  const chunks = splitTextIntoChunks(text);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    if (!isStale()) options?.onDone?.();
    return;
  }

  // Configure Audio mode once up front
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {}

  // Build the orderly playback queue
  const queue: QueuedChunkItem[] = chunks.map((chunkText, index) => ({
    index,
    text: chunkText,
    status: 'pending',
  }));

  let currentPlayIndex = 0;
  let activeDownloadsCount = 0;
  const MAX_CONCURRENT_DOWNLOADS = 2;
  const MAX_BUFFER_AHEAD = 6;

  // Pre-creates and decodes the Audio.Sound instance for a downloaded chunk so there is 0ms gap between chunks
  const preloadChunkSound = (index: number): Promise<Audio.Sound | null> => {
    if (index < 0 || index >= totalChunks || isStale()) return Promise.resolve(null);
    const item = queue[index];
    if (item.preloadedSound) return Promise.resolve(item.preloadedSound);
    if (item.preloadPromise) return item.preloadPromise;
    if (!item.uri) return Promise.resolve(null);

    const p = (async (): Promise<Audio.Sound | null> => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: item.uri! },
          { shouldPlay: false }
        );
        if (isStale()) {
          await sound.unloadAsync().catch(() => {});
          return null;
        }
        allActiveSounds.add(sound);
        item.preloadedSound = sound;
        return sound;
      } catch {
        return null;
      }
    })();

    item.preloadPromise = p;
    return p;
  };

  // Starts downloading a specific chunk in the queue and triggers the next queued download when done
  const startQueuedDownload = (index: number): Promise<string> => {
    const item = queue[index];
    if (item.downloadPromise) return item.downloadPromise;

    item.status = 'downloading';
    activeDownloadsCount++;

    const p = downloadChunkFromRender(
      item.text,
      voice,
      options?.rate,
      isStale,
      index === 0
        ? (pct) => {
            if (!isStale()) options?.onPreparing?.(pct);
          }
        : undefined
    )
      .then((uri) => {
        item.uri = uri;
        item.status = 'ready';
        // Immediately preload the Audio.Sound if this is the current or next chunk to play
        if (!isStale() && (index === currentPlayIndex || index === currentPlayIndex + 1)) {
          preloadChunkSound(index);
        }
        return uri;
      })
      .catch((err) => {
        item.status = 'failed';
        throw err;
      })
      .finally(() => {
        activeDownloadsCount = Math.max(0, activeDownloadsCount - 1);
        if (!isStale()) {
          pumpDownloadQueue();
        }
      });

    item.downloadPromise = p;
    return p;
  };

  // Continuously pumps the download queue in strict sequential order (0 -> 1 -> 2 -> 3...)
  const pumpDownloadQueue = () => {
    if (isStale()) return;

    // Prioritize Chunk 0 alone until Chunk 0 is ready so first audio starts as fast as possible
    if (queue[0].status === 'pending') {
      startQueuedDownload(0);
      return;
    }
    if (queue[0].status === 'downloading') {
      return;
    }

    // Once Chunk 0 is ready, download subsequent chunks in strict sequential order
    const maxIndexToBuffer = Math.min(totalChunks - 1, currentPlayIndex + MAX_BUFFER_AHEAD);
    for (let i = currentPlayIndex; i <= maxIndexToBuffer; i++) {
      if (activeDownloadsCount >= MAX_CONCURRENT_DOWNLOADS) break;
      if (queue[i].status === 'pending') {
        startQueuedDownload(i);
      }
    }
  };

  try {
    if (!isStale()) options?.onPreparing?.(15);

    // Kick off the orderly queue starting with Chunk 0
    pumpDownloadQueue();

    // Consumer loop: play chunks in strict sequential order (0, 1, 2, ..., totalChunks - 1)
    while (currentPlayIndex < totalChunks) {
      if (isStale()) return;

      const currentItem = queue[currentPlayIndex];
      const downloadPromise = currentItem.downloadPromise || startQueuedDownload(currentPlayIndex);

      let uri = '';
      try {
        uri = await downloadPromise;
        if (isStale()) return;
      } catch (err: any) {
        if (isStale()) return;
        console.warn(`Render TTS unreachable for chunk ${currentPlayIndex}, using offline fallback:`, err?.message || err);

        // Pump subsequent downloads while offline fallback speaks
        pumpDownloadQueue();

        await new Promise<void>((resolve) => {
          if (isStale()) {
            resolve();
            return;
          }
          Speech.speak(currentItem.text, {
            language: 'en',
            rate: 0.92,
            onStart: () => {
              if (isStale()) {
                Speech.stop().catch(() => {});
                resolve();
                return;
              }
              if (currentPlayIndex === 0) {
                options?.onPreparing?.(100);
                options?.onStart?.();
              }
            },
            onDone: () => resolve(),
            onStopped: () => resolve(),
            onError: () => resolve(),
          });
        });
        currentPlayIndex++;
        continue;
      }

      if (isStale()) return;

      // Ensure background download queue is actively fetching upcoming chunks (1, 2, 3...)
      pumpDownloadQueue();

      // If the next chunk is already downloaded, ensure its Audio.Sound is preloaded in memory
      if (currentPlayIndex + 1 < totalChunks && queue[currentPlayIndex + 1].status === 'ready') {
        preloadChunkSound(currentPlayIndex + 1);
      }

      let sound: Audio.Sound | null = currentItem.preloadedSound || null;
      if (!sound) {
        sound = await preloadChunkSound(currentPlayIndex);
      }

      if (isStale()) {
        if (sound) await sound.unloadAsync().catch(() => {});
        return;
      }

      if (!sound) {
        currentPlayIndex++;
        continue;
      }

      // Stop any previous sound instance cleanly before starting this chunk
      if (activeSound && activeSound !== sound) {
        try {
          await activeSound.stopAsync();
          await activeSound.unloadAsync();
        } catch {}
        allActiveSounds.delete(activeSound);
      }

      activeSound = sound;
      allActiveSounds.add(sound);

      if (currentPlayIndex === 0) {
        options?.onPreparing?.(100);
        options?.onStart?.();
      }

      const playingIdx = currentPlayIndex;
      await new Promise<void>((resolve) => {
        let resolved = false;
        const finishChunk = () => {
          if (resolved) return;
          resolved = true;
          if (sound) {
            allActiveSounds.delete(sound);
            if (activeSound === sound) activeSound = null;
            currentItem.preloadedSound = null;
            sound.unloadAsync().catch(() => {});
          }
          resolve();
        };

        sound!.setOnPlaybackStatusUpdate((status) => {
          if (isStale()) {
            finishChunk();
            return;
          }

          if (status.isLoaded) {
            if (status.durationMillis && status.durationMillis > 0) {
              const chunkWeight = 100 / totalChunks;
              const currentChunkProgress = (status.positionMillis / status.durationMillis) * chunkWeight;
              const overallPct = Math.min(100, Math.round(playingIdx * chunkWeight + currentChunkProgress));
              options?.onPlaybackProgress?.(overallPct);
            }
            if (status.didJustFinish) {
              finishChunk();
            }
          } else if ((status as any).error) {
            finishChunk();
          }
        });

        sound!.playAsync().catch(() => {
          finishChunk();
        });
      });

      currentPlayIndex++;
    }

    if (!isStale()) {
      options?.onPlaybackProgress?.(100);
      options?.onDone?.();
    }
  } catch (err: any) {
    if (!isStale()) {
      console.error('Sequential Mobile TTS error:', err);
      options?.onError?.(err);
    }
  }
}
