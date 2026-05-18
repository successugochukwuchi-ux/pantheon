import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { C, F } from './Theme';

export function ActivationModal() {
  const { user, profile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Determine if we should show the modal
  const showModal = !!user && !!profile && !profile.isActivated;

  const handleActivate = async () => {
    if (!code.trim()) {
      Alert.alert('Activation Error', 'Please enter an activation code.');
      return;
    }

    setLoading(true);
    try {
      const codeRef = doc(db, 'activationCodes', code.trim());
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        Alert.alert('Invalid Code', 'The activation code you entered is invalid.');
        setLoading(false);
        return;
      }

      const codeData = codeSnap.data();
      if (codeData.isUsed) {
        Alert.alert('Code Used', 'This activation code has already been used.');
        setLoading(false);
        return;
      }

      // Valid code! Update code and user profile
      await updateDoc(codeRef, {
        isUsed: true,
        usedBy: user?.uid,
        usedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user?.uid!), {
        isActivated: true,
      });

      Alert.alert('Success', 'Your account has been activated! Enjoy PANTHEON.');
    } catch (error) {
      console.error('Activation error:', error);
      Alert.alert('Error', 'Failed to activate account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={showModal} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.iconCircle}>
            <Text style={s.icon}>⚡</Text>
          </View>
          <Text style={s.title}>Account Activation</Text>
          <Text style={s.sub}>
            Welcome to PANTHEON! To access all features, please enter your activation code below.
          </Text>

          <TextInput
            style={s.input}
            placeholder="Enter Code (e.g. PN-XXXX)"
            placeholderTextColor={C.inkLight}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />

          <TouchableOpacity 
            style={[s.btn, loading && { opacity: 0.7 }]} 
            onPress={handleActivate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>ACTIVATE NOW</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>Need a code? Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    alignItems: 'center',
    paddingBottom: 48,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 32 },
  title: {
    fontFamily: F.bold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    fontFamily: F.medium,
    fontSize: 15,
    color: C.inkMid,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    height: 60,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    fontFamily: F.bold,
    fontSize: 18,
    color: C.ink,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#F9F8FD',
  },
  btn: {
    width: '100%',
    height: 60,
    backgroundColor: '#000',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  btnText: { fontFamily: F.bold, fontSize: 16, color: '#fff', letterSpacing: 1 },
  secondaryBtn: { marginTop: 24 },
  secondaryBtnText: { fontFamily: F.bold, fontSize: 14, color: C.inkLight, textDecorationLine: 'underline' },
});
