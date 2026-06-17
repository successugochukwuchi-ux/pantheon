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
  Linking,
} from 'react-native';
import { doc, getDoc, updateDoc, serverTimestamp, query, where, getDocs, collection, writeBatch, increment, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { C, F } from './Theme';

async function sendTelegramAlertMobile(message: string) {
  try {
    const docRef = doc(db, 'system', 'telegram');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const config = snap.data();
    if (!config || !config.botToken || !config.chatId) {
      return;
    }

    const source = config.source || 'CoLearn';
    const formattedMessage = message.replace(/{source}/g, source);

    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: formattedMessage,
        parse_mode: 'HTML'
      }),
    });

    if (!response.ok) {
      console.error("Telegram mobile API Error:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send Telegram mobile alert:", error);
  }
}

export function ActivationModal() {
  const { user, profile, promoConfig } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [closedByUser, setClosedByUser] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);

  // Determine if we should show the modal
  const showModal = !!user && !!profile && !profile.isActivated && !closedByUser;

  const currentShowPromo = !!promoConfig?.isActive && !usePinMode;

  const handlePromoActivate = async () => {
    if (!user || !promoConfig?.isActive) return;

    setLoading(true);
    try {
      const promoRef = doc(db, 'system', 'promo');
      const promoSnap = await getDoc(promoRef);
      const currentPromo = promoSnap.data();

      if (!currentPromo?.isActive || currentPromo.count >= currentPromo.quota) {
        Alert.alert("Ended", "Promo mode has just ended. Please use a pin.");
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      const isPromoEnded = (currentPromo.count || 0) + 1 >= currentPromo.quota;
      // Increment the count in the promo document
      batch.update(promoRef, {
        count: (currentPromo.count || 0) + 1,
        isActive: !isPromoEnded
      });

      // Update user account activation
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        isActivated: true,
        activatedViaPromo: true
      });

      await batch.commit();

      if (isPromoEnded) {
        await sendTelegramAlertMobile(
          `<b>🎉 ALERT: PROMO MODE COMPLETED</b>\n\n` +
          `<b>Source:</b> {source} (Mobile)\n` +
          `<b>Completed Because:</b> Quota fully completed!\n` +
          `<b>Original Quota:</b> ${currentPromo.quota}\n` +
          `<b>Total Activations:</b> ${currentPromo.quota}\n` +
          `<b>Time Completed:</b> ${new Date().toLocaleString()}`
        );
      }

      Alert.alert('Success', 'Your account has been activated via Promo Mode! Welcome to COLEARN.');
    } catch (error) {
      console.error("Promo Activation Error:", error);
      Alert.alert("Activation Error", "Failed to activate via Promo. Please check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

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

      const usedAtStr = new Date().toISOString();

      // Valid code! Update code with appropriate tracking fields
      await updateDoc(codeRef, {
        isUsed: true,
        usedBy: user?.uid,
        usedByStudentId: profile?.studentId || '',
        usedAt: usedAtStr,
      });

      // Update system stats on pin consumption
      try {
        await setDoc(doc(db, 'system', 'stats'), {
          totalUnusedPins: increment(-1),
          totalUsedPins: increment(1)
        }, { merge: true });
      } catch (statsErr) {
        console.warn("Failed to update system stats via mobile activation:", statsErr);
      }

      await updateDoc(doc(db, 'users', user?.uid!), {
        isActivated: true,
      });

      // Get pin creator profile for telegram alert metadata
      let isCreatorLevel4 = false;
      let creatorStudentId = 'N/A';

      if (codeData.createdBy) {
        try {
          const creatorRef = doc(db, 'users', codeData.createdBy);
          const creatorSnap = await getDoc(creatorRef);
          if (creatorSnap.exists()) {
            const creatorData = creatorSnap.data();
            creatorStudentId = creatorData?.studentId || 'N/A';
            if (creatorData?.level === '4') {
              isCreatorLevel4 = true;
            }
          }
        } catch (error) {
          console.error("Failed to get creator snap on mobile:", error);
        }
      }

      // If we couldn't resolve via createdBy, query users collection by studentId matching owner field to confirm level 4 status
      if (!isCreatorLevel4 && codeData.owner) {
        try {
          const usersQ = query(collection(db, 'users'), where('studentId', '==', codeData.owner), where('level', '==', '4'));
          const usersSnap = await getDocs(usersQ);
          if (!usersSnap.empty) {
            isCreatorLevel4 = true;
            creatorStudentId = codeData.owner;
          }
        } catch (err) {
          console.error("Failed to query user by pin owner studentId on mobile:", err);
        }
      }

      // Telegram Alert if the pin was not assigned to any vendor and owned/created by a Level 4 Admin
      if (!codeData.assignedTo && isCreatorLevel4) {
        const headerTitle = '🔔 ALERT: LEVEL 4 ADMIN AP-PIN USED';
        await sendTelegramAlertMobile(
          `<b>${headerTitle}</b>\n\n` +
          `<b>Source:</b> {source} (Mobile)\n` +
          `<b>Pin Code:</b> ${code.trim()}\n` +
          `<b>Pin Type:</b> ${codeData.type?.toUpperCase() || 'STANDARD'}\n` +
          `<b>User Student ID:</b> ${profile?.studentId || 'N/A'}\n` +
          `<b>Time Used:</b> ${new Date().toLocaleString()}\n` +
          `<b>Pin Created At:</b> ${codeData.createdAt ? new Date(codeData.createdAt).toLocaleString() : 'N/A'}\n` +
          `<b>Creator/Owner Student ID:</b> ${creatorStudentId}\n` +
          `<b>Pool Status:</b> Master Pool`
        );
      }

      Alert.alert('Success', 'Your account has been activated! Enjoy COLEARN.');
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
          <TouchableOpacity onPress={() => setClosedByUser(true)} style={s.closeBtn} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {currentShowPromo ? (
            <>
              <View style={[s.iconCircle, { backgroundColor: '#F59E0B' }]}>
                <Text style={s.icon}>🎁</Text>
              </View>
              
              <View style={s.promoBadge}>
                <Text style={s.promoBadgeText}>FREE PROMO MODE ACTIVE</Text>
              </View>

              <Text style={s.title}>Account Activation</Text>
              <Text style={s.sub}>
                You're in luck! Current promo allows free activation. Grab this chance to unlock all study materials instantly.
              </Text>

              {promoConfig && (
                <Text style={s.promoQuotaText}>
                  Quota Remaining: {promoConfig.quota - promoConfig.count}
                </Text>
              )}

              <TouchableOpacity 
                style={[s.btn, { backgroundColor: '#F59E0B' }, loading && { opacity: 0.7 }]} 
                onPress={handlePromoActivate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>ACTIVATE FREE (PROMO)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setUsePinMode(true)} style={s.switchBtn}>
                <Text style={s.switchBtnText}>Use Activation Pin instead →</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[s.secondaryBtn, { marginTop: 12 }]}
                onPress={() => {
                  Linking.openURL('https://wa.me/2348118429150?text=Hello%2C%20I%20want%20to%20purchase%20an%20activation%20pin%20for%20CoLearn%20App.');
                }}
              >
                <Text style={s.secondaryBtnText}>Need a Code? Contact an Admin</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.iconCircle}>
                <Text style={s.icon}>⚡</Text>
              </View>
              
              {promoConfig?.isActive && (
                <View style={[s.promoBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]}>
                  <Text style={[s.promoBadgeText, { color: '#B45309' }]}>FREE PROMO MODE AVAILABLE</Text>
                </View>
              )}

              <Text style={s.title}>Account Activation</Text>
              <Text style={s.sub}>
                Welcome to COLEARN! To access all features, please enter your activation code below.
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

              {promoConfig?.isActive && (
                <TouchableOpacity onPress={() => setUsePinMode(false)} style={s.switchBtn}>
                  <Text style={[s.switchBtnText, { color: '#F59E0B' }]}>← Use Free Promo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[s.secondaryBtn, { marginTop: 12 }]}
                onPress={() => {
                  Linking.openURL('https://wa.me/2348118429150?text=Hello%2C%20I%20want%20to%20purchase%20an%20activation%20pin%20for%20CoLearn%20App.');
                }}
              >
                <Text style={s.secondaryBtnText}>Need a Code? Contact an Admin</Text>
              </TouchableOpacity>
            </>
          )}
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
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontFamily: F.bold,
    fontSize: 16,
    color: C.inkMid,
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
  promoBadge: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#F59E0B', borderRadius: 20, marginBottom: 16 },
  promoBadgeText: { fontFamily: F.bold, fontSize: 12, color: '#fff', letterSpacing: 0.5 },
  promoQuotaText: { fontFamily: F.bold, fontSize: 14, color: '#D97706', marginBottom: 20 },
  switchBtn: { marginTop: 22, paddingVertical: 10 },
  switchBtnText: { fontFamily: F.bold, fontSize: 14, color: C.inkLight },
});
