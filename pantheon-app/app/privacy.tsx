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

function ShieldIcon() {
  return (
    <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 24, height: 28, borderWidth: 2, borderColor: '#27AE60', borderRadius: 4, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />
      <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#27AE60' }} />
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 24 }}>
        <View style={s.hero}>
          <View style={s.iconCircle}>
            <ShieldIcon />
          </View>
          <Text style={s.title}>Privacy Policy</Text>
          <Text style={s.lastUpdated}>Last updated: April 17, 2026</Text>
        </View>

        <View style={s.card}>
          <Section 
            number="1" 
            title="Introduction" 
            text="Welcome to PANTHEON ('we,' 'our,' or 'us'). We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner. This Privacy Policy outlines how we collect, use, disclose, and safeguard your information when you use our platform."
          />

          <Section number="2" title="Information We Collect">
            <SubSection title="Personal Information" text="When you register for an account, we collect information such as your name, email address, student ID, and level of study." />
            <SubSection title="Usage Data" text="We collect information about your interactions with our platform, including courses viewed, CBT scores, and chat messages." />
            <SubSection title="Authentication Data" text="We use Firebase Authentication to manage your login credentials securely." />
          </Section>

          <Section number="3" title="How We Use Your Information">
            <Bullet point="To provide and maintain our Service." />
            <Bullet point="To notify you about changes to our Service." />
            <Bullet point="To allow you to participate in interactive features (Chat, Discussions)." />
            <Bullet point="To provide student support and track academic progress." />
            <Bullet point="To gather analysis or valuable information so that we can improve the Service." />
          </Section>

          <Section 
            number="4" 
            title="Data Security" 
            text="The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security."
          />

          <Section 
            number="5" 
            title="Third-Party Services" 
            text="We use Firebase (a Google service) for database management and authentication. Your data is stored on secure European servers (europe-west3) managed by Google Cloud."
          />

          <Section 
            number="6" 
            title="Contact Us" 
            text="If you have any questions about this Privacy Policy, please contact us at successcugo@gmail.com."
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

function SubSection({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.subSection}>
      <Text style={s.subSectionTitle}>{title}</Text>
      <Text style={s.sectionText}>{text}</Text>
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
  subSection: { marginTop: 16 },
  subSectionTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 4 },
  bulletRow: { flexDirection: 'row', marginTop: 8, paddingLeft: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60', marginTop: 9, marginRight: 12 },
  bulletText: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.inkMid, lineHeight: 24 },
  footerText: { textAlign: 'center', marginTop: 32, marginBottom: 16, fontFamily: F.medium, fontSize: 13, color: C.inkLight },
});
