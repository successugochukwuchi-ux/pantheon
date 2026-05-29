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
