import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Alert, ActivityIndicator } from 'react-native';

const C = {
  bg: '#F0EFF5',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkMid: '#555555',
  inkLight: '#888888',
  border: '#DEDDE4',
  inputBg: '#FFFFFF',
  pill: '#E8E6F0',
  pillText: '#4A4A5A',
  accent: '#0A0A0A',
  accentText: '#FFFFFF',
  info: '#666680',
  error: '#C0392B',
};

const F = {
  display: 'DMSerifDisplay_400Regular',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

function Navbar({ onHelp }: { onHelp: () => void }) {
  return (
    <View style={s.navbar}>
      <View style={s.navBrand}>
        <View style={s.navLogo} />
        <Text style={s.navBrandText}>COLEARN</Text>
      </View>
      <TouchableOpacity onPress={onHelp} activeOpacity={0.7}>
        <Text style={s.navHelp}>Help</Text>
      </TouchableOpacity>
    </View>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  hint,
  rightAction,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  hint?: string;
  rightAction?: React.ReactNode;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [isSecured, setIsSecured] = useState(!!secureTextEntry);

  return (
    <View style={s.fieldWrap}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {rightAction}
      </View>
      <View style={[
        s.inputContainer,
        focused && s.inputContainerFocused,
        !!error && s.inputContainerError
      ]}>
        <TextInput
          style={s.inputField}
          placeholder={placeholder}
          placeholderTextColor={C.inkLight}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecured}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={s.eyeButton}
            activeOpacity={0.7}
            onPress={() => setIsSecured(!isSecured)}
          >
            <Text style={s.eyeText}>{isSecured ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hint && !error && (
        <View style={s.hintRow}>
          <Text style={s.hintIcon}>ⓘ</Text>
          <Text style={s.hintText}>{hint}</Text>
        </View>
      )}
      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async () => {
    if (validate()) {
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/dashboard');
      } catch (error: any) {
        console.error('Login error:', error);
        let msg = 'An unexpected error occurred.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          msg = 'Invalid email or password.';
        }
        Alert.alert('Login Failed', msg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Navbar onHelp={() => {}} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={s.hero}>
            <Text style={s.heroTitle}>Welcome Back.</Text>
            <Text style={s.heroSub}>
              Access your academic tools and preparation resources.
            </Text>
          </View>

          {/* Form card */}
          <View style={s.card}>
            <InputField
              label="EMAIL ADDRESS"
              placeholder="e.g., name@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              hint="Use any personal email (Gmail, Yahoo, iCloud). Student-specific emails are not required."
              error={errors.email}
            />

            <InputField
              label="PASSWORD"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
              rightAction={
                <TouchableOpacity activeOpacity={0.7} onPress={() => {}}>
                  <Text style={s.forgotText}>Forgot?</Text>
                </TouchableOpacity>
              }
            />

            <TouchableOpacity 
              style={[s.signInBtn, loading && { opacity: 0.7 }]} 
              onPress={handleSignIn} 
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.accentText} />
              ) : (
                <Text style={s.signInBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerLabel}>NEW TO COLEARN?</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={s.createBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.85}
            >
              <Text style={s.createBtnText}>Create CoLearn Account</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={s.terms}>
            By signing in, you agree to our{' '}
            <Text 
              style={s.termsLink} 
              onPress={() => router.push('/terms' as any)}
            >
              Terms of Service
            </Text>.
          </Text>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerCopy}>© 2026 Pillara Education 2026</Text>
            <View style={s.footerLinks}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/privacy' as any)}>
                <Text style={s.footerLink}>Privacy policy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/terms' as any)}>
                <Text style={s.footerLink}>Terms and Conditions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLogo: { width: 18, height: 18, borderRadius: 3, backgroundColor: C.ink },
  navBrandText: { fontFamily: F.bold, fontSize: 15, color: C.ink, letterSpacing: 2 },
  navHelp: { fontFamily: F.body, fontSize: 15, color: C.inkMid },

  scroll: { paddingBottom: 40 },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28, alignItems: 'center' },
  heroTitle: { fontFamily: F.display, fontSize: 44, color: C.ink, marginBottom: 12, textAlign: 'center' },
  heroSub: { fontFamily: F.body, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22 },

  // Card
  card: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 0,
  },

  // Fields
  fieldWrap: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontFamily: F.bold, fontSize: 11, color: C.ink, letterSpacing: 1.5 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    overflow: 'hidden',
  },
  inputContainerFocused: { borderColor: C.ink },
  inputContainerError: { borderColor: C.error },
  inputField: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  },
  eyeButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  eyeText: {
    fontSize: 18,
  },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, gap: 6 },
  hintIcon: { fontSize: 13, color: C.info, marginTop: 1 },
  hintText: { fontFamily: F.medium, fontSize: 12, color: C.info, flex: 1, lineHeight: 18 },
  errorText: { fontFamily: F.body, fontSize: 12, color: C.error, marginTop: 6 },
  forgotText: { fontFamily: F.bold, fontSize: 13, color: C.ink },

  // Buttons
  signInBtn: {
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  signInBtnText: { fontFamily: F.medium, fontSize: 15, color: C.accentText },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: { fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 1.5 },

  createBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: { fontFamily: F.body, fontSize: 15, color: C.ink },

  // Terms
  terms: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.inkLight,
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 24,
    lineHeight: 18,
  },
  termsLink: { fontFamily: F.bold, color: C.ink, textDecorationLine: 'underline' },

  // Footer
  footer: { alignItems: 'center', marginTop: 32, gap: 10 },
  footerCopy: { fontFamily: F.body, fontSize: 11, color: C.inkLight },
  footerLinks: { flexDirection: 'row', gap: 24 },
  footerLink: { fontFamily: F.body, fontSize: 12, color: C.inkLight },
});
