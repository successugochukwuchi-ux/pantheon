import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface DiagramViewProps {
  url: string;
  settings?: {
    width?: number;
    height?: number;
    flipX?: boolean;
    flipY?: boolean;
  };
}

export const DiagramView: React.FC<DiagramViewProps> = ({ url, settings }) => {
  const transform = [];
  if (settings?.flipX) transform.push({ scaleX: -1 });
  if (settings?.flipY) transform.push({ scaleY: -1 });

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: url }}
        style={[
          styles.image,
          {
            width: settings?.width || '100%',
            height: settings?.height || 200,
            transform,
          }
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
  },
});
