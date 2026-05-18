import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { C, F } from './Theme';
import { HomeIcon, NotesIcon, SocialIcon, CbtIcon, SettingsIcon, ChatIcon } from './Icons';

type TabId = 'home' | 'notes' | 'social' | 'chat' | 'cbt' | 'profile' | 'settings';

interface BottomNavProps {
  active: TabId;
}

export function BottomNav({ active }: BottomNavProps) {
  const router = useRouter();
  const { colors: C } = useTheme();
  
  const tabs = [
    { id: 'home',     label: 'Home',     icon: HomeIcon,     route: '/dashboard' },
    { id: 'notes',    label: 'Study',    icon: NotesIcon,    route: '/notes'     },
    { id: 'social',   label: 'Social',   icon: SocialIcon,   route: '/social'    },
    { id: 'cbt',      label: 'CBT',      icon: CbtIcon,      route: '/cbt-setup' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, route: '/settings'  },
  ];

  return (
    <View style={[s.bottomNav, { backgroundColor: C.surface, borderColor: C.border }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[s.navTab, isActive && [s.navTabActive, { backgroundColor: C.surfaceDark }]]}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <Icon color={isActive ? C.surface : C.navInactive} />
            {!isActive && <Text style={[s.navLabel, { color: C.navInactive }]}>{tab.label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 1000,
  },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 3, borderRadius: 30 },
  navTabActive: { backgroundColor: C.surfaceDark, paddingHorizontal: 20, flex: 0, paddingVertical: 10, minWidth: 60 },
  navLabel: { fontFamily: F.bold, fontSize: 11, color: C.navInactive },
});
