import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { F } from './Theme';

const { width: windowWidth } = Dimensions.get('window');

interface NoteBlock {
  id: string;
  type: string;
  content: string;
  settings?: any;
}

interface NoteRendererProps {
  content: string;
}

export function NoteRenderer({ content }: NoteRendererProps) {
  const { colors: C } = useTheme();
  const [webViewHeight, setWebViewHeight] = useState(500);

  const blocks = useMemo(() => {
    if (typeof content !== 'string') return [{ id: '1', type: 'text', content: String(content || '') }];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed as NoteBlock[];
      return [{ id: '1', type: 'text', content: content }];
    } catch (e) {
      return [{ id: '1', type: 'text', content: content }];
    }
  }, [content]);

  const htmlContent = useMemo(() => {
    const renderedBlocks = blocks.map(block => {
      switch (block.type) {
        case 'h1':
          return `<div class="block-h1">${block.content}</div>`;
        case 'h2':
          return `<div class="block-h2">${block.content}</div>`;
        case 'text':
          // Escape HTML characters to prevent math delimiters (<, >) from being treated as tags
          const escapedContent = block.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return `<div class="block-text markdown-body">${escapedContent}</div>`;
        case 'math':
          return `<div class="block-math">$$${block.content.replace(/^\$\$?/, '').replace(/\$\$?$/, '')}$$</div>`;
        case 'table':
          try {
            const data = JSON.parse(block.content);
            let tableHtml = `<div class="block-table"><table>`;
            data.forEach((row: string[], ri: number) => {
              tableHtml += `<tr>`;
              row.forEach((cell) => {
                tableHtml += `<td>${cell}</td>`;
              });
              tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
            return tableHtml;
          } catch (e) {
            return `<div class="block-text" style="color: ${C.error}">Invalid Table</div>`;
          }
        case 'bullet-list':
        case 'numbered-list':
          const items = block.content.split('\n').filter(Boolean);
          const listType = block.type === 'bullet-list' ? 'ul' : 'ol';
          return `<div class="block-list"><${listType}>${items.map(i => `<li>${i.replace(/^[\*\-\+\d\.]+\s+/, '')}</li>`).join('')}</${listType}></div>`;
        case 'diagram':
          return `<div class="block-diagram">
            <img src="${block.content}" style="transform: scaleX(${block.settings?.flipX ? -1 : 1}) scaleY(${block.settings?.flipY ? -1 : 1});" />
            ${block.settings?.caption ? `<p class="caption">${block.settings.caption}</p>` : ''}
          </div>`;
        case 'video':
          return `<div class="block-video">🎥 Video: ${block.content}<br/><small>(Available on desktop)</small></div>`;
        case 'question':
          try {
            const q = JSON.parse(block.content);
            return `<div class="block-question">
              <div class="q-label">Quiz Check</div>
              <div class="q-text">${q.question}</div>
              <div class="q-options">
                <div class="q-opt q-correct">✓ ${q.correct}</div>
                ${(q.incorrect || []).map((inc: string) => `<div class="q-opt">○ ${inc}</div>`).join('')}
              </div>
              ${q.explanation ? `<div class="q-exp"><strong>Note:</strong> ${q.explanation}</div>` : ''}
            </div>`;
          } catch (e) { return ''; }
        default:
          return '';
      }
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <style>
            body { 
              background-color: ${C.bg}; 
              color: ${C.ink};
              font-family: -apple-system, system-ui;
              margin: 0; 
              padding: 16px;
              overflow-x: hidden;
            }
            .block-h1 { font-size: 28px; font-weight: bold; margin-bottom: 24px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-h2 { font-size: 24px; font-weight: bold; margin-top: 36px; margin-bottom: 18px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-text { font-size: 17px; line-height: 1.8; color: ${C.inkMid}; margin-bottom: 28px; letter-spacing: 0.2px; }
            .block-math { 
              background: ${C.surface}; 
              border: 1px solid ${C.border}; 
              padding: 28px; 
              border-radius: 16px; 
              margin: 36px 0; 
              text-align: center;
              overflow-x: auto;
              font-size: 19px;
            }
            .block-table { overflow-x: auto; margin: 36px 0; border: 1px solid ${C.border}; border-radius: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 15px; }
            td { padding: 16px; border: 1px solid ${C.border}; color: ${C.inkMid}; }
            .block-list { margin-bottom: 28px; padding-left: 28px; color: ${C.inkMid}; }
            li { margin-bottom: 14px; font-size: 17px; line-height: 1.7; }
            .block-diagram { margin: 36px 0; text-align: center; }
            .block-diagram img { max-width: 100%; height: auto; border-radius: 12px; }
            .caption { font-size: 13px; font-style: italic; color: ${C.inkLight}; margin-top: 12px; text-align: center; }
            .block-video { padding: 48px; border-radius: 16px; border: 1px dashed ${C.border}; background: ${C.surface}; margin: 36px 0; text-align: center; color: ${C.inkLight}; font-size: 15px; }
            .block-question { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 20px; padding: 28px; margin: 48px 0; }
            .q-label { font-size: 11px; font-weight: bold; color: ${C.inkLight}; letter-spacing: 2.5px; margin-bottom: 18px; text-transform: uppercase; }
            .q-text { font-size: 20px; font-weight: bold; color: ${C.ink}; line-height: 1.5; margin-bottom: 28px; }
            .q-opt { padding: 18px; border-radius: 14px; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.inkMid}; font-size: 15px; margin-bottom: 12px; }
            .q-correct { border-color: #27AE60; background: #E8F6EF; color: #27AE60; font-weight: bold; }
            .q-exp { margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 15px; font-style: italic; color: ${C.inkLight}; line-height: 1.7; }
            
            p { margin: 0 0 16px 0; }
            p:last-child { margin-bottom: 0; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" rel="stylesheet">
        </head>
        <body>
          <div id="content">
            ${renderedBlocks}
          </div>
          
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/mhchem.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
          
          <script>
            // Parse Markdown for text blocks, protecting math
            document.querySelectorAll('.markdown-body').forEach(el => {
              const localMathMap = new Map();
              let localCounter = 0;

              function protect(text) {
                // $$...$$ for display and $...$ for inline (must not start with space)
                return text.replace(/\$\$([\s\S]+?)\$\$|\$([^\s\$][^\$]*?)\$/g, (match) => {
                  const id = '___MATH_' + (localCounter++) + '___';
                  localMathMap.set(id, match);
                  return id;
                });
              }

              function unprotect(html) {
                let result = html;
                localMathMap.forEach((content, id) => {
                  result = result.replace(id, content);
                });
                return result;
              }

              const raw = el.textContent;
              const protectedText = protect(raw);
              const parsed = marked.parse(protectedText);
              el.innerHTML = unprotect(parsed);
            });

            function renderMath() {
              if (window.renderMathInElement) {
                renderMathInElement(document.body, {
                  delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                  ],
                  throwOnError: false
                });
              }
            }

            function sendHeight() {
              const height = document.getElementById('content').scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
            }

            renderMath();
            setTimeout(sendHeight, 100);
            setTimeout(sendHeight, 500);
            
            // Re-render math if changed and update height
            window.onload = function() {
              renderMath();
              sendHeight();
            };
          </script>
        </body>
      </html>
    `;
  }, [blocks, C]);

  return (
    <View style={[s.container, { height: webViewHeight }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ backgroundColor: 'transparent' }}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height) {
              setWebViewHeight(data.height + 20);
            }
          } catch(e) {}
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
});


