import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

function BackIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }, { translateX: 2 }] }} />
    </View>
  );
}

const FEEDBACK_TYPES = ['Bug Report', 'Feature Request', 'General Feedback', 'Academic Content Issue'];

export default function FeedbackScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const { profile } = useAuth();

  const [type, setType] = useState(FEEDBACK_TYPES[2]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please tell us what is on your mind.');
      return;
    }
    setSubmitting(true);
    try {
      if (profile) {
        await addDoc(collection(db, 'feedback'), {
          uid: profile.uid,
          userId: profile.uid,
          username: profile.username || 'Student',
          email: profile.email || '',
          studentId: profile.studentId || '',
          department: profile.department || '',
          academicLevel: profile.academicLevel || profile.level || '',
          level: profile.level || '1',
          type: type,
          subject: subject.trim() || type,
          message: message.trim(),
          status: 'pending',
          pushedToLevel5: false,
          createdAt: new Date().toISOString(),
          At: profile.At || 'futo',
        });
      }
      setSubmitting(false);
      Alert.alert('Thank You', 'Your feedback has been received and routed to your university administrator team.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setSubmitting(false);
      Alert.alert('Error', 'Failed to submit feedback. Please check your network connection.');
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <BackIcon color={C.ink} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: C.ink }]}>Give Feedback</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={s.content} contentContainerStyle={{ padding: 20 }}>
          <Text style={[s.label, { color: C.inkLight }]}>WHAT TYPE OF FEEDBACK?</Text>
          <View style={s.typeGrid}>
            {FEEDBACK_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, { backgroundColor: C.surface, borderColor: C.border }, type === t && [s.typeBtnActive, { backgroundColor: C.ink, borderColor: C.ink }]]}
                onPress={() => setType(t)}
              >
                <Text style={[s.typeBtnText, { color: C.inkMid }, type === t && s.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { color: C.inkLight }]}>SUBJECT (OPTIONAL)</Text>
          <TextInput
            style={[s.input, { backgroundColor: C.surface, borderColor: C.border, color: C.ink }]}
            placeholder="e.g. Question on MTH201, Bug in Quiz..."
            placeholderTextColor={C.inkLight}
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={[s.label, { color: C.inkLight }]}>YOUR MESSAGE</Text>
          <TextInput
            style={[s.textArea, { backgroundColor: C.surface, borderColor: C.border, color: C.ink }]}
            placeholder="Type your detailed feedback or inquiry here..."
            placeholderTextColor={C.inkLight}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity 
            style={[s.submitBtn, { backgroundColor: C.ink }, submitting && { opacity: 0.7 }]} 
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={[s.submitBtnText, { color: C.bg }]}>{submitting ? 'SENDING...' : 'SUBMIT FEEDBACK'}</Text>
          </TouchableOpacity>

          <View style={[s.infoBox, { backgroundColor: C.activeBg || '#E8F6EF' }]}>
            <Text style={[s.infoText, { color: C.activeText || '#27AE60' }]}>
              We value your input! Your feedback is securely delivered directly to administrators of your university ({profile?.At ? profile.At.toUpperCase() : 'CoLearn'}).
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 18 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1.2, marginBottom: 8, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBtnActive: { },
  typeBtnText: { fontFamily: F.bold, fontSize: 13 },
  typeBtnTextActive: { color: '#fff' },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    fontFamily: F.body,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 8,
  },
  textArea: {
    borderRadius: 16,
    padding: 16,
    height: 160,
    fontFamily: F.body,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 24,
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { fontFamily: F.bold, fontSize: 15, letterSpacing: 1 },
  infoBox: { marginTop: 24, padding: 18, borderRadius: 16 },
  infoText: { fontFamily: F.medium, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
