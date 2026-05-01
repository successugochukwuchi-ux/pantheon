import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../theme';
import { KATEX_JS, KATEX_CSS, KATEX_AUTO_RENDER_JS } from '../constants/KaTeX';

export const NoteDetailScreen = ({ route }: any) => {
  const { note } = route.params;
  const { width } = useWindowDimensions();

  let htmlContent = '';
  try {
    const blocks = JSON.parse(note.content);
    htmlContent = blocks.map((block: any) => {
      switch (block.type) {
        case 'h1': return `<h1>${block.content}</h1>`;
        case 'h2': return `<h2>${block.content}</h2>`;
        case 'h3': return `<h3>${block.content}</h3>`;
        case 'text': return `<p>${block.content.replace(/\n/g, '<br/>')}</p>`;
        case 'math': return `<div class="katex-display">$$${block.content}$$</div>`;
        case 'diagram': return `
          <div class="diagram-container">
            <img src="${block.content}" style="width: ${block.settings?.width || '100%'}; height: auto;" />
          </div>`;
        case 'table':
          try {
            const rows = JSON.parse(block.content);
            return `
              <table>
                ${rows.map((row: string[]) => `
                  <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
                `).join('')}
              </table>`;
          } catch (e) {
            return '<p>Invalid table data</p>';
          }
        default: return '';
      }
    }).join('');
  } catch (e) {
    // Fallback for raw markdown/text
    htmlContent = note.content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/\n/g, '<br/>');
  }

  const webViewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          ${KATEX_CSS}
          body {
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: ${theme.colors.foreground};
            padding: 16px;
            font-size: 16px;
            line-height: 1.6;
            margin: 0;
            background-color: ${theme.colors.background};
          }
          h1 { font-size: 24px; margin-bottom: 16px; }
          h2 { font-size: 20px; margin-bottom: 12px; }
          h3 { font-size: 18px; margin-bottom: 8px; }
          .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; }
          .diagram-container { display: flex; justify-content: center; margin: 16px 0; }
          img { max-width: 100%; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          td { border: 1px solid ${theme.colors.border}; padding: 8px; font-size: 14px; }
        </style>
        <script>${KATEX_JS}</script>
        <script>${KATEX_AUTO_RENDER_JS}</script>
      </head>
      <body>
        <div id="content">${htmlContent}</div>
        <script>
          window.onload = function() {
            renderMathInElement(document.getElementById('content'), {
              delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
              ],
              throwOnError: false
            });
          };
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{note.title}</Text>
      </View>
      <View style={styles.content}>
        <WebView
          originWhitelist={['*']}
          source={{ html: webViewHtml }}
          style={{ width: width - theme.spacing.lg * 2, height: '100%', backgroundColor: 'transparent' }}
          scrollEnabled={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.muted,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
});
