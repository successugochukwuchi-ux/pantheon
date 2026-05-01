import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

export const NoteDetailScreen = ({ route }: any) => {
  const { note } = route.params;
  const { colors } = useTheme();

  let contentHtml = '';
  try {
    const blocks = JSON.parse(note.content);
    if (Array.isArray(blocks)) {
        contentHtml = blocks.map(block => {
            switch (block.type) {
                case 'h1': return `<h1 style="color: ${colors.foreground}; font-size: 28px; font-weight: bold; margin-bottom: 16px; margin-top: 8px;">${block.content}</h1>`;
                case 'h2': return `<h2 style="color: ${colors.foreground}; font-size: 22px; font-weight: bold; margin-bottom: 12px; margin-top: 8px;">${block.content}</h2>`;
                case 'text':
                    const processedText = block.content.replace(/\n/g, '<br/>');
                    return `<div class="text-block" style="color: ${colors.foreground}; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${processedText}</div>`;
                case 'math':
                    return `<div style="margin: 16px 0; display: flex; justify-content: center; color: ${colors.foreground}; font-size: 1.2em;">
                        \\[${block.content.replace(/\\/g, '\\\\')}\\]
                    </div>`;
                case 'diagram':
                    const transform = `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`;
                    return `<div style="margin: 16px 0; text-align: center;">
                        <img src="${block.content}" style="max-width: 100%; height: ${block.settings?.height ? block.settings.height + 'px' : 'auto'}; width: ${block.settings?.width ? block.settings.width + 'px' : 'auto'}; transform: ${transform}; border-radius: 8px;" />
                    </div>`;
                case 'table':
                    try {
                        const rows = JSON.parse(block.content);
                        const tableHtml = rows.map((row: string[]) =>
                            `<tr>${row.map(cell => `<td style="border: 1px solid ${colors.border}; padding: 8px; font-size: 14px;">${cell}</td>`).join('')}</tr>`
                        ).join('');
                        return `<div style="overflow-x: auto; margin: 16px 0;">
                            <table style="width: 100%; border-collapse: collapse; color: ${colors.foreground};">${tableHtml}</table>
                        </div>`;
                    } catch (e) {
                        return `<div style="color: ${colors.destructive};">Error rendering table</div>`;
                    }
                default: return '';
            }
        }).join('');
    } else {
        throw new Error('Not an array');
    }
  } catch (e) {
    contentHtml = `<div style="color: ${colors.foreground}; font-size: 16px; line-height: 1.6;">${note.content.replace(/\n/g, '<br/>')}</div>`;
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
            /* Disable text selection as requested */
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
            renderMathInElement(document.body, {
              delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\\\[", right: "\\\\]", display: true},
                {left: "\\\\(", right: "\\\\)", display: false}
              ],
              throwOnError: false,
              errorColor: "#ef4444",
              strict: false
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
