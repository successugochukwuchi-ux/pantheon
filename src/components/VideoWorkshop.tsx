import React, { useState, useEffect, useRef } from 'react';
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
import { MICROSOFT_VOICES } from '../lib/edge-tts';
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

  // Helper to format seconds to SRT time format: HH:MM:SS,mmm
  const formatSrtTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    const pad = (num: number, size: number = 2) => String(num).padStart(size, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
  };

  // Helper to split text into clean sentence blocks for SRT
  const splitTextToSentences = (text: string): string[] => {
    return text
      .replace(/([.?!;])\s+/g, "$1|")
      .split("|")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Split large text into chunks <= maxChunkLength without breaking sentences
  const splitTextIntoChunks = (text: string, maxChunkLength = 1500): string[] => {
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

  // Robust chunk fetcher with support for EdgeTTS and Fish Audio S2.1 Pro
  const fetchTTSChunk = async (
    textChunk: string, 
    voice: string, 
    rate: string, 
    provider: 'edge' | 'fish-audio'
  ): Promise<ArrayBuffer> => {
    if (provider === 'fish-audio') {
      const targetVoice = fishAudioVoiceModelId.trim() || voice;
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textChunk,
            voice: targetVoice,
            model: fishAudioModel || DEFAULT_FISH_MODEL_ID,
            apiKey: openRouterApiKey || HARDCODED_OPENROUTER_API_KEY,
            provider: 'fish-audio',
            response_format: 'mp3'
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && !contentType.includes('text/html')) {
          const buf = await response.arrayBuffer();
          if (buf.byteLength > 100) {
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
        if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
          console.warn('/api/tts server proxy error, trying direct OpenRouter fetch:', err.message);
        }
      }

      // Direct client fallback
      return await generateDirectOpenRouterAudio(
        textChunk,
        targetVoice,
        fishAudioModel,
        openRouterApiKey
      );
    }

    // EdgeTTS provider
    const endpoints = [
      '/api/tts',
      'https://colearn-backend-tzo9.onrender.com/api/tts'
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const postRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textChunk, voice, rate, provider: 'edge' })
        });

        if (postRes.ok) {
          const buf = await postRes.arrayBuffer();
          if (buf.byteLength > 100) {
            const firstBytes = new Uint8Array(buf.slice(0, 5));
            const isHtml = firstBytes[0] === 60 && firstBytes[1] === 33 && firstBytes[2] === 68;
            if (!isHtml) {
              return buf;
            }
          }
        }

        const getUrl = `${endpoint}?text=${encodeURIComponent(textChunk)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}`;
        const getRes = await fetch(getUrl, { method: 'GET' });
        if (getRes.ok) {
          const buf = await getRes.arrayBuffer();
          if (buf.byteLength > 100) {
            const firstBytes = new Uint8Array(buf.slice(0, 5));
            const isHtml = firstBytes[0] === 60 && firstBytes[1] === 33 && firstBytes[2] === 68;
            if (!isHtml) {
              return buf;
            }
          }
        }
      } catch (err: any) {
        console.warn(`TTS fetch failed for endpoint ${endpoint}:`, err);
        lastError = err;
      }
    }

    throw new Error(lastError?.message || 'Could not connect to EdgeTTS voice server.');
  };

  // Handle Chunked TTS and SRT Generation
  const handleGenerateWorkshop = async () => {
    if (!scriptText.trim()) {
      toast.error('Please enter a script or text to generate video audio & subtitles.');
      return;
    }

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressStatus('Preparing script & dividing text into audio blocks...');

    try {
      // Clear previous IndexedDB audio chunks
      await clearAudioChunks();

      const fullText = scriptText.trim();
      const chunks = splitTextIntoChunks(fullText, 1500);
      
      const engineName = ttsProvider === 'fish-audio' ? 'Fish Audio S2.1 Pro' : 'EdgeTTS';

      if (chunks.length > 1) {
        toast.info(`Script is ${fullText.length} characters. Dividing into ${chunks.length} audio chunks for seamless ${engineName} conversion...`);
      }

      const audioBuffers: ArrayBuffer[] = [];

      // 1. Process Chunks sequentially & save each to IndexedDB
      for (let i = 0; i < chunks.length; i++) {
        const chunkIndex = i + 1;
        const startPct = 10 + Math.floor((i / chunks.length) * 70);
        setProgressPercent(startPct);
        setProgressStatus(`Synthesizing audio block ${chunkIndex} of ${chunks.length} (${chunks[i].length} chars) via ${engineName}...`);

        const buf = await fetchTTSChunk(chunks[i], selectedVoice, speakingRate, ttsProvider);
        audioBuffers.push(buf);

        // Store chunk in IndexedDB
        await saveAudioChunk(i, chunks[i], buf);
      }

      // 2. Merge Audio Buffers & Retrieve from IndexedDB
      setProgressPercent(85);
      setProgressStatus('Merging audio streams from IndexedDB into a single cohesive MP3 file...');

      const dbAudio = await getMergedAudioFromDB();
      let blobUrl = '';

      if (dbAudio && dbAudio.count > 0) {
        blobUrl = URL.createObjectURL(dbAudio.blob);
        setAudioBuffer(dbAudio.buffer);
        setAudioBlobUrl(blobUrl);
        setDbStats({ count: dbAudio.count, sizeBytes: dbAudio.buffer.byteLength });
      } else {
        const mergedBuffer = concatArrayBuffers(audioBuffers);
        const blob = new Blob([mergedBuffer], { type: 'audio/mpeg' });
        blobUrl = URL.createObjectURL(blob);
        setAudioBuffer(mergedBuffer);
        setAudioBlobUrl(blobUrl);
      }

      // 3. Estimate total duration based on loaded HTML Audio metadata
      const audio = new Audio(blobUrl);
      await new Promise((resolve) => {
        audio.onloadedmetadata = () => resolve(true);
        audio.onerror = () => resolve(true);
        setTimeout(resolve, 2000); // fallback timeout
      });

      const totalAudioDuration = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
        ? audio.duration
        : Math.max(5, Math.ceil(fullText.split(/\s+/).length / 2.5));

      setDuration(totalAudioDuration);

      // 4. Build SRT Sentences & Timestamps
      setProgressPercent(92);
      setProgressStatus('Generating synchronized SRT timestamps & sentence blocks...');

      const sentences = splitTextToSentences(fullText);
      const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);

      const introOffset = 2.0; // 2s COLEARN intro screen
      let currentSec = introOffset;

      const segments: SrtSegment[] = sentences.map((sentence, idx) => {
        const sentenceWords = sentence.split(/\s+/).length;
        const proportion = sentenceWords / Math.max(1, totalWords);
        const segmentDuration = Math.max(2.2, proportion * totalAudioDuration);

        const startSec = currentSec;
        const endSec = currentSec + segmentDuration;
        currentSec = endSec;

        return {
          index: idx + 1,
          startTime: formatSrtTime(startSec),
          endTime: formatSrtTime(endSec),
          text: sentence,
          startSeconds: startSec,
          endSeconds: endSec
        };
      });

      setSrtSegments(segments);

      const rawSrt = segments
        .map(seg => `${seg.index}\n${seg.startTime} --> ${seg.endTime}\n${seg.text}\n`)
        .join('\n');

      setSrtContent(rawSrt);

      // 5. Construct Manim Prompt
      setProgressPercent(98);
      setProgressStatus('Formatting Colearn Manim AI animation prompt...');

      buildManimPrompt(rawSrt, segments, assets, totalAudioDuration + introOffset);

      setProgressPercent(100);
      setProgressStatus('Complete!');
      toast.success(`Success! Generated audio via ${engineName} (${chunks.length} block${chunks.length > 1 ? 's merged' : ''}), SRT & Manim Prompt!`);
    } catch (err: any) {
      console.error('Error in Video Workshop generation:', err);
      toast.error(err.message || 'Failed to generate audio or prompt');
    } finally {
      setIsGenerating(false);
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

2. **2-SECOND MANDATORY BRAND INTRO**:
   - The video MUST start with a clean 2-second intro sequence:
     - Clear screen to background color \`#0F172A\` (Dark Slate).
     - Display the brand title **'COLEARN'** sketched across the center of the screen within the safe margin (e.g., using \`Write(Text("COLEARN", font_size=48, weight=BOLD, color="#38BDF8"))\` or \`Create(...)\`).
     - Hold for ~1.5 seconds, then smoothly transition or transform into the main lesson title.

3. **COLEARN VISUAL DESIGN & BRANDING**:
   - **Background Color**: Dark Slate \`#0F172A\` (\`self.camera.background_color = "#0F172A"\`).
   - **Color Palette**:
     - Primary Accent / Highlights: Sky Blue \`#38BDF8\`
     - Secondary Accent: Gold / Amber \`#F59E0B\`
     - Formulas / Key Numbers: Emerald Green \`#10B981\`
     - Text / Equations: Off-White Slate \`#F8FAFC\`
   - **Typography**: Clean LaTeX formatting (\`MathTex\`) for equations and formulas.
   - **Layout**: Keep formulas centered or neatly aligned on top with diagram illustrations in the center. Prevent overlapping text by arranging elements systematically using \`.next_to()\`, \`.shift()\`, or \`VGroup\`.

4. **SRT TIMING & SCENE SYNCHRONIZATION**:
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
                Paste the lecture or topic explanation text. Scripts longer than 1,500 characters are automatically split into audio blocks and merged cleanly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script-input">Lecture Text</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {scriptText.length.toLocaleString()} characters ({Math.ceil(scriptText.length / 1500)} audio block{scriptText.length > 1500 ? 's' : ''})
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
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      {progressStatus}
                    </span>
                    <span>{progressPercent}%</span>
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
                      ✓ 2s Colearn Intro Animation
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ SRT Subtitle Synchronized
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
