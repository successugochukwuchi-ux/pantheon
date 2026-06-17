import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../components/Theme';

function ShieldAlertIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 44, height: 50, borderWidth: 3.5, borderColor: color, borderRadius: 8, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 4.5, height: 16, backgroundColor: color, borderRadius: 2, marginBottom: 4 }} />
        <View style={{ width: 4.5, height: 4.5, backgroundColor: color, borderRadius: 2.25 }} />
      </View>
    </View>
  );
}

export default function BannedScreen() {
  const router = useRouter();
  const { user, loading, profile, logout } = useAuth();
  const { colors: C } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/' as any);
    }
  }, [user, loading, router]);

  const handleAppeal = () => {
    const message = encodeURIComponent(
      `Hello, my account (Student ID: ${profile?.studentId || 'N/A'}) has been banned from the mobile app. I want to appeal. Reason given: ${profile?.banReason || 'No reason provided'}`
    );
    Linking.openURL(`https://wa.me/2348118429150?text=${message}`).catch((err) => {
      console.warn("Failed to open WhatsApp:", err);
    });
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/' as any);
    } catch (err) {
      console.warn("Failed to sign out:", err);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.iconContainer}>
            <ShieldAlertIcon color="#D32F2F" />
          </View>
          
          <Text style={[s.title, { color: '#D32F2F' }]}>Account Banned</Text>
          <Text style={[s.subtitle, { color: C.inkLight }]}>
            Your account has been restricted from accessing CoLearn features.
          </Text>

          <View style={[s.reasonBox, { backgroundColor: 'rgba(211, 47, 47, 0.08)', borderColor: 'rgba(211, 47, 47, 0.2)' }]}>
            <Text style={s.reasonLabel}>REASON FOR BAN</Text>
            <Text style={[s.reasonText, { color: C.ink }]}>
              "{profile?.banReason || 'No reason provided'}"
            </Text>
          </View>

          <Text style={[s.infoText, { color: C.inkMid }]}>
            If you believe this is a mistake, you can appeal the ban by contacting our administration desk on WhatsApp.
          </Text>

          <TouchableOpacity style={s.appealBtn} activeOpacity={0.8} onPress={handleAppeal}>
            <Text style={s.appealBtnText}>Appeal via WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.logoutBtn, { borderColor: C.border }]} activeOpacity={0.8} onPress={handleSignOut}>
            <Text style={[s.logoutBtnText, { color: C.ink }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.footerText, { color: C.inkLight }]}>
          © 2026 Pillara Education 2026
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: F.bold,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: F.medium,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  reasonBox: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  reasonLabel: {
    fontFamily: F.bold,
    fontSize: 11,
    color: '#D32F2F',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  reasonText: {
    fontFamily: F.medium,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoText: {
    fontFamily: F.medium,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  appealBtn: {
    width: '100%',
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  appealBtnText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  logoutBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutBtnText: {
    fontFamily: F.bold,
    fontSize: 15,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    fontFamily: F.medium,
    fontSize: 12,
  },
});
