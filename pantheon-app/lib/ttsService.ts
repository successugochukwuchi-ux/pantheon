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

