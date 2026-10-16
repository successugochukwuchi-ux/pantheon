/**
 * diagramManager.ts
 * Downloads and compresses diagram images for offline storage in SQLite.
 * Uses native Expo FileSystem for rock-solid downloads and fast base64 caching.
 * Handles JSON blocks, Markdown images, XML (<DIAGRAM>...</DIAGRAM>), and HTML <img> formats.
 */
import * as FileSystem from 'expo-file-system';

// Optimizes Cloudinary URLs to request compressed, mobile-friendly images (~25-45KB)
export function getOptimizedDiagramUrl(url: string, maxWidth = 650, quality = 60): string {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    if (!url.includes('/upload/w_') && !url.includes('/upload/q_')) {
      return url.replace('/upload/', `/upload/w_${maxWidth},c_limit,q_${quality},f_jpg/`);
    }
  }
  return url;
}

// Fetches an image URL with native Expo FileSystem, compresses it to base64
export async function downloadAndCompressImage(url: string, timeoutMs = 8000): Promise<string> {
  if (!url || typeof url !== 'string') return url;
  // If already base64 or file URL, return directly
  if (url.startsWith('data:image/') || url.startsWith('file://')) return url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

  const optimizedUrl = getOptimizedDiagramUrl(url);

  // 1. Primary: Native Expo FileSystem Download (rock-solid on iOS & Android)
  try {
    if (FileSystem && FileSystem.cacheDirectory) {
      const filename = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
      const tempPath = `${FileSystem.cacheDirectory}${filename}`;

      // Native download with timeout
      const downloadPromise = FileSystem.downloadAsync(optimizedUrl, tempPath);
      let timer: any;
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      });

      const res = await Promise.race([downloadPromise, timeoutPromise]);
      clearTimeout(timer);

      if (res && (res as any).status === 200) {
        const base64Data = await FileSystem.readAsStringAsync(tempPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Clean up temporary file
        FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});

        if (base64Data && base64Data.length > 50) {
          return `data:image/jpeg;base64,${base64Data}`;
        }
      }
    }
  } catch (fsErr) {
    // Continue to fallback
  }

  // 2. Secondary Web / Node fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(optimizedUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      if (typeof btoa === 'function') {
        const base64Data = btoa(binary);
        return `data:image/jpeg;base64,${base64Data}`;
      }
    }
  } catch (err) {
    // Fallback gracefully so syncing never fails
  }

  return url;
}

// Processes all diagrams in note content (JSON, XML, Markdown, and HTML formats)
export async function processAndCompressNoteDiagrams(content: string): Promise<string> {
  if (!content || typeof content !== 'string') return content;

  // 1. Check if JSON block array
  let isJson = false;
  let parsedBlocks: any[] | null = null;
  const trimmed = content.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        isJson = true;
        parsedBlocks = parsed;
      }
    } catch {}
  }

  if (isJson && parsedBlocks) {
    const blockPromises = parsedBlocks.map(async (block: any) => {
      if ((block.type === 'diagram' || block.type === 'image') && block.content && typeof block.content === 'string') {
        const compressed = await downloadAndCompressImage(block.content);
        return {
          ...block,
          content: compressed,
        };
      }
      return block;
    });

    const settled = await Promise.allSettled(blockPromises);
    const updated = settled.map((res, i) => res.status === 'fulfilled' ? res.value : parsedBlocks![i]);
    return JSON.stringify(updated);
  }

  let updatedContent = content;

  // 2. Check if XML format: <DIAGRAM>url</DIAGRAM> or <diagram>url</diagram>
  const xmlDiagramRegex = /<(DIAGRAM|diagram)>([\s\S]*?)<\/\1>/gi;
  const xmlMatches = [...updatedContent.matchAll(xmlDiagramRegex)];
  if (xmlMatches.length > 0) {
    for (const match of xmlMatches) {
      const fullTag = match[0];
      const tagName = match[1];
      const rawUrl = match[2].trim();
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const compressed = await downloadAndCompressImage(rawUrl);
        if (compressed && compressed !== rawUrl) {
          updatedContent = updatedContent.replace(fullTag, `<${tagName}>${compressed}</${tagName}>`);
        }
      }
    }
  }

  // 3. Check for Markdown image format: ![alt](url)
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/gi;
  const mdMatches = [...updatedContent.matchAll(mdImgRegex)];
  if (mdMatches.length > 0) {
    for (const match of mdMatches) {
      const fullTag = match[0];
      const altText = match[1];
      const rawUrl = match[2];
      const compressed = await downloadAndCompressImage(rawUrl);
      if (compressed && compressed !== rawUrl) {
        updatedContent = updatedContent.replace(fullTag, `![${altText}](${compressed})`);
      }
    }
  }

  // 4. Check for HTML img tags: <img src="url" ... />
  const imgRegex = /<img\s+[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const imgMatches = [...updatedContent.matchAll(imgRegex)];
  if (imgMatches.length > 0) {
    for (const match of imgMatches) {
      const rawUrl = match[1];
      const compressed = await downloadAndCompressImage(rawUrl);
      if (compressed && compressed !== rawUrl) {
        updatedContent = updatedContent.replace(rawUrl, compressed);
      }
    }
  }

  return updatedContent;
}

// Processes diagrams embedded inside question text or question options
export async function processAndCompressQuestionDiagrams(questionText: string): Promise<string> {
  if (!questionText || typeof questionText !== 'string') return questionText;
  return processAndCompressNoteDiagrams(questionText);
}
