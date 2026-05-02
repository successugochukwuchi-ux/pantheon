import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

// Escape HTML special chars so plain text brackets/symbols are never
// misread as LaTeX by KaTeX's auto-render.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// For text/heading blocks: escape everything EXCEPT intentional $...$ or $$...$$ math spans.
// This means `f(x)`, `[a, b]`, `(n+1)` etc. are safe — only explicit dollar-sign
// delimited content is handed to KaTeX.
function processTextContent(raw: string): string {
  // Split on $$ first (display), then $ (inline), preserving the delimiters.
  // We do two passes to handle both, replacing math spans with placeholders,
  // escaping the rest, then restoring.
  const placeholders: string[] = [];

  // Replace $$...$$ and $...$ with placeholders before escaping
  const withPlaceholders = raw.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `\x00MATH${idx}\x00`;
  });

  // Escape the non-math parts
  const escaped = escapeHtml(withPlaceholders);

  // Restore math placeholders (unescaped — KaTeX needs the raw $ delimiters)
  return escaped.replace(/\x00MATH(\d+)\x00/g, (_, idx) => placeholders[Number(idx)]);
}

export const NoteDetailScreen = ({ route }: any) => {
  const { note } = route.params;
  const { colors } = useTheme();

  let contentHtml = '';
  try {
    const blocks = JSON.parse(note.content);
    if (Array.isArray(blocks)) {
      contentHtml = blocks.map(block => {
        switch (block.type) {
          case 'h1': {
            const content = processTextContent(block.content);
            return `<h1 class="math-text" style="color: ${colors.foreground}; font-size: 28px; font-weight: bold; margin-bottom: 16px; margin-top: 8px;">${content}</h1>`;
          }
          case 'h2': {
            const content = processTextContent(block.content);
            return `<h2 class="math-text" style="color: ${colors.foreground}; font-size: 22px; font-weight: bold; margin-bottom: 12px; margin-top: 8px;">${content}</h2>`;
          }
          case 'text': {
            const processedText = processTextContent(block.content).replace(/\n/g, '<br/>');
            return `<div class="math-text text-block" style="color: ${colors.foreground}; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${processedText}</div>`;
          }
          case 'math': {
            // Dedicated math block — strip any accidental outer $$ from stored content
            const cleanMath = block.content.replace(/^\$\$|\$\$$/g, '').trim();
            return `<div class="math-block" style="margin: 16px 0; text-align: center; overflow-x: auto; padding: 8px 0; color: ${colors.foreground};">$$${cleanMath}$$</div>`;
          }
          case 'diagram': {
            const transform = `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`;
            return `<div style="margin: 16px 0; text-align: center;">
              <img src="${block.content}" style="max-width: 100%; height: ${block.settings?.height ? block.settings.height + 'px' : 'auto'}; width: ${block.settings?.width ? block.settings.width + 'px' : 'auto'}; transform: ${transform}; border-radius: 8px;" />
            </div>`;
          }
          case 'table': {
            try {
              const rows = JSON.parse(block.content);
              const tableHtml = rows.map((row: string[]) =>
                `<tr>${row.map((cell: string) => `<td style="border: 1px solid ${colors.border}; padding: 8px; font-size: 14px;">${processTextContent(cell)}</td>`).join('')}</tr>`
              ).join('');
              return `<div style="overflow-x: auto; margin: 16px 0;">
                <table class="math-text" style="width: 100%; border-collapse: collapse; color: ${colors.foreground};">${tableHtml}</table>
              </div>`;
            } catch (e) {
              return `<div style="color: ${colors.destructive};">Error rendering table</div>`;
            }
          }
          default: return '';
        }
      }).join('');
    } else {
      throw new Error('Not an array');
    }
  } catch (e) {
    contentHtml = `<div class="math-text" style="color: ${colors.foreground}; font-size: 16px; line-height: 1.6;">${processTextContent(note.content).replace(/\n/g, '<br/>')}</div>`;
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <style>
          body {
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            background-color: transparent;
            word-wrap: break-word;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            user-select: none;
          }
          img { max-width: 100%; height: auto; }
          table td { word-break: break-word; }
          .text-block { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            // Only run auto-render on elements explicitly marked as math-containing.
            // This prevents plain text brackets like (x+1), [a,b] from being
            // misinterpreted as LaTeX delimiters.
            var mathEls = document.querySelectorAll('.math-text, .math-block');
            mathEls.forEach(function(el) {
              renderMathInElement(el, {
                delimiters: [
                  {left: "$$", right: "$$", display: true},
                  {left: "$", right: "$", display: false}
                ],
                throwOnError: false,
                errorColor: "#ef4444",
                strict: false
              });
            });
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlTemplate }}
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ flex: 1 }}
        scrollEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
