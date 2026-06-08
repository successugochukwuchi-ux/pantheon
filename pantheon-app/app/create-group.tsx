import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function UserCircleIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.ink, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink, marginBottom: 1 }} />
      <View style={{ width: 16, height: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.5, borderColor: C.ink, borderBottomWidth: 0 }} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CreateGroupScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const [groupName, setGroupName] = useState('');

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIcon}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.ink }]} numberOfLines={2}>Create Study{"\n"}Group</Text>
        <TouchableOpacity style={s.headerIcon}>
          <UserCircleIcon />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        <Text style={[s.label, { color: C.inkLight }]}>GROUP NAME</Text>
        <TextInput
          style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.ink }]}
          placeholder="e.g. Quantum Mechanics Squad"
          placeholderTextColor={C.inkLight}
          value={groupName}
          onChangeText={setGroupName}
          autoFocus
        />

        <View style={{ flex: 1 }} />

        <TouchableOpacity 
          style={[s.continueBtn, { backgroundColor: C.ink }, !groupName && { opacity: 0.5 }]} 
          disabled={!groupName}
          onPress={() => router.push({ pathname: '/add-members', params: { groupName } })}
          activeOpacity={0.8}
        >
          <Text style={[s.continueBtnText, { color: C.bg }]}>Continue</Text>
        </TouchableOpacity>

        <Text style={[s.footerText, { color: C.inkLight }]}>
          By creating a group, you agree to COLEARN's{"\n"}community guidelines for academic integrity.
        </Text>
      </View>

      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  headerTitle: { fontFamily: F.bold, fontSize: 36, flex: 1, marginLeft: 12, lineHeight: 40 },

  content: { flex: 1, padding: 24, paddingTop: 60 },
  label: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1, marginBottom: 12 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    fontFamily: F.medium,
    fontSize: 18,
  },

  continueBtn: {
    borderRadius: 16,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  continueBtnText: { fontFamily: F.bold, fontSize: 22 },
  footerText: {
    fontFamily: F.bold,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
