import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { MathView } from './MathView';

interface MathTextProps {
  text: string;
  style?: any;
  color?: string;
  fontSize?: number;
}

export const MathText: React.FC<MathTextProps> = ({ text, style, color = '#000', fontSize = 16 }) => {
  if (!text) return null;

  // Split by math delimiters, including the delimiters in the matched parts
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);

  return (
    <Text style={[{ fontSize, color }, style]}>
      {parts.map((part, index) => {
        if (!part) return null;

        const isBlock = (part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'));
        const isInline = (part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'));

        if (isBlock || isInline) {
          const isDollar = part.startsWith('$');
          // For $$...$$ and \[...\] use 2, for $...$ use 1, for \(...\) use 2
          const sliceSize = isBlock ? 2 : (isDollar ? 1 : 2);
          const math = part.slice(sliceSize, -sliceSize).trim();
          
          return (
            <MathView 
              key={index} 
              math={math} 
              inline={!isBlock} 
              color={color} 
            />
          );
        }

        return part;
      })}
    </Text>
  );
};
