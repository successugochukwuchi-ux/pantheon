import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface CredentialSet {
  id?: string;
  name: string;
  whatsapp: string;
  enabled: boolean;
  At: string;
}

export async function getContactWhatsAppNumber(universityId: string | undefined): Promise<string> {
  const defaultNumber = "2348118429150";
  if (!universityId) return defaultNumber;

  try {
    const q = query(
      collection(db, 'credentialSets'),
      where('At', '==', universityId),
      where('enabled', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return defaultNumber;
    }
    const enabledSets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CredentialSet));
    if (enabledSets.length === 0) return defaultNumber;
    
    // Choose one at random
    const randomIndex = Math.floor(Math.random() * enabledSets.length);
    const selected = enabledSets[randomIndex].whatsapp;
    // Sanitize phone number (strip spaces, +, or other non-digits except leading digits)
    return selected.replace(/\D/g, '');
  } catch (error) {
    console.error("Error fetching support credential:", error);
    return defaultNumber;
  }
}
