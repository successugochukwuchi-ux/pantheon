import { GoogleGenAI, Type } from "@google/genai";
import { AIConfig } from '../types';
import { getBackendCandidates } from '../lib/backendConfig';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

    const modelId = config?.model || 'gemini-3.8-flash';

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

export async function chatWithHermes(messages: ChatMessage[], noteContent: string, config?: AIConfig, isVoiceCall?: boolean) {
  // Strategy 1: Attempt candidate backend proxies (local or Render backend for static hosts like Wasmer)
  const candidateUrls = getBackendCandidates('/api/hermes/chat');
  for (const endpoint of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          noteContent,
          config,
          isVoiceCall: Boolean(isVoiceCall),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      // Ensure the response is valid JSON and not an HTML SPA fallback page (like Wasmer static-server returns for routes)
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data?.content) {
          return data.content as string;
        }
      } else {
        console.warn(`Backend candidate ${endpoint} returned status ${response.status} with content-type: ${contentType}`);
      }
    } catch (proxyErr) {
      console.warn(`Backend candidate ${endpoint} unavailable:`, proxyErr);
    }
  }

  // Strategy 2: Direct Client-Side Fallback (for static hosting or proxy failure)
  try {
    const provider = config?.provider || 'gemini';
    const rawKey = config?.apiKey || '';
    const cleanKey = rawKey.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    const geminiEnvKey = (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : '') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const activeGeminiKey = cleanKey.startsWith('AIza') ? cleanKey : (geminiEnvKey || cleanKey);

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

    const latestUserMsg = messages.length > 0 ? messages[messages.length - 1].content : 'Hello';

    // A. Direct Custom / OpenAI-Compatible Provider Fallback (handles Xiaomi MIMO, DeepSeek, Together, OpenAI, etc.)
    let customBaseUrl = config?.baseUrl || '';
    if (!customBaseUrl) {
      const p = (provider as string).toLowerCase();
      if (p === 'openai') customBaseUrl = 'https://api.openai.com/v1';
      else if (p === 'deepseek') customBaseUrl = 'https://api.deepseek.com/v1';
      else if (p === 'together') customBaseUrl = 'https://api.together.xyz/v1';
      else if (p === 'mistral') customBaseUrl = 'https://api.mistral.ai/v1';
      else if (p === 'xai') customBaseUrl = 'https://api.x.ai/v1';
    }

    if (customBaseUrl && cleanKey) {
      try {
        const cleanBaseUrl = customBaseUrl.replace(/\/+$/, '');
        const targetUrl = cleanBaseUrl.endsWith('/chat/completions')
          ? cleanBaseUrl
          : `${cleanBaseUrl}/chat/completions`;

        const customRes = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config?.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-6)
            ],
            temperature: 0.5,
          }),
        });

        const contentType = customRes.headers.get('content-type') || '';
        if (customRes.ok && contentType.includes('application/json')) {
          const customData = await customRes.json();
          const reply = customData.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      } catch (customErr) {
        console.warn("Direct Custom/OpenAI provider fallback failed:", customErr);
      }
    }

    // B. Try Gemini if Gemini key or provider is available
    if (activeGeminiKey && (provider === 'gemini' || cleanKey.startsWith('AIza') || !cleanKey)) {
      try {
        const aiGen = new GoogleGenAI({ apiKey: activeGeminiKey });
        const geminiModel = config?.model || 'gemini-3.8-flash';
        const res = await aiGen.models.generateContent({
          model: geminiModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER QUESTION:\n${latestUserMsg}` }]
            }
          ]
        });
        if (res.text) {
          return res.text;
        }
      } catch (geminiErr) {
        console.warn("Direct Gemini fallback failed:", geminiErr);
      }
    }

    // C. Try Groq if Groq key or provider is configured
    const groqKey = cleanKey.startsWith('gsk_') ? cleanKey : (provider === 'groq' ? cleanKey : '');
    if (groqKey) {
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
              ...messages.slice(-6)
            ],
            temperature: 0.5,
            max_tokens: 2048
          })
        });
        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const reply = groqData.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      } catch (groqErr) {
        console.warn("Direct Groq fallback failed:", groqErr);
      }
    }

    // D. Try OpenRouter if key is available
    const openrouterKey = cleanKey.startsWith('sk-or-') ? cleanKey : (provider === 'openrouter' ? cleanKey : '');
    if (openrouterKey) {
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
            model: config?.model || 'meta-llama/llama-3.3-70b-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-6)
            ],
            temperature: 0.5,
            max_tokens: 2048
          })
        });
        if (orRes.ok) {
          const orData = await orRes.json();
          const reply = orData.choices?.[0]?.message?.content;
          if (reply) return reply;
        }
      } catch (orErr) {
        console.warn("Direct OpenRouter fallback failed:", orErr);
      }
    }
  } catch (fallbackErr) {
    console.warn("Client AI fallback encountered an error:", fallbackErr);
  }

  // Friendly message that never contains 405 error
  throw new Error("Hermes AI is currently busy or connecting to the network. Please ask again in a moment.");
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