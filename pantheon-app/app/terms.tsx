import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { C, F } from '../components/Theme';

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }, { translateX: 2 }] }} />
    </View>
  );
}

function FileIcon() {
  return (
    <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 22, height: 28, borderWidth: 2, borderColor: '#27AE60', borderRadius: 4 }} />
      <View style={{ position: 'absolute', top: 12, width: 12, height: 2, backgroundColor: '#27AE60' }} />
      <View style={{ position: 'absolute', top: 18, width: 12, height: 2, backgroundColor: '#27AE60' }} />
      <View style={{ position: 'absolute', top: 24, width: 12, height: 2, backgroundColor: '#27AE60' }} />
    </View>
  );
}

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 24 }}>
        <View style={s.hero}>
          <View style={s.iconCircle}>
            <FileIcon />
          </View>
          <Text style={s.title}>Terms of Service</Text>
          <Text style={s.lastUpdated}>Last updated: April 17, 2026</Text>
        </View>

        <View style={s.card}>
          <Section 
            number="1" 
            title="Acceptance of Terms" 
            text="By accessing or using COLEARN, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our platform."
          />

          <Section 
            number="2" 
            title="Account Registration" 
            text="You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account."
          />

          <Section number="3" title="User Conduct">
            <Text style={s.sectionText}>You agree not to:</Text>
            <Bullet point="Use the Service for any illegal purpose or in violation of any local, state, national, or international law." />
            <Bullet point="Post or transmit any content that is infringing, libelous, defamatory, obscene, or otherwise objectionable." />
            <Bullet point="Spam, harass, or threaten other users." />
            <Bullet point="Attempt to gain unauthorized access to any portion of the Service." />
          </Section>

          <Section 
            number="4" 
            title="Academic Integrity" 
            text="COLEARN is a study aid. We do not encourage or facilitate academic dishonesty. Users should use the platform responsibly and in accordance with their institution's academic integrity policies."
          />

          <Section 
            number="5" 
            title="Account Activation" 
            text="Some features of COLEARN require account activation via a valid activation code. These codes are provided by administrators and should not be shared or resold without authorization."
          />

          <Section 
            number="6" 
            title="Termination" 
            text="We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the Service or us."
          />

          <Section 
            number="7" 
            title="Changes to Terms" 
            text="We may revise these Terms of Service from time to time. The most current version will always be posted on this page. By continuing to use the Service after changes become effective, you agree to be bound by the revised terms."
          />
        </View>

        <Text style={s.footerText}>© 2026 Pillara Education 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ number, title, text, children }: { number: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{number}. {title}</Text>
      {text && <Text style={s.sectionText}>{text}</Text>}
      {children}
    </View>
  );
}

function Bullet({ point }: { point: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>{point}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 56,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  content: { flex: 1 },
  hero: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#E8F6EF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: F.bold, fontSize: 28, color: C.ink, textAlign: 'center' },
  lastUpdated: { fontFamily: F.medium, fontSize: 14, color: C.inkLight, marginTop: 4 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  section: { marginBottom: 32 },
  sectionTitle: { fontFamily: F.bold, fontSize: 20, color: '#27AE60', marginBottom: 12 },
  sectionText: { fontFamily: F.medium, fontSize: 15, color: C.inkMid, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', marginTop: 8, paddingLeft: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60', marginTop: 9, marginRight: 12 },
  bulletText: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.inkMid, lineHeight: 24 },
  footerText: { textAlign: 'center', marginTop: 32, marginBottom: 16, fontFamily: F.medium, fontSize: 13, color: C.inkLight },
});
