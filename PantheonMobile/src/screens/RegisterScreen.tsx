import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, User, Mail, Lock, GraduationCap, Building, ChevronDown, Check } from 'lucide-react-native';
import { DEPARTMENTS } from '../types/departments';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RegisterScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [academicLevel, setAcademicLevel] = useState('100');
  const [department, setDepartment] = useState('General');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isLevelModalVisible, setIsLevelModalVisible] = useState(false);
  const [isDeptModalVisible, setIsDeptModalVisible] = useState(false);

  const levels = ['100', '200', '300', '400', '500'];

  const cacheCourses = async (level: string) => {
    try {
      const q = query(collection(db, 'courses'), where('level', '==', level));
      const snap = await getDocs(q);
      const courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await AsyncStorage.setItem('offline_courses', JSON.stringify(courses));
    } catch (e) {
      console.error('Caching error:', e);
    }
  };

  const generateStudentId = () => {
    return Math.floor(Math.random() * 90000000000 + 10000000000).toString();
  };

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const studentId = generateStudentId();

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        username: username,
        studentId: studentId,
        level: '1',
        academicLevel: academicLevel,
        department: department,
        isActivated: false,
        referralCount: 0,
        createdAt: new Date().toISOString(),
      });

      await cacheCourses(academicLevel);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const SelectionModal = ({ visible, title, data, selectedValue, onSelect, onClose }: any) => (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
                  <FlatList
                    data={data}
                    keyExtractor={item => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.modalItem, { borderBottomColor: colors.border }]}
                            onPress={() => { onSelect(item); onClose(); }}
                        >
                            <Text style={[styles.modalItemText, { color: colors.foreground }]}>{item}</Text>
                            {selectedValue === item && <Check size={18} color={colors.primary} />}
                        </TouchableOpacity>
                    )}
                  />
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Close</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Join Pantheon</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Create your student account</Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
        <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <User size={18} color={colors.mutedForeground} style={styles.icon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="John Doe"
            placeholderTextColor={colors.mutedForeground}
            value={username}
            onChangeText={setUsername}
          />
        </View>
      </View>


      <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>Level</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setIsLevelModalVisible(true)}
              >
                  <GraduationCap size={18} color={colors.mutedForeground} style={styles.icon} />
                  <Text style={[styles.input, { color: colors.foreground, paddingTop: 14 }]}>{academicLevel}</Text>
                  <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>Department</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setIsDeptModalVisible(true)}
              >
                  <Building size={18} color={colors.mutedForeground} style={styles.icon} />
                  <Text numberOfLines={1} style={[styles.input, { color: colors.foreground, paddingTop: 14 }]}>{department}</Text>
                  <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
          </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
        <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Mail size={18} color={colors.mutedForeground} style={styles.icon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="email@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Lock size={18} color={colors.mutedForeground} style={styles.icon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Minimum 6 characters"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Create Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
        <Text style={[styles.linkText, { color: colors.primary }]}>Already have an account? <Text style={{ fontWeight: 'bold' }}>Login</Text></Text>
      </TouchableOpacity>

      <SelectionModal
        visible={isLevelModalVisible}
        title="Select Academic Level"
        data={levels}
        selectedValue={academicLevel}
        onSelect={setAcademicLevel}
        onClose={() => setIsLevelModalVisible(false)}
      />
      <SelectionModal
        visible={isDeptModalVisible}
        title="Select Department"
        data={DEPARTMENTS}
        selectedValue={department}
        onSelect={setDepartment}
        onClose={() => setIsDeptModalVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
      flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerLink: {
      marginTop: 32,
  },
  linkText: {
    textAlign: 'center',
    fontSize: 14,
  },
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
  },
  modalContent: {
      maxHeight: '80%',
      borderRadius: 20,
      padding: 20,
  },
  modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
  },
  modalItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
  },
  modalItemText: {
      fontSize: 16,
  },
  modalCloseBtn: {
      marginTop: 20,
      alignItems: 'center',
      padding: 10,
  }
});
