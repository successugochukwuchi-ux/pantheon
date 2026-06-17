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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Alert, ActivityIndicator } from 'react-native';

const C = {
  bg: '#F0EFF5',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkMid: '#555555',
  inkLight: '#888888',
  border: '#DEDDE4',
  inputBg: '#FFFFFF',
  accent: '#0A0A0A',
  accentText: '#FFFFFF',
  error: '#C0392B',
  overlay: 'rgba(0,0,0,0.4)',
};

const F = {
  display: 'DMSerifDisplay_400Regular',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

const DEPARTMENTS = [
  "Agribusiness",
  "Agricultural and Bio resources Engineering",
  "Agricultural Economics",
  "Agricultural Extension",
  "Animal Science and Technology",
  "Architecture",
  "Biochemistry",
  "Biomedical Engineering",
  "Biology",
  "Biotechnology",
  "Building Technology",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Computer Engineering",
  "Computer Science",
  "Crop Science and Technology",
  "Cyber Security",
  "Dental Technology",
  "Electrical (Power Systems) Engineering",
  "Electronics Engineering",
  "Entrepreneurship and Innovation",
  "Environmental Health Science",
  "Environmental Management",
  "Environmental Management and Evaluation",
  "Environmental Management and Evaluation.",
  "Fisheries and Aquaculture Technology",
  "Food Science and technology",
  "Forensic Science",
  "Forestry and Wildlife Technology",
  "Geology",
  "Human Anatomy",
  "Human Physiology",
  "Information Technology",
  "Logistics and Transport Technology",
  "Maritime Technology and Logistics",
  "Material and Metallurgical Engineering",
  "Mathematics",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Microbiology",
  "Optometry",
  "Petroleum Engineering",
  "Physics",
  "Polymer and Textile Engineering",
  "Project Management Technology",
  "Prosthetics and Orthotics",
  "Public Health Technology",
  "Quantity Surveying",
  "Science Laboratory Technology",
  "Software Engineering",
  "Soil Science and Technology",
  "Statistics",
  "Supply Chain Management",
  "Surveying and Geoinformatics",
  "Telecommunications Engineering",
  "Urban and Regional Planning"
].sort((a, b) => a.localeCompare(b));

const LEVELS = ['100LVL', '200LVL'];

function Navbar() {
  const router = useRouter();
  return (
    <View style={s.navbar}>
      <View style={s.navBrand}>
        <View style={s.navLogo} />
        <Text style={s.navBrandText}>COLEARN</Text>
      </View>
      <TouchableOpacity
        style={s.navCta}
        onPress={() => router.push('/login')}
        activeOpacity={0.85}
      >
        <Text style={s.navCtaText}>Get Started</Text>
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
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [isSecured, setIsSecured] = useState(!!secureTextEntry);

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
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
      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  onSelect,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.input, s.pickerTrigger, !!error && s.inputError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[s.pickerText, !value && s.pickerPlaceholder]}>
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={s.chevron}>⌄</Text>
      </TouchableOpacity>
      {error && <Text style={s.errorText}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.modalOption, item === value && s.modalOptionSelected]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.modalOptionText, item === value && s.modalOptionTextSelected]}>
                    {item}
                  </Text>
                  {item === value && <Text style={s.modalCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

type FormErrors = {
  username?: string;
  email?: string;
  department?: string;
  level?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterScreen() {
  const router = useRouter();

  const [form, setForm] = useState({
    username: '',
    email: '',
    department: '',
    level: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'Username must be at least 3 characters';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.department) e.department = 'Please select your department';
    if (!form.level) e.level = 'Please select your level';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (validate()) {
      setLoading(true);
      try {
        const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
        
        const studentId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
        const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        const academicLevel = form.level.replace('LVL', '');

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          studentId: studentId,
          email: form.email,
          username: form.username,
          department: form.department,
          mobileNumber: form.phone,
          academicLevel: academicLevel,
          level: form.email === 'successugochukwuchi@gmail.com' ? '4' : '1',
          isActivated: form.email === 'successugochukwuchi@gmail.com', // Default to not activated unless admin
          referralCount: 0,
          referredBy: null,
          theme: 'light',
          photoURL: photoURL,
          createdAt: new Date().toISOString(),
        });

        // Increment stats total users
        try {
          await setDoc(doc(db, 'system', 'stats'), {
            totalUsers: increment(1)
          }, { merge: true });
        } catch (statsErr) {
          console.warn("Failed to increment totalUsers on mobile:", statsErr);
        }

        router.push('/dashboard');
      } catch (error: any) {
        console.error('Registration error:', error);
        let msg = 'An unexpected error occurred.';
        if (error.code === 'auth/email-already-in-use') msg = 'This email is already in use.';
        if (error.code === 'auth/invalid-email') msg = 'The email address is invalid.';
        if (error.code === 'auth/weak-password') msg = 'The password is too weak.';
        Alert.alert('Registration Failed', msg);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Navbar />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            {/* Card header */}
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Create Account</Text>
              <Text style={s.cardSubtitle}>Create COLEARN Account</Text>
            </View>

            <InputField
              label="USERNAME"
              placeholder="e.g. futotech_24"
              value={form.username}
              onChangeText={set('username')}
              autoCapitalize="none"
              error={errors.username}
            />

            <InputField
              label="EMAIL ADDRESS"
              placeholder="student@futo.edu.ng"
              value={form.email}
              onChangeText={set('email')}
              keyboardType="email-address"
              error={errors.email}
            />

            <PickerField
              label="DEPARTMENT"
              value={form.department}
              options={DEPARTMENTS}
              onSelect={set('department')}
              error={errors.department}
            />

            <PickerField
              label="LEVEL"
              value={form.level}
              options={LEVELS}
              onSelect={set('level')}
              error={errors.level}
            />

            <InputField
              label="PHONE NUMBER"
              placeholder="+234 000 000 0000"
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <InputField
              label="PASSWORD"
              placeholder="••••••••"
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
              error={errors.password}
            />

            <InputField
              label="CONFIRM PASSWORD"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChangeText={set('confirmPassword')}
              secureTextEntry
              error={errors.confirmPassword}
            />

            <TouchableOpacity 
              style={[s.registerBtn, loading && { opacity: 0.7 }]} 
              onPress={handleRegister} 
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.accentText} />
              ) : (
                <Text style={s.registerBtnText}>REGISTER ACCOUNT</Text>
              )}
            </TouchableOpacity>

            <View style={s.dividerLine} />

            <TouchableOpacity
              style={s.loginLink}
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
            >
              <Text style={s.loginLinkText}>
                Already have an account?{' '}
                <Text style={s.loginLinkBold}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerBrand}>COLEARN</Text>
            <View style={s.footerLinks}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/privacy' as any)}>
                <Text style={s.footerLink}>Privacy policy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/terms' as any)}>
                <Text style={s.footerLink}>Terms and Conditions</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.footerCopy}>© 2026 Pillara Education 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

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
  navCta: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  navCtaText: { fontFamily: F.medium, fontSize: 13, color: C.ink },

  scroll: { paddingBottom: 40, paddingTop: 20 },

  card: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
  },

  cardHeader: { alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontFamily: F.display, fontSize: 30, color: C.ink, marginBottom: 4 },
  cardSubtitle: { fontFamily: F.body, fontSize: 14, color: C.inkLight },

  // Fields
  fieldWrap: { marginBottom: 16 },
  label: { fontFamily: F.bold, fontSize: 11, color: C.ink, letterSpacing: 1.5, marginBottom: 8 },
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
  errorText: { fontFamily: F.body, fontSize: 12, color: C.error, marginTop: 5 },

  // Picker
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontFamily: F.body, fontSize: 15, color: C.ink, flex: 1 },
  pickerPlaceholder: { color: C.inkLight },
  chevron: { fontSize: 18, color: C.inkLight, marginLeft: 8 },

  // Modal picker
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: { fontFamily: F.bold, fontSize: 13, color: C.ink, letterSpacing: 1.5 },
  modalClose: { fontSize: 16, color: C.inkLight },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F4F0',
  },
  modalOptionSelected: { backgroundColor: '#F5F4F0' },
  modalOptionText: { fontFamily: F.body, fontSize: 15, color: C.ink, flex: 1 },
  modalOptionTextSelected: { fontFamily: F.bold },
  modalCheck: { fontSize: 14, color: C.ink },

  // Buttons
  registerBtn: {
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  registerBtnText: { fontFamily: F.bold, fontSize: 14, color: C.accentText, letterSpacing: 1.5 },

  dividerLine: { height: 1, backgroundColor: C.border, marginBottom: 20 },

  loginLink: { alignItems: 'center' },
  loginLinkText: { fontFamily: F.body, fontSize: 14, color: C.inkMid },
  loginLinkBold: { fontFamily: F.bold, color: C.ink },

  // Footer
  footer: { alignItems: 'center', marginTop: 32, gap: 10 },
  footerBrand: { fontFamily: F.bold, fontSize: 13, color: C.ink, letterSpacing: 3 },
  footerLinks: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontFamily: F.body, fontSize: 12, color: C.inkLight },
  footerCopy: { fontFamily: F.body, fontSize: 11, color: C.inkLight },
});
