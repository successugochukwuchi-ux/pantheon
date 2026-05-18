import React, { useState } from 'react';
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
import { C, F } from '../components/Theme';

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }, { translateX: 2 }] }} />
    </View>
  );
}

const FEEDBACK_TYPES = ['Bug Report', 'Feature Request', 'General Feedback', 'Academic Content Issue'];

export default function FeedbackScreen() {
  const router = useRouter();
  const [type, setType] = useState(FEEDBACK_TYPES[2]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) {
      Alert.alert('Empty Message', 'Please tell us what is on your mind.');
      return;
    }
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert('Thank You', 'Your feedback has been received and will be reviewed by our team.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }, 1500);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Give Feedback</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={s.content} contentContainerStyle={{ padding: 20 }}>
          <Text style={s.label}>WHAT TYPE OF FEEDBACK?</Text>
          <View style={s.typeGrid}>
            {FEEDBACK_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, type === t && s.typeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[s.typeBtnText, type === t && s.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>YOUR MESSAGE</Text>
          <TextInput
            style={s.textArea}
            placeholder="Type your feedback here..."
            placeholderTextColor={C.inkLight}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity 
            style={[s.submitBtn, submitting && { opacity: 0.7 }]} 
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>{submitting ? 'SENDING...' : 'SUBMIT FEEDBACK'}</Text>
          </TouchableOpacity>

          <View style={s.infoBox}>
            <Text style={s.infoText}>
              We value your input! Your feedback helps us make Pantheon the ultimate companion for FUTO students.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 18, color: C.ink },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  label: { fontFamily: F.bold, fontSize: 12, color: C.inkLight, letterSpacing: 1.2, marginBottom: 12, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeBtnText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },
  typeBtnTextActive: { color: '#fff' },
  textArea: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    height: 200,
    fontFamily: F.body,
    fontSize: 16,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: C.ink,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { fontFamily: F.bold, fontSize: 15, color: '#fff', letterSpacing: 1 },
  infoBox: { marginTop: 32, padding: 20, backgroundColor: '#E8F6EF', borderRadius: 16 },
  infoText: { fontFamily: F.medium, fontSize: 14, color: '#27AE60', textAlign: 'center', lineHeight: 20 },
});
