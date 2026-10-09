import { getBackendCandidates } from './backendConfig';

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
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US Male - News/Academic)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-MichelleNeural', name: 'Michelle (US Female - Conversational)', lang: 'en-US', gender: 'Female' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha (Australia Female - Natural)', lang: 'en-AU', gender: 'Female' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (India Female - Natural)', lang: 'en-IN', gender: 'Female' },
  { id: 'en-KE-AsiliaNeural', name: 'Asilia (Kenya Female - Natural)', lang: 'en-KE', gender: 'Female' },
  { id: 'en-ZA-LeahNeural', name: 'Leah (South Africa Female - Natural)', lang: 'en-ZA', gender: 'Female' },
];

const VOICE_STORE_KEY = 'colearn_default_voice';
let activeAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;
let isAudioUnlocked = false;
let currentSpokenChunkText = '';

export function getCurrentSpokenText(): string {
  return currentSpokenChunkText;
}

/**
 * Pre-created and unlocked audio element to bypass Chrome/Safari/Firefox autoplay restrictions
 */
function getOrCreateAudioElement(): HTMLAudioElement {
  if (typeof window === 'undefined') {
    throw new Error('Audio element only available in browser environment');
  }
  if (!activeAudio) {
    activeAudio = new Audio();
    activeAudio.preload = 'auto';
    // Preserve volume settings
    activeAudio.volume = 1.0;
  }
  return activeAudio;
}

/**
 * Prime audio element on user click to comply with browser autoplay policies across Chrome, Safari, Firefox and Edge.
 */
export function unlockAudioContext(): void {
  if (typeof window === 'undefined') return;
  try {
    const audio = getOrCreateAudioElement();
    if (!isAudioUnlocked) {
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      audio.volume = 0.01;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
        isAudioUnlocked = true;
      }).catch(() => {
        // Even if immediate play promise is pending, element is primed
        isAudioUnlocked = true;
      });
    }
  } catch {}
}

export async function getDefaultVoice(): Promise<string> {
  if (typeof window === 'undefined') return 'en-US-AriaNeural';
  const idbVal = await getIndexedDBItem(VOICE_STORE_KEY);
  if (idbVal) return idbVal;
  return localStorage.getItem(VOICE_STORE_KEY) || 'en-US-AriaNeural';
}

export async function setDefaultVoice(voiceId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOICE_STORE_KEY, voiceId);
  await setIndexedDBItem(VOICE_STORE_KEY, voiceId).catch(() => {});
}

export function stopSpeech(): void {
  currentSpokenChunkText = '';
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = '';
    } catch {}
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

export function pauseSpeech(): void {
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
  } else if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech(): void {
  if (activeAudio && activeAudio.paused && activeAudio.src) {
    activeAudio.play().catch((err) => console.error('Resume playback error:', err));
  } else if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

export function isSpeechPaused(): boolean {
  if (activeAudio && activeAudio.src) return activeAudio.paused;
  if (typeof window !== 'undefined' && window.speechSynthesis) return window.speechSynthesis.paused;
  return false;
}

export interface SpeakOptions {
  voiceId?: string;
  rate?: string;
  disallowNativeFallback?: boolean; // Strictly forbid robotic window.speechSynthesis fallback
  onPreparing?: (progressPercent: number) => void;
  onStart?: () => void;
  onChunkStart?: (chunkIndex: number, totalChunks: number, chunkText: string) => void;
  onPlaybackProgress?: (playbackPercent: number) => void;
  onDone?: () => void;
  onError?: (err: any) => void;
}

function splitTextToSentences(text: string): string[] {
  return text
    .replace(/([.?!;])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Splits text into small, natural conversational sentence chunks (max ~220 characters).
 * Small chunks synthesize in 150-300ms, enabling instant audio start and seamless background pre-fetching.
 */
function splitTextIntoChunks(text: string, maxChunkLength = 220): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (clean.length <= maxChunkLength) return [clean];

  const sentences = splitTextToSentences(clean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    } else {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      // If a single sentence exceeds maxChunkLength, split on commas, colons, or dashes
      if (sentence.length > maxChunkLength) {
        const clauses = sentence.split(/(?<=[,:\-—])\s+/);
        let currentSub = '';
        for (const clause of clauses) {
          if ((currentSub + ' ' + clause).trim().length <= maxChunkLength) {
            currentSub = currentSub ? `${currentSub} ${clause}` : clause;
          } else {
            if (currentSub.trim().length > 0) {
              chunks.push(currentSub.trim());
            }
            currentSub = clause;
          }
        }
        currentChunk = currentSub;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Robust fetch for TTS chunks with automatic retries and multi-endpoint fallback
 */
async function fetchChunkAudio(
  text: string,
  voice: string,
  rate: string | undefined,
  signal: AbortSignal,
  onPreparing?: (progressPercent: number) => void
): Promise<string> {
  const backendEndpoints = getBackendCandidates('/api/tts');

  let lastError: any = null;

  // Try each endpoint with up to 2 attempts for network resilience
  for (const endpoint of backendEndpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // 1. Try POST request with JSON
      try {
        if (onPreparing) onPreparing(attempt === 0 ? 15 : 30);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, rate }),
          signal,
        });

        if (response.ok) {
          if (onPreparing) onPreparing(70);
          const blob = await response.blob();
          if (blob && blob.size > 100) {
            if (onPreparing) onPreparing(100);
            return URL.createObjectURL(blob);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err;
      }

      // 2. Try GET request with URL params as fallback
      try {
        const getUrl = `${endpoint}?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}${rate ? `&rate=${encodeURIComponent(rate)}` : ''}`;
        if (onPreparing) onPreparing(40);
        const response = await fetch(getUrl, {
          method: 'GET',
          signal,
        });

        if (response.ok) {
          if (onPreparing) onPreparing(85);
          const blob = await response.blob();
          if (blob && blob.size > 100) {
            if (onPreparing) onPreparing(100);
            return URL.createObjectURL(blob);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Failed to generate natural TTS audio from available servers');
}

/**
 * Fallback to browser's native SpeechSynthesis if server TTS is unreachable
 */
function speakWithBrowserSynthesis(text: string, options?: SpeakOptions) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    options?.onError?.(new Error('Speech synthesis not supported in this browser'));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Calculate rate
    if (options?.rate) {
      const match = options.rate.match(/([+-]?\d+)/);
      if (match) {
        const delta = parseInt(match[1], 10);
        utterance.rate = Math.max(0.5, Math.min(2.0, 1.0 + (delta / 100)));
      }
    }

    const voices = window.speechSynthesis.getVoices();
    const voicePref = options?.voiceId || 'en-US';
    const matchedVoice = voices.find(v => v.lang.includes(voicePref.substring(0, 5)) || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('google')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      options?.onDone?.();
    };

    utterance.onerror = (e) => {
      console.warn('Browser SpeechSynthesis error:', e);
      options?.onError?.(e);
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    options?.onError?.(err);
  }
}

/**
 * Converts mathematical formulas, Greek letters, and LaTeX/MathJax syntax to natural spoken English.
 * Covers algebra, calculus, matrices, trigonometry, physics/chemistry units, logic, and set theory.
 * Strips all raw backslashes and LaTeX formatting so the TTS sounds like an educated professor,
 * never pronouncing "backslash" or code syntax.
 */
function cleanMathFormula(formula: string, isMathContext = false): string {
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

  // 5. Strip fenced code blocks & diagram blocks
  cleaned = cleaned.replace(/```(?:mermaid|diagram|ascii|drawio|plantuml|python|javascript|typescript|js|ts|json|html|css|cpp|java|c|csharp)?[\s\S]*?```/gi, (match) => {
    if (/mermaid|diagram|drawio|plantuml|ascii/i.test(match)) {
      return ' [Diagram] ';
    }
    return ' ';
  });
  cleaned = cleaned.replace(/~~~[\s\S]*?~~~/g, ' ');

  // 6. Strip Markdown images ![alt](url)
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

  // 9. Clean up markdown headers, bold, italics, bullets, inline code
  // and strip any remaining backslashes completely
  cleaned = cleaned
    .replace(/#+\s+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\\/g, ' ') // Strip all stray backslashes
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 10. Strip all emojis, pictographs, symbols, and variation selectors so TTS never pronounces emoji names
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}\u{200D}\u{20E3}]/gu, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

export async function speakText(
  rawText: string,
  options?: SpeakOptions
): Promise<void> {
  stopSpeech();
  unlockAudioContext();

  const text = stripDiagramsAndCleanForTTS(rawText);

  if (!text || !text.trim()) {
    options?.onDone?.();
    return;
  }

  const voice = options?.voiceId || (await getDefaultVoice());
  const abortController = new AbortController();
  currentAbortController = abortController;

  const chunks = splitTextIntoChunks(text, 220);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    options?.onDone?.();
    return;
  }

  // Pre-fetch state maps and queues
  const blobUrls: (string | null)[] = new Array(totalChunks).fill(null);
  const fetchPromises: (Promise<string> | null)[] = new Array(totalChunks).fill(null);

  // Helper to start fetching a specific chunk
  const startFetchingChunk = (index: number) => {
    if (index >= totalChunks || fetchPromises[index]) return;
    
    fetchPromises[index] = fetchChunkAudio(
      chunks[index],
      voice,
      options?.rate,
      abortController.signal,
      index === 0 ? options?.onPreparing : undefined
    ).then((url) => {
      blobUrls[index] = url;
      return url;
    });
  };

  try {
    options?.onPreparing?.(0);
    // Start fetching first chunk immediately
    startFetchingChunk(0);

    // Pre-fetch second chunk immediately for zero-latency continuation
    if (totalChunks > 1) {
      startFetchingChunk(1);
    }

    let currentIndex = 0;

    // Play each chunk sequentially
    while (currentIndex < totalChunks) {
      if (abortController.signal.aborted) return;

      startFetchingChunk(currentIndex);

      let currentUrl: string | null = null;
      try {
        currentUrl = await fetchPromises[currentIndex]!;
      } catch (chunkErr: any) {
        if (abortController.signal.aborted) return;
        console.warn(`[ttsService] Chunk ${currentIndex} failed to fetch:`, chunkErr);
        // If the first chunk fails, re-throw to allow error handlers
        if (currentIndex === 0 && totalChunks === 1) {
          throw chunkErr;
        }
        // If a subsequent chunk fails, skip to next chunk so speech doesn't cut off completely
        currentIndex++;
        continue;
      }

      if (abortController.signal.aborted || !currentUrl) return;

      // Pre-fetch next 2 chunks in parallel to ensure continuous buffer
      if (currentIndex + 1 < totalChunks) {
        startFetchingChunk(currentIndex + 1);
      }
      if (currentIndex + 2 < totalChunks) {
        startFetchingChunk(currentIndex + 2);
      }

      const audio = getOrCreateAudioElement();
      audio.src = currentUrl;
      activeAudio = audio;

      currentSpokenChunkText = chunks[currentIndex];
      options?.onChunkStart?.(currentIndex, totalChunks, chunks[currentIndex]);

      if (currentIndex === 0) {
        options?.onPreparing?.(100);
        options?.onStart?.();
      }

      await new Promise<void>((resolve) => {
        const onEnded = () => {
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null;
          try {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
          } catch {}
          resolve();
        };

        const onError = (e: any) => {
          console.warn(`[ttsService] Audio element playback error on chunk ${currentIndex}:`, e);
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null;
          try {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
          } catch {}
          resolve(); // Resolve to let subsequent chunks play rather than halting
        };

        audio.onended = onEnded;
        audio.onerror = onError;

        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            const chunkWeight = 100 / totalChunks;
            const currentChunkProgress = (audio.currentTime / audio.duration) * chunkWeight;
            const overallPct = Math.min(100, Math.round(currentIndex * chunkWeight + currentChunkProgress));
            options?.onPlaybackProgress?.(overallPct);
          }
        };

        audio.play().catch(onError);
      });

      currentIndex++;
    }

    currentSpokenChunkText = '';
    activeAudio = null;
    options?.onDone?.();
  } catch (err: any) {
    currentSpokenChunkText = '';
    if (err.name === 'AbortError') {
      return;
    }
    if (options?.disallowNativeFallback) {
      console.warn('Server Edge TTS failed and disallowNativeFallback is set:', err);
      options?.onError?.(err);
      return;
    }
    console.warn('Edge TTS streaming encountered error, attempting SpeechSynthesis fallback:', err);
    // Graceful fallback to browser speech synthesis
    try {
      speakWithBrowserSynthesis(text, options);
    } catch (fallbackErr) {
      console.error('All TTS methods failed:', fallbackErr);
      options?.onError?.(err);
    }
  } finally {
    blobUrls.forEach((url) => {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    });

    if (currentAbortController === abortController) {
      currentAbortController = null;
    }
  }
}

async function getIndexedDBItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open('ColearnVoiceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('voiceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('voiceStore')) {
        resolve(null);
        return;
      }
      const transaction = db.transaction('voiceStore', 'readonly');
      const store = transaction.objectStore('voiceStore');
      const getRequest = store.get(key);
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function setIndexedDBItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ColearnVoiceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('voiceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const transaction = db.transaction('voiceStore', 'readwrite');
      const store = transaction.objectStore('voiceStore');
      const putRequest = store.put(value, key);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}
