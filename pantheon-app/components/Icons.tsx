import React from 'react';
import { View } from 'react-native';
import { C } from './Theme';

export function HamburgerIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 22, height: 2, backgroundColor: color, borderRadius: 1 }} />
      ))}
    </View>
  );
}

export function BellIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderColor: color, borderBottomWidth: 0, marginTop: 2 }} />
      <View style={{ width: 20, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2, borderColor: color, borderTopWidth: 0, marginTop: -1 }} />
    </View>
  );
}

export function SearchIcon({ color = C.ink, opacity = 0.6 }: { color?: string, opacity?: number }) {
  return (
    <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center', opacity }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color }} />
      <View style={{ position: 'absolute', bottom: 1, right: 1, width: 5, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

export function HomeIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 20, alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ width: 14, height: 10, backgroundColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}

export function NotesIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 20, borderWidth: 2, borderColor: color, borderRadius: 3, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 10, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      ))}
    </View>
  );
}

export function SocialIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 18, justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.8, borderColor: color }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.8, borderColor: color }} />
      </View>
      <View style={{ width: 18, height: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.8, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  );
}

export function ChatIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 18, borderWidth: 2, borderColor: color, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
       <View style={{ width: 10, height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
       <View style={{ width: 14, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
       <View style={{ position: 'absolute', bottom: -5, left: 4, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
    </View>
  );
}

export function CbtIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: color, borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: 3 }} />
      <View style={{ width: 10, height: 1.5, backgroundColor: color, borderRadius: 1, marginBottom: 3 }} />
      <View style={{ width: 6, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

export function ProfileIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color }} />
      <View style={{ width: 18, height: 7, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 2, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  );
}

export function SettingsIcon({ color }: { color: string }) {
   return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color }} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <View key={deg} style={{ position: 'absolute', width: 3, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: `${deg}deg` }, { translateY: -8 }] }} />
      ))}
    </View>
   );
}

export function VideoIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 18, borderWidth: 2, borderColor: color, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 0, borderTopWidth: 4, borderBottomWidth: 4, borderLeftColor: color, borderRightColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: 2 }} />
    </View>
  );
}

export function LogoutIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 18, borderWidth: 2, borderColor: color, borderRadius: 2, borderRightWidth: 0 }} />
      <View style={{ position: 'absolute', right: 0, width: 12, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: 0, width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }, { translateY: -2.8 }] }} />
    </View>
  );
}

export function InfoIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1, marginTop: 1 }} />
      <View style={{ width: 2, height: 2, backgroundColor: color, borderRadius: 1, marginBottom: 1 }} />
    </View>
  );
}

export function BotIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 14, borderWidth: 2, borderColor: color, borderRadius: 4 }} />
      <View style={{ position: 'absolute', top: 0, width: 2, height: 4, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: -2, width: 6, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ flexDirection: 'row', gap: 4, marginTop: -2 }}>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function MoreIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

export function ChevronDownIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 12, height: 8, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }, { translateY: -2 }] }} />
    </View>
  );
}

export function BirdIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 22, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      {/* Head */}
      <View style={{ position: 'absolute', top: 2, right: 3, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      {/* Beak */}
      <View style={{ 
        position: 'absolute', 
        top: 3, 
        right: 0, 
        width: 0, 
        height: 0, 
        borderLeftWidth: 4, 
        borderRightWidth: 0, 
        borderTopWidth: 2, 
        borderBottomWidth: 2, 
        borderLeftColor: color, 
        borderRightColor: 'transparent', 
        borderTopColor: 'transparent', 
        borderBottomColor: 'transparent' 
      }} />
      {/* Body */}
      <View style={{ 
        position: 'absolute', 
        top: 6, 
        left: 2, 
        width: 14, 
        height: 10, 
        borderBottomLeftRadius: 8, 
        borderBottomRightRadius: 5, 
        borderTopLeftRadius: 2, 
        borderTopRightRadius: 4,
        backgroundColor: color 
      }} />
      {/* Wing */}
      <View style={{ 
        position: 'absolute', 
        top: 6, 
        left: 5, 
        width: 7, 
        height: 6, 
        borderRadius: 3, 
        backgroundColor: 'transparent', 
        borderWidth: 1.5, 
        borderColor: 'white',
        transform: [{ rotate: '-15deg' }]
      }} />
      {/* Tail */}
      <View style={{ 
        position: 'absolute', 
        bottom: 4, 
        left: 0, 
        width: 5, 
        height: 2, 
        backgroundColor: color, 
        transform: [{ rotate: '30deg' }] 
      }} />
    </View>
  );
}

export function CalculatorIcon({ color = C.ink }: { color?: string }) {
  return (
    <View style={{ width: 18, height: 22, borderWidth: 2, borderColor: color, borderRadius: 3, alignItems: 'center', padding: 2 }}>
      {/* Screen */}
      <View style={{ width: 10, height: 3, backgroundColor: color, borderRadius: 1, marginBottom: 3 }} />
      {/* Keypad */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}
