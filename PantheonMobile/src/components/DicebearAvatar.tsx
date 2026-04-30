import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface DicebearAvatarProps {
  seed: string;
  style?: string;
  size?: number;
}

export const DicebearAvatar: React.FC<DicebearAvatarProps> = ({
  seed,
  style = 'avataaars',
  size = 40
}) => {
  const uri = `https://api.dicebear.com/7.x/${style}/png?seed=${seed}`;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
});
