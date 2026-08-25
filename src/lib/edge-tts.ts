import { Communicate } from 'edge-tts-universal';
import crypto from 'crypto';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: string;
}

export const MICROSOFT_VOICES = [
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

// In-memory TTS audio cache: Key -> Buffer
const ttsAudioCache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 120;

function getCacheKey(text: string, voice: string, rate: string): string {
  const hash = crypto.createHash('md5').update(text).digest('hex');
  return `${voice}_${rate}_${hash}`;
}

/**
 * Standardizes rate format to strictly match /^[+-]\d+%$/ expected by edge-tts-universal.
 */
function formatRate(rate?: string): string {
  if (!rate) return '+0%';
  const trimmed = rate.trim();
  if (trimmed === 'default' || trimmed === '0%' || trimmed === '0') {
    return '+0%';
  }
  if (/^[+-]\d+%$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[+-]\d+$/.test(trimmed)) {
    return trimmed + '%';
  }
  if (/^\d+%$/.test(trimmed)) {
    return '+' + trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return '+' + trimmed + '%';
  }
  return '+0%';
}

function sanitizeTextForTTS(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Streams TTS audio chunks directly via callback while populating cache.
 */
export async function streamEdgeTTS(
  options: TTSOptions,
  onAudioChunk: (chunk: Buffer) => void
): Promise<Buffer> {
  const rawText = options.text || '';
  const text = sanitizeTextForTTS(rawText);
  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const voice = options.voice || 'en-US-AriaNeural';
  const rate = formatRate(options.rate);
  const cacheKey = getCacheKey(text, voice, rate);

  // Check in-memory cache
  if (ttsAudioCache.has(cacheKey)) {
    const cachedBuffer = ttsAudioCache.get(cacheKey)!;
    onAudioChunk(cachedBuffer);
    return cachedBuffer;
  }

  const communicate = new Communicate(text, {
    voice,
    rate,
  });

  const chunks: Buffer[] = [];
  try {
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
        onAudioChunk(chunk.data);
      }
    }
  } catch (streamErr: any) {
    console.error(`Edge TTS stream error for voice "${voice}":`, streamErr?.message || streamErr);
    // If voice failed and wasn't default, attempt fallback with default voice
    if (voice !== 'en-US-AriaNeural') {
      console.log('Attempting fallback to en-US-AriaNeural...');
      const fallbackComm = new Communicate(text, { voice: 'en-US-AriaNeural', rate });
      for await (const chunk of fallbackComm.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          chunks.push(chunk.data);
          onAudioChunk(chunk.data);
        }
      }
    } else {
      throw streamErr;
    }
  }

  if (chunks.length === 0) {
    throw new Error('No audio data received from Microsoft Edge TTS');
  }

  const fullBuffer = Buffer.concat(chunks);

  // Evict oldest entry if cache limit reached
  if (ttsAudioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ttsAudioCache.keys().next().value;
    if (firstKey) ttsAudioCache.delete(firstKey);
  }
  ttsAudioCache.set(cacheKey, fullBuffer);

  return fullBuffer;
}

/**
 * Robust Text-to-Speech function that uses edge-tts-universal with caching.
 */
export async function generateEdgeTTS(options: TTSOptions): Promise<Buffer> {
  const text = options.text?.trim();
  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const voice = options.voice || 'en-US-AriaNeural';
  const rate = formatRate(options.rate);
  const cacheKey = getCacheKey(text, voice, rate);

  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey)!;
  }

  return await streamEdgeTTS(options, () => {});
}
