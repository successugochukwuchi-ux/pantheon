import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathViewProps {
  math: string;
  inline?: boolean;
  color?: string;
}

export const MathView: React.FC<MathViewProps> = ({ math, inline = false, color = '#000' }) => {
  const { width: windowWidth } = useWindowDimensions();
  const [height, setHeight] = React.useState(inline ? 24 : 60);
  const [width, setWidth] = React.useState(inline ? 100 : windowWidth - 64);

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
            padding: 0;
            display: ${inline ? 'inline-block' : 'block'};
            background-color: transparent;
            color: ${color};
            font-size: 16px;
          }
          #math {
            display: ${inline ? 'inline-block' : 'flex'};
            justify-content: center;
            padding: ${inline ? '0' : '8px 0'};
          }
          .katex-display {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div id="math"></div>
        <script>
          const math = ${JSON.stringify(math)};
          const displayMode = ${!inline};
          const mathEl = document.getElementById('math');
          try {
            katex.render(math, mathEl, {
              displayMode: displayMode,
              throwOnError: false,
              errorColor: "#ef4444",
              strict: false
            });
          } catch (e) {
            mathEl.textContent = math;
            mathEl.style.color = '#ef4444';
          }

          function sendDimensions() {
            const rect = mathEl.getBoundingClientRect();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              height: rect.height,
              width: rect.width
            }));
          }

          window.onload = sendDimensions;
          // Also send after a short delay for fonts
          setTimeout(sendDimensions, 500);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, !inline && styles.blockContainer, { width: inline ? width : '100%', height }]}>
      <WebView
        scrollEnabled={false}
        source={{ html }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height) setHeight(data.height + 2);
            if (data.width && inline) setWidth(data.width + 4);
          } catch (e) {}
        }}
        style={styles.webview}
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
