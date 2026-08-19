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

const VOICE_STORE_KEY = 'colearn_default_voice';
let activeAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;
let isAudioUnlocked = false;

/**
 * Prime audio element on user click to comply with browser autoplay policies.
 */
export function unlockAudioContext(): void {
  if (isAudioUnlocked || typeof window === 'undefined') return;
  try {
    const dummyAudio = new Audio();
    dummyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    dummyAudio.volume = 0.001;
    dummyAudio.play().then(() => {
      dummyAudio.pause();
      isAudioUnlocked = true;
    }).catch(() => {});
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
    activeAudio = null;
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
  if (activeAudio && activeAudio.paused) {
    activeAudio.play().catch((err) => console.error('Resume playback error:', err));
  } else if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

export function isSpeechPaused(): boolean {
  if (activeAudio) return activeAudio.paused;
  if (typeof window !== 'undefined' && window.speechSynthesis) return window.speechSynthesis.paused;
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

function splitTextToSentences(text: string): string[] {
  return text
    .replace(/([.?!;])\s+/g, "$1|")
    .split("|")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function splitTextIntoChunks(text: string, maxChunkLength = 1200): string[] {
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

async function fetchChunkAudio(
  text: string,
  voice: string,
  rate: string | undefined,
  signal: AbortSignal,
  onPreparing?: (progressPercent: number) => void
): Promise<string> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  const textLength = text.length;
  const estimatedTotalBytes = Math.max(6000, textLength * 450);

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (onPreparing) {
          const prepPercent = Math.min(98, Math.round((receivedBytes / estimatedTotalBytes) * 100));
          onPreparing(prepPercent);
        }
      }
    }
  } else {
    const arrayBuffer = await response.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
  }

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (chunks.length === 0) {
    throw new Error('Received 0 bytes from TTS endpoint');
  }

  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
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
 * Converts LaTeX formulas to phonetically clean English for TTS
 */
export function convertLatexToSpeakable(text: string): string {
  if (!text) return '';
  return text.replace(/\$\$?([\s\S]+?)\$\$?/g, (_, formula) => {
    let speakable = formula.trim();

    speakable = speakable.replace(/\\left/g, '').replace(/\\right/g, '');
    speakable = speakable.replace(/\\mathrm/g, '');
    speakable = speakable.replace(/\\text\s*\{([^}]+)\}/g, ' $1 ');
    speakable = speakable.replace(/\\mathrm\s*\{([^}]+)\}/g, ' $1 ');

    speakable = speakable.replace(/\\sin\b/g, ' sine of, ');
    speakable = speakable.replace(/\\cos\b/g, ' cosine of, ');
    speakable = speakable.replace(/\\tan\b/g, ' tangent of, ');
    speakable = speakable.replace(/\\ln\b/g, ' natural log of, ');
    speakable = speakable.replace(/\\log\b/g, ' log of, ');

    speakable = speakable.replace(/\\vec\{(\w)\}/g, ' vector $1, ');
    speakable = speakable.replace(/\\bar\{(\w)\}/g, ' $1 bar, ');
    speakable = speakable.replace(/\\hat\{(\w)\}/g, ' $1 hat, ');

    speakable = speakable.replace(/\\lim_\{([^\}]+)\s*\\to\s*([^}]+)\}/g, ' limit as $1 approaches $2, ');
    speakable = speakable.replace(/\\lim_\{([^\}]+)\}/g, ' limit as $1, ');

    speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' sum from $1 to $2 of, ');
    speakable = speakable.replace(/\\sum_\{([^\}]+)\}\^(\w)/g, ' sum from $1 to $2 of, ');
    speakable = speakable.replace(/\\sum\b/g, ' sum ');

    speakable = speakable.replace(/\\int_\{([^\}]+)\}\^\{([^\}]+)\}/g, ' integral from $1 to $2 of, ');
    speakable = speakable.replace(/\\int_\{([^\}]+)\}\^(\w)/g, ' integral from $1 to $2 of, ');
    speakable = speakable.replace(/\\int\b/g, ' integral ');

    speakable = speakable.replace(/\\frac\{d(\w)\}\{d(\w)\}/g, ' derivative of $1 with respect to $2, ');
    speakable = speakable.replace(/\\frac\{\\partial\s*(\w)\}\{\\partial\s*(\w)\}/g, ' partial derivative of $1 with respect to $2, ');

    let prev;
    do {
      prev = speakable;
      speakable = speakable.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, ' ($1 divided by $2) ');
    } while (speakable !== prev);

    speakable = speakable.replace(/(\w+)\^2\b/g, '$1 squared ');
    speakable = speakable.replace(/(\w+)\^3\b/g, '$1 cubed ');
    speakable = speakable.replace(/\{?([^}^^]+)\}?\^\{([^}]+)\}/g, '$1 to the power of $2 ');

    speakable = speakable.replace(/\\sqrt\s*\{([^}]+)\}/g, ' square root of $1 ');

    return ` ${speakable} `;
  });
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
  cleaned = cleaned
    .replace(/#+\s+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

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

  const chunks = splitTextIntoChunks(text, 1200);
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

    // Pre-fetch second chunk immediately
    if (totalChunks > 1) {
      startFetchingChunk(1);
    }

    let currentIndex = 0;

    // Play each chunk sequentially
    while (currentIndex < totalChunks) {
      if (abortController.signal.aborted) return;

      startFetchingChunk(currentIndex);

      const currentUrl = await fetchPromises[currentIndex]!;
      if (abortController.signal.aborted) return;

      if (currentIndex + 1 < totalChunks) {
        startFetchingChunk(currentIndex + 1);
      }

      const audio = new Audio(currentUrl);
      activeAudio = audio;

      if (currentIndex === 0) {
        options?.onPreparing?.(100);
        options?.onStart?.();
      }

      await new Promise<void>((resolve, reject) => {
        const onEnded = () => {
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null;
          try {
            URL.revokeObjectURL(currentUrl);
          } catch {}
          resolve();
        };

        const onError = (e: any) => {
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null;
          try {
            URL.revokeObjectURL(currentUrl);
          } catch {}
          reject(e);
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

    activeAudio = null;
    options?.onDone?.();
  } catch (err: any) {
    if (err.name === 'AbortError') {
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
