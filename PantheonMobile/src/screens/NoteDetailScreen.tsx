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

  // We pass the raw blocks to the WebView and let it handle the rendering
  // for maximum consistency with the web's Markdown/MathJax combo.
  let blocks = [];
  try {
    blocks = JSON.parse(note.content);
    if (!Array.isArray(blocks)) {
        blocks = [{ id: 'fallback', type: 'text', content: note.content }];
    }
  } catch (e) {
    blocks = [{ id: 'fallback', type: 'text', content: note.content || '' }];
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script>
          window.MathJax = {
            tex: {
              inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
              displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
              packages: {'[+]': ['mhchem', 'physics']},
              macros: {
                degree: "^{\\\\circ}"
              }
            },
            loader: {
              load: ['[tex]/mhchem', '[tex]/physics']
            },
            options: {
              enableMenu: false
            },
            startup: {
              pageReady: () => {
                return MathJax.startup.defaultPageReady().then(() => {
                  window.ReactNativeWebView.postMessage('rendered');
                });
              }
            }
          };
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <style>
          body {
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: transparent;
            color: ${colors.foreground};
            line-height: 1.6;
          }
          h1 { font-size: 28px; margin-bottom: 16px; font-weight: 800; border-bottom: 1px solid ${colors.border}; padding-bottom: 8px; }
          h2 { font-size: 22px; margin-bottom: 12px; font-weight: 700; margin-top: 24px; }
          p { margin-bottom: 16px; font-size: 16px; }
          .math-block { 
            margin: 20px 0; 
            padding: 16px; 
            background: ${colors.muted}1A; 
            border-radius: 12px;
            overflow-x: auto;
          }
          img { max-width: 100%; height: auto; border-radius: 12px; margin: 16px 0; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          table td, table th { border: 1px solid ${colors.border}; padding: 12px; font-size: 14px; }
          blockquote { border-left: 4px solid ${colors.primary}; padding-left: 16px; margin: 16px 0; font-style: italic; opacity: 0.8; }
          code { background: ${colors.muted}; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
          pre { background: ${colors.muted}; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
          ul, ol { margin-bottom: 16px; padding-left: 24px; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div id="content"></div>
        <script>
          const blocks = ${JSON.stringify(blocks)};
          const contentEl = document.getElementById('content');
          
          function render() {
            let html = '';
            blocks.forEach(block => {
              if (block.type === 'h1') {
                html += '<h1>' + marked.parseInline(block.content) + '</h1>';
              } else if (block.type === 'h2') {
                html += '<h2>' + marked.parseInline(block.content) + '</h2>';
              } else if (block.type === 'text') {
                html += marked.parse(block.content);
              } else if (block.type === 'math') {
                html += '<div class="math-block">\\\\[ ' + block.content + ' \\\\]</div>';
              } else if (block.type === 'diagram') {
                const transform = block.settings ? "scale(" + (block.settings.flipX ? -1 : 1) + "," + (block.settings.flipY ? -1 : 1) + ")" : "none";
                html += '<div style="text-align: center;"><img src="' + block.content + '" style="transform: ' + transform + '; width: ' + (block.settings?.width || 'auto') + 'px; height: ' + (block.settings?.height || 'auto') + 'px;" /></div>';
              } else if (block.type === 'table') {
                try {
                  const rows = JSON.parse(block.content);
                  let tableHtml = '<table>';
                  rows.forEach(row => {
                    tableHtml += '<tr>';
                    row.forEach(cell => {
                      tableHtml += '<td>' + marked.parseInline(cell) + '</td>';
                    });
                    tableHtml += '</tr>';
                  });
                  tableHtml += '</table>';
                  html += tableHtml;
                } catch(e) {}
              }
            });
            contentEl.innerHTML = html;
            
            // Trigger MathJax
            if (window.MathJax && window.MathJax.typesetPromise) {
              window.MathJax.typesetPromise();
            }
          }
          
          window.onload = render;
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
        onMessage={(event) => {
           // Can handle rendering finished messages here if needed
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
