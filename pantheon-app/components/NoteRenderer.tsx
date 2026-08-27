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
  onFocusBlock?: (type: 'math' | 'diagram', content: string) => void;
  scrollableMath?: boolean;
  scrollEnabled?: boolean;
  onScrollPercentage?: (percentage: number) => void;
  onNavigate?: (action: 'prev' | 'next') => void;
  headerMeta?: {
    courseCode?: string;
    title?: string;
    date?: string;
  };
  summary?: string;
  nav?: {
    hasPrev: boolean;
    hasNext: boolean;
  };
}

export function NoteRenderer({ 
  content,
  bgOverride,
  paddingOverride,
  inkOverride,
  onFocusBlock,
  scrollableMath = false,
  scrollEnabled = false,
  onScrollPercentage,
  onNavigate,
  headerMeta,
  summary,
  nav,
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
      if (content.includes('<PLX>') || content.includes('</PLX>')) {
        const plxMatch = /<PLX>([\s\S]*?)<\/PLX>/i.exec(content);
        const text = plxMatch ? plxMatch[1].trim() : content.trim();
        const tagRegex = /<(H1|H2|TEXT|B|I|U|MATH|LIST|ORDERED|TABLE|VIDEO|DIAGRAM|QUES)(?:\s*=\s*"([^"]*)")?>([\s\S]*?)<\/\1>/gi;
        const resultBlocks: NoteBlock[] = [];
        let match;
        let idx = 1;
        while ((match = tagRegex.exec(text)) !== null) {
          const tagName = match[1].toUpperCase();
          const attr = match[2] || '';
          let bContent = match[3].trim();
          if (tagName === 'TABLE') {
            const rows = bContent.split('\n').filter(r => r.trim().length > 0).map(r => r.split(',').map(c => c.trim()));
            resultBlocks.push({ id: String(idx++), type: 'table', content: JSON.stringify(rows) });
          } else if (tagName === 'QUES') {
            const corMatch = /<COR(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(bContent);
            const incMatches = [...bContent.matchAll(/<INC(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/gi)];
            const expMatch = /<EXP(?:\s*=\s*"([^"]*)"|\s*=\s*([^>\s]+))?\s*>/i.exec(bContent);
            const firstSubTag = bContent.search(/<(COR|INC|EXP)/i);
            const questionBody = firstSubTag === -1 ? bContent.trim() : bContent.substring(0, firstSubTag).trim();
            const qData = {
              question: questionBody,
              correct: corMatch ? (corMatch[1] || corMatch[2] || '') : '',
              incorrect: incMatches.map(m => m[1] || m[2] || '').filter(Boolean),
              explanation: expMatch ? (expMatch[1] || expMatch[2] || '') : ''
            };
            resultBlocks.push({ id: String(idx++), type: 'question', content: JSON.stringify(qData) });
          } else {
            const typeMap: Record<string, string> = {
              'H1': 'h1',
              'H2': 'h2',
              'TEXT': 'text',
              'B': 'text',
              'I': 'text',
              'U': 'text',
              'MATH': 'math',
              'LIST': 'bullet-list',
              'ORDERED': 'numbered-list',
              'VIDEO': 'video',
              'DIAGRAM': 'diagram'
            };
            if (tagName === 'B') bContent = `<B>${bContent}</B>`;
            if (tagName === 'I') bContent = `<I>${bContent}</I>`;
            if (tagName === 'U') bContent = `<U>${bContent}</U>`;
            resultBlocks.push({ id: String(idx++), type: typeMap[tagName] || 'text', content: bContent });
          }
        }
        if (resultBlocks.length > 0) return resultBlocks;
      }
      return [{ id: '1', type: 'text', content: content }];
    }
  }, [content]);

  const htmlContent = useMemo(() => {
    const formatTags = (str: string) => {
      if (!str) return '';
      return str
        .replace(/<B>([\s\S]*?)<\/B>/gi, '<strong>$1</strong>')
        .replace(/<I>([\s\S]*?)<\/I>/gi, '<em>$1</em>')
        .replace(/<U>([\s\S]*?)<\/U>/gi, '<u>$1</u>')
        .replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<strong>$1</strong>')
        .replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<em>$1</em>')
        .replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<u>$1</u>');
    };

    const renderedBlocks = blocks.map(block => {
      switch (block.type) {
        case 'h1':
          return `<div class="block-h1 markdown-body">${formatTags(block.content)}</div>`;
        case 'h2':
          return `<div class="block-h2 markdown-body">${formatTags(block.content)}</div>`;
        case 'text':
          return `<div class="block-text markdown-body">${formatTags(block.content)}</div>`;
        case 'math':
          const escapedMath = block.content.replace(/^\$\$?/, '').replace(/\$\$?$/, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
          return `<div class="block-math" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'focus', blockType: 'math', content: '${escapedMath}' }))">$$${block.content.replace(/^\$\$?/, '').replace(/\$\$?$/, '')}$$</div>`;
        case 'table':
          try {
            const data = JSON.parse(block.content);
            let tableHtml = `<div class="block-table"><table>`;
            data.forEach((row: string[], ri: number) => {
              tableHtml += `<tr>`;
              row.forEach((cell) => {
                tableHtml += `<td class="markdown-body">${formatTags(cell)}</td>`;
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
          return `<div class="block-list"><${listType}>${items.map(i => `<li class="markdown-body">${formatTags(i.replace(/^[\*\-\+\d\.]+\s+/, ''))}</li>`).join('')}</${listType}></div>`;
        case 'diagram':
          const escapedDiagram = block.content.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
          return `<div class="block-diagram" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'focus', blockType: 'diagram', content: '${escapedDiagram}' }))">
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
              <div class="q-text markdown-body">${formatTags(q.question)}</div>
              <div class="q-options">
                <div class="q-opt q-correct markdown-body">✓ ${formatTags(q.correct)}</div>
                ${(q.incorrect || []).map((inc: string) => `<div class="q-opt markdown-body">○ ${formatTags(inc)}</div>`).join('')}
              </div>
              ${q.explanation ? `<div class="q-exp markdown-body"><strong>Note:</strong> ${formatTags(q.explanation)}</div>` : ''}
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
                enableMenu: false,
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
              },
              chtml: {
                scale: 1,
                minScale: 0.4,
                matchFontHeight: true,
                displayAlign: 'center',
                displayIndent: '0'
              },
              startup: {
                ready() {
                  MathJax.startup.defaultReady();
                  MathJax.startup.promise.then(() => {
                    MathJax.typesetPromise([document.body]).then(() => {
                      if (typeof autoScaleMath === 'function') autoScaleMath();
                      sendHeight();
                    });
                  });
                }
              }
            };
          </script>
          <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" id="MathJax-script" async></script>
          <style>
            *, *::before, *::after {
              -webkit-user-select: none !important;
              -moz-user-select: none !important;
              -ms-user-select: none !important;
              user-select: none !important;
              -webkit-touch-callout: none !important;
              -webkit-tap-highlight-color: transparent !important;
            }
            body { 
              background-color: ${bgOverride || C.bg}; 
              color: ${inkOverride || C.ink};
              font-family: -apple-system, system-ui, sans-serif;
              margin: 0; 
              padding: ${paddingOverride || '16px 20px 48px 20px'};
              overflow-x: hidden;
              -webkit-overflow-scrolling: touch;
              box-sizing: border-box;
              width: 100%;
            }
            #content {
              width: 100%;
              box-sizing: border-box;
            }
            .block-h1 { font-size: 24px; font-weight: bold; margin-bottom: 20px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-h2 { font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 14px; line-height: 1.3; font-family: 'DM Serif Display', serif; }
            .block-text { 
              font-size: 15.5px; 
              line-height: 1.7; 
              color: ${C.inkMid}; 
              margin-bottom: 24px; 
              letter-spacing: 0.1px; 
              word-wrap: break-word;
              overflow-wrap: break-word;
              box-sizing: border-box;
            }
            .markdown-body {
              word-wrap: break-word;
              overflow-wrap: break-word;
              box-sizing: border-box;
            }
            u { text-decoration: underline; text-underline-offset: 3px; }
            strong, b { font-weight: 700; }
            em, i { font-style: italic; }
            
            /* Dedicated math block styling */
            .block-math { 
              background: ${C.surface}; 
              border: 1px solid ${C.border}; 
              padding: ${scrollableMath ? '18px 16px' : '16px 14px'}; 
              border-radius: 14px; 
              margin: 18px 0; 
              text-align: ${scrollableMath ? 'left' : 'center'};
              overflow-x: auto !important;
              overflow-y: hidden !important;
              -webkit-overflow-scrolling: touch;
              font-size: 16px;
              cursor: pointer;
              max-width: 100% !important;
              width: 100% !important;
              box-sizing: border-box !important;
              display: block;
              position: relative;
            }
            .block-math.is-scrollable {
              white-space: nowrap !important;
            }
            .block-math mjx-container {
              margin: ${scrollableMath ? '0 auto' : '0 auto'} !important;
              text-align: center !important;
              min-width: 100%;
            }
            
            /* Horizontal scroll cue indicator */
            .math-scroll-wrapper {
              position: relative;
              width: 100%;
              overflow: hidden;
            }
            .scroll-edge-hint {
              position: absolute;
              top: 0;
              right: 0;
              bottom: 0;
              width: 32px;
              pointer-events: none;
              background: linear-gradient(to right, transparent, ${C.surface});
              border-top-right-radius: 14px;
              border-bottom-right-radius: 14px;
              opacity: 0;
              transition: opacity 0.25s ease;
            }
            .has-scroll .scroll-edge-hint {
              opacity: 1;
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
            
            /* Inline LaTeX math styling: prevent cutoff at edge of screen */
            mjx-container:not([display="true"]) {
              display: inline-block !important;
              max-width: 100% !important;
              overflow: visible !important;
              vertical-align: middle;
              box-sizing: border-box !important;
              padding: 0 1px;
            }
            mjx-container:not([display="true"]) mjx-math {
              white-space: normal !important;
            }
            mjx-container:not([display="true"]) svg {
              max-width: 100% !important;
              height: auto !important;
            }
            
            /* Display math styling: auto-scale and center without cutoff */
            mjx-container[display="true"] {
              display: block !important;
              margin: 0.8em auto !important;
              text-align: center !important;
              overflow: visible !important;
              box-sizing: border-box !important;
            }
            mjx-container[display="true"] svg {
              max-width: 100% !important;
              height: auto !important;
            }
            .block-table { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 28px 0; border: 1px solid ${C.border}; border-radius: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            td { padding: 12px; border: 1px solid ${C.border}; color: ${C.inkMid}; }
            .block-list { margin-bottom: 24px; padding-left: 24px; color: ${C.inkMid}; }
            li { 
              margin-bottom: 10px; 
              font-size: 15.5px; 
              line-height: 1.6; 
              word-wrap: break-word;
              overflow-wrap: break-word;
              box-sizing: border-box;
            }
            .block-diagram { margin: 28px 0; text-align: center; }
            .block-diagram img { max-width: 100%; height: auto; border-radius: 12px; }
            .caption { font-size: 12px; font-style: italic; color: ${C.inkLight}; margin-top: 10px; text-align: center; }
            .block-video { padding: 32px; border-radius: 12px; border: 1px dashed ${C.border}; background: ${C.surface}; margin: 28px 0; text-align: center; color: ${C.inkLight}; font-size: 14px; }
            .block-question { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; padding: 20px; margin: 36px 0; }
            .q-label { font-size: 10px; font-weight: bold; color: ${C.inkLight}; letter-spacing: 2.5px; margin-bottom: 14px; text-transform: uppercase; }
            .q-text { font-size: 18px; font-weight: bold; color: ${C.ink}; line-height: 1.5; margin-bottom: 20px; word-wrap: break-word; overflow-wrap: break-word; }
            .q-opt { padding: 14px; border-radius: 12px; border: 1px solid ${C.border}; background: ${C.bg}; color: ${C.inkMid}; font-size: 14px; margin-bottom: 10px; word-wrap: break-word; overflow-wrap: break-word; }
            .q-correct { border-color: #27AE60; background: #E8F6EF; color: #27AE60; font-weight: bold; }
            .q-exp { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 14px; font-style: italic; color: ${C.inkLight}; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; }
            
            .header-meta { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${C.border}; }
            .course-pill { display: inline-block; padding: 4px 10px; border-radius: 9999px; background-color: ${C.tagBg || C.surface}; font-size: 11px; font-weight: 700; color: ${C.inkLight}; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
            .note-title { font-size: 26px; font-weight: 700; color: ${C.ink}; line-height: 1.25; margin: 0 0 8px 0; font-family: 'DM Serif Display', serif; }
            .note-date { font-size: 12px; color: ${C.inkLight}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

            .summary-wrap { margin-top: 40px; padding-top: 24px; border-top: 1px solid ${C.border}; }
            .summary-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: ${C.inkLight}; text-transform: uppercase; margin-bottom: 8px; }
            .summary-bar { width: 32px; height: 2px; background-color: ${C.ink}; margin-bottom: 14px; }
            .summary-text { font-size: 14.5px; line-height: 1.7; color: ${C.inkMid}; font-style: italic; }

            .nav-row { display: flex; flex-direction: row; gap: 12px; margin-top: 36px; padding-bottom: 40px; }
            .nav-btn { flex: 1; padding: 14px 16px; border-radius: 12px; border: 1px solid ${C.border}; background-color: ${C.surface}; color: ${C.inkMid}; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; outline: none; }
            .nav-btn.disabled { opacity: 0.35; pointer-events: none; }
            .nav-btn-primary { flex: 1; padding: 14px 16px; border-radius: 12px; border: none; background-color: ${C.ink}; color: ${C.bg}; font-size: 14px; font-weight: 600; text-align: center; cursor: pointer; outline: none; }
            .nav-btn-primary.disabled { opacity: 0.35; pointer-events: none; }

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
            ${headerMeta ? `
              <div class="header-meta">
                ${headerMeta.courseCode ? `<div class="course-pill">${headerMeta.courseCode}</div>` : ''}
                ${headerMeta.title ? `<h1 class="note-title">${headerMeta.title}</h1>` : ''}
                ${headerMeta.date ? `<div class="note-date">${headerMeta.date}</div>` : ''}
              </div>
            ` : ''}

            ${renderedBlocks}

            ${summary ? `
              <div class="summary-wrap">
                <div class="summary-label">SUMMARY</div>
                <div class="summary-bar"></div>
                <div class="summary-text">${summary}</div>
              </div>
            ` : ''}

            ${nav ? `
              <div class="nav-row">
                <button class="nav-btn ${!nav.hasPrev ? 'disabled' : ''}" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nav', action: 'prev' }))">← Previous</button>
                <button class="nav-btn-primary ${!nav.hasNext ? 'disabled' : ''}" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'nav', action: 'next' }))">Next Topic →</button>
              </div>
            ` : ''}
          </div>
          
          <script>
            // Completely disable context menus and callouts on tap-and-hold
            document.addEventListener('contextmenu', function(e) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }, true);
            window.addEventListener('contextmenu', function(e) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }, true);

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

            // Auto-scale all math blocks and inline math so they fit without cut-off
            function autoScaleMath() {
              try {
                var isScrollMode = ${scrollableMath ? 'true' : 'false'};

                // 1. Dedicated math blocks (.block-math)
                var mathBlocks = document.querySelectorAll('.block-math');
                for (var i = 0; i < mathBlocks.length; i++) {
                  var block = mathBlocks[i];
                  var container = block.querySelector('mjx-container') || block.querySelector('.offline-math-font') || block.firstElementChild;
                  if (!container) continue;

                  // Clear existing scaling to get unconstrained measurement
                  container.style.transform = 'none';
                  container.style.webkitTransform = 'none';
                  container.style.display = 'inline-block';
                  container.style.maxWidth = 'none';
                  container.style.width = 'auto';

                  var mathInner = container.querySelector('mjx-math') || container.querySelector('svg') || container;
                  
                  var blockRect = block.getBoundingClientRect ? block.getBoundingClientRect() : { width: block.clientWidth };
                  var blockWidth = blockRect.width || block.clientWidth;
                  
                  var availW = blockWidth - 28; // Subtract internal padding
                  if (availW <= 0) {
                    availW = (document.documentElement.clientWidth || window.innerWidth || 360) - 48;
                  }

                  var innerRect = mathInner.getBoundingClientRect ? mathInner.getBoundingClientRect() : { width: mathInner.scrollWidth };
                  var mathW = Math.max(innerRect.width || 0, mathInner.scrollWidth || 0, mathInner.offsetWidth || 0, container.scrollWidth || 0);

                  if (isScrollMode) {
                    // Full size with smooth horizontal scroll
                    container.style.transform = 'none';
                    container.style.webkitTransform = 'none';
                    block.classList.add('is-scrollable');
                    if (mathW > availW) {
                      block.parentElement && block.parentElement.classList.add('has-scroll');
                    }
                  } else {
                    if (mathW > availW && availW > 0) {
                      var scale = availW / mathW;
                      var appliedScale = Math.min(1, Math.max(0.40, scale));
                      container.style.transform = 'scale(' + appliedScale + ')';
                      container.style.webkitTransform = 'scale(' + appliedScale + ')';
                      container.style.transformOrigin = 'center center';
                      container.style.webkitTransformOrigin = 'center center';
                    } else {
                      container.style.transform = 'none';
                      container.style.webkitTransform = 'none';
                    }
                  }
                }

                // 2. Standalone display math outside .block-math
                var displayContainers = document.querySelectorAll('mjx-container[display="true"]');
                for (var j = 0; j < displayContainers.length; j++) {
                  var dContainer = displayContainers[j];
                  if (dContainer.closest && dContainer.closest('.block-math')) continue;

                  dContainer.style.transform = 'none';
                  dContainer.style.webkitTransform = 'none';
                  dContainer.style.display = 'inline-block';
                  dContainer.style.maxWidth = 'none';
                  dContainer.style.width = 'auto';

                  var parent = dContainer.parentElement || document.body;
                  var pRect = parent.getBoundingClientRect ? parent.getBoundingClientRect() : { width: parent.clientWidth };
                  var pAvailW = (pRect.width || parent.clientWidth) - 16;
                  if (pAvailW <= 0) pAvailW = (document.documentElement.clientWidth || window.innerWidth || 360) - 40;

                  var dMathEl = dContainer.querySelector('mjx-math') || dContainer.querySelector('svg') || dContainer;
                  var dRect = dMathEl.getBoundingClientRect ? dMathEl.getBoundingClientRect() : { width: dMathEl.scrollWidth };
                  var dNaturalW = Math.max(dRect.width || 0, dMathEl.scrollWidth || 0, dMathEl.offsetWidth || 0);

                  if (dNaturalW > pAvailW && pAvailW > 0) {
                    var dScale = Math.min(1, Math.max(0.40, pAvailW / dNaturalW));
                    dContainer.style.transform = 'scale(' + dScale + ')';
                    dContainer.style.webkitTransform = 'scale(' + dScale + ')';
                    dContainer.style.transformOrigin = 'center center';
                    dContainer.style.webkitTransformOrigin = 'center center';
                  } else {
                    dContainer.style.transform = 'none';
                    dContainer.style.webkitTransform = 'none';
                  }
                }

                // 3. Inline math
                var inlineContainers = document.querySelectorAll('mjx-container:not([display="true"])');
                for (var k = 0; k < inlineContainers.length; k++) {
                  var inline = inlineContainers[k];
                  var inParent = inline.parentElement;
                  if (!inParent) continue;

                  inline.style.transform = 'none';
                  inline.style.webkitTransform = 'none';

                  var inAvailW = (inParent.clientWidth || window.innerWidth || 360) - 20;
                  var inMathEl = inline.querySelector('mjx-math') || inline.querySelector('svg') || inline;
                  var inRect = inMathEl.getBoundingClientRect ? inMathEl.getBoundingClientRect() : { width: inMathEl.scrollWidth };
                  var inNaturalW = Math.max(inRect.width || 0, inMathEl.scrollWidth || 0);

                  if (inNaturalW > inAvailW && inAvailW > 0) {
                    var inScale = Math.min(1, Math.max(0.50, inAvailW / inNaturalW));
                    inline.style.display = 'inline-block';
                    inline.style.transform = 'scale(' + inScale + ')';
                    inline.style.webkitTransform = 'scale(' + inScale + ')';
                    inline.style.transformOrigin = 'left center';
                    inline.style.webkitTransformOrigin = 'left center';
                  }
                }
              } catch(e) {
                console.error('autoScaleMath error:', e);
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

            function formatPLX(str) {
              if (!str) return '';
              var s = str;
              s = s.replace(/<B>([\s\S]*?)<\/B>/gi, '<strong>$1</strong>');
              s = s.replace(/<I>([\s\S]*?)<\/I>/gi, '<em>$1</em>');
              s = s.replace(/<U>([\s\S]*?)<\/U>/gi, '<u>$1</u>');
              s = s.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<strong>$1</strong>');
              s = s.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<em>$1</em>');
              s = s.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<u>$1</u>');
              s = s.replace(/<b>([\s\S]*?)<\/b>/gi, '<strong>$1</strong>');
              s = s.replace(/<i>([\s\S]*?)<\/i>/gi, '<em>$1</em>');
              s = s.replace(/<u>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
              return s;
            }

            // Render markdown text blocks, protecting all math delimiters first
            function renderMarkdown() {
              var myMarked = {
                parse: function(markdown) {
                  if (!markdown) return '';
                  var html = formatPLX(markdown);
                  
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
                  el.innerHTML = formatPLX(unprotect(parser.parse(protect(formatPLX(raw))))));
                } catch (e) {
                  console.error('Markdown processing failed:', e);
                  try {
                    el.innerHTML = formatPLX(unprotect(myMarked.parse(protect(formatPLX(raw))))));
                  } catch (err) {
                    el.innerHTML = formatPLX(raw);
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
              autoScaleMath();
              sendHeight();
            }

            // Trigger MathJax typesetting then update height
            function renderMath() {
              if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([document.body])
                  .then(function() {
                    autoScaleMath();
                    sendHeight();
                  })
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

              // Setup ResizeObserver to report height and scale dynamically
              if (window.ResizeObserver) {
                try {
                  var contentEl = document.getElementById('content');
                  if (contentEl) {
                    var ro = new ResizeObserver(function() {
                      autoScaleMath();
                      sendHeight();
                    });
                    ro.observe(contentEl);
                  }
                } catch (e) {
                  console.error('ResizeObserver error:', e);
                }
              }
              
              autoScaleMath();
              sendHeight();
            });

            window.addEventListener('resize', function() {
              autoScaleMath();
              sendHeight();
            });

            // Handle scroll reporting for independent scrolling
            window.addEventListener('scroll', function() {
              try {
                var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
                var scrollHeight = (document.documentElement.scrollHeight || document.body.scrollHeight || 0);
                var clientHeight = (document.documentElement.clientHeight || window.innerHeight || 0);
                var maxScroll = scrollHeight - clientHeight;
                var pct = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 0;
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    type: 'scroll', 
                    percentage: Math.min(100, Math.max(0, pct)),
                    scrollTop: scrollTop,
                    scrollHeight: scrollHeight
                  }));
                }
              } catch (err) {}
            }, { passive: true });

            window.addEventListener('load', function() {
              autoScaleMath();
              sendHeight();
              // Register loaders on images
              document.querySelectorAll('img').forEach(function(img) {
                img.addEventListener('load', function() {
                  autoScaleMath();
                  sendHeight();
                });
                img.addEventListener('error', function() {
                  autoScaleMath();
                  sendHeight();
                });
              });
            });

            // Extra fallback intervals
            setTimeout(function() { autoScaleMath(); sendHeight(); }, 150);
            setTimeout(function() { autoScaleMath(); sendHeight(); }, 500);
            setTimeout(function() { autoScaleMath(); sendHeight(); }, 1000);
            setTimeout(function() { autoScaleMath(); sendHeight(); }, 2000);
            setTimeout(function() { autoScaleMath(); sendHeight(); }, 4000);
          </script>
        </body>
      </html>
    `;
  }, [blocks, C, bgOverride, paddingOverride, inkOverride, scrollableMath, headerMeta, summary, nav]);

  return (
    <View style={[s.container, scrollEnabled ? s.flexContainer : { height: webViewHeight }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={s.webview}
        scrollEnabled={scrollEnabled || scrollableMath}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={scrollEnabled}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height && !scrollEnabled) {
              setWebViewHeight(data.height + 45);
            }
            if (data.type === 'scroll' && onScrollPercentage) {
              onScrollPercentage(data.percentage);
            }
            if (data.type === 'focus' && onFocusBlock) {
              onFocusBlock(data.blockType, data.content);
            }
            if (data.type === 'nav' && onNavigate) {
              onNavigate(data.action);
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
  flexContainer: { flex: 1, width: '100%' },
  webview: { backgroundColor: 'transparent', flex: 1 },
});


