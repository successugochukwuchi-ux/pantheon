import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { initDatabase } from '../lib/db';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    initDatabase();
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#F0EFF5' }} />;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
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
        <Stack.Screen name="note-grabber" />
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
