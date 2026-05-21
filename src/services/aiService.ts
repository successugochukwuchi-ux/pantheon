import { GoogleGenAI, Type } from "@google/genai";
import { AIConfig } from '../types';

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

    const modelId = config?.model || 'gemini-2.0-flash-lite';

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

export async function chatWithHermes(messages: ChatMessage[], noteContent: string, config?: AIConfig) {
  const provider = config?.provider || 'groq';
  let model = config?.model;
  
  if (!model) {
    model = provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'gemini' ? 'gemini-2.0-flash-lite' : 'google/gemini-2.0-flash-001';
  }
  
  // Clean model ID for Groq
  if (provider === 'groq' && model.includes('/')) {
    const parts = model.split('/');
    model = parts[parts.length - 1]; 
  }

  const rawKey = config?.apiKey || (provider === 'groq' ? GROQ_API_KEY : OPENROUTER_API_KEY);
  // Extreme trim: removes ALL whitespace, surrounding quotes, and invisible characters
  const apiKey = rawKey?.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  if (!apiKey) {
    throw new Error(`${provider === 'gemini' ? 'Google Gemini' : provider === 'groq' ? 'Groq' : 'OpenRouter'} Chat AI is not configured. Please set an API Key in the Admin Panel > Level 4 > Hermes Chat configuration.`);
  }

  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are Hermes, a helpful academic assistant. 
    STRATEGIC DIRECTIVES:
    1. Answer strictly based on the provided NOTE CONTENT.
    2. If a question is unrelated to the notes, politely decline.
    3. Use LaTeX for ALL mathematical formulas or scientific notations (e.g., $E=mc^2$ or \\frac{a}{b}).
    4. Keep responses concise and focused to ensure fast response times.
    
    NOTE CONTENT:
    ${noteContent}
    `
  };

  // ─── GOOGLE GEMINI (Direct) ──────────────────────────────────────────────────
  if (provider === 'gemini') {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Convert OpenAI-style system role to Gemini format
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${messages[messages.length - 1].content}` }]
        }
      ]
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData?.error?.message || `Gemini API error (${response.status})`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
  }

  // ─── GROQ / OPENROUTER ──────────────────────────────────────────────────────
  const baseUrl = provider === 'groq' 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://openrouter.ai/api/v1/chat/completions';

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Hermes Academic Assistant';
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model,
      messages: [systemPrompt, ...messages],
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    
    // Robust error parsing for Groq's potentially nested structure
    const errInfo = errData.error?.error || errData.error || errData;
    const errMsg = errInfo.message || `Failed to connect to Hermes via ${provider}`;
    const errCode = errInfo.code || 'unknown';
    
    console.error("Hermes Chat Error Details:", {
      status: response.status,
      code: errCode,
      error: errData,
      maskedKey: getMaskedKey(apiKey),
      provider
    });
    throw new Error(`${errMsg} | Code: ${errCode} | Provider: ${provider.toUpperCase()} | Model: ${model} | Key: ${getMaskedKey(apiKey)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}