import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

export const NoteDetailScreen = ({ route }: any) => {
  const { note } = route.params;
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // Handle legacy content or JSON blocks
  let contentHtml = '';
  try {
    const blocks = JSON.parse(note.content);
    if (Array.isArray(blocks)) {
        contentHtml = blocks.map(block => {
            switch (block.type) {
                case 'h1': return `<h1 style="color: ${colors.foreground}; font-size: 28px; font-weight: bold; margin-bottom: 16px; margin-top: 8px;">${block.content}</h1>`;
                case 'h2': return `<h2 style="color: ${colors.foreground}; font-size: 22px; font-weight: bold; margin-bottom: 12px; margin-top: 8px;">${block.content}</h2>`;
                case 'text':
                    // Simple conversion of $math$ to inline KaTeX and \n to <br>
                    const processedText = block.content
                        .replace(/\$(.*?)\$/g, '<span class="inline-math">\\\\($1\\\\)</span>')
                        .replace(/\n/g, '<br/>');
                    return `<div style="color: ${colors.foreground}; font-size: 16px; line-height: 1.5; margin-bottom: 16px;">${processedText}</div>`;
                case 'math': return `<div style="margin: 16px 0; display: flex; justify-content: center;"><span class="display-math">\\\\[${block.content}\\\\]</span></div>`;
                case 'diagram':
                    const transform = `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`;
                    return `<div style="margin: 16px 0; text-align: center;">
                        <img src="${block.content}" style="max-width: 100%; height: ${block.settings?.height || 'auto'}; width: ${block.settings?.width || 'auto'}; transform: ${transform}; border-radius: 8px;" />
                    </div>`;
                default: return '';
            }
        }).join('');
    } else {
        throw new Error('Not an array');
    }
  } catch (e) {
    // Fallback for legacy text
    contentHtml = `<div style="color: ${colors.foreground}; font-size: 16px; line-height: 1.5;">${note.content.replace(/\n/g, '<br/>')}</div>`;
  }

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
        <style>
          body {
            font-family: -apple-system, system-ui;
            margin: 0;
            padding: 16px;
            background-color: transparent;
            word-wrap: break-word;
          }
          img { max-width: 100%; height: auto; }
          .inline-math { display: inline-block; }
          .display-math { display: block; }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          renderMathInElement(document.body, {
            delimiters: [
                {left: "\\\\[", right: "\\\\]", display: true},
                {left: "\\\\(", right: "\\\\)", display: false}
            ],
            throwOnError: false
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
