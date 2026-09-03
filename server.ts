import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { generateEdgeTTS, streamEdgeTTS, MICROSOFT_VOICES } from "./src/lib/edge-tts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add Security Headers and CORS Middleware
  app.use((req, res, next) => {
    // Note: X-Frame-Options is intentionally omitted so the app can render within the AI Studio preview iframe
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval' blob: ws: wss:; connect-src 'self' https: wss: ws:; img-src 'self' data: https: referrer blob:; frame-src 'self' https:; font-src 'self' data: https:;"
    );
    // Strict-Transport-Security (HSTS)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    // X-Content-Type-Options
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Referrer-Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions-Policy
    res.setHeader("Permissions-Policy", "camera=*, microphone=*, geolocation=*");
    // X-XSS-Protection
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  // Enable JSON and raw body parsing with high limit for direct file proxy uploads (up to 500MB)
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));
  app.use(express.raw({ limit: "500mb", type: "*/*" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Microsoft Edge TTS & Fish Audio TTS endpoints
  app.get("/api/tts/voices", (req, res) => {
    res.json({ voices: MICROSOFT_VOICES });
  });

  const DEFAULT_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
  const DEFAULT_FISH_AUDIO_MODEL = "fish-audio/s2.1-pro-free:free";

  async function handleOpenRouterTTS(
    params: { text: string; voice?: string; model?: string; apiKey?: string; response_format?: string },
    res: express.Response
  ) {
    const { text, voice, model, apiKey: userApiKey, response_format = "mp3" } = params;
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_API_KEY;
    const openrouterUrl = "https://openrouter.ai/api/v1/audio/speech";

    let actualModel = model || DEFAULT_FISH_AUDIO_MODEL;
    let actualVoice = voice;

    if (typeof actualVoice === 'string' && actualVoice.startsWith('custom:')) {
      actualVoice = actualVoice.replace('custom:', '');
    }

    if (typeof actualModel === "string" && (!actualModel.includes("/") || actualModel.length === 32)) {
      if (!actualVoice || ["alex", "anna", "benjamin", "eva", "en-US-AriaNeural"].includes(actualVoice)) {
        actualVoice = actualModel;
      }
      actualModel = DEFAULT_FISH_AUDIO_MODEL;
    }

    const bodyObj: Record<string, any> = {
      model: actualModel,
      input: text,
      response_format: response_format || "mp3"
    };

    if (actualVoice && typeof actualVoice === "string" && actualVoice.trim().length > 0) {
      const cleanVoice = actualVoice.trim();
      if (!["alex", "anna", "benjamin", "eva", "en-US-AriaNeural"].includes(cleanVoice)) {
        bodyObj.voice = cleanVoice;
      }
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://ais-dev.run.app",
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
      const errText = await response.text();
      console.error("OpenRouter API error:", response.status, errText);
      return res.status(response.status).json({
        error: `OpenRouter API error (${response.status}): ${errText}`
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 0 && (buffer[0] === 123 || buffer[0] === 34)) {
      const textStr = buffer.toString("utf-8");
      try {
        const parsed = JSON.parse(textStr);
        if (parsed.audio) {
          const audioBuf = Buffer.from(parsed.audio, "base64");
          res.setHeader("Content-Type", "audio/mpeg");
          return res.send(audioBuf);
        } else if (parsed.data) {
          const audioBuf = Buffer.from(parsed.data, "base64");
          res.setHeader("Content-Type", "audio/mpeg");
          return res.send(audioBuf);
        } else if (parsed.error) {
          return res.status(500).json({ error: parsed.error });
        }
      } catch {
        const audioMatch = textStr.match(/"audio"\s*:\s*"([^"]+)"/);
        if (audioMatch) {
          const audioBuf = Buffer.from(audioMatch[1], "base64");
          res.setHeader("Content-Type", "audio/mpeg");
          return res.send(audioBuf);
        }
        try {
          const decoded = Buffer.from(textStr.trim(), "base64");
          if (decoded.length > 100) {
            res.setHeader("Content-Type", "audio/mpeg");
            return res.send(decoded);
          }
        } catch {}
      }
    }

    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(buffer);
  }

  app.get("/api/tts", async (req, res) => {
    try {
      const { text, voice, rate, provider, model, apiKey } = req.query || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text parameter is required' });
      }

      const isFish = provider === 'fish-audio' ||
        (typeof model === 'string' && model.length > 0) ||
        (typeof voice === 'string' && (voice.length === 32 || voice.includes('fish-audio') || voice.startsWith('custom:')));

      if (isFish) {
        return await handleOpenRouterTTS(
          {
            text,
            voice: typeof voice === 'string' ? voice : undefined,
            model: typeof model === 'string' ? model : undefined,
            apiKey: typeof apiKey === 'string' ? apiKey : undefined
          },
          res
        );
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Text-Length', String(text.length));

      await streamEdgeTTS(
        {
          text,
          voice: typeof voice === 'string' ? voice : undefined,
          rate: typeof rate === 'string' ? rate : undefined,
        },
        (chunk) => {
          res.write(chunk);
        }
      );

      return res.end();
    } catch (err: any) {
      console.error('TTS GET endpoint error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: err?.message || 'Failed to generate TTS audio' });
      }
      return res.end();
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice, rate, provider, model, apiKey, response_format } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text parameter is required' });
      }

      const isFish = provider === 'fish-audio' ||
        (typeof model === 'string' && model.length > 0) ||
        (typeof voice === 'string' && (voice.length === 32 || voice.includes('fish-audio') || voice.startsWith('custom:')));

      if (isFish) {
        return await handleOpenRouterTTS(
          { text, voice, model, apiKey, response_format },
          res
        );
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Text-Length', String(text.length));

      await streamEdgeTTS(
        { text, voice, rate },
        (chunk) => {
          res.write(chunk);
        }
      );

      return res.end();
    } catch (err: any) {
      console.error('TTS endpoint error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: err?.message || 'Failed to generate TTS audio' });
      }
      return res.end();
    }
  });

  // Helper function to normalize OpenAI-compatible Base URLs
  function normalizeOpenAIBaseUrl(rawUrl?: string, provider?: string): string {
    let url = (rawUrl || '').trim();
    if (!url) {
      if (provider === 'groq') return 'https://api.groq.com/openai/v1';
      if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
      if (provider === 'openai' || provider === 'custom') return 'https://api.openai.com/v1';
      return 'https://api.openai.com/v1';
    }

    // Strip trailing slashes
    url = url.replace(/\/+$/, '');

    // Upgrade insecure HTTP to HTTPS for remote domains
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('192.168.') && !url.includes('10.') && !url.includes('172.16.')) {
      url = 'https://' + url.substring(7);
    }

    // Strip full endpoint suffixes if mistakenly pasted
    if (url.endsWith('/chat/completions')) {
      url = url.replace(/\/chat\/completions$/, '');
    }

    // Provider specific canonical paths
    if (/^https?:\/\/api\.openai\.com$/i.test(url)) {
      url = 'https://api.openai.com/v1';
    }
    if (/^https?:\/\/api\.groq\.com$/i.test(url) || /^https?:\/\/api\.groq\.com\/v1$/i.test(url)) {
      url = 'https://api.groq.com/openai/v1';
    }
    if (/^https?:\/\/openrouter\.ai$/i.test(url) || /^https?:\/\/openrouter\.ai\/v1$/i.test(url) || /^https?:\/\/openrouter\.ai\/api$/i.test(url)) {
      url = 'https://openrouter.ai/api/v1';
    }
    if (/^https?:\/\/api\.deepseek\.com$/i.test(url)) {
      url = 'https://api.deepseek.com/v1';
    }
    if (/^https?:\/\/api\.together\.xyz$/i.test(url) || /^https?:\/\/api\.together\.ai$/i.test(url)) {
      url = 'https://api.together.xyz/v1';
    }
    if (/^https?:\/\/api\.x\.ai$/i.test(url)) {
      url = 'https://api.x.ai/v1';
    }
    if (/^https?:\/\/api\.mistral\.ai$/i.test(url)) {
      url = 'https://api.mistral.ai/v1';
    }
    if (/^https?:\/\/api\.perplexity\.ai$/i.test(url)) {
      url = 'https://api.perplexity.ai';
    }

    return url.replace(/\/+$/, '');
  }

  app.post("/api/hermes/chat", async (req, res) => {
    try {
      const { messages, noteContent, config } = req.body;
      
      const provider = config?.provider || 'groq';
      let model = config?.model;
      
      if (!model) {
        model = provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openrouter' ? 'google/gemini-2.0-flash-001' : 'gpt-4o-mini';
      }
      
      // Clean model ID for Groq
      if (provider === 'groq' && model.includes('/')) {
        const parts = model.split('/');
        model = parts[parts.length - 1]; 
      }

      const rawKey = config?.apiKey || '';
      const apiKey = rawKey?.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '') || '';
      const serverGeminiKey = process.env.GEMINI_API_KEY || '';

      // 1. Truncate note content to prevent model context limits
      const maxNoteLength = 15000;
      const truncatedNote = (noteContent || '').length > maxNoteLength
        ? noteContent.substring(0, maxNoteLength) + "\n\n[Study Note content truncated to fit system context window limitations...]"
        : (noteContent || '');

      // 2. Slice messages history to keep context footprint small
      const maxHistoryCount = 8;
      const slicedMessages = (messages || []).length > maxHistoryCount
        ? messages.slice(-maxHistoryCount)
        : (messages || []);

      const systemPrompt = {
        role: 'system',
        content: `You are Hermes, a friendly, intelligent, and polite academic assistant on CoLearn designed to help students study, understand, and query their lecture notes.

CORE CAPABILITIES & GUIDELINES:
1. GREETINGS & COURTESY: Always respond warmly, politely, and helpfully to user greetings (e.g. "hi", "hello", "good day", "how are you?") and pleasantries. Welcome the student and express readiness to assist them with their note.
2. ABOUT HERMES: Answer questions about yourself clearly, accurately, and politely. You are Hermes, the dedicated AI study companion on CoLearn, designed to help students explore, understand, summarize, and master their lecture notes and academic materials.
3. NOTE INQUIRIES & ACADEMIC HELP: Answer questions about the provided "STUDY NOTE CONTENT" below. Explain, summarize, simplify, or clarify the concepts, definitions, examples, and details found in the note.
4. MATHEMATICAL & SCIENTIFIC NOTATION: Use LaTeX for mathematical formulas, equations, or scientific notations (e.g., $E=mc^2$ or \\frac{a}{b}).
5. BOUNDARIES FOR UNRELATED TOPICS: You should only answer questions about yourself, user greetings, and this study note. If the user asks about completely unrelated topics (such as general entertainment, unrelated coding, pop culture, or unrelated news), politely explain that you are dedicated to helping them with this note and invite them to ask questions about the current topic.
6. Keep your explanations clear, educational, well-formatted, and helpful.

STUDY NOTE CONTENT:
${truncatedNote}
`
      };

      const latestUserMsg = slicedMessages.length > 0 ? slicedMessages[slicedMessages.length - 1].content : '';

      // Helper function to call Google Gemini using GenAI SDK
      const callGeminiFallback = async (key: string, geminiModelName?: string) => {
        const aiGen = new GoogleGenAI({ apiKey: key });
        const targetModel = geminiModelName && !geminiModelName.includes('1.5') && !geminiModelName.includes('2.0-flash-lite')
          ? geminiModelName
          : 'gemini-2.5-flash';
        
        const response = await aiGen.models.generateContent({
          model: targetModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${latestUserMsg}` }]
            }
          ]
        });
        return response.text || "I'm sorry, I couldn't generate a response.";
      };

      // ─── GOOGLE GEMINI (Direct REST / SDK when no custom Base URL is set) ────────────
      if (provider === 'gemini' && !config?.baseUrl) {
        const activeGeminiKey = apiKey || serverGeminiKey;
        if (!activeGeminiKey) {
          return res.status(400).json({ error: 'Google Gemini Chat AI is not configured. Please set an API Key in the Admin Panel.' });
        }

        try {
          const content = await callGeminiFallback(activeGeminiKey, model);
          return res.json({ content });
        } catch (geminiErr: any) {
          console.error("Gemini SDK error in Hermes chat proxy:", geminiErr);
          // If custom key failed and server key is available, try server key
          if (apiKey && serverGeminiKey && apiKey !== serverGeminiKey) {
            try {
              const fallbackContent = await callGeminiFallback(serverGeminiKey, 'gemini-2.5-flash');
              return res.json({ content: fallbackContent });
            } catch (secErr: any) {
              console.error("Server fallback Gemini key also failed:", secErr);
            }
          }
          return res.status(500).json({ error: geminiErr.message || "Failed to generate response from Gemini." });
        }
      }

      // ─── OPENAI-COMPATIBLE ENDPOINT (Groq, OpenRouter, OpenAI, Custom, etc.) ──────
      // If provider key is missing, seamlessly fallback to Gemini if server key exists
      if (!apiKey && serverGeminiKey) {
        try {
          const content = await callGeminiFallback(serverGeminiKey, 'gemini-2.5-flash');
          return res.json({ content });
        } catch (err: any) {
          console.warn("Fallback to Gemini failed when API key was missing:", err);
        }
      }

      const normalizedBaseUrl = normalizeOpenAIBaseUrl(config?.baseUrl, provider);
      let primaryEndpoint = `${normalizedBaseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CoLearn-Hermes-AI/1.0',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (provider === 'openrouter' || primaryEndpoint.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = req.headers.origin || 'https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app';
        headers['X-Title'] = 'Hermes Academic Assistant';
      }

      const payload = {
        model: model,
        messages: [systemPrompt, ...slicedMessages],
      };

      let response = await fetch(primaryEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      // Automatic fallback retry for 404/405 (Method Not Allowed / Not Found)
      // e.g. If url is https://server.com and needed /v1/chat/completions, or if url had /v1 and needed /chat/completions
      if (!response.ok && (response.status === 404 || response.status === 405)) {
        let fallbackEndpoint: string | null = null;
        if (!normalizedBaseUrl.endsWith('/v1') && !normalizedBaseUrl.includes('/v1/')) {
          fallbackEndpoint = `${normalizedBaseUrl}/v1/chat/completions`;
        } else if (normalizedBaseUrl.endsWith('/v1')) {
          fallbackEndpoint = `${normalizedBaseUrl.replace(/\/v1$/, '')}/chat/completions`;
        }

        if (fallbackEndpoint && fallbackEndpoint !== primaryEndpoint) {
          console.warn(`Hermes primary endpoint ${primaryEndpoint} returned ${response.status}. Retrying fallback: ${fallbackEndpoint}`);
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
        const errMsg = typeof nestedErr === 'string' ? nestedErr : nestedErr.message || `Failed to connect to Hermes via ${provider}`;
        const errCode = nestedErr.code || response.status;
        
        console.error("Hermes Proxy Chat Error Details:", {
          status: response.status,
          code: errCode,
          error: errInfo,
          provider,
          endpoint: primaryEndpoint
        });

        // Fallback to server Gemini if third-party provider failed with 401/429/500 and server key exists
        if (serverGeminiKey) {
          try {
            console.log("Attempting fallback to Gemini due to provider error...");
            const fallbackContent = await callGeminiFallback(serverGeminiKey, 'gemini-2.5-flash');
            return res.json({ content: fallbackContent });
          } catch (fbErr) {
            console.error("Gemini fallback also failed:", fbErr);
          }
        }

        return res.status(response.status).json({ error: `${errMsg} (Code: ${errCode})` });
      }

      const data = await response.json();
      if (!data?.choices?.[0]?.message?.content) {
        // Try fallback if choice is missing
        if (serverGeminiKey) {
          try {
            const fallbackContent = await callGeminiFallback(serverGeminiKey, 'gemini-2.5-flash');
            return res.json({ content: fallbackContent });
          } catch (e) {}
        }
        return res.status(500).json({ error: "Unexpected response structure from AI provider." });
      }

      return res.json({ content: data.choices[0].message.content });
    } catch (err: any) {
      console.error("Error in Hermes chat proxy:", err);
      // Last-resort fallback to server Gemini key
      if (process.env.GEMINI_API_KEY) {
        try {
          const aiGen = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await aiGen.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are Hermes, an academic assistant. Please answer the user: ${(req.body?.messages?.slice(-1)?.[0]?.content) || 'Hello'}`
          });
          if (response.text) {
            return res.json({ content: response.text });
          }
        } catch (e) {}
      }
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.get("/api/video-stream/:id", async (req, res) => {
    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).send("File ID required");
    }

    try {
      const gdUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
      
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      };

      const gdRes = await fetch(gdUrl, {
        headers: requestHeaders,
        redirect: 'follow',
      });

      const contentType = gdRes.headers.get('content-type') || '';

      // If Google Drive returns HTML, we hit a virus confirmation screen or warning page
      if (contentType.includes('text/html')) {
        const htmlText = await gdRes.text();
        const confirmTokenMatch = htmlText.match(/confirm=([^&"\s]+)/) || htmlText.match(/id="confirm"[^>]*value="([^"]+)"/) || htmlText.match(/name="confirm"[^>]*value="([^"]+)"/);
        
        if (confirmTokenMatch) {
          const token = confirmTokenMatch[1];
          const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${token}&id=${fileId}`;
          return res.redirect(confirmUrl);
        } else {
          // Fallback redirect
          return res.redirect(gdUrl);
        }
      }

      // If it's already a direct stream resource, redirect to Google's resolved final URL
      return res.redirect(gdRes.url);

    } catch (err: any) {
      console.error("Error streaming Google Drive file:", err);
      // Fallback
      return res.redirect(`https://drive.google.com/uc?id=${fileId}&export=download`);
    }
  });

  // Direct Static Downloads Route for APKs
  const downloadsDir = path.join(process.cwd(), "public", "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  app.use("/downloads", express.static(downloadsDir));

  // GitHub Release Asset Proxy Upload Endpoint (Bypasses browser CORS for uploads.github.com)
  app.post("/api/admin/upload-github-release", async (req, res) => {
    try {
      const owner = (req.query.owner as string)?.trim();
      const repo = (req.query.repo as string)?.trim();
      const tag = (req.query.tag as string)?.trim();
      const token = (req.query.token as string)?.trim();
      const fileName = (req.query.fileName as string)?.trim() || `colearn-${tag}.apk`;

      console.log(`\n================ [GITHUB RELEASE PROXY UPLOAD] ================`);
      console.log(`[GitHub Proxy] Upload initiated -> Repo: ${owner}/${repo} | Tag: ${tag} | File: ${fileName}`);

      if (!owner || !repo || !tag || !token) {
        console.error("[GitHub Proxy ERROR] Missing required parameters:", { owner, repo, tag, hasToken: !!token });
        return res.status(400).json({ error: "Missing required query parameters (owner, repo, tag, token)." });
      }

      // 1. Fetch or create release
      const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
      console.log(`[GitHub Proxy] 1. Checking release tag ${tag} at ${releaseUrl}`);

      let releaseRes = await fetch(releaseUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'CoLearn-App-Server'
        }
      });

      let release: any;
      if (releaseRes.ok) {
        release = await releaseRes.json();
        console.log(`[GitHub Proxy] Found existing release ID ${release.id} for tag ${tag}`);
      } else if (releaseRes.status === 404) {
        console.log(`[GitHub Proxy] Tag ${tag} not found. Creating new GitHub release tag ${tag}...`);
        const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'CoLearn-App-Server'
          },
          body: JSON.stringify({
            tag_name: tag,
            name: `CoLearn Mobile ${tag}`,
            body: `CoLearn Mobile Release ${tag}`,
            draft: false,
            prerelease: false,
          })
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          console.error(`[GitHub Proxy ERROR] Failed to create release (${createRes.status}):`, JSON.stringify(errData, null, 2));
          return res.status(createRes.status).json({ 
            error: errData.message || `Failed to create release on GitHub (${createRes.status}). Verify repository permissions and PAT scopes.`,
            detail: errData
          });
        }
        release = await createRes.json();
        console.log(`[GitHub Proxy] Successfully created release ID ${release.id} for tag ${tag}`);
      } else {
        const errData = await releaseRes.json().catch(() => ({}));
        console.error(`[GitHub Proxy ERROR] GitHub API returned ${releaseRes.status}:`, JSON.stringify(errData, null, 2));
        return res.status(releaseRes.status).json({
          error: errData.message || `GitHub API error (${releaseRes.status})`,
          detail: errData
        });
      }

      if (!release || !release.upload_url) {
        console.error("[GitHub Proxy ERROR] Invalid release response from GitHub:", release);
        return res.status(500).json({ error: "Invalid release response from GitHub API" });
      }

      // 2. Remove existing conflicting asset if present
      if (release.assets && Array.isArray(release.assets)) {
        const existingAsset = release.assets.find((a: any) => a.name === fileName);
        if (existingAsset) {
          console.log(`[GitHub Proxy] 2. Deleting existing conflicting asset ID ${existingAsset.id} (${fileName})...`);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'CoLearn-App-Server'
            }
          });
        }
      }

      // 3. Buffer incoming binary file and upload to uploads.github.com
      const baseUrl = release.upload_url.replace(/\{.*?\}/, '');
      const uploadEndpoint = `${baseUrl}?name=${encodeURIComponent(fileName)}`;
      console.log(`[GitHub Proxy] 3. Streaming binary payload to ${uploadEndpoint}`);

      let fileBuffer: Buffer;
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        fileBuffer = req.body;
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
      }

      console.log(`[GitHub Proxy] Received file buffer: ${fileBuffer.length} bytes (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

      const ghUploadRes = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': fileBuffer.length.toString(),
          'User-Agent': 'CoLearn-App-Server'
        },
        body: fileBuffer
      });

      const responseText = await ghUploadRes.text();
      let responseJson: any = {};
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }

      if (ghUploadRes.ok) {
        console.log(`[GitHub Proxy SUCCESS] Asset uploaded successfully! Permanent URL:`, responseJson.browser_download_url);
        console.log(`=================================================================\n`);
        return res.json({
          success: true,
          downloadUrl: responseJson.browser_download_url,
          asset: responseJson
        });
      } else {
        console.error(`[GitHub Proxy ERROR] Upload to GitHub CDN failed (${ghUploadRes.status}):`, JSON.stringify(responseJson, null, 2));
        console.log(`=================================================================\n`);
        return res.status(ghUploadRes.status).json({
          error: responseJson.message || `GitHub Release asset upload failed (${ghUploadRes.status})`,
          detail: responseJson
        });
      }

    } catch (err: any) {
      console.error("[GitHub Proxy EXCEPTION]:", err);
      return res.status(500).json({ error: err.message || "Internal server error during GitHub upload proxy." });
    }
  });

  // High-Capacity Direct APK Upload Endpoint (up to 200MB)
  app.post("/api/admin/upload-apk", (req, res) => {
    try {
      const rawFileName = (req.query.fileName as string) || `colearn-release-${Date.now()}.apk`;
      const sanitizedName = rawFileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const targetFilePath = path.join(downloadsDir, sanitizedName);

      const writeStream = fs.createWriteStream(targetFilePath);

      req.pipe(writeStream);

      writeStream.on("finish", () => {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.get("host") || "localhost:3000";
        const downloadUrl = `${protocol}://${host}/downloads/${sanitizedName}`;
        console.log(`[APK Upload] Saved ${sanitizedName} to ${targetFilePath}`);
        res.json({ success: true, downloadUrl, fileName: sanitizedName });
      });

      writeStream.on("error", (err) => {
        console.error("APK Upload Stream Error:", err);
        res.status(500).json({ error: "Failed to write APK file to server disk" });
      });
    } catch (err: any) {
      console.error("APK Upload Handler Error:", err);
      res.status(500).json({ error: err.message || "Server error handling APK upload" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production we serve static assets from the compiled dist directory
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
