import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AutoDownloader } from '../components/AutoDownloader';
import { AppUpdater } from '../components/AppUpdater';
import { ScreenSecurityHandler } from '../components/ScreenSecurityHandler';
import { initDatabase } from '../lib/db';
import { stopSpeech } from '../lib/ttsService';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    initDatabase();
    const timer = setTimeout(() => setFontTimeout(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (prevPathRef.current && prevPathRef.current !== pathname) {
      stopSpeech().catch(() => {});
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimeout) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, fontTimeout]);

  if (!fontsLoaded && !fontError && !fontTimeout) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F4F0', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color="#0A0A0A" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ScreenSecurityHandler />
      <ThemeProvider>
        <AutoDownloader />
        <AppUpdater />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 150, freezeOnBlur: true }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="banned" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="notes-topics" />
        <Stack.Screen name="note-viewer" />
        <Stack.Screen name="cbt-setup" />
        <Stack.Screen name="cbt-exam" />
        <Stack.Screen name="cbt-results" />
        <Stack.Screen name="search" />
        <Stack.Screen name="social" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="general-settings" />
        <Stack.Screen name="profile-settings" />
        <Stack.Screen name="profile-view" />
        <Stack.Screen name="create-group" />
        <Stack.Screen name="add-members" />
        <Stack.Screen name="chat-room" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="chat-list" />
        <Stack.Screen name="course-discussion" />
        <Stack.Screen name="past-questions" />
        <Stack.Screen name="compete" />
      </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
