import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { contactAdmin } from '../lib/support';
import { C, F, width } from './Theme';
import { 
  HomeIcon, 
  NotesIcon, 
  SocialIcon, 
  CbtIcon, 
  SettingsIcon, 
  VideoIcon, 
  LogoutIcon, 
  InfoIcon,
  BellIcon,
  ChatIcon,
  ProfileIcon,
  CompeteIcon,
  CalendarIcon
} from './Icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard',    route: '/dashboard',     icon: HomeIcon },
  { label: 'Compete Arena', route: '/compete',       icon: CompeteIcon },
  { label: 'Study Timetable', route: '/timetable',   icon: CalendarIcon },
  { label: 'Lecture Notes', route: '/notes',         icon: NotesIcon },
  { label: 'CBT Hub',      route: '/cbt-setup',     icon: CbtIcon },
  { label: 'Video Library', route: '/video-library', icon: VideoIcon },
  { label: 'Social Hub',    route: '/social',        icon: SocialIcon },
  { label: 'Notifications', route: '/notifications', icon: BellIcon },
  { label: 'Give Feedback', route: '/feedback',      icon: InfoIcon },
  { label: 'Settings',      route: '/settings',      icon: SettingsIcon },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { profile, logout, isOffline } = useAuth();
  const { colors: C, themeName } = useTheme();
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [render, setRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width, duration: 350, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => setRender(false));
    }
  }, [isOpen]);

  if (!render && !isOpen) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2000 }]}>
      <Animated.View style={[s.sidebarOverlay, { opacity: opacityAnim }]}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      
      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }], backgroundColor: C.bg }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[s.sidebarHeader, { borderBottomColor: C.border }]}>
            <View style={s.studentInfo}>
              <View style={[s.avatarBox, { backgroundColor: C.surface, borderColor: C.border }]}>
                {profile?.photoURL ? (
                  <Image 
                    source={{ uri: profile.photoURL.replace('/svg', '/png') }} 
                    style={{ width: '100%', height: '100%', borderRadius: 16 }} 
                  />
                ) : (
                  <Text style={[s.avatarText, { color: C.inkMid }]}>
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </Text>
                )}
              </View>
              <View>
                <Text style={[s.studentName, { color: C.ink }]}>{profile?.username || 'Guest'}</Text>
                <Text style={[s.studentId, { color: C.inkLight }]}>{profile?.studentId || 'N/A'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[s.sidebarClose, { backgroundColor: C.bgAlt }]}>
              <Text style={{ fontSize: 24, color: C.ink }}>×</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={s.sidebarScroll} showsVerticalScrollIndicator={false}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: C.inkLight }]}>NAVIGATION</Text>
            </View>
            
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.label}
                  style={s.sidebarItem}
                  onPress={() => {
                    onClose();
                    router.push(item.route as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[s.iconWrapper, { backgroundColor: C.surface }]}>
                    <Icon color={C.ink} />
                  </View>
                  <Text style={[s.sidebarItemText, { color: C.ink }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={s.sidebarItem}
              onPress={() => {
                onClose();
                contactAdmin(profile?.At, !!isOffline, "Help Needed");
              }}
              activeOpacity={0.7}
            >
              <View style={[s.iconWrapper, { backgroundColor: '#E8F6EF' }]}>
                <InfoIcon color="#27AE60" />
              </View>
              <Text style={[s.sidebarItemText, { color: '#27AE60' }]}>Need Help? (WhatsApp)</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
          
          <View style={[s.sidebarFooter, { borderTopColor: C.border }]}>
            <TouchableOpacity 
              style={[s.logoutBtn, { backgroundColor: themeName === 'midnight' || themeName === 'dark' ? 'rgba(192, 57, 43, 0.1)' : '#FDECEC' }]} 
              onPress={async () => {
                onClose();
                try {
                  await logout();
                  router.replace('/' as any);
                } catch (e) {
                  console.error('Logout error:', e);
                }
              }}
              activeOpacity={0.8}
            >
              <LogoutIcon color="#C0392B" />
              <Text style={s.logoutBtnText}>Logout Session</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebarOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sidebar: { 
    position: 'absolute', 
    top: 0, 
    bottom: 0, 
    width: width * 0.82, 
    backgroundColor: C.bg, 
    shadowColor: '#000', 
    shadowOffset: { width: 4, height: 0 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 10,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
  },
  sidebarHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    borderBottomWidth: 1, 
    borderBottomColor: C.border 
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  avatarText: { fontFamily: F.bold, fontSize: 16, color: C.inkMid },
  studentName: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  studentId: { fontFamily: F.medium, fontSize: 12, color: C.inkLight },
  sidebarClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  
  sidebarScroll: { flex: 1, padding: 16 },
  sectionHeader: { paddingHorizontal: 12, marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontFamily: F.bold, fontSize: 12, color: C.inkLight, letterSpacing: 1.5 },
  
  sidebarItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16,
    marginBottom: 4,
  },
  iconWrapper: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sidebarItemText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  
  sidebarFooter: { padding: 24, borderTopWidth: 1, borderTopColor: C.border },
  logoutBtn: { 
    flexDirection: 'row',
    backgroundColor: '#FDECEC', 
    borderRadius: 16, 
    paddingVertical: 16, 
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  logoutBtnText: { fontFamily: F.bold, fontSize: 15, color: '#C0392B' },
});
