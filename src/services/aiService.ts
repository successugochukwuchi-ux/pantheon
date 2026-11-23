import { AIConfig } from '../types';
import { getBackendCandidates, isStaticHost, probeEndpoint, RENDER_BACKEND_URL } from '../lib/backendConfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface HermesAttemptLog {
  target: string;
  strategy: 'backend_proxy' | 'client_direct_fallback';
  status?: number;
  statusText?: string;
  contentType?: string;
  durationMs: number;
  error?: string;
  responseSnippet?: string;
  success: boolean;
}

export interface HermesDiagnostics {
  timestamp: string;
  appHostname: string;
  isStaticHost: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  maskedKey: string;
  baseUrl?: string;
  primaryCause: string;
  recommendation: string;
  attempts: HermesAttemptLog[];
}

export class HermesChatError extends Error {
  diagnostics: HermesDiagnostics;
  constructor(message: string, diagnostics: HermesDiagnostics) {
    super(message);
    this.name = 'HermesChatError';
    this.diagnostics = diagnostics;
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  diagnostics?: HermesDiagnostics;
  isError?: boolean;
}

const GROQ_API_KEY = ''; // To be set in Admin Panel
const OPENROUTER_API_KEY = ''; // To be set in Admin Panel

const getMaskedKey = (key: string | undefined) => {
  if (!key) return 'None';
  if (key.length <= 8) return 'Short Key';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

export async function magicNoteCreator(fileData: { data: string, mimeType: string }, config?: AIConfig) {
  const prompt = `
    You are an expert academic content creator. 
    Analyze the provided document (PDF or Image) and extract its key information.
    Format your response as a JSON array of blocks that strictly follow this TypeScript structure:
    
    type BlockType = 'text' | 'math' | 'h1' | 'h2' | 'diagram' | 'table' | 'bullet-list' | 'numbered-list';
    interface NoteBlock {
      id: string; 
      type: BlockType;
      content: string;
      settings?: any;
    }

    STRATEGIC DIRECTIVES (CRITICAL):
    1. STRICT EXTRACTION: Do NOT summarize, edit, rephrase, add, or remove any text from the uploaded source. Extract all content VERBATIM as it appears in the document. This is for academic notes, accuracy is paramount.
    2. LOGICAL STRUCTURE: Organize the verbatim content into a logical sequence using h1 (main headings), h2 (subheadings), and text blocks.
    3. LIST DETECTION: If the document contains bullet points or numbered lists, use 'bullet-list' or 'numbered-list' blocks. In 'bullet-list', each item should start with '- '. In 'numbered-list', each item should start with '1. ', '2. ', etc.
    4. DIAGRAM DETECTION: Identify where diagrams, illustrations, charts, or figures are located in the document. Insert a 'diagram' block at that exact position with an empty content field (the admin will fill this later).
    5. SPACING: Ensure sufficient empty text blocks between different sections or after lists to maintain readability.
    6. FORMULAS: Use LaTeX for ALL mathematical formulas or scientific notations within the 'content' field (e.g., $E=mc^2$ or $\\\\frac{a}{b}$).
    7. TABLES: If there are tables, extract them as 'table' blocks where 'content' is a JSON stringified 2D array of strings.
    8. ACCENT & LANGUAGE FIDELITY: Maintain 100% accuracy for foreign languages (such as French, Igbo, Yoruba, Spanish, etc.). Never strip, modify, simplify, or approximate accents, intonation tone marks, diacritics, or subdots (e.g., ọ/Ọ, ụ/Ụ, ị/Ị, ṅ/Ṅ, ñ/Ñ, á, é, í, ó, ú, ọ́, ụ́, ị́, à, è, ì, ò, ù, ọ̀, ụ̀, ị̀, m̄, n̄, ḿ, ń). Precision is critical for language learning notes.
    9. Return ONLY the JSON array, no markdown fences, no preamble.
  `;

  const provider = config?.provider || 'groq';

  // ─── GOOGLE GEMINI (FREE TIER) ───────────────────────────────────────────────
  // Free tier: 1,500 requests/day, no credit card required.
  // Get a free API key at https://aistudio.google.com/app/apikey
  if (provider === 'gemini') {
    const apiKey = config?.apiKey;
    if (!apiKey) {
      throw new Error(
        "Magic Note AI is not configured. Please add your free Google Gemini API key in the Admin Panel > Level 4 > Magic Note Creator AI. " +
        "IMPORTANT: Generate the key at https://aistudio.google.com/app/apikey (AI Studio), NOT from Google Cloud Console. " +
        "Cloud Console keys lose the free tier. AI Studio keys are always free."
      );
    }

    const modelId = config?.model || 'gemini-4-hydrogen';

    // Gemini REST API — supports both image/* and application/pdf natively
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    // Build Gemini parts — text/plain for PDFs (extracted client-side), inlineData for images
    const isGeminiText = fileData.mimeType === 'text/plain';
    const geminiParts = isGeminiText
      ? [{ text: prompt + `

Here is the document text to convert into notes:

${fileData.data}` }]
      : [
          { text: prompt },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ];

    const body = {
      contents: [{ parts: geminiParts }],
      generationConfig: { responseMimeType: 'application/json' },
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('Gemini API Error:', errData);
      const errMsg: string = errData?.error?.message || `Gemini API error (${response.status})`;
      // Quota error = key was created in Google Cloud Console (billing project), not AI Studio
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || response.status === 429) {
        throw new Error(
          "Gemini quota error: Your API key appears to be from Google Cloud Console, which has no free tier. " +
          "Please create a NEW key at https://aistudio.google.com/app/apikey (Google AI Studio) instead — " +
          "those keys are always free with 1,500 requests/day."
        );
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    let rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) throw new Error('Unexpected response structure from Gemini.');

    rawContent = rawContent.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

    if (Array.isArray(parsed)) return parsed;
    if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed.blocks;
    const firstKey = Object.keys(parsed)[0];
    if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
    return [];
  }

  // ─── GROQ / OPENROUTER ───────────────────────────────────────────────────────
  const rawKey = config?.apiKey || (provider === 'groq' ? GROQ_API_KEY : OPENROUTER_API_KEY);
  // Extreme trim: removes ALL whitespace, surrounding quotes, and invisible characters
  const apiKey = rawKey?.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  if (!apiKey) {
    throw new Error(
      provider === 'groq'
        ? "Magic Note AI is not configured. Get a FREE Groq API key (no credit card) at https://console.groq.com — sign up, go to API Keys, and paste it in Admin Panel > Level 4 > Magic Note Creator AI."
        : "Magic Note AI is not configured. Please set an API Key in the Admin Panel > Level 4 > Magic Note Creator AI configuration."
    );
  }

  const baseUrl = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  // Use configured model or a default if none is set
  let activeModelId = config?.model;
  
  if (!activeModelId) {
    activeModelId = provider === 'groq' ? 'llama-3.2-11b-vision-instruct' : 'google/gemini-2.0-flash-001';
  }
  
  // Clean model ID for Groq (remove prefixes like "meta-llama/" commonly used in OpenRouter)
  if (provider === 'groq' && activeModelId.includes('/')) {
    const parts = activeModelId.split('/');
    activeModelId = parts[parts.length - 1]; 
  }

  // PDF SAFETY CHECK: Groq and most OpenRouter vision models only support images.
  // PDFs must be pre-converted to images (page by page) before calling this function.
  // The NoteBuilder handleMagicUpload handles this conversion via PDF.js.
  // PDFs are handled as text/plain (text extracted client-side via PDF.js).
  // Raw application/pdf binary should never reach here.
  if (fileData.mimeType === 'application/pdf') {
    throw new Error('Raw PDF binary received. PDF text should be extracted client-side before calling this function.');
  }

  // For OpenRouter PDF (if somehow reached), force Gemini model
  if (provider === 'openrouter' && !activeModelId.includes('gemini') && !activeModelId.includes('pro')) {
    console.warn(`Model ${activeModelId} may not support all file types. Consider using google/gemini-2.0-flash-001.`);
  }

  try {
    // ── Text-based call (PDF text extracted client-side) ───────────────────────
    // Much faster and no size limits vs vision — used for PDFs
    const isTextMode = fileData.mimeType === 'text/plain';
    const textPrompt = isTextMode
      ? prompt + `

Here is the document text to convert into notes:

${fileData.data}`
      : prompt;

    const contentParts: any[] = isTextMode
      ? [{ type: "text", text: textPrompt }]
      : [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${fileData.mimeType};base64,${fileData.data}` } }
        ];

    const payload: any = {
      model: activeModelId,
      messages: [{ role: "user", content: contentParts }],
    };

    if (activeModelId.includes('flash') || activeModelId.includes('gemini-2.0') || activeModelId.includes('pro')) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Hermes Magic Note Creator',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json();
      
      // Robust error parsing for Groq's potentially nested structure
      const errInfo = errData.error?.error || errData.error || errData;
      const errMsg = errInfo.message || `AI Provider Error (${response.status})`;
      const errCode = errInfo.code || 'unknown';
      
      console.error(`${provider.toUpperCase()} Provider Error Details:`, {
        status: response.status,
        code: errCode,
        error: errData,
        maskedKey: getMaskedKey(apiKey),
        model: activeModelId
      });
      
      throw new Error(`${errMsg} | Code: ${errCode} | Provider: ${provider.toUpperCase()} | Model: ${activeModelId} | Key: ${getMaskedKey(apiKey)}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Unexpected response structure from AI provider.");
    }

    let rawContent = data.choices[0].message.content;

    if (typeof rawContent === 'string') {
      rawContent = rawContent.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    }

    const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;

    if (Array.isArray(parsed)) return parsed;
    if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed.blocks;
    const firstKey = Object.keys(parsed)[0];
    if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
    return [];
  } catch (e: any) {
    console.error("Magic Note Creator failed:", e);
    throw new Error(e.message || "Failed to generate note content.");
  }
}

async function loadHermesConfigWithTimeout(config?: AIConfig, timeoutMs = 3500): Promise<AIConfig | undefined> {
  if (config && (config.apiKey || config.provider || config.baseUrl)) {
    return config;
  }
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'system', 'hermes')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (snap && snap.exists()) {
      return snap.data() as AIConfig;
    }
  } catch {}
  return config;
}

function readChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`Hermes stream timed out after ${Math.round(timeoutMs / 1000)}s without a response.`));
    }, timeoutMs);
  });
  return Promise.race([reader.read(), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function chatWithHermesStream(
  messages: ChatMessage[],
  noteContent: string,
  config?: AIConfig,
  isVoiceCall?: boolean,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const candidateUrls = getBackendCandidates('/api/hermes/chat');
  const activeConfig = await loadHermesConfigWithTimeout(config, 3500);

  const cleanMessagesPayload = (messages || [])
    .filter(m => !m.isError && m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').trim()
    }))
    .filter(m => m.content.length > 0 && !m.content.includes('Hermes Connection Diagnostic') && !m.content.includes('Hermes AI is currently busy'));

  let sawBackendExplicitError = false;
  let lastBackendErrorMsg = '';
  let onlyStaticSpaOr404 = true;

  for (const endpoint of candidateUrls) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const isRemoteRender = endpoint.includes('onrender.com');
    const connectTimeoutMs = isRemoteRender ? 40000 : 35000;
    const firstChunkTimeoutMs = isRemoteRender ? 35000 : 35000;
    const nextChunkTimeoutMs = 25000;

    const reqController = new AbortController();
    const onUserAbort = () => reqController.abort();
    signal?.addEventListener('abort', onUserAbort, { once: true });
    let connectTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      reqController.abort();
    }, connectTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cleanMessagesPayload,
          noteContent,
          config: activeConfig,
          isVoiceCall: Boolean(isVoiceCall),
        }),
        signal: reqController.signal,
      });

      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = undefined;
      }

      if (!response.ok) {
        if (response.status !== 404 && response.status !== 405) {
          onlyStaticSpaOr404 = false;
        }
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        continue;
      }

      onlyStaticSpaOr404 = false;

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data?.content) {
          if (onChunk) {
            const words = String(data.content).split(/(\s+)/);
            for (const word of words) {
              if (signal?.aborted) break;
              onChunk(word);
              await new Promise(r => setTimeout(r, 15));
            }
          }
          return data.content;
        }
        if (data?.error) {
          sawBackendExplicitError = true;
          lastBackendErrorMsg = data.error;
          throw new Error(data.error);
        }
        continue;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        continue;
      }

      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';
      let isStreamFinished = false;
      let streamDeadline = Date.now() + firstChunkTimeoutMs;

      while (!isStreamFinished) {
        const remainingMs = Math.max(1000, streamDeadline - Date.now());
        const { value, done } = await readChunkWithTimeout(
          reader,
          accumulatedText.length > 0 ? nextChunkTimeoutMs : remainingMs,
          () => reqController.abort()
        );
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            isStreamFinished = true;
            break;
          }

          let parsed: any = null;
          try {
            parsed = JSON.parse(dataStr);
            if (parsed.text) {
              accumulatedText += parsed.text;
              streamDeadline = Date.now() + nextChunkTimeoutMs;
              if (onChunk) {
                onChunk(parsed.text);
              }
            }
            if (parsed.error) {
              sawBackendExplicitError = true;
              lastBackendErrorMsg = parsed.error;
              throw new Error(parsed.error);
            }
          } catch (e: any) {
            if (parsed?.error) throw e;
          }
        }
      }

      if (accumulatedText.trim().length > 0) {
        return accumulatedText;
      }
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      console.warn(`Streaming endpoint ${endpoint} failed, trying next candidate...`, err);
    } finally {
      if (connectTimer) clearTimeout(connectTimer);
      signal?.removeEventListener('abort', onUserAbort);
    }
  }

  // Only invoke non-streaming chatWithHermes fallback if we never got an active API error from our backend
  // or if we're on a static host needing CORS/Render fallback.
  if (sawBackendExplicitError && !isStaticHost() && !onlyStaticSpaOr404) {
    throw new Error(lastBackendErrorMsg || 'Hermes AI could not complete this request. Please try again.');
  }

  const fallbackText = await chatWithHermes(messages, noteContent, activeConfig, isVoiceCall);
  if (onChunk) {
    const words = String(fallbackText).split(/(\s+)/);
    for (const word of words) {
      if (signal?.aborted) break;
      onChunk(word);
      await new Promise(r => setTimeout(r, 15));
    }
  }
  return fallbackText;
}

export async function chatWithHermes(messages: ChatMessage[], noteContent: string, config?: AIConfig, isVoiceCall?: boolean) {
  const attempts: HermesAttemptLog[] = [];
  const candidateUrls = getBackendCandidates('/api/hermes/chat');

  const activeConfig = await loadHermesConfigWithTimeout(config, 3500);

  // Sanitize message history to strict { role, content } format, stripping internal diagnostic objects
  const cleanMessagesPayload = (messages || [])
    .filter(m => !m.isError && m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').trim()
    }))
    .filter(m => m.content.length > 0 && !m.content.includes('Hermes Connection Diagnostic') && !m.content.includes('Hermes AI is currently busy'));

  // Strategy 1: Attempt candidate backend proxies (local dev or Render backend for static hosts like Wasmer)
  for (const endpoint of candidateUrls) {
    const start = Date.now();
    const isRemoteRender = endpoint.includes('onrender.com');
    const timeoutMs = isRemoteRender ? 40000 : 35000;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cleanMessagesPayload,
          noteContent,
          config: activeConfig,
          isVoiceCall: Boolean(isVoiceCall),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const durationMs = Date.now() - start;

      // Ensure response is JSON and not an HTML SPA fallback page (like Wasmer static-server returns for routes)
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data?.content) {
          attempts.push({
            target: endpoint,
            strategy: 'backend_proxy',
            status: response.status,
            statusText: response.statusText,
            contentType,
            durationMs,
            success: true,
          });
          return data.content as string;
        }
      }

      if (response.ok && contentType.includes('text/event-stream')) {
        const text = await response.text();
        let full = '';
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) full += parsed.text;
            } catch {}
          }
        }
        if (full) {
          attempts.push({
            target: endpoint,
            strategy: 'backend_proxy',
            status: response.status,
            statusText: response.statusText,
            contentType,
            durationMs,
            success: true,
          });
          return full;
        }
      }

      // Read response snippet for pinpointing diagnostics
      let snippet = '';
      try {
        snippet = (await response.text()).slice(0, 200);
      } catch {}

      const isHtml = contentType.includes('text/html') || snippet.startsWith('<!DOCTYPE') || snippet.startsWith('<html');
      let stepErr = '';
      if (isHtml) {
        stepErr = 'Wasmer static-server returned index.html SPA page. Static hosts cannot execute backend Express endpoints.';
      } else if (response.status === 405) {
        stepErr = 'HTTP 405 Method Not Allowed (Route not served by host).';
      } else if (response.status === 404) {
        stepErr = 'HTTP 404 Not Found.';
      } else if (!response.ok) {
        stepErr = `HTTP ${response.status} ${response.statusText}${snippet ? `: ${snippet}` : ''}`;
      } else {
        stepErr = `Unexpected content-type "${contentType || 'none'}" without JSON content.`;
      }

      attempts.push({
        target: endpoint,
        strategy: 'backend_proxy',
        status: response.status,
        statusText: response.statusText,
        contentType,
        durationMs,
        responseSnippet: snippet.slice(0, 150),
        error: stepErr,
        success: false,
      });
    } catch (proxyErr: any) {
      const isTimeout = proxyErr?.name === 'AbortError';
      const durationMs = Date.now() - start;
      const errMsg = isTimeout
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s`
        : (proxyErr?.message || String(proxyErr));

      attempts.push({
        target: endpoint,
        strategy: 'backend_proxy',
        status: 0,
        statusText: isTimeout ? 'Timed Out' : 'Network/Fetch Error',
        contentType: '',
        durationMs,
        error: errMsg,
        success: false,
      });
    }
  }

  // Strategy 2: Direct Client-Side Fallback (for static hosting or proxy failure)
  const provider = activeConfig?.provider || 'gemini';
  const rawKey = activeConfig?.apiKey || '';
  const cleanKey = rawKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  const activeGeminiKey = cleanKey.startsWith('AIza') ? cleanKey : '';

  const maxNoteLength = 12000;
  const truncatedNote = (noteContent || '').length > maxNoteLength
    ? noteContent.substring(0, maxNoteLength) + "\n\n[Study Note truncated for context size...]"
    : (noteContent || '');

  const voiceDirective = isVoiceCall
    ? "\nKeep your answer short, spoken, and under 25 words with no markdown or bullet points."
    : "";

  const systemPrompt = `You are Hermes, a patient and intelligent academic tutor on CoLearn helping students understand their study notes.${voiceDirective}
Always format mathematical equations using LaTeX wrapped in single dollar signs $...$ for inline math or $$...$$ for standalone display formulas.

STUDY NOTE CONTENT:
${truncatedNote}`;

  const latestUserMsg = cleanMessagesPayload.length > 0 ? cleanMessagesPayload[cleanMessagesPayload.length - 1].content : 'Hello';

  // A. Direct Custom / OpenAI-Compatible Provider Fallback (Xiaomi MIMO, DeepSeek, Together, OpenAI, etc.)
  let customBaseUrl = activeConfig?.baseUrl || '';
  if (!customBaseUrl) {
    const p = (provider as string).toLowerCase();
    if (p === 'openai') customBaseUrl = 'https://api.openai.com/v1';
    else if (p === 'deepseek') customBaseUrl = 'https://api.deepseek.com/v1';
    else if (p === 'together') customBaseUrl = 'https://api.together.xyz/v1';
    else if (p === 'mistral') customBaseUrl = 'https://api.mistral.ai/v1';
    else if (p === 'xai') customBaseUrl = 'https://api.x.ai/v1';
  }

  if (customBaseUrl && cleanKey) {
    const start = Date.now();
    const cleanBaseUrl = customBaseUrl.replace(/\/+$/, '');
    const targetUrl = cleanBaseUrl.endsWith('/chat/completions')
      ? cleanBaseUrl
      : `${cleanBaseUrl}/chat/completions`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const customRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: activeConfig?.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...cleanMessagesPayload.slice(-6)
          ],
          temperature: 0.5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = customRes.headers.get('content-type') || '';
      const durationMs = Date.now() - start;

      if (customRes.ok && contentType.includes('application/json')) {
        const customData = await customRes.json();
        const reply = customData.choices?.[0]?.message?.content;
        if (reply) {
          attempts.push({
            target: targetUrl,
            strategy: 'client_direct_fallback',
            status: customRes.status,
            statusText: customRes.statusText,
            contentType,
            durationMs,
            success: true,
          });
          return reply;
        }
      }

      let snippet = '';
      try { snippet = (await customRes.text()).slice(0, 200); } catch {}
      attempts.push({
        target: targetUrl,
        strategy: 'client_direct_fallback',
        status: customRes.status,
        statusText: customRes.statusText,
        contentType,
        durationMs,
        responseSnippet: snippet.slice(0, 150),
        error: `Custom Provider HTTP ${customRes.status}: ${snippet || customRes.statusText}`,
        success: false,
      });
    } catch (customErr: any) {
      const isTimeout = customErr?.name === 'AbortError';
      const durationMs = Date.now() - start;
      const isCors = customErr?.name === 'TypeError' || String(customErr).includes('fetch');
      attempts.push({
        target: targetUrl,
        strategy: 'client_direct_fallback',
        status: 0,
        statusText: isTimeout ? 'Timed Out' : 'Direct Fetch Failed',
        contentType: '',
        durationMs,
        error: isCors
          ? `Browser direct call blocked (likely CORS policy on provider endpoint ${customBaseUrl}): ${customErr.message}`
          : (customErr?.message || String(customErr)),
        success: false,
      });
    }
  }

  // Gemini requests are handled exclusively through the server-side /api/hermes/chat route.

  // C. Try Groq if Groq key or provider is configured
  const groqKey = cleanKey.startsWith('gsk_') ? cleanKey : (provider === 'groq' ? cleanKey : '');
  if (groqKey) {
    const start = Date.now();
    try {
      const groqModel = config?.model?.includes('/') ? config.model.split('/').pop() : (config?.model || 'llama-3.3-70b-versatile');
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...cleanMessagesPayload.slice(-6)
          ],
          temperature: 0.5,
          max_tokens: 2048
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const reply = groqData.choices?.[0]?.message?.content;
        if (reply) {
          attempts.push({
            target: 'https://api.groq.com/openai/v1/chat/completions',
            strategy: 'client_direct_fallback',
            status: groqRes.status,
            statusText: 'OK',
            durationMs: Date.now() - start,
            success: true,
          });
          return reply;
        }
      }
      let snippet = '';
      try { snippet = (await groqRes.text()).slice(0, 150); } catch {}
      attempts.push({
        target: 'https://api.groq.com/openai/v1/chat/completions',
        strategy: 'client_direct_fallback',
        status: groqRes.status,
        statusText: groqRes.statusText,
        durationMs: Date.now() - start,
        error: `Groq HTTP ${groqRes.status}: ${snippet}`,
        success: false,
      });
    } catch (groqErr: any) {
      attempts.push({
        target: 'https://api.groq.com/openai/v1/chat/completions',
        strategy: 'client_direct_fallback',
        status: 0,
        statusText: 'Fetch Error',
        durationMs: Date.now() - start,
        error: `Groq call failed: ${groqErr?.message || String(groqErr)}`,
        success: false,
      });
    }
  }

  // D. Try OpenRouter if key is available
  const openrouterKey = cleanKey.startsWith('sk-or-') ? cleanKey : (provider === 'openrouter' ? cleanKey : '');
  if (openrouterKey) {
    const start = Date.now();
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://colearn.app',
          'X-Title': 'Hermes Chat',
        },
        body: JSON.stringify({
          model: activeConfig?.model || 'meta-llama/llama-3.3-70b-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            ...cleanMessagesPayload.slice(-6)
          ],
          temperature: 0.5,
          max_tokens: 2048
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (orRes.ok) {
        const orData = await orRes.json();
        const reply = orData.choices?.[0]?.message?.content;
        if (reply) {
          attempts.push({
            target: 'https://openrouter.ai/api/v1/chat/completions',
            strategy: 'client_direct_fallback',
            status: orRes.status,
            statusText: 'OK',
            durationMs: Date.now() - start,
            success: true,
          });
          return reply;
        }
      }
      let snippet = '';
      try { snippet = (await orRes.text()).slice(0, 150); } catch {}
      attempts.push({
        target: 'https://openrouter.ai/api/v1/chat/completions',
        strategy: 'client_direct_fallback',
        status: orRes.status,
        statusText: orRes.statusText,
        durationMs: Date.now() - start,
        error: `OpenRouter HTTP ${orRes.status}: ${snippet}`,
        success: false,
      });
    } catch (orErr: any) {
      attempts.push({
        target: 'https://openrouter.ai/api/v1/chat/completions',
        strategy: 'client_direct_fallback',
        status: 0,
        statusText: 'Fetch Error',
        durationMs: Date.now() - start,
        error: `OpenRouter call failed: ${orErr?.message || String(orErr)}`,
        success: false,
      });
    }
  }

  // Synthesize root cause and actionable recommendation
  const staticSpaAttempt = attempts.find(a => a.strategy === 'backend_proxy' && (a.contentType?.includes('text/html') || a.error?.includes('Wasmer static-server')));
  const renderProxyAttempt = attempts.find(a => a.target.includes('onrender.com'));
  const directAttempt = attempts.find(a => a.strategy === 'client_direct_fallback');

  let primaryCause = '';
  let recommendation = '';

  if (staticSpaAttempt && renderProxyAttempt && !renderProxyAttempt.success) {
    if (renderProxyAttempt.error?.includes('Timed out')) {
      primaryCause = `Wasmer static host has no backend Express server, and the live Render backend proxy timed out after 45s (Render free-tier cold sleep).`;
      recommendation = `The Render backend instance was asleep and spinning up. Please click "Retry" in 20-30 seconds now that it is awake.`;
    } else if (renderProxyAttempt.status === 0 || renderProxyAttempt.error?.includes('Network') || renderProxyAttempt.error?.includes('fetch')) {
      primaryCause = `Wasmer static server cannot handle backend routes, and connecting to the live Render backend failed (${renderProxyAttempt.error || 'Network error'}).`;
      recommendation = `Ensure the Render backend (https://colearn-backend-tzo9.onrender.com) is online, or test direct provider connectivity below.`;
    } else {
      primaryCause = `Wasmer static server returned HTML (SPA fallback), and Render backend returned HTTP ${renderProxyAttempt.status} (${renderProxyAttempt.error || renderProxyAttempt.statusText}).`;
      recommendation = `Verify your AI Provider credentials in Admin Panel > Level 4 > Hermes AI Configuration.`;
    }
  } else if (!cleanKey && isStaticHost()) {
    primaryCause = `No API key is configured for Hermes AI provider "${provider}".`;
    recommendation = `Go to Admin Panel > Level 4 > Hermes AI Configuration and save a valid API key.`;
  } else if (directAttempt && (directAttempt.error?.includes('CORS') || directAttempt.error?.includes('Failed to fetch'))) {
    primaryCause = `Browser direct call to AI provider was blocked by CORS policy, and backend proxies failed.`;
    recommendation = `Direct browser calls to third-party endpoints (${customBaseUrl || provider}) require proxying because the provider restricts browser origins. The Render backend must be reachable.`;
  } else {
    primaryCause = `All ${attempts.length} connection attempts failed across backend proxies and client fallbacks.`;
    recommendation = `Inspect the detailed attempt trace below and check your network connection or API credentials in Admin Panel.`;
  }

  const diagnostics: HermesDiagnostics = {
    timestamp: new Date().toISOString(),
    appHostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    isStaticHost: isStaticHost(),
    provider: config?.provider || 'gemini',
    model: config?.model || 'default',
    hasApiKey: Boolean(cleanKey || activeGeminiKey),
    maskedKey: getMaskedKey(cleanKey || activeGeminiKey),
    baseUrl: config?.baseUrl,
    primaryCause,
    recommendation,
    attempts,
  };

  throw new HermesChatError(primaryCause, diagnostics);
}

/**
 * Runs a standalone health check across candidate endpoints and provider connectivity.
 */
export async function runHermesHealthCheck(config?: AIConfig): Promise<HermesDiagnostics> {
  const attempts: HermesAttemptLog[] = [];
  const candidateUrls = getBackendCandidates('/api/hermes/chat');

  for (const endpoint of candidateUrls) {
    const probe = await probeEndpoint(endpoint, 12000);
    let stepErr = '';
    if (probe.isHtmlSpa) {
      stepErr = 'Host returned SPA index.html (Wasmer static-server). Static hosts cannot execute backend Express endpoints.';
    } else if (probe.status === 405) {
      stepErr = 'HTTP 405 Method Not Allowed.';
    } else if (!probe.ok && probe.error) {
      stepErr = probe.error;
    }

    attempts.push({
      target: endpoint,
      strategy: 'backend_proxy',
      status: probe.status,
      statusText: probe.statusText,
      contentType: probe.contentType,
      durationMs: probe.durationMs,
      error: stepErr || probe.error,
      success: probe.ok,
    });
  }

  const rawKey = config?.apiKey || '';
  const cleanKey = rawKey.toString().replace(/\s+/g, '').replace(/['"]/g, '');
  const baseUrl = config?.baseUrl || '';
  const provider = config?.provider || 'gemini';

  if (baseUrl) {
    const probe = await probeEndpoint(baseUrl, 8000);
    attempts.push({
      target: baseUrl,
      strategy: 'client_direct_fallback',
      status: probe.status,
      statusText: probe.statusText,
      contentType: probe.contentType,
      durationMs: probe.durationMs,
      error: probe.ok ? undefined : (probe.error || `HTTP ${probe.status}`),
      success: probe.ok || probe.status === 200 || probe.status === 401 || probe.status === 405,
    });
  }

  const anyProxyOk = attempts.some(a => a.strategy === 'backend_proxy' && a.success);
  const primaryCause = anyProxyOk
    ? 'Backend proxy is responsive and available.'
    : 'No healthy backend proxy responding with JSON API status.';

  const recommendation = anyProxyOk
    ? 'Backend is online. If chat fails, check AI Provider credentials in Admin Panel.'
    : 'Check Render backend status (https://colearn-backend-tzo9.onrender.com) or configure a CORS-enabled provider.';

  return {
    timestamp: new Date().toISOString(),
    appHostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    isStaticHost: isStaticHost(),
    provider,
    model: config?.model || 'default',
    hasApiKey: Boolean(cleanKey),
    maskedKey: getMaskedKey(cleanKey),
    baseUrl,
    primaryCause,
    recommendation,
    attempts,
  };
}

/**
 * Heals LaTeX syntax, formulas, delimiters, and notation in academic questions or notes
 * using the Hermes AI model configured in Firebase.
 */
export async function healLatexWithHermesAI(items: any[], config?: AIConfig): Promise<any[]> {
  if (!items || items.length === 0) return [];
  const candidates = getBackendCandidates('/api/hermes/heal-latex');
  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          config,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (err: any) {
      console.warn(`Hermes LaTeX healing candidate ${endpoint} failed:`, err);
    }
  }
  return items;
}

/**
 * Serializes an array of questions into strict PLX <QUES ID="..."> format
 */
export function serializeQuestionsToPLX(questions: any[]): string {
  let plx = "<PLX>\n";
  for (const q of questions) {
    const qId = q.id || '';
    plx += `  <QUES ID="${qId}">\n`;
    plx += `    ${q.text || q.question || ''}\n`;
    if (q.correctAnswer) {
      plx += `    <COR ="${q.correctAnswer}">\n`;
    }
    const incs = q.incorrectAnswers || [];
    if (Array.isArray(incs)) {
      for (const inc of incs) {
        if (inc) plx += `    <INC ="${inc}">\n`;
      }
    }
    if (q.explanation) {
      plx += `    <EXP ="${q.explanation}">\n`;
    }
    plx += `  </QUES>\n\n`;
  }
  plx += "</PLX>";
  return plx;
}

/**
 * Heals an array of questions by converting to PLX format with ID="..." attributes,
 * sending to DeepSeek / Hermes AI, and returning the structured questions.
 */
export async function healQuestionsWithHermesPLX(questions: any[], config?: AIConfig): Promise<any[]> {
  if (!questions || questions.length === 0) return [];
  const plx = serializeQuestionsToPLX(questions);

  const candidates = getBackendCandidates('/api/hermes/heal-plx');
  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plx,
          config,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        return data.questions || [];
      }
    } catch (err: any) {
      console.warn(`Hermes PLX healing candidate ${endpoint} failed:`, err);
    }
  }

  return questions;
}

/**
 * Heals a single LaTeX text string or formula using Hermes AI
 */
export async function healSingleTextWithHermesAI(text: string, config?: AIConfig): Promise<string> {
  if (!text) return '';
  try {
    const res = await healLatexWithHermesAI([{ id: 'single', text }], config);
    return res?.[0]?.text || text;
  } catch (e) {
    console.warn("Single text healing failed, returning original:", e);
    return text;
  }
}