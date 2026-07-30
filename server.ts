import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add Security Headers Middleware
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

    next();
  });

  // Enable JSON body parsing for API requests
  app.use(express.json({ limit: "10mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/hermes/chat", async (req, res) => {
    try {
      const { messages, noteContent, config } = req.body;
      
      const provider = config?.provider || 'groq';
      let model = config?.model;
      
      if (!model) {
        model = provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'gemini' ? 'gemini-2.0-flash-lite' : provider === 'openrouter' ? 'google/gemini-2.0-flash-001' : 'gpt-4o-mini';
      }
      
      // Clean model ID for Groq
      if (provider === 'groq' && model.includes('/')) {
        const parts = model.split('/');
        model = parts[parts.length - 1]; 
      }

      const rawKey = config?.apiKey || '';
      const apiKey = rawKey?.toString().replace(/\s+/g, '').replace(/['"]/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '') || '';

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
        content: `You are Hermes, a hyper-focused academic assistant designed to help the user query their study notes.

CRITICAL REFUSAL MANDATES:
1. You can ONLY answer questions that can be directly and objectively answered using the provided "STUDY NOTE CONTENT" below.
2. If the user's latest question is NOT fully and directly addressed in the provided STUDY NOTE CONTENT, or if they ask general knowledge questions, language translation questions, programming questions, or questions about yourself (who you are, your model, etc.), you MUST decline.
3. In such cases of off-topic or unanswerable queries, you MUST respond EXACTLY with the following sentence and nothing else:
"I can only assist you with questions directly related to this note."
4. Do NOT translate languages, do NOT answer in French unless the study note is explicitly about the French language, and do NOT make up information.
5. Use LaTeX for ALL mathematical formulas or scientific notations (e.g., $E=mc^2$ or \\frac{a}{b}).
6. Keep all answers highly concise, factual, and strictly relevant.

STUDY NOTE CONTENT:
${truncatedNote}
`
      };

      // Determine base URL
      let rawBaseUrl = config?.baseUrl ? config.baseUrl.trim().replace(/\/+$/, '') : '';

      if (!rawBaseUrl) {
        if (provider === 'groq') rawBaseUrl = 'https://api.groq.com/openai/v1';
        else if (provider === 'openrouter') rawBaseUrl = 'https://openrouter.ai/api/v1';
        else if (provider === 'openai' || provider === 'custom') rawBaseUrl = 'https://api.openai.com/v1';
      }

      // ─── GOOGLE GEMINI (Direct REST API) ──────────────────────────────────────────
      if (provider === 'gemini' && !rawBaseUrl) {
        if (!apiKey) {
          return res.status(400).json({ error: 'Google Gemini Chat AI is not configured. Please set an API Key in the Admin Panel.' });
        }
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const latestUserMsg = slicedMessages.length > 0 ? slicedMessages[slicedMessages.length - 1].content : '';
        const body = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt.content}\n\nUSER QUESTION: ${latestUserMsg}` }]
            }
          ]
        };

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return res.status(response.status).json({ error: errData?.error?.message || `Gemini API error (${response.status})` });
        }

        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
        return res.json({ content });
      }

      // ─── OPENAI-COMPATIBLE ENDPOINT (Groq, OpenRouter, OpenAI, Custom, etc.) ──────
      if (rawBaseUrl.endsWith('/chat/completions')) {
        rawBaseUrl = rawBaseUrl.replace(/\/chat\/completions$/, '');
      }
      const finalEndpoint = `${rawBaseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = req.headers.origin || 'https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app';
        headers['X-Title'] = 'Hermes Academic Assistant';
      }

      const response = await fetch(finalEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: [systemPrompt, ...slicedMessages],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errInfo = errData.error?.error || errData.error || errData;
        const errMsg = errInfo.message || `Failed to connect to Hermes via ${provider}`;
        const errCode = errInfo.code || response.status;
        
        console.error("Hermes Proxy Chat Error Details:", {
          status: response.status,
          code: errCode,
          error: errData,
          provider,
          endpoint: finalEndpoint
        });
        return res.status(response.status).json({ error: `${errMsg} (Code: ${errCode})` });
      }

      const data = await response.json();
      if (!data?.choices?.[0]?.message?.content) {
        return res.status(500).json({ error: "Unexpected response structure from AI provider." });
      }

      return res.json({ content: data.choices[0].message.content });
    } catch (err: any) {
      console.error("Error in Hermes chat proxy:", err);
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
