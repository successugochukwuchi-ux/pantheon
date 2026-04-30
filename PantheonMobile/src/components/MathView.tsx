import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathViewProps {
  math: string;
  inline?: boolean;
  color?: string;
}

export const MathView: React.FC<MathViewProps> = ({ math, inline = false, color = '#000' }) => {
  const { width } = useWindowDimensions();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: ${inline ? '0' : '8px 0'};
            display: ${inline ? 'inline-block' : 'flex'};
            justify-content: center;
            background-color: transparent;
            color: ${color};
            font-size: 16px;
          }
          #math {
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div id="math"></div>
        <script>
          const math = ${JSON.stringify(math)};
          const displayMode = ${!inline};
          katex.render(math, document.getElementById('math'), {
            displayMode: displayMode,
            throwOnError: false
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, !inline && styles.blockContainer]}>
      <WebView
        scrollEnabled={false}
        source={{ html }}
        style={[
          styles.webview,
          { width: inline ? 100 : width - 64, height: inline ? 24 : 60 }
        ]}
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  blockContainer: {
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
