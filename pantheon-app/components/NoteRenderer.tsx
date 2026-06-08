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
  bgOverride?: string;
  paddingOverride?: string;
  inkOverride?: string;
}

export function NoteRenderer({ 
  content,
  bgOverride,
  paddingOverride,
  inkOverride
}: NoteRendererProps) {
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
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true,
                processEnvironments: true
              },
              options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
              },
              startup: {
                ready() {
                  MathJax.startup.defaultReady();
                  MathJax.startup.promise.then(() => {
                    // Markdown is already rendered by now; typeset and send height
                    MathJax.typesetPromise([document.body]).then(() => {
                      sendHeight();
                    });
                  });
                }
              }
            };
          </script>
          <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" id="MathJax-script" async></script>
          <style>
            * {
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
              -webkit-touch-callout: none;
            }
            body { 
              background-color: ${bgOverride || C.bg}; 
              color: ${inkOverride || C.ink};
              font-family: -apple-system, system-ui;
              margin: 0; 
              padding: ${paddingOverride || '16px 20px 48px 20px'};
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            .block-h1 { font-size: 24px; font-weight: bold; margin-bottom: 20px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-h2 { font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 14px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-text { font-size: 15.5px; line-height: 1.7; color: ${C.inkMid}; margin-bottom: 24px; letter-spacing: 0.1px; }
            .block-math { 
              background: ${C.surface}; 
              border: 1px solid ${C.border}; 
              padding: 16px; 
              border-radius: 12px; 
              margin: 28px 0; 
              text-align: center;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              font-size: 16px;
            }
            /* Hide scrollbars on scrollable components for elegant rendering */
            .block-math::-webkit-scrollbar,
            .block-table::-webkit-scrollbar,
            mjx-container::-webkit-scrollbar {
              display: none !important;
            }
            .block-math,
            .block-table,
            mjx-container {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
            /* Allow beautiful horizontal scroll on math elements */
            mjx-container {
              max-width: 100% !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch !important;
              display: inline-block;
              vertical-align: middle;
            }
            mjx-container[display="true"] {
              display: block !important;
              margin: 1em 0 !important;
              text-align: center;
            }
            .block-table { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 28px 0; border: 1px solid ${C.border}; border-radius: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            td { padding: 12px; border: 1px solid ${C.border}; color: ${C.inkMid}; }
            .block-list { margin-bottom: 24px; padding-left: 24px; color: ${C.inkMid}; }
            li { margin-bottom: 10px; font-size: 15.5px; line-height: 1.6; }
            .block-diagram { margin: 28px 0; text-align: center; }
            .block-diagram img { max-width: 100%; height: auto; border-radius: 12px; }
            .caption { font-size: 12px; font-style: italic; color: ${C.inkLight}; margin-top: 10px; text-align: center; }
            .block-video { padding: 32px; border-radius: 12px; border: 1px dashed ${C.border}; background: ${C.surface}; margin: 28px 0; text-align: center; color: ${C.inkLight}; font-size: 14px; }
            .block-question { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; padding: 20px; margin: 36px 0; }
            .q-label { font-size: 10px; font-weight: bold; color: ${C.inkLight}; letter-spacing: 2.5px; margin-bottom: 14px; text-transform: uppercase; }
            .q-text { font-size: 18px; font-weight: bold; color: ${C.ink}; line-height: 1.5; margin-bottom: 20px; }
            .q-opt { padding: 14px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.inkMid}; font-size: 14px; margin-bottom: 10px; }
            .q-correct { border-color: #27AE60; background: #E8F6EF; color: #27AE60; font-weight: bold; }
            .q-exp { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 14px; font-style: italic; color: ${C.inkLight}; line-height: 1.6; }
            
            p { margin: 0 0 16px 0; }
            p:last-child { margin-bottom: 0; }

            /* Offline Math Styles */
            .offline-math-font {
              font-family: 'Times New Roman', Times, 'Cambria Math', serif;
              font-style: italic;
              letter-spacing: 0.5px;
            }
            .offline-math-font sub, .offline-math-font sup {
              font-style: normal;
              font-size: 0.7em;
            }
            .fraction {
              display: inline-block;
              vertical-align: middle;
              text-align: center;
              margin: 0 6px;
            }
            .numerator {
              display: block;
              border-bottom: 1.5px solid ${C.inkMid};
              padding: 0 4px;
              font-style: italic;
            }
            .denominator {
              display: block;
              padding: 0 4px;
              font-style: italic;
            }
            .sqrt {
              font-style: normal;
              white-space: nowrap;
            }
            .sqrt-content {
              border-top: 1.5px solid ${C.inkMid};
              padding-top: 1px;
              margin-left: 2px;
              display: inline-block;
              font-style: italic;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" rel="stylesheet">
        </head>
        <body oncontextmenu="return false;">
          <div id="content">
            ${renderedBlocks}
          </div>
          
          <script>
            function sendHeight() {
              try {
                var el = document.getElementById('content');
                if (!el) return;
                var height = el.scrollHeight;
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ height: height }));
                }
              } catch (err) {
                console.error('sendHeight error:', err);
              }
            }

            function renderOfflineMath(text) {
              if (!text) return '';
              var html = text;
              
              // Clean up display/inline delimiters
              html = html.replace(/^\\$\\$?/, '').replace(/\\$\\$?$/, '');
              
              // Greek letters (lowercase)
              var greeks = {
                'alpha': '&alpha;', 'beta': '&beta;', 'gamma': '&gamma;', 'delta': '&delta;',
                'epsilon': '&epsilon;', 'zeta': '&zeta;', 'eta': '&eta;', 'theta': '&theta;',
                'iota': '&iota;', 'kappa': '&kappa;', 'lambda': '&lambda;', 'mu': '&mu;',
                'nu': '&nu;', 'xi': '&xi;', 'pi': '&pi;', 'rho': '&rho;',
                'sigma': '&sigma;', 'tau': '&tau;', 'upsilon': '&upsilon;', 'phi': '&phi;',
                'chi': '&chi;', 'psi': '&psi;', 'omega': '&omega;'
              };
              for (var key in greeks) {
                if (greeks.hasOwnProperty(key)) {
                  html = html.split('\\\\' + key).join(greeks[key]);
                }
              }

              // Greek letters (uppercase)
              var greeksCap = {
                'Gamma': '&Gamma;', 'Delta': '&Delta;', 'Theta': '&Theta;', 'Lambda': '&Lambda;',
                'Xi': '&Xi;', 'Pi': '&Pi;', 'Sigma': '&Sigma;', 'Phi': '&Phi;',
                'Psi': '&Psi;', 'Omega': '&Omega;'
              };
              for (var key in greeksCap) {
                if (greeksCap.hasOwnProperty(key)) {
                  html = html.split('\\\\' + key).join(greeksCap[key]);
                }
              }

              // Math operators & symbols
              var symbols = {
                '\\\\infty': '&infin;',
                '\\\\partial': '&part;',
                '\\\\hbar': '&#8463;',
                '\\\\geq': '&ge;',
                '\\\\ge': '&ge;',
                '\\\\leq': '&le;',
                '\\\\le': '&le;',
                '\\\\neq': '&ne;',
                '\\\\ne': '&ne;',
                '\\\\approx': '&approx;',
                '\\\\pm': '&plusmn;',
                '\\\\times': '&times;',
                '\\\\div': '&divide;',
                '\\\\cdot': '&middot;',
                '\\\\to': '&rarr;',
                '\\\\rightarrow': '&rarr;',
                '\\\\leftarrow': '&larr;',
                '\\\\nabla': '&nabla;',
                '\\\\sum': '<span style="font-size:1.3em;">&sum;</span>',
                '\\\\int': '<span style="font-size:1.4em; vertical-align:-0.1em;">&int;</span>',
                '\\\\\\\\': '<br/>'
              };
              for (var key in symbols) {
                if (symbols.hasOwnProperty(key)) {
                  html = html.split(key).join(symbols[key]);
                }
              }

              // Fractions
              var prevHtml = '';
              while (html !== prevHtml) {
                prevHtml = html;
                html = html.replace(/\\\\frac\\s*\\{([^}]*)\\}\\s*\\{([^}]*)\\}/g, function(match, num, den) {
                  return '<span class="fraction"><span class="numerator">' + num + '</span><span class="denominator">' + den + '</span></span>';
                });
              }

              // Square roots
              prevHtml = '';
              while (html !== prevHtml) {
                prevHtml = html;
                html = html.replace(/\\\\sqrt\\s*\\{([^}]*)\\}/g, function(match, content) {
                  return '<span class="sqrt">&radic;<span class="sqrt-content">' + content + '</span></span>';
                });
              }

              // Superscripts & Subscripts (curly braces first)
              html = html.replace(/\\^\\{([^}]*)\\}/g, '<sup>$1</sup>');
              html = html.replace(/_\\{([^}]*)\\}/g, '<sub>$1</sub>');
              // Single character scripts
              html = html.replace(/\\^([a-zA-Z0-9\\+\\-\\=\\(\\)]+)/g, '<sup>$1</sup>');
              html = html.replace(/_([a-zA-Z0-9\\+\\-\\=\\(\\)]+)/g, '<sub>$1</sub>');

              return '<span class="offline-math-font">' + html + '</span>';
            }

            // Render markdown text blocks, protecting all math delimiters first
            function renderMarkdown() {
              var myMarked = {
                parse: function(markdown) {
                  if (!markdown) return '';
                  var html = markdown;
                  
                  // Convert headers
                  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
                  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
                  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
                  
                  // Bold and italics
                  html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                  html = html.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
                  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
                  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
                  
                  // Code blocks / inline code
                  html = html.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
                  
                  // Link replacement
                  html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
                  
                  // Lists
                  // Unordered
                  html = html.replace(/^\\s*[\\*\\-\\+]\\s+(.*)$/gim, '<ul><li>$1</li></ul>');
                  // Ordered
                  html = html.replace(/^\\s*\\d+\\.\\s+(.*)$/gim, '<ol><li>$1</li></ol>');
                  // Merge consecutive uls and ols
                  html = html.replace(/<\\/ul>\\s*<ul>/g, '');
                  html = html.replace(/<\\/ol>\\s*<ol>/g, '');
                  
                  // Paragraphs (split by two or more newlines)
                  var lines = html.split(/\\n{2,}/);
                  html = lines.map(function(line) {
                    var trimmed = line.trim();
                    if (trimmed.indexOf('<h') === 0 || trimmed.indexOf('<ul') === 0 || trimmed.indexOf('<ol') === 0 || trimmed.indexOf('<div') === 0 || trimmed.indexOf('<p>') === 0) {
                      return line;
                    }
                    return '<p>' + line.replace(/\\n/g, '<br>') + '</p>';
                  }).join('\\n');
                  
                  return html;
                }
              };

              var parser = (typeof marked !== 'undefined') ? marked : myMarked;

              document.querySelectorAll('.markdown-body').forEach(function(el) {
                var mathMap = new Map();
                var counter = 0;

                function protect(text) {
                  return text
                    .replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, function(m) { var id = 'MATHJAXPH' + (counter++) + 'PH'; mathMap.set(id, m); return id; })
                    .replace(/\\\\\\[([\\s\\S]+?)\\\\\\]/g, function(m) { var id = 'MATHJAXPH' + (counter++) + 'PH'; mathMap.set(id, m); return id; })
                    .replace(/\\$([^\\s\\$][^\\$\\n]*?)\\$/g, function(m) { var id = 'MATHJAXPH' + (counter++) + 'PH'; mathMap.set(id, m); return id; })
                    .replace(/\\\\\\((.+?)\\\\\\)/g, function(m) { var id = 'MATHJAXPH' + (counter++) + 'PH'; mathMap.set(id, m); return id; });
                }

                function unprotect(html) {
                  var result = html;
                  mathMap.forEach(function(val, key) { result = result.split(key).join(val); });
                  return result;
                }

                var raw = el.textContent || '';
                try {
                  el.innerHTML = unprotect(parser.parse(protect(raw)));
                } catch (e) {
                  console.error('Markdown processing failed:', e);
                  try {
                    el.innerHTML = unprotect(myMarked.parse(protect(raw)));
                  } catch (err) {
                    el.innerHTML = raw;
                  }
                }
              });
            }

            function fallbackMath() {
              try {
                // Render any .block-math elements offline
                document.querySelectorAll('.block-math').forEach(function(el) {
                  var raw = el.textContent || '';
                  el.innerHTML = renderOfflineMath(raw);
                });
                
                // Also find any math tags within text (delimited by $$ or $)
                document.querySelectorAll('.markdown-body').forEach(function(el) {
                  var html = el.innerHTML;
                  
                  // Replace displayed math: $$ formula $$
                  html = html.replace(/\\$\\$([\\s\\S]+?)\\$\\$/g, function(m, formula) {
                    return '<div class="block-math">' + renderOfflineMath(formula) + '</div>';
                  });
                  
                  // Replace inline math: $ formula $ or \( formula \)
                  html = html.replace(/\\$([^\\$\\n]+?)\\$/g, function(m, formula) {
                    return ' ' + renderOfflineMath(formula) + ' ';
                  });
                  html = html.replace(/\\\\\\(([\\s\\S]+?)\\\\\\)/g, function(m, formula) {
                    return ' ' + renderOfflineMath(formula) + ' ';
                  });

                  el.innerHTML = html;
                });
              } catch (e) {
                console.error('fallbackMath error:', e);
              }
              sendHeight();
            }

            // Trigger MathJax typesetting then update height
            function renderMath() {
              if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([document.body])
                  .then(sendHeight)
                  .catch(function(err) {
                    console.warn('MathJax error:', err);
                    fallbackMath();
                  });
              } else {
                fallbackMath();
              }
            }

            document.addEventListener('DOMContentLoaded', function() {
              renderMarkdown();
              
              // Give MathJax a small window to load asynchronously.
              // If it doesn't load/start up, trigger offline fallback typesetting.
              setTimeout(function() {
                if (window.MathJax && window.MathJax.startup && window.MathJax.typesetPromise) {
                  renderMath();
                } else {
                  fallbackMath();
                }
              }, 400);

              // Setup ResizeObserver to report height dynamically
              if (window.ResizeObserver) {
                try {
                  var contentEl = document.getElementById('content');
                  if (contentEl) {
                    var ro = new ResizeObserver(function() {
                      sendHeight();
                    });
                    ro.observe(contentEl);
                  }
                } catch (e) {
                  console.error('ResizeObserver error:', e);
                }
              }
              
              sendHeight();
            });

            window.addEventListener('load', function() {
              sendHeight();
              // Register loaders on images
              document.querySelectorAll('img').forEach(function(img) {
                img.addEventListener('load', sendHeight);
                img.addEventListener('error', sendHeight);
              });
            });

            // Extra fallback intervals
            setTimeout(sendHeight, 150);
            setTimeout(sendHeight, 500);
            setTimeout(sendHeight, 1000);
            setTimeout(sendHeight, 2000);
            setTimeout(sendHeight, 4000);
          </script>
        </body>
      </html>
    `;
  }, [blocks, C, bgOverride, paddingOverride, inkOverride]);

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
              setWebViewHeight(data.height + 45);
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


