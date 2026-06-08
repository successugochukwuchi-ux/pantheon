import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add Security Headers Middleware
  app.use((req, res, next) => {
    // 1. Content Security Policy (CSP)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval' blob: ws: wss:; connect-src 'self' https: wss: ws:; img-src 'self' data: https: referrer blob:; frame-src 'self' https:; font-src 'self' data: https:;"
    );
    // 2. Strict-Transport-Security (HSTS)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    // 3. X-Frame-Options
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // 4. X-Content-Type-Options
    res.setHeader("X-Content-Type-Options", "nosniff");
    // 5. Referrer-Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // 6. Permissions-Policy
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // 7. X-XSS-Protection
    res.setHeader("X-XSS-Protection", "1; mode=block");

    next();
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
