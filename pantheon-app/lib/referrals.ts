import { Alert, Linking, Share } from 'react-native';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export const COLEARN_WEB_ORIGIN = 'https://colearn.com.ng';

export function getLevel2ReferralThreshold(systemConfig?: { referralThresholdForLevel2?: number } | null): number {
  const parsed = Number(systemConfig?.referralThresholdForLevel2);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 5;
}

export function getReferralLink(uid?: string | null): string {
  if (!uid) return `${COLEARN_WEB_ORIGIN}/register`;
  return `${COLEARN_WEB_ORIGIN}/register?ref=${encodeURIComponent(uid)}`;
}

export function buildReferralShareMessage(referralCode: string, referralLink: string): string {
  return (
    `Join me on CoLearn to access lecture notes, past questions, and CBT practice!\n\n` +
    `Register here: ${referralLink}\n` +
    (referralCode ? `Or enter my referral code in the CoLearn mobile app: ${referralCode}` : '')
  );
}

export async function shareReferralToWhatsApp(referralCode: string, referralLink: string): Promise<void> {
  const message = buildReferralShareMessage(referralCode, referralLink);
  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://wa.me/?text=${encoded}`;

  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);
    if (canOpenApp) {
      await Linking.openURL(appUrl);
      return;
    }
    await Linking.openURL(webUrl);
  } catch (err) {
    console.warn('WhatsApp quick share fallback:', err);
    try {
      await Share.share({
        title: 'Join CoLearn Student Portal',
        message,
      });
    } catch {
      Alert.alert('Unable to Share', 'Could not open WhatsApp right now. You can copy your link or code instead.');
    }
  }
}

export async function shareReferralToFacebook(referralCode: string, referralLink: string): Promise<void> {
  const quote = referralCode
    ? `Join me on CoLearn for lecture notes, past questions, and CBT practice! Referral code: ${referralCode}`
    : 'Join me on CoLearn for lecture notes, past questions, and CBT practice!';
  const sharerUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(quote)}`;

  try {
    await Linking.openURL(sharerUrl);
  } catch (err) {
    console.warn('Facebook quick share fallback:', err);
    try {
      await Share.share({
        title: 'Join CoLearn Student Portal',
        message: buildReferralShareMessage(referralCode, referralLink),
        url: referralLink,
      });
    } catch {
      Alert.alert('Unable to Share', 'Could not open Facebook right now. You can copy your link or code instead.');
    }
  }
}

export async function shareReferralNative(referralCode: string, referralLink: string): Promise<void> {
  const message = buildReferralShareMessage(referralCode, referralLink);
  try {
    await Share.share({
      title: 'Join CoLearn Student Portal',
      message,
      url: referralLink,
    });
  } catch (err) {
    console.warn('Native share cancelled/failed:', err);
  }
}

export async function checkAndUpgradeReferrerMobile(
  referredByUid: string | null | undefined,
  newlyActivatedUid: string
): Promise<boolean> {
  if (!referredByUid || !newlyActivatedUid) return false;
  try {
    let threshold = 5;
    try {
      const cfgSnap = await getDoc(doc(db, 'system', 'config'));
      if (cfgSnap.exists()) {
        threshold = getLevel2ReferralThreshold(cfgSnap.data() as any);
      }
    } catch {}

    const referrerRef = doc(db, 'users', referredByUid);
    const referrerSnap = await getDoc(referrerRef);
    if (!referrerSnap.exists()) return false;

    const referrerData = referrerSnap.data();
    if (referrerData?.level !== '1') return false;

    const referredSnap = await getDocs(
      query(
        collection(db, 'users'),
        where('referredBy', '==', referredByUid),
        where('isActivated', '==', true)
      )
    );

    const activatedCount = referredSnap.docs.filter((d) => d.id !== newlyActivatedUid).length + 1;
    if (activatedCount >= threshold) {
      await updateDoc(referrerRef, { level: '2' });
      return true;
    }
  } catch (err) {
    console.warn('Mobile referral upgrade check skipped/failed:', err);
  }
  return false;
}
