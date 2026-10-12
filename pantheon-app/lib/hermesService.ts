import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getBackendUrls } from './backendConfig';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIConfig {
  provider: 'gemini' | 'groq' | 'openrouter' | 'openai' | 'custom';
  baseUrl?: string;
  apiKey: string;
  model?: string;
  isActive?: boolean;
}

let cachedMagicNoteConfig: AIConfig | null = null;
let cachedHermesConfig: AIConfig | null = null;

export async function getSystemAIConfigs(
  providedHermes?: AIConfig | null
): Promise<{ hermes: AIConfig | null; magicNote: AIConfig | null }> {
  if (providedHermes) {
    cachedHermesConfig = providedHermes;
  }

  await Promise.all([
    !cachedHermesConfig
      ? getDoc(doc(db, 'system', 'hermes'))
          .then((snap) => {
            if (snap.exists()) cachedHermesConfig = snap.data() as AIConfig;
          })
          .catch(() => {})
      : Promise.resolve(),
    !cachedMagicNoteConfig
      ? getDoc(doc(db, 'system', 'magicNote'))
          .then((snap) => {
            if (snap.exists()) cachedMagicNoteConfig = snap.data() as AIConfig;
          })
          .catch(() => {})
      : Promise.resolve(),
  ]);

  return {
    hermes: providedHermes || cachedHermesConfig,
    magicNote: cachedMagicNoteConfig,
  };
}

export function normalizeOpenAIBaseUrl(rawUrl?: string, provider?: string): string {
  let url = (rawUrl || '').trim();
  if (!url) {
    if (provider === 'groq') return 'https://api.groq.com/openai/v1';
    if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
    if (provider === 'openai' || provider === 'custom') return 'https://api.openai.com/v1';
    return 'https://api.openai.com/v1';
  }

  url = url.replace(/\/+$/, '');

  if (
    url.startsWith('http://') &&
    !url.includes('localhost') &&
    !url.includes('127.0.0.1') &&
    !url.includes('192.168.') &&
    !url.includes('10.') &&
    !url.includes('172.16.')
  ) {
    url = 'https://' + url.substring(7);
  }

  if (url.endsWith('/chat/completions')) {
    url = url.replace(/\/chat\/completions$/, '');
  }

  if (/^https?:\/\/api\.openai\.com$/i.test(url)) url = 'https://api.openai.com/v1';
  if (/^https?:\/\/api\.groq\.com$/i.test(url) || /^https?:\/\/api\.groq\.com\/v1$/i.test(url)) {
    url = 'https://api.groq.com/openai/v1';
  }
  if (
    /^https?:\/\/openrouter\.ai$/i.test(url) ||
    /^https?:\/\/openrouter\.ai\/v1$/i.test(url) ||
    /^https?:\/\/openrouter\.ai\/api$/i.test(url)
  ) {
    url = 'https://openrouter.ai/api/v1';
  }
  if (/^https?:\/\/api\.deepseek\.com$/i.test(url)) url = 'https://api.deepseek.com/v1';
  if (/^https?:\/\/api\.together\.xyz$/i.test(url) || /^https?:\/\/api\.together\.ai$/i.test(url)) {
    url = 'https://api.together.xyz/v1';
  }
  if (/^https?:\/\/api\.x\.ai$/i.test(url)) url = 'https://api.x.ai/v1';
  if (/^https?:\/\/api\.mistral\.ai$/i.test(url)) url = 'https://api.mistral.ai/v1';
  if (/^https?:\/\/api\.perplexity\.ai$/i.test(url)) url = 'https://api.perplexity.ai';

  return url.replace(/\/+$/, '');
}

export async function chatWithHermesMobile(
  messages: ChatMessage[],
  noteContent: string,
  config?: AIConfig,
  isVoiceCall?: boolean
): Promise<string> {
  // Strategy 1: Try candidate backend proxies first
  const candidateUrls = getBackendUrls();
  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/hermes/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, noteContent, config, isVoiceCall: Boolean(isVoiceCall) }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.content) {
          return data.content as string;
        }
      }
    } catch (errProxy) {
      console.warn(`Backend candidate ${baseUrl} unavailable:`, errProxy);
    }
  }

  // Strategy 2: Direct Client-Side Fallback
  const provider = config?.provider || 'groq';
  let model = config?.model;

  if (!model) {
    model =
      provider === 'groq'
        ? 'llama-3.3-70b-versatile'
        : provider === 'gemini'
        ? 'gemini-2.5-flash'
        : provider === 'openrouter'
        ? 'google/gemini-2.0-flash-001'
        : 'gpt-4o-mini';
  }

  if (provider === 'groq' && model.includes('/')) {
    const parts = model.split('/');
    model = parts[parts.length - 1];
  }

  const rawKey = config?.apiKey || '';
  const apiKey = rawKey
    .toString()
    .replace(/\s+/g, '')
    .replace(/['"]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const maxNoteLength = 15000;
  const truncatedNote =
    (noteContent || '').length > maxNoteLength
      ? noteContent.substring(0, maxNoteLength) +
        '\n\n[Study material truncated to fit system context window limitations...]'
      : noteContent || '';

  const maxHistoryCount = 8;
  const slicedMessages = (messages || []).length > maxHistoryCount ? messages.slice(-maxHistoryCount) : messages || [];

  const voiceCallDirective = isVoiceCall
    ? `\n\nCRITICAL LIVE VOICE CALL DIRECTIVE:
- Keep your response conversational, clear, and concise (2 to 4 sentences).
- Answer the student's question immediately and naturally like a live tutor.\n`
    : '';

  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are Hermes, a friendly, intelligent, and polite academic assistant on CoLearn designed to help students study, understand, and master their lecture notes and past examination questions.${voiceCallDirective}

CORE CAPABILITIES & GUIDELINES:
1. GREETINGS & COURTESY: Always respond warmly, politely, and helpfully to user greetings and pleasantries.
2. ABOUT HERMES: Answer questions about yourself clearly, accurately, and politely. You are Hermes, the dedicated AI study companion on CoLearn.
3. ACADEMIC HELP (NOTES & PAST QUESTIONS): Answer questions about the provided "STUDY MATERIAL CONTENT" below. If the material is a Past Examination Question, explain the step-by-step solution, why the correct option is right, why other options are incorrect, and the underlying academic concept clearly.
4. MATHEMATICAL & SCIENTIFIC NOTATION:
CRITICAL FORMATTING MANDATE: Every mathematical formula, equation, variable, fraction, power, or symbol MUST be wrapped in single dollar signs $ ... $ for inline math (e.g. $E=mc^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\theta$) or double dollar signs $$ ... $$ for standalone display formulas. NEVER output raw bare LaTeX commands like \\frac or \\sqrt without dollar signs.
5. Keep your explanations clear, educational, well-formatted, and helpful.

STUDY MATERIAL CONTENT:
${truncatedNote}
`,
  };

  // Google Gemini direct REST fallback
  const isGemini =
    provider === 'gemini' ||
    apiKey.startsWith('AIza') ||
    (config?.baseUrl && config.baseUrl.includes('generativelanguage.googleapis.com'));
  if (isGemini) {
    if (!apiKey) {
      throw new Error('Google Gemini Chat AI is not configured. Please set an API Key in the Admin Panel.');
    }
    const targetModel = !model || model.includes('1.5') || model.includes('2.0-flash-lite') ? 'gemini-2.5-flash' : model;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const latestUserMsg = slicedMessages.length > 0 ? slicedMessages[slicedMessages.length - 1].content : '';
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${latestUserMsg}` }],
        },
      ],
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini API error (${response.status})`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
  }

  // OpenAI-compatible endpoint (Groq, OpenRouter, OpenAI, Custom/Xiaomi MiMo, etc.)
  const normalizedBaseUrl = normalizeOpenAIBaseUrl(config?.baseUrl, provider);
  let primaryEndpoint = `${normalizedBaseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'CoLearn-Mobile-Hermes/1.0',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  if (provider === 'openrouter' || primaryEndpoint.includes('openrouter.ai')) {
    headers['X-Title'] = 'Hermes Academic Assistant';
  }

  const sanitizedHistory = slicedMessages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim(),
    }));

  const payload = {
    model: model,
    messages: [systemPrompt, ...sanitizedHistory],
  };

  let response = await fetch(primaryEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok && (response.status === 404 || response.status === 405)) {
    let fallbackEndpoint: string | null = null;
    if (!normalizedBaseUrl.endsWith('/v1') && !normalizedBaseUrl.includes('/v1/')) {
      fallbackEndpoint = `${normalizedBaseUrl}/v1/chat/completions`;
    } else if (normalizedBaseUrl.endsWith('/v1')) {
      fallbackEndpoint = `${normalizedBaseUrl.replace(/\/v1$/, '')}/chat/completions`;
    }

    if (fallbackEndpoint && fallbackEndpoint !== primaryEndpoint) {
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
        primaryEndpoint = fallbackEndpoint;
      }
    }
  }

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let errInfo: any = {};
    try {
      errInfo = JSON.parse(rawText);
    } catch {
      errInfo = { message: rawText || `HTTP ${response.status} from AI endpoint` };
    }

    const nestedErr = errInfo.error?.error || errInfo.error || errInfo;
    const errMsg =
      typeof nestedErr === 'string' ? nestedErr : nestedErr.message || `Failed to connect to Hermes via ${provider}`;
    const errCode = nestedErr.code || response.status;
    throw new Error(
      `${errMsg} | Code: ${errCode} | Provider: ${provider.toUpperCase()} | Model: ${model} | Endpoint: ${primaryEndpoint}`
    );
  }

  const data = await response.json();
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('Unexpected response structure from AI provider.');
  }

  return data.choices[0].message.content as string;
}

/**
 * Multi-engine Speech-to-Text transcription for Mobile:
 * 1. Direct Groq Whisper API (whisper-large-v3-turbo / whisper-large-v3) using hermes or magicNote Groq key
 * 2. Render Backend /api/hermes/transcribe (with both hermes & magicNote configs)
 * 3. Direct Gemini Multimodal Audio API
 * 4. Direct OpenAI Whisper API
 */
export async function transcribeAudioMobile(
  audioUri: string,
  base64Audio: string,
  mimeType: string,
  hermesConfig?: AIConfig | null
): Promise<string> {
  const { hermes, magicNote } = await getSystemAIConfigs(hermesConfig);

  const cleanKey = (k?: string) =>
    (k || '')
      .toString()
      .replace(/\s+/g, '')
      .replace(/['"]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const hermesKey = cleanKey(hermes?.apiKey);
  const magicKey = cleanKey(magicNote?.apiKey);

  // Identify available provider keys across both system configs
  const groqKey =
    (hermesKey.startsWith('gsk_') ? hermesKey : '') ||
    (magicKey.startsWith('gsk_') ? magicKey : '') ||
    (hermes?.provider === 'groq' && hermesKey ? hermesKey : '') ||
    (magicNote?.provider === 'groq' && magicKey ? magicKey : '');

  const geminiKey =
    (hermesKey.startsWith('AIza') ? hermesKey : '') ||
    (magicKey.startsWith('AIza') ? magicKey : '') ||
    (hermes?.provider === 'gemini' && hermesKey ? hermesKey : '') ||
    (magicNote?.provider === 'gemini' && magicKey ? magicKey : '');

  const ext = mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('mp3') || mimeType.includes('mpeg')
    ? 'mp3'
    : mimeType.includes('aac')
    ? 'aac'
    : mimeType.includes('3gp')
    ? '3gp'
    : 'm4a';

  // 1. Primary Engine: Groq Whisper API (ultra-fast ~300ms transcription)
  if (groqKey) {
    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3'];
    for (const wModel of whisperModels) {
      try {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const byteChars = atob(base64Audio);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
          formData.append('file', blob, `speech.${ext}`);
        } else {
          formData.append('file', {
            uri: audioUri,
            name: `speech.${ext}`,
            type: mimeType,
          } as any);
        }
        formData.append('model', wModel);
        formData.append('language', 'en');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch (err) {
        console.warn(`Groq Whisper (${wModel}) transcription attempt failed:`, err);
      }
    }
  }

  // 2. Secondary Engine: Render Backend /api/hermes/transcribe (passing configs so backend has keys)
  const backendUrls = getBackendUrls();
  for (const baseUrl of backendUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/hermes/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType,
          config: hermes || magicNote,
          magicNoteConfig: magicNote,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.text && data.text.trim()) {
          return data.text.trim();
        }
      }
    } catch (err) {
      console.warn(`Transcribe failed on ${baseUrl}:`, err);
    }
  }

  // 3. Tertiary Engine: Direct Gemini Multimodal Audio Transcription
  if (geminiKey) {
    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const gModel of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: base64Audio,
                      },
                    },
                    {
                      text: "Listen carefully to this student asking a question. Transcribe the student's exact words. Output ONLY the transcribed text with no quotes or extra commentary.",
                    },
                  ],
                },
              ],
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        }
      } catch (err) {
        console.warn(`Direct Gemini (${gModel}) transcription failed:`, err);
      }
    }
  }

  return '';
}

export async function transcribeHermesAudio(
  audioUri: string,
  hermesConfig?: AIConfig | null
): Promise<string> {
  if (!audioUri) return '';
  try {
    let base64Audio = '';
    if (Platform.OS !== 'web') {
      base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64Audio || base64Audio.length < 50) {
        return '';
      }
    }

    let mimeType = 'audio/m4a';
    const lower = audioUri.toLowerCase();
    if (lower.endsWith('.wav')) mimeType = 'audio/wav';
    else if (lower.endsWith('.mp3')) mimeType = 'audio/mp3';
    else if (lower.endsWith('.aac')) mimeType = 'audio/aac';
    else if (lower.endsWith('.3gp')) mimeType = 'audio/3gpp';
    else if (lower.endsWith('.mp4')) mimeType = 'audio/mp4';
    else if (lower.endsWith('.webm')) mimeType = 'audio/webm';

    return await transcribeAudioMobile(audioUri, base64Audio, mimeType, hermesConfig);
  } catch (err) {
    console.error('transcribeHermesAudio error:', err);
    return '';
  }
}

export function sanitizeHermesError(rawMessage: string): string {
  let errorCode = 'BUSY';
  let cleanMsg = rawMessage || 'Failed to generate response';

  if (cleanMsg.includes('405') || cleanMsg.includes('Method Not Allowed')) {
    return 'Hermes AI is currently busy or updating its study connection. Please ask your question again in a moment.';
  }

  const codeMatch = cleanMsg.match(/(?:Code|status):\s*(\d+)/i);
  if (codeMatch) {
    errorCode = codeMatch[1] === '405' ? 'BUSY' : codeMatch[1];
  }

  if (cleanMsg.includes('|')) {
    cleanMsg = cleanMsg.split('|')[0].trim();
  }

  const blacklist = [
    /groq/gi,
    /openrouter/gi,
    /openai/gi,
    /gemini/gi,
    /claude/gi,
    /google/gi,
    /gpt-[a-zA-Z0-9.-]+/gi,
    /llama[a-zA-Z0-9.-]*/gi,
    /mixtral/gi,
    /deepseek/gi,
    /https?:\/\/\S+/gi,
    /\/\S+completions/gi,
    /endpoint:\s*\S+/gi,
    /provider:\s*\S+/gi,
    /model:\s*\S+/gi,
    /\b405\b/g,
  ];

  for (const pattern of blacklist) {
    cleanMsg = cleanMsg.replace(pattern, '').trim();
  }

  cleanMsg = cleanMsg.replace(/\s*[|:-]+\s*$/g, '').trim() || 'An unexpected network error occurred.';

  if (errorCode === 'BUSY') {
    return 'Hermes AI is currently busy connecting to the academic network. Please try asking again in a moment.';
  }

  return `Error Code: ${errorCode}\nError Message: ${cleanMsg}\n\nPlease inform an administrator about this issue.`;
}
