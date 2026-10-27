import { Alert, Linking } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Contacts an admin via WhatsApp using the active credentials for the user's university.
 * Prompts the user if the app is offline.
 * Shows a message that the app is searching for an available admin for the fastest support.
 */
export async function contactAdmin(
  universityId: string | undefined,
  isOffline: boolean,
  customMessage?: string
) {
  if (isOffline) {
    Alert.alert(
      "Offline Mode",
      "You are currently offline. Please go online to contact an administrator."
    );
    return;
  }

  Alert.alert(
    "Support Desk",
    "Searching for an available admin for the fastest support...",
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Connect Now",
        onPress: async () => {
          try {
            // Use active credentials for the user's university (At)
            const uniId = (universityId || 'futo').toLowerCase().trim();
            const q = query(
              collection(db, 'credentialSets'),
              where('At', '==', uniId),
              where('enabled', '==', true)
            );
            
            const snap = await getDocs(q);
            let whatsappNumber = "2348118429150"; // default fallback support number
            
            if (!snap.empty) {
              const enabledSets = snap.docs.map(doc => doc.data());
              if (enabledSets.length > 0) {
                // Choose one of the enabled credentials at random
                const randomIndex = Math.floor(Math.random() * enabledSets.length);
                const selected = enabledSets[randomIndex].whatsapp;
                if (selected) {
                  whatsappNumber = selected.replace(/\D/g, '');
                }
              }
            }
            
            const textParam = customMessage ? encodeURIComponent(customMessage) : 'Admin%20Support';
            const url = `https://wa.me/${whatsappNumber}?text=${textParam}`;
            
            await Linking.openURL(url);
          } catch (error) {
            console.error("Error contacting admin:", error);
            const textParam = customMessage ? encodeURIComponent(customMessage) : 'Admin%20Support';
            Linking.openURL(`https://wa.me/2348118429150?text=${textParam}`).catch((err) => {
              console.warn("Failed fallback link:", err);
            });
          }
        }
      }
}

export interface MobileAdminContact {
  name: string;
  whatsapp: string;
  phone: string;
  email?: string;
  university: string;
}

/**
 * Fetches available administrator contact details matching the given university ID (At).
 */
export async function fetchMobileAdminContactForUniversity(universityId?: string): Promise<MobileAdminContact> {
  const uniId = (universityId || 'futo').toLowerCase().trim();
  const defaultWhatsapp = "2348118429150";
  const defaultPhone = "+234 811 842 9150";

  const fallback: MobileAdminContact = {
    name: `${uniId.toUpperCase()} Campus Administrator`,
    whatsapp: defaultWhatsapp,
    phone: defaultPhone,
    university: uniId.toUpperCase(),
  };

  try {
    const q = query(
      collection(db, 'credentialSets'),
      where('At', '==', uniId),
      where('enabled', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const enabledSets = snap.docs.map(doc => doc.data());
      if (enabledSets.length > 0) {
        const randomIndex = Math.floor(Math.random() * enabledSets.length);
        const selected = enabledSets[randomIndex];
        const rawWa = selected.whatsapp ? selected.whatsapp.replace(/\D/g, '') : defaultWhatsapp;
        const cleanWa = rawWa.startsWith('234') ? rawWa : (rawWa.startsWith('0') ? '234' + rawWa.substring(1) : rawWa);
        return {
          name: selected.name || `${uniId.toUpperCase()} Administrator`,
          whatsapp: cleanWa,
          phone: selected.phone || selected.whatsapp || defaultPhone,
          email: selected.email,
          university: uniId.toUpperCase(),
        };
      }
    }

    // Try Level 4 admin in users
    const adminQ = query(
      collection(db, 'users'),
      where('At', '==', uniId),
      where('level', '==', '4')
    );
    const adminSnap = await getDocs(adminQ);
    if (!adminSnap.empty) {
      const aData = adminSnap.docs[0].data();
      const rawContact = aData.phoneNumber || aData.phone || aData.whatsapp || defaultPhone;
      const rawWa = rawContact.replace(/\D/g, '');
      const cleanWa = rawWa.startsWith('234') ? rawWa : (rawWa.startsWith('0') ? '234' + rawWa.substring(1) : (rawWa || defaultWhatsapp));
      return {
        name: aData.username || aData.displayName || `${uniId.toUpperCase()} Administrator`,
        whatsapp: cleanWa,
        phone: rawContact,
        email: aData.email,
        university: uniId.toUpperCase(),
      };
    }
  } catch (e) {
    console.warn("Error fetching mobile admin contact:", e);
  }

  return fallback;
}
