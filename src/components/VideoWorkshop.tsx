import React, { useState, useEffect, useRef } from 'react';
import { getBackendCandidates } from '../lib/backendConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  Video, 
  Mic, 
  Download, 
  Copy, 
  Sparkles, 
  Play, 
  Pause, 
  FileText, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Check, 
  Layers, 
  Clock, 
  ExternalLink,
  Code2,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  Database,
  RotateCcw,
  Key,
  Eye,
  EyeOff,
  AudioWaveform,
  Settings
} from 'lucide-react';
import { MICROSOFT_VOICES, stripDiagramsAndCleanForTTS } from '../lib/ttsService';
import { CloudinaryUpload } from './CloudinaryUpload';
import { 
  saveAudioChunk, 
  getAllAudioChunks, 
  clearAudioChunks, 
  getMergedAudioFromDB, 
  downloadBlobFile,
  saveWorkshopSetting,
  getWorkshopSetting,
  SETTINGS_KEYS
} from '../lib/workshopStorage';

const HARDCODED_OPENROUTER_API_KEY = "";
const DEFAULT_FISH_MODEL_ID = "fish-audio/s2.1-pro-free:free";

interface Asset {
  id: string;
  name: string;
  url: string;
  description: string;
}

interface SrtSegment {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export const VideoWorkshop: React.FC = () => {
  // Input Script State
  const [scriptText, setScriptText] = useState<string>(
    "Today we shall study Geometric Sequences and Geometric Series. " +
    "This topic is one of the fundamental concepts in elementary mathematics and has important applications in engineering, economics, finance, computer science, and many other fields. " +
    "A geometric sequence, or G.P., is a sequence of numbers where every term after the first is obtained by multiplying the previous term by a fixed non-zero constant called the common ratio r. " +
    "The nth term formula is given by a_n = a_1 * r^(n-1). " +
    "The sum of the first n terms of a finite geometric series is S_n = a_1 * (1 - r^n) / (1 - r) when r is not equal to 1."
  );

  // TTS Engine & Settings
  const [ttsProvider, setTtsProvider] = useState<'edge' | 'fish-audio'>('edge');
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-AriaNeural');
  const [speakingRate, setSpeakingRate] = useState<string>('+0%');

  // Fish Audio & OpenRouter Settings
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>(HARDCODED_OPENROUTER_API_KEY);
  const [fishAudioVoiceModelId, setFishAudioVoiceModelId] = useState<string>('');
  const [fishAudioModel, setFishAudioModel] = useState<string>(DEFAULT_FISH_MODEL_ID);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Asset Manager State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [newAssetName, setNewAssetName] = useState<string>('');
  const [newAssetUrl, setNewAssetUrl] = useState<string>('');
  const [newAssetDesc, setNewAssetDesc] = useState<string>('');

  // Generation Output State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const workshopAbortRef = useRef<AbortController | null>(null);
  const preferredEdgeEndpointRef = useRef<string | null>(null);
  
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [dbStats, setDbStats] = useState<{ count: number; sizeBytes: number } | null>(null);
  const [srtSegments, setSrtSegments] = useState<SrtSegment[]>([]);
  const [srtContent, setSrtContent] = useState<string>('');
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Restore cached audio segments and saved settings from IndexedDB on component mount
  useEffect(() => {
    // 1. Restore merged audio from IndexedDB
    getMergedAudioFromDB()
      .then((dbAudio) => {
        if (dbAudio && dbAudio.count > 0) {
          const blobUrl = URL.createObjectURL(dbAudio.blob);
          setAudioBuffer(dbAudio.buffer);
          setAudioBlobUrl(blobUrl);
          setDbStats({ count: dbAudio.count, sizeBytes: dbAudio.buffer.byteLength });
          const parsedDur = parseMp3DurationSeconds(dbAudio.buffer);
          if (parsedDur > 0) {
            setDuration(parsedDur);
          }
        }
      })
      .catch((err) => {
        console.warn('IndexedDB audio check:', err);
      });

    // 2. Restore saved settings from IndexedDB (OpenRouter API key, Custom Voice ID, Provider)
    Promise.all([
      getWorkshopSetting<string>(SETTINGS_KEYS.OPENROUTER_API_KEY),
      getWorkshopSetting<string>(SETTINGS_KEYS.FISH_AUDIO_VOICE_MODEL_ID),
      getWorkshopSetting<string>(SETTINGS_KEYS.TTS_PROVIDER),
      getWorkshopSetting<string>(SETTINGS_KEYS.SELECTED_VOICE)
    ]).then(([savedKey, savedVoiceId, savedProvider, savedVoice]) => {
      if (savedKey) setOpenRouterApiKey(savedKey);
      if (savedVoiceId) setFishAudioVoiceModelId(savedVoiceId);
      if (savedProvider === 'edge' || savedProvider === 'fish-audio') {
        setTtsProvider(savedProvider);
      }
      if (savedVoice) setSelectedVoice(savedVoice);
    }).catch(err => {
      console.warn('Error loading workshop settings from IndexedDB:', err);
    });
  }, []);

  // Save changes to IndexedDB
  const handleOpenRouterKeyChange = (val: string) => {
    setOpenRouterApiKey(val);
    saveWorkshopSetting(SETTINGS_KEYS.OPENROUTER_API_KEY, val);
  };

  const handleFishAudioVoiceIdChange = (val: string) => {
    setFishAudioVoiceModelId(val);
    saveWorkshopSetting(SETTINGS_KEYS.FISH_AUDIO_VOICE_MODEL_ID, val);
  };

  const handleProviderChange = (val: 'edge' | 'fish-audio') => {
    setTtsProvider(val);
    saveWorkshopSetting(SETTINGS_KEYS.TTS_PROVIDER, val);
  };

  // Audio Playback State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Helper to format seconds to SRT time format: HH:MM:SS,mmm (rounded to nearest millisecond)
  const formatSrtTime = (seconds: number): string => {
    const safeSec = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const totalMs = Math.round(safeSec * 1000);
    const hrs = Math.floor(totalMs / 3_600_000);
    const mins = Math.floor((totalMs % 3_600_000) / 60_000);
    const secs = Math.floor((totalMs % 60_000) / 1000);
    const millis = totalMs % 1000;

    const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
  };

  // Exact MPEG Layer III frame header parser to compute accurate MP3 duration in seconds
  function parseMp3DurationSeconds(buffer: ArrayBuffer): number {
    const bytes = new Uint8Array(buffer);
    const len = bytes.length;
    if (len < 4) return 0;

    // Bitrate tables (kbps) for Layer III
    const bitratesV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const bitratesV2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

    // Sample rates (Hz) by MPEG version index: 0=MPEG2.5, 2=MPEG2, 3=MPEG1
    const sampleRates: Record<number, number[]> = {
      0: [11025, 12000, 8000],
      2: [22050, 24000, 16000],
      3: [44100, 48000, 32000],
    };

    let offset = 0;
    let totalDuration = 0;
    let framesFound = 0;

    while (offset + 4 <= len) {
      // Skip ID3v2 tags at start or mid-stream (from concatenated chunks)
      if (
        offset + 10 <= len &&
        bytes[offset] === 0x49 &&
        bytes[offset + 1] === 0x44 &&
        bytes[offset + 2] === 0x33
      ) {
        const tagSize =
          ((bytes[offset + 6] & 0x7f) << 21) |
          ((bytes[offset + 7] & 0x7f) << 14) |
          ((bytes[offset + 8] & 0x7f) << 7) |
          (bytes[offset + 9] & 0x7f);
        offset += 10 + tagSize;
        continue;
      }

      // Skip ID3v1 tag (128 bytes starting with "TAG")
      if (
        offset + 128 <= len &&
        bytes[offset] === 0x54 &&
        bytes[offset + 1] === 0x41 &&
        bytes[offset + 2] === 0x47
      ) {
        offset += 128;
        continue;
      }

      // Check 11-bit frame sync word
      if (bytes[offset] === 0xff && (bytes[offset + 1] & 0xe0) === 0xe0) {
        const b1 = bytes[offset + 1];
        const b2 = bytes[offset + 2];
        const versionBits = (b1 >> 3) & 0x03; // 0=2.5, 1=reserved, 2=2, 3=1
        const layerBits = (b1 >> 1) & 0x03;   // 1=Layer III
        const bitrateIdx = (b2 >> 4) & 0x0f;
        const srIdx = (b2 >> 2) & 0x03;
        const padding = (b2 >> 1) & 0x01;

        if (
          versionBits !== 1 &&
          layerBits === 1 &&
          bitrateIdx > 0 &&
          bitrateIdx < 15 &&
          srIdx < 3
        ) {
          const sr = sampleRates[versionBits]?.[srIdx] || 0;
          const kbps = versionBits === 3 ? bitratesV1L3[bitrateIdx] : bitratesV2L3[bitrateIdx];
          if (sr > 0 && kbps > 0) {
            const samplesPerFrame = versionBits === 3 ? 1152 : 576;
            const coeff = versionBits === 3 ? 144 : 72;
            const frameSize = Math.floor((coeff * kbps * 1000) / sr) + padding;
            if (frameSize > 4) {
              totalDuration += samplesPerFrame / sr;
              framesFound++;
              offset += frameSize;
              continue;
            }
          }
        }
      }
      offset++;
    }

    if (framesFound > 0 && totalDuration > 0) {
      return totalDuration;
    }
    // Fallback for 48kbps mono stream
    return len > 0 ? (len * 8) / 48000 : 0;
  }

  // Estimate spoken syllable + prosodic pause weight of a sentence for intra-block timing
  const estimateSpokenWeight = (rawSentence: string): number => {
    const cleaned = (stripDiagramsAndCleanForTTS(rawSentence) || rawSentence).trim();
    if (!cleaned) return 1;

    // Expand numbers and common math operators to spoken word equivalents
    const expanded = cleaned
      .replace(/\d+(\.\d+)?/g, (m) => ' word '.repeat(Math.max(1, Math.min(6, m.length))))
      .replace(/[=+*/^<>≈≠≤≥±]/g, ' operator ');

    const words = expanded.split(/\s+/).filter(Boolean);
    let syllables = 0;
    for (const word of words) {
      const alpha = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!alpha) {
        syllables += 1;
        continue;
      }
      const vowelGroups = alpha.replace(/(?:[^laeiouy]es|ed|e)$/, '').match(/[aeiouy]{1,2}/g);
      syllables += Math.max(1, vowelGroups ? vowelGroups.length : 1);
    }

    // Add prosodic pause weights for internal and final punctuation
    const internalPauses = (cleaned.match(/[,;:—–-]/g) || []).length * 2.2;
    const endPause = /[.?!]$/.test(cleaned) ? 3.2 : 1.5;

    return Math.max(1, syllables + internalPauses + endPause);
  };

  // Helper to split text into clean, readable sentence blocks for SRT
  const splitTextToSentences = (text: string): string[] => {
    if (!text || !text.trim()) return [];

    // Protect common abbreviations and initials from false sentence splits
    const PROTECTED_DOT = '\u0000';
    const protectedText = text
      .replace(/\b(e\.g|i\.e|vs|etc|fig|eq|dr|mr|mrs|ms|prof|st|jr|sr|ch|sec|vol|no)\./gi, `$1${PROTECTED_DOT}`)
      .replace(/\b([A-Z])\.([A-Z])\./g, `$1${PROTECTED_DOT}$2${PROTECTED_DOT}`);

    const rawSentences = protectedText
      .replace(/\r?\n+/g, '|')
      .replace(/([.?!;]+)\s+/g, '$1|')
      .split('|')
      .map((s) => s.replace(new RegExp(PROTECTED_DOT, 'g'), '.').trim())
      .filter((s) => s.length > 0 && (stripDiagramsAndCleanForTTS(s) || '').trim().length > 0);

    // Break any overly long run-on sentences (> 240 chars) at natural clause boundaries so cues remain readable
    const finalSentences: string[] = [];
    for (const sentence of rawSentences) {
      if (sentence.length <= 240) {
        finalSentences.push(sentence);
      } else {
        const clauses = sentence
          .replace(/([,:—–]+)\s+/g, '$1|')
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);

        let currentCue = '';
        for (const clause of clauses) {
          const candidate = currentCue ? `${currentCue} ${clause}` : clause;
          if (candidate.length <= 220) {
            currentCue = candidate;
          } else {
            if (currentCue) finalSentences.push(currentCue);
            currentCue = clause;
          }
        }
        if (currentCue) finalSentences.push(currentCue);
      }
    }

    return finalSentences.length > 0 ? finalSentences : [text.trim()];
  };

  // Group sentences into compact synthesis blocks so each block maps to exact SRT sentences
  const groupSentencesIntoBlocks = (
    sentences: string[],
    maxBlockChars: number
  ): { text: string; sentences: string[] }[] => {
    const blocks: { text: string; sentences: string[] }[] = [];
    let currentSentences: string[] = [];
    let currentLen = 0;

    for (const sentence of sentences) {
      const addedLen = currentLen === 0 ? sentence.length : currentLen + 1 + sentence.length;
      if (currentSentences.length > 0 && addedLen > maxBlockChars) {
        blocks.push({
          text: currentSentences.join(' '),
          sentences: currentSentences,
        });
        currentSentences = [sentence];
        currentLen = sentence.length;
      } else {
        currentSentences.push(sentence);
        currentLen = addedLen;
      }
    }

    if (currentSentences.length > 0) {
      blocks.push({
        text: currentSentences.join(' '),
        sentences: currentSentences,
      });
    }

    return blocks;
  };

  // Split large text into sentence/clause-aligned chunks <= maxChunkLength without breaking words
  const splitTextIntoChunks = (text: string, maxChunkLength = 320): string[] => {
    const clean = text.trim();
    if (!clean) return [];
    if (clean.length <= maxChunkLength) return [clean];

    const sentences = splitTextToSentences(clean);
    const chunks: string[] = [];
    let currentChunk = '';

    const pushLongSentence = (sentence: string) => {
      // Split by clause punctuation (, : —) or words so we never slice mid-word
      const clauses = sentence
        .replace(/([,:—–-]+)\s+/g, '$1|')
        .split('|')
        .map(c => c.trim())
        .filter(Boolean);

      let clauseChunk = '';
      for (const clause of clauses) {
        if ((clauseChunk ? `${clauseChunk} ${clause}` : clause).length <= maxChunkLength) {
          clauseChunk = clauseChunk ? `${clauseChunk} ${clause}` : clause;
        } else {
          if (clauseChunk) {
            chunks.push(clauseChunk);
            clauseChunk = '';
          }
          if (clause.length <= maxChunkLength) {
            clauseChunk = clause;
          } else {
            const words = clause.split(/\s+/);
            let wordChunk = '';
            for (const word of words) {
              if ((wordChunk ? `${wordChunk} ${word}` : word).length <= maxChunkLength) {
                wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
              } else {
                if (wordChunk) chunks.push(wordChunk);
                wordChunk = word;
              }
            }
            clauseChunk = wordChunk;
          }
        }
      }
      if (clauseChunk) {
        currentChunk = clauseChunk;
      }
    };

    for (const sentence of sentences) {
      const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      if (candidate.length > maxChunkLength) {
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        if (sentence.length > maxChunkLength) {
          pushLongSentence(sentence);
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [clean];
  };

  // Splits a stubborn chunk into two balanced halves at the nearest clause or word boundary
  const splitChunkInHalf = (text: string): [string, string] | null => {
    const trimmed = text.trim();
    if (trimmed.length < 60) return null;
    const mid = Math.floor(trimmed.length / 2);

    // Look for sentence or clause break near midpoint
    let splitIdx = -1;
    const punctuationRegex = /[.?!;,:—–-]\s+/g;
    let match: RegExpExecArray | null;
    let bestDist = Infinity;

    while ((match = punctuationRegex.exec(trimmed)) !== null) {
      const candidateIdx = match.index + match[0].length;
      if (candidateIdx > 15 && candidateIdx < trimmed.length - 15) {
        const dist = Math.abs(candidateIdx - mid);
        if (dist < bestDist) {
          bestDist = dist;
          splitIdx = candidateIdx;
        }
      }
    }

    if (splitIdx === -1) {
      const leftSpace = trimmed.lastIndexOf(' ', mid);
      const rightSpace = trimmed.indexOf(' ', mid);
      if (leftSpace > 15) splitIdx = leftSpace + 1;
      else if (rightSpace > 15 && rightSpace < trimmed.length - 10) splitIdx = rightSpace + 1;
    }

    if (splitIdx <= 0 || splitIdx >= trimmed.length) return null;
    const left = trimmed.slice(0, splitIdx).trim();
    const right = trimmed.slice(splitIdx).trim();
    if (!left || !right) return null;
    return [left, right];
  };

  // Concatenate multiple ArrayBuffers into a single Uint8Array ArrayBuffer
  const concatArrayBuffers = (buffers: ArrayBuffer[]): ArrayBuffer => {
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return result.buffer;
  };

  // Handle Adding Asset
  const handleAddAsset = () => {
    if (!newAssetName.trim()) {
      toast.error('Please enter an asset name (e.g. geometric_formula.png)');
      return;
    }
    const newAsset: Asset = {
      id: Date.now().toString(),
      name: newAssetName.trim().replace(/\s+/g, '_'),
      url: newAssetUrl.trim() || 'local_asset.png',
      description: newAssetDesc.trim() || 'Visual asset diagram'
    };
    setAssets([...assets, newAsset]);
    setNewAssetName('');
    setNewAssetUrl('');
    setNewAssetDesc('');
    toast.success('Asset added to project workshop');
  };

  // Handle Removing Asset
  const handleRemoveAsset = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
    toast.success('Asset removed');
  };

  // Direct client-side fetch for Fish Audio / OpenRouter TTS when server proxy is unavailable
  const generateDirectOpenRouterAudio = async (text: string, voice?: string, model?: string, apiKey?: string): Promise<ArrayBuffer> => {
    const key = apiKey || openRouterApiKey || HARDCODED_OPENROUTER_API_KEY;
    const openrouterUrl = "https://openrouter.ai/api/v1/audio/speech";

    let actualModel = model || fishAudioModel || DEFAULT_FISH_MODEL_ID;
    let actualVoice = voice || fishAudioVoiceModelId;

    if (typeof actualModel === "string" && (!actualModel.includes("/") || actualModel.length === 32)) {
      if (!actualVoice || actualVoice === "alex" || actualVoice === "anna") {
        actualVoice = actualModel;
      }
      actualModel = DEFAULT_FISH_MODEL_ID;
    }

    const bodyObj: Record<string, any> = {
      model: actualModel,
      input: text,
      response_format: "mp3"
    };

    if (actualVoice && typeof actualVoice === "string" && actualVoice.trim().length > 0) {
      const cleanVoice = actualVoice.trim();
      if (!["alex", "anna", "benjamin", "eva"].includes(cleanVoice)) {
        bodyObj.voice = cleanVoice;
      }
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://ais-dev.run.app",
      "X-Title": "Fish Audio Voiceover Studio"
    };

    let response = await fetch(openrouterUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj)
    });

    if (!response.ok && response.status === 400 && bodyObj.voice) {
      delete bodyObj.voice;
      response = await fetch(openrouterUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj)
      });
    }

    if (!response.ok) {
      const resText = await response.text();
      let errDetail = resText;
      try {
        const errJson = JSON.parse(resText);
        if (errJson.error?.message) errDetail = errJson.error.message;
        else if (errJson.error) errDetail = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
      } catch {}
      throw new Error(`OpenRouter API Error (${response.status}): ${errDetail}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const json = await response.json();
      let b64: string | null = null;
      if (json.audio) b64 = json.audio;
      else if (json.data) b64 = json.data;

      if (b64) {
        const byteCharacters = atob(b64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        return byteArray.buffer;
      }
    }

    const blob = await response.blob();
    if (blob.type.includes("html") || blob.size === 0) {
      throw new Error("Received invalid audio format from OpenRouter API.");
    }
    return await blob.arrayBuffer();
  };

  // Helper: fetch with strict AbortController timeout so requests never stall
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number,
    parentSignal?: AbortSignal
  ): Promise<Response> => {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) {
        throw new DOMException('Workshop generation cancelled', 'AbortError');
      }
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    }
  };

  const isValidAudioBuffer = (buf: ArrayBuffer): boolean => {
    if (!buf || buf.byteLength <= 100) return false;
    const firstBytes = new Uint8Array(buf.slice(0, 5));
    // Reject HTML error pages (<!DOC or <html)
    const isHtml =
      firstBytes[0] === 60 &&
      ((firstBytes[1] === 33 && firstBytes[2] === 68) ||
        (firstBytes[1] === 104 && firstBytes[2] === 116));
    return !isHtml;
  };

  // Robust, stall-proof chunk fetcher with timeouts, endpoint caching, retries, and recursive sub-chunk fallback
  const fetchTTSChunk = async (
    textChunk: string, 
    voice: string, 
    rate: string, 
    provider: 'edge' | 'fish-audio',
    parentSignal?: AbortSignal,
    depth = 0
  ): Promise<ArrayBuffer> => {
    if (parentSignal?.aborted) {
      throw new DOMException('Workshop generation cancelled', 'AbortError');
    }

    const speakableText = (stripDiagramsAndCleanForTTS(textChunk) || textChunk).trim();
    if (!speakableText) {
      throw new Error('Empty speakable text in chunk');
    }

    if (provider === 'fish-audio') {
      const targetVoice = fishAudioVoiceModelId.trim() || voice;
      try {
        const response = await fetchWithTimeout(
          '/api/tts',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: speakableText,
              voice: targetVoice,
              model: fishAudioModel || DEFAULT_FISH_MODEL_ID,
              apiKey: openRouterApiKey || HARDCODED_OPENROUTER_API_KEY,
              provider: 'fish-audio',
              response_format: 'mp3'
            })
          },
          18000,
          parentSignal
        );

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && !contentType.includes('text/html')) {
          const buf = await response.arrayBuffer();
          if (isValidAudioBuffer(buf)) {
            return buf;
          }
        }

        if (!response.ok && !contentType.includes('text/html')) {
          const errText = await response.text();
          let msg = `Server error ${response.status}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) msg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
          } catch {}
          if (response.status >= 400 && response.status < 500 && !msg.includes('404')) {
            throw new Error(msg);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' && parentSignal?.aborted) throw err;
        if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
          console.warn('/api/tts server proxy error, trying direct OpenRouter fetch:', err.message);
        }
      }

      // Direct client fallback
      return await generateDirectOpenRouterAudio(
        speakableText,
        targetVoice,
        fishAudioModel,
        openRouterApiKey
      );
    }

    // EdgeTTS provider: prioritize verified working endpoint first
    const baseCandidates = getBackendCandidates('/api/tts');
    const endpoints = preferredEdgeEndpointRef.current
      ? [
          preferredEdgeEndpointRef.current,
          ...baseCandidates.filter((e) => e !== preferredEdgeEndpointRef.current),
        ]
      : baseCandidates;

    let lastError: Error | null = null;
    const maxAttempts = depth === 0 ? 2 : 2;
    const attemptTimeoutMs = 8000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      for (const endpoint of endpoints) {
        if (parentSignal?.aborted) {
          throw new DOMException('Workshop generation cancelled', 'AbortError');
        }

        // 1. Fast POST request with strict timeout
        try {
          const postRes = await fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: speakableText,
                voice,
                rate,
                provider: 'edge',
              }),
            },
            attemptTimeoutMs,
            parentSignal
          );

          if (postRes.ok) {
            const buf = await postRes.arrayBuffer();
            if (isValidAudioBuffer(buf)) {
              preferredEdgeEndpointRef.current = endpoint;
              return buf;
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError' && parentSignal?.aborted) throw err;
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        // 2. Fallback GET request (only for compact chunks <= 450 chars) with strict timeout
        if (speakableText.length <= 450) {
          try {
            const getUrl = `${endpoint}?text=${encodeURIComponent(speakableText)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}${attempt > 0 ? `&r=${attempt}` : ''}`;
            const getRes = await fetchWithTimeout(
              getUrl,
              { method: 'GET' },
              attemptTimeoutMs,
              parentSignal
            );
            if (getRes.ok) {
              const buf = await getRes.arrayBuffer();
              if (isValidAudioBuffer(buf)) {
                preferredEdgeEndpointRef.current = endpoint;
                return buf;
              }
            }
          } catch (err: any) {
            if (err?.name === 'AbortError' && parentSignal?.aborted) throw err;
            lastError = err instanceof Error ? err : new Error(String(err));
          }
        }
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }

    // 3. Automatic recursive half-split fallback: if a chunk stalled or timed out,
    // split it into two smaller phrases and synthesize both in parallel so it NEVER stalls!
    if (depth < 2) {
      const halves = splitChunkInHalf(speakableText);
      if (halves) {
        const [leftText, rightText] = halves;
        const [leftBuf, rightBuf] = await Promise.all([
          fetchTTSChunk(leftText, voice, rate, provider, parentSignal, depth + 1),
          fetchTTSChunk(rightText, voice, rate, provider, parentSignal, depth + 1),
        ]);
        return concatArrayBuffers([leftBuf, rightBuf]);
      }
    }

    throw new Error(lastError?.message || 'Could not connect to EdgeTTS voice server.');
  };

  const handleCancelGeneration = () => {
    if (workshopAbortRef.current) {
      workshopAbortRef.current.abort();
      workshopAbortRef.current = null;
    }
    setIsGenerating(false);
    setProgressStatus('Generation cancelled.');
    toast.info('Audio generation cancelled.');
  };

  // Handle Chunked TTS and SRT Generation
  const handleGenerateWorkshop = async () => {
    if (!scriptText.trim()) {
      toast.error('Please enter a script or text to generate video audio & subtitles.');
      return;
    }

    if (workshopAbortRef.current) {
      workshopAbortRef.current.abort();
    }
    const abortController = new AbortController();
    workshopAbortRef.current = abortController;

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressStatus('Preparing script & dividing text into sentence-aligned audio blocks...');

    try {
      // Clear previous IndexedDB audio chunks
      await clearAudioChunks();

      const fullText = scriptText.trim();
      const sentences = splitTextToSentences(fullText);

      // Group sentences into compact blocks (180 chars for EdgeTTS -> typically 1 sentence per block)
      // so every block maps directly to its constituent SRT sentences for exact audio-locked timestamps.
      const targetBlockLen = ttsProvider === 'edge' ? 180 : 900;
      const sentenceBlocks = groupSentencesIntoBlocks(sentences, targetBlockLen);
      const chunks = sentenceBlocks.map((b) => b.text);

      const engineName = ttsProvider === 'fish-audio' ? 'Fish Audio S2.1 Pro' : 'EdgeTTS';
      const concurrency = ttsProvider === 'edge' ? Math.min(6, chunks.length) : Math.min(2, chunks.length);

      if (chunks.length > 1) {
        toast.info(`Dividing ${fullText.length.toLocaleString()} chars into ${chunks.length} sentence blocks (${concurrency}x parallel ${engineName} queue)...`);
      }

      const audioBuffers: ArrayBuffer[] = new Array(chunks.length);
      let completedCount = 0;
      let nextIndex = 0;

      setProgressPercent(10);
      setProgressStatus(
        `Synthesizing ${chunks.length} audio block${chunks.length > 1 ? 's' : ''} (${concurrency}x parallel) via ${engineName}...`
      );

      // 1. Process Chunks in a parallel ordered worker pool & save each to IndexedDB by index
      const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
          if (abortController.signal.aborted) break;
          const idx = nextIndex++;
          if (idx >= chunks.length) break;

          const buf = await fetchTTSChunk(
            chunks[idx],
            selectedVoice,
            speakingRate,
            ttsProvider,
            abortController.signal
          );
          audioBuffers[idx] = buf;

          // Store chunk in IndexedDB with its exact sequential index
          await saveAudioChunk(idx, chunks[idx], buf);

          completedCount++;
          const pct = 10 + Math.floor((completedCount / chunks.length) * 72);
          setProgressPercent(pct);
          setProgressStatus(
            `Synthesizing audio via ${engineName}: ${completedCount} of ${chunks.length} blocks ready...`
          );
        }
      });

      await Promise.all(workers);

      if (abortController.signal.aborted) {
        return;
      }

      // 2. Merge Audio Buffers in strict sequential order & Retrieve from IndexedDB
      setProgressPercent(85);
      setProgressStatus('Merging audio streams from IndexedDB into a single cohesive MP3 file...');

      const mergedBuffer = concatArrayBuffers(audioBuffers);
      const mergedBlob = new Blob([mergedBuffer], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(mergedBlob);
      setAudioBuffer(mergedBuffer);
      setAudioBlobUrl(blobUrl);
      setDbStats({ count: chunks.length, sizeBytes: mergedBuffer.byteLength });

      // 3. Measure exact duration of each individual audio block AND the merged MP3
      setProgressPercent(90);
      setProgressStatus('Measuring exact MP3 frame & PCM durations for subtitle synchronization...');

      // Parse exact MPEG frame durations for each chunk buffer
      const frameBlockDurations = audioBuffers.map((buf) => parseMp3DurationSeconds(buf));
      let blockDurations = [...frameBlockDurations];

      // Also decode via Web Audio API if available for sample-accurate verification
      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;

      if (AudioCtx) {
        let audioCtx: AudioContext | null = null;
        try {
          audioCtx = new AudioCtx();
          const decodedDurations = await Promise.all(
            audioBuffers.map(async (buf, idx) => {
              try {
                // Only use frame duration when MPEG frames were cleanly parsed, otherwise decode PCM
                if (frameBlockDurations[idx] > 0) {
                  return frameBlockDurations[idx];
                }
                const decoded = await audioCtx!.decodeAudioData(buf.slice(0));
                return decoded.duration > 0 ? decoded.duration : frameBlockDurations[idx];
              } catch {
                return frameBlockDurations[idx];
              }
            })
          );
          blockDurations = decodedDurations;
        } catch {
          // Fallback to frameBlockDurations already populated
        } finally {
          if (audioCtx && audioCtx.state !== 'closed') {
            audioCtx.close().catch(() => {});
          }
        }
      }

      const sumBlockDurations = blockDurations.reduce((acc, d) => acc + d, 0);
      const parsedMergedDuration = parseMp3DurationSeconds(mergedBuffer);

      // Verify with HTMLAudioElement metadata duration
      const audio = new Audio(blobUrl);
      await new Promise((resolve) => {
        audio.onloadedmetadata = () => resolve(true);
        audio.onerror = () => resolve(true);
        setTimeout(resolve, 2000);
      });

      const htmlDuration =
        audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0;

      const totalAudioDuration =
        htmlDuration > 0 && (sumBlockDurations === 0 || Math.abs(htmlDuration - sumBlockDurations) / sumBlockDurations < 0.05)
          ? htmlDuration
          : sumBlockDurations > 0
          ? sumBlockDurations
          : parsedMergedDuration > 0
          ? parsedMergedDuration
          : Math.max(5, Math.ceil(fullText.split(/\s+/).length / 2.5));

      setDuration(totalAudioDuration);

      // Normalize block durations so their sum equals totalAudioDuration with zero cumulative drift
      const durationScale = sumBlockDurations > 0 ? totalAudioDuration / sumBlockDurations : 1;
      const normalizedBlockDurations =
        sumBlockDurations > 0
          ? blockDurations.map((d) => d * durationScale)
          : sentenceBlocks.map(() => totalAudioDuration / Math.max(1, sentenceBlocks.length));

      // 4. Build SRT Sentences & Timestamps starting strictly at 00:00:00,000
      setProgressPercent(94);
      setProgressStatus('Generating audio-locked SRT timestamps starting at 00:00:00,000...');

      let currentSec = 0; // Start immediately at 00:00:00,000 to match generated audio
      const segments: SrtSegment[] = [];
      let cueIndex = 1;

      for (let bIdx = 0; bIdx < sentenceBlocks.length; bIdx++) {
        const block = sentenceBlocks[bIdx];
        const blockDuration = normalizedBlockDurations[bIdx];
        const blockSentences = block.sentences;

        const weights = blockSentences.map((s) => estimateSpokenWeight(s));
        const totalBlockWeight = weights.reduce((acc, w) => acc + w, 0) || blockSentences.length;

        for (let sIdx = 0; sIdx < blockSentences.length; sIdx++) {
          const isLastSentenceOverall =
            bIdx === sentenceBlocks.length - 1 && sIdx === blockSentences.length - 1;
          const sentenceDuration = blockDuration * (weights[sIdx] / totalBlockWeight);

          const startSec = currentSec;
          const endSec = isLastSentenceOverall ? totalAudioDuration : currentSec + sentenceDuration;
          currentSec = endSec;

          segments.push({
            index: cueIndex++,
            startTime: formatSrtTime(startSec),
            endTime: formatSrtTime(endSec),
            text: blockSentences[sIdx],
            startSeconds: startSec,
            endSeconds: endSec,
          });
        }
      }

      setSrtSegments(segments);

      const rawSrt = segments
        .map(seg => `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`)
        .join('\n');

      setSrtContent(rawSrt);

      // 5. Construct Manim Prompt
      setProgressPercent(98);
      setProgressStatus('Formatting Colearn Manim AI animation prompt...');

      buildManimPrompt(rawSrt, segments, assets, totalAudioDuration);

      setProgressPercent(100);
      setProgressStatus('Complete!');
      toast.success(`Success! Generated audio via ${engineName} (${chunks.length} block${chunks.length > 1 ? 's merged' : ''}), SRT & Manim Prompt!`);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Error in Video Workshop generation:', err);
      toast.error(err.message || 'Failed to generate audio or prompt');
    } finally {
      setIsGenerating(false);
      workshopAbortRef.current = null;
    }
  };

  // Construct structured Manim Prompt
  const buildManimPrompt = (
    srtText: string, 
    segments: SrtSegment[], 
    assetList: Asset[], 
    totalSecs: number
  ) => {
    const assetSection = assetList.length > 0
      ? `### AVAILABLE ASSETS:\nUse the following user-provided assets in the scene where appropriate:\n` +
        assetList.map(a => `- Asset Filename: "${a.name}"\n  URL: ${a.url}\n  Description: ${a.description}`).join('\n\n')
      : `### ASSETS INSTRUCTION:\nNo external image or SVG assets are provided. Construct ALL diagrams, mathematical shapes, coordinate axes, formulas, and visual illustrations using native Manim Community Edition vector primitives (e.g. \`Axes\`, \`Line\`, \`Circle\`, \`Rectangle\`, \`VGroup\`, \`MathTex\`, \`Tex\`, \`Text\`).`;

    const prompt = `You are an expert Python animator specializing in Manim Community Edition (\`manimCE\`).
Your task is to write a single, complete, fully working Python script for a 16:9 widescreen educational video animation for **COLEARN**.

---

### CORE SPECIFICATIONS & CONSTRAINTS:

1. **ASPECT RATIO & CANVAS BOUNDS (16:9 WIDESCREEN)**:
   - Widescreen 16:9 ratio (\`config.frame_width = 14.22\`, \`config.frame_height = 8.0\` or default Manim \`[-7.11, 7.11]\` X and \`[-4.0, 4.0]\` Y bounds).
   - **INVISIBLE SAFE MARGIN (CRITICAL MANDATE)**:
     Maintain an invisible padding margin of at least **0.8 units** from all 4 screen edges:
     - Safe X Range: \`[-6.3, 6.3]\`
     - Safe Y Range: \`[-3.2, 3.2]\`
     **NO text, formula, diagram, label, or shape may extend outside this safe margin.** Always use \`BUFF = 0.8\` or scale groups with \`.scale_to_fit_width(12.0)\` / \`.scale_to_fit_height(6.0)\` to prevent clipping or spilling off screen.

2. **OPENING BRAND HEADER**:
   - Start at \`00:00:00,000\` in sync with the first narration cue:
     - Clear screen to background color \`#0F172A\` (Dark Slate).
     - Display the brand title **'COLEARN'** alongside the opening lesson title within the safe margin (e.g., using \`Write(Text("COLEARN", font_size=48, weight=BOLD, color="#38BDF8"))\`) without adding any silent offset before cue 1.

3. **COLEARN VISUAL DESIGN & BRANDING**:
   - **Background Color**: Dark Slate \`#0F172A\` (\`self.camera.background_color = "#0F172A"\`).
   - **Color Palette**:
     - Primary Accent / Highlights: Sky Blue \`#38BDF8\`
     - Secondary Accent: Gold / Amber \`#F59E0B\`
     - Formulas / Key Numbers: Emerald Green \`#10B981\`
     - Text / Equations: Off-White Slate \`#F8FAFC\`
   - **Typography**: Clean LaTeX formatting (\`MathTex\`) for equations and formulas.
   - **Layout**: Keep formulas centered or neatly aligned on top with diagram illustrations in the center. Prevent overlapping text by arranging elements systematically using \`.next_to()\`, \`.shift()\`, or \`VGroup\`.

4. **SRT TIMING & SCENE SYNCHRONIZATION (TOTAL DURATION: ${totalSecs.toFixed(2)}s)**:
   - The SRT subtitles start at \`00:00:00,000\` and end at exactly \`${formatSrtTime(totalSecs)}\` (\`${totalSecs.toFixed(2)}s\`), matching the generated narration audio 1:1.
   - You MUST synchronize all visual movements, equation reveals, shape highlights, and scene transitions strictly with the timestamped sentences in the provided SRT subtitles.
   - Use \`self.wait(duration)\` to ensure each visual section aligns precisely with the start and end seconds of each sentence chunk.

${assetSection}

---

### SRT SUBTITLES & TIMINGS:
\`\`\`srt
${srtText}
\`\`\`

---

### EXPECTED OUTPUT:
Output ONLY valid, executable Python code for Manim Community Edition inside a single \`\`\`python code block.
Include a main scene class (e.g. \`class ColearnLesson(Scene):\`) with complete imports (\`from manim import *\`). Do not use pseudo-code or omitted functions.`;

    setGeneratedPrompt(prompt);
  };

  // Re-generate prompt when assets change
  useEffect(() => {
    if (srtContent) {
      buildManimPrompt(srtContent, srtSegments, assets, duration);
    }
  }, [assets]);

  // Audio Control Handlers
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Copy Prompt to Clipboard
  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    toast.success('Manim Prompt copied to clipboard!');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // Download File Helpers
  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleDownloadAudio = async () => {
    try {
      const dbAudio = await getMergedAudioFromDB();
      if (dbAudio && dbAudio.count > 0) {
        downloadBlobFile(dbAudio.blob, 'colearn_lecture_audio.mp3');
        const sizeMB = (dbAudio.buffer.byteLength / (1024 * 1024)).toFixed(2);
        toast.success(`Downloaded merged MP3 from IndexedDB (${dbAudio.count} blocks, ${sizeMB} MB)!`);
        return;
      }

      if (audioBuffer) {
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        downloadBlobFile(blob, 'colearn_lecture_audio.mp3');
        toast.success('Downloaded merged MP3 audio!');
        return;
      }

      toast.error('No audio segments found in IndexedDB or memory.');
    } catch (err: any) {
      console.error('Error downloading from IndexedDB:', err);
      toast.error('Failed to download merged MP3 from IndexedDB.');
    }
  };

  const handleClearCache = async () => {
    try {
      await clearAudioChunks();
      setAudioBlobUrl(null);
      setAudioBuffer(null);
      setDbStats(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      toast.success('IndexedDB audio cache cleared!');
    } catch (err: any) {
      console.error('Error clearing IndexedDB:', err);
      toast.error('Failed to clear IndexedDB cache.');
    }
  };

  const handleDownloadSrt = () => {
    if (!srtContent) {
      toast.error('No SRT subtitles generated yet');
      return;
    }
    downloadFile(srtContent, 'colearn_lecture_subtitles.srt', 'text/plain');
  };

  const handleDownloadPrompt = () => {
    if (!generatedPrompt) {
      toast.error('No prompt generated yet');
      return;
    }
    downloadFile(generatedPrompt, 'colearn_manim_animation_prompt.txt', 'text/plain');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Level 4 Admin Tool
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Video className="h-3 w-3" /> Manim, EdgeTTS & Fish Audio
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-2">Video Workshop</h1>
          <p className="text-muted-foreground mt-1">
            Generate high-fidelity voiceovers (EdgeTTS & Fish Audio S2.1 Pro), synchronized SRT subtitles, and standardized Manim Community Edition prompts for Colearn video library lessons.
          </p>
        </div>

        {audioBlobUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadAudio} className="gap-2">
              <Mic className="h-4 w-4 text-emerald-500" /> Audio (.mp3)
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadSrt} className="gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-500" /> Subtitles (.srt)
            </Button>
            <Button variant="default" size="sm" onClick={handleDownloadPrompt} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600">
              <Download className="h-4 w-4" /> Prompt (.txt)
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Script Input & Asset Configuration */}
        <div className="lg:col-span-6 space-y-6">
          {/* Step 1: Script Input & Voice Engine */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                1. Lecture Script & Voice Options
              </CardTitle>
              <CardDescription>
                Paste the lecture or topic explanation text. Scripts are automatically divided into fast sentence blocks, synthesized in parallel, and merged cleanly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script-input">Lecture Text</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {scriptText.length.toLocaleString()} characters ({Math.max(1, splitTextIntoChunks(scriptText, ttsProvider === 'edge' ? 320 : 1000).length)} audio block{splitTextIntoChunks(scriptText, ttsProvider === 'edge' ? 320 : 1000).length > 1 ? 's' : ''})
                  </span>
                </div>
                <Textarea
                  id="script-input"
                  rows={6}
                  placeholder="Enter or paste full lecture script here..."
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="font-mono text-sm leading-relaxed"
                />
              </div>

              {/* Voice Engine Switcher */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <AudioWaveform className="h-4 w-4 text-primary" />
                    Select Voice Engine
                  </Label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => handleProviderChange('edge')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                        ttsProvider === 'edge'
                          ? 'bg-background text-foreground shadow-sm font-semibold border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5 text-blue-500" />
                      Microsoft EdgeTTS (Free)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderChange('fish-audio')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                        ttsProvider === 'fish-audio'
                          ? 'bg-gradient-to-r from-amber-500/10 to-purple-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Fish Audio S2.1 Pro
                    </button>
                  </div>
                </div>

                {ttsProvider === 'edge' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>EdgeTTS Voice</Label>
                      <Select value={selectedVoice} onValueChange={(val) => {
                        setSelectedVoice(val);
                        saveWorkshopSetting(SETTINGS_KEYS.SELECTED_VOICE, val);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {MICROSOFT_VOICES.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Speaking Rate</Label>
                      <Select value={speakingRate} onValueChange={setSpeakingRate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Speed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-15%">-15% (Slower / Clear)</SelectItem>
                          <SelectItem value="-5%">-5% (Slightly Slower)</SelectItem>
                          <SelectItem value="+0%">+0% (Natural Normal)</SelectItem>
                          <SelectItem value="+10%">+10% (Brisk / Energetic)</SelectItem>
                          <SelectItem value="+20%">+20% (Fast)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 rounded-xl border bg-amber-500/5 dark:bg-amber-950/10 border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          Fish Audio S2.1 Pro Options
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300">
                        OpenRouter AI
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Custom Fish Audio Voice Model ID</Label>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Database className="h-2.5 w-2.5 text-emerald-500" /> Saved in IndexedDB
                        </Badge>
                      </div>
                      <Input
                        placeholder="e.g. ca3007f96ae7499ab87d27ea3599956a or model ID"
                        value={fishAudioVoiceModelId}
                        onChange={(e) => handleFishAudioVoiceIdChange(e.target.value)}
                        className="font-mono text-xs h-9 bg-background"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Input any custom Fish Audio voice model ID. Automatically saved to your Level 4 Admin IndexedDB so you don't need to re-enter it manually.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1">
                          <Key className="h-3 w-3 text-amber-500" /> OpenRouter API Key
                        </Label>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Database className="h-2.5 w-2.5 text-emerald-500" /> Admin IndexedDB
                        </Badge>
                      </div>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          placeholder="sk-or-v1-..."
                          value={openRouterApiKey}
                          onChange={(e) => handleOpenRouterKeyChange(e.target.value)}
                          className="font-mono text-xs h-9 pr-9 bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Saved automatically in Level 4 Admin's IndexedDB.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Image & Vector Assets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-amber-500" />
                2. Animation Assets (Optional)
              </CardTitle>
              <CardDescription>
                Attach images, formulas, or diagrams to include in the Manim code prompt. If omitted, Manim will render using native shapes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Asset Filename / Identifier</Label>
                    <Input 
                      placeholder="e.g. geometric_series.png"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      className="text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Asset Description / Role</Label>
                    <Input 
                      placeholder="e.g. Formula breakdown diagram"
                      value={newAssetDesc}
                      onChange={(e) => setNewAssetDesc(e.target.value)}
                      className="text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  <div className="flex-1 w-full">
                    <CloudinaryUpload 
                      onUploadSuccess={(url) => setNewAssetUrl(url)}
                      acceptedTypes="image/*"
                      label="Upload Image Asset"
                    />
                  </div>
                  <Button variant="secondary" onClick={handleAddAsset} className="w-full sm:w-auto gap-2">
                    <Plus className="h-4 w-4" /> Add Asset
                  </Button>
                </div>
              </div>

              {/* Asset List */}
              {assets.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Added Assets ({assets.length})</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {assets.map((ast) => (
                      <div key={ast.id} className="flex items-center justify-between p-3 rounded-md border bg-card text-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {ast.url.startsWith('http') ? (
                            <img src={ast.url} alt={ast.name} className="h-9 w-9 object-cover rounded border" />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground p-1 border rounded" />
                          )}
                          <div className="truncate">
                            <p className="font-mono font-medium text-xs truncate">{ast.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{ast.description}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveAsset(ast.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Progress Bar */}
              {isGenerating && (
                <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-200 dark:border-blue-900 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                      <span className="truncate">{progressStatus}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span>{progressPercent}%</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelGeneration}
                        className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleGenerateWorkshop} 
                disabled={isGenerating} 
                className="w-full h-11 text-base gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md hover:opacity-95"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-5 w-5 animate-spin" />
                    Generating Audio, SRT & Prompt...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate Audio ({ttsProvider === 'fish-audio' ? 'Fish Audio' : 'EdgeTTS'}), SRT & Prompt
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Audio Player, SRT Timestamps & Prompt Preview */}
        <div className="lg:col-span-6 space-y-6">
          {/* Step 3: Audio & SRT Output */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mic className="h-5 w-5 text-emerald-500" />
                  3. Generated Audio & Subtitles
                </CardTitle>
                {(audioBlobUrl || dbStats) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleDownloadAudio} 
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Audio (.mp3)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      className="gap-1 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Clear all stored MP3 audio blocks from IndexedDB"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear Cache
                    </Button>
                    {dbStats && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 gap-1 text-xs">
                        <Database className="h-3 w-3" /> IndexedDB ({dbStats.count} block{dbStats.count > 1 ? 's' : ''}, {(dbStats.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <CardDescription>
                Preview synthesized TTS narration and synchronized SRT sentence timing blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {audioBlobUrl ? (
                <div className="p-4 rounded-xl border bg-slate-900 text-slate-100 space-y-3">
                  <audio 
                    ref={audioRef} 
                    src={audioBlobUrl} 
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (d && !isNaN(d) && isFinite(d) && d > 0) {
                        setDuration(d);
                      }
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden" 
                  />
                  <div className="flex items-center justify-between gap-4">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={togglePlayAudio} 
                      className="h-12 w-12 rounded-full border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    >
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                    </Button>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-xs text-slate-400 font-mono">
                        <span>{formatSrtTime(currentTime).split(',')[0]}</span>
                        <span>{formatSrtTime(duration).split(',')[0]}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-150"
                          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Est. Total Duration: {duration.toFixed(1)}s
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" /> Subtitle Segments: {srtSegments.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={handleDownloadAudio} className="h-6 px-2 text-xs text-emerald-400 hover:text-emerald-300 gap-1">
                        <Download className="h-3 w-3" /> Save .mp3
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleClearCache} className="h-6 px-2 text-xs text-rose-400 hover:text-rose-300 gap-1">
                        <Trash2 className="h-3 w-3" /> Clear
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-lg border border-dashed bg-muted/20">
                  <Mic className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No audio generated yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Generate Audio" to synthesize narration.</p>
                </div>
              )}

              {/* SRT Subtitle Preview Box */}
              {srtContent && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Generated SRT Subtitles</Label>
                    <Button variant="ghost" size="sm" onClick={handleDownloadSrt} className="h-7 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download .srt
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg border bg-slate-950 text-slate-200 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {srtContent}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Manim Code Prompt */}
          <Card className="border-indigo-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-indigo-500" />
                  4. Manim AI Animation Prompt
                </CardTitle>
                {generatedPrompt && (
                  <Button variant="secondary" size="sm" onClick={handleCopyPrompt} className="gap-1.5 text-xs">
                    {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
                  </Button>
                )}
              </div>
              <CardDescription>
                Copy this structured prompt into an AI model (Claude, GPT-4o, Gemini) to generate the complete Python Manim script.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {generatedPrompt ? (
                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedPrompt}
                    rows={12}
                    className="w-full p-4 rounded-lg border bg-slate-950 text-indigo-200 font-mono text-xs leading-relaxed resize-none focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ Widescreen 16:9 Aspect Ratio
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ Invisible 0.8 Buff Safe Margin
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ Starts at 00:00:00,000
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ Exact MP3 Frame-Locked SRT
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-lg border border-dashed bg-muted/20">
                  <Code2 className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No prompt generated yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Prompt will be automatically built when audio is generated.</p>
                </div>
              )}
            </CardContent>
            {generatedPrompt && (
              <CardFooter className="flex justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Ready for Manim Community Edition (\`manimCE\`)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadPrompt} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download (.txt)
                  </Button>
                  <Button size="sm" onClick={handleCopyPrompt} className="gap-1.5">
                    {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy Prompt
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
