import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface AdminContactInfo {
  name: string;
  whatsapp: string;
  phone: string;
  email?: string;
  university: string;
}

/**
 * Retrieves the contact information for an available administrator
 * matching the user's institution/university ("At").
 * Searches credentialSets first, then admin users (level 4), and falls back to campus desk.
 */
export async function fetchAdminContactForUniversity(universityId?: string): Promise<AdminContactInfo> {
  const uniId = (universityId || 'futo').toLowerCase().trim();
  const defaultWhatsapp = "2348118429150";
  const defaultPhone = "+234 811 842 9150";
  const defaultEmail = "support@colearn.app";
  
  const fallbackInfo: AdminContactInfo = {
    name: `${uniId.toUpperCase()} Campus Administrator`,
    whatsapp: defaultWhatsapp,
    phone: defaultPhone,
    email: defaultEmail,
    university: uniId.toUpperCase(),
  };

  try {
    // 1. Query active credentialSets for this university (At)
    const credQuery = query(
      collection(db, 'credentialSets'),
      where('At', '==', uniId),
      where('enabled', '==', true)
    );
    const credSnap = await getDocs(credQuery);

    if (!credSnap.empty) {
      const docs = credSnap.docs.map(d => d.data());
      // Pick one randomly for load balancing if multiple exist
      const chosen = docs[Math.floor(Math.random() * docs.length)];
      const rawWa = chosen.whatsapp ? chosen.whatsapp.replace(/\D/g, '') : defaultWhatsapp;
      const cleanWa = rawWa.startsWith('234') ? rawWa : (rawWa.startsWith('0') ? '234' + rawWa.substring(1) : rawWa);

      return {
        name: chosen.name || `${uniId.toUpperCase()} Campus Administrator`,
        whatsapp: cleanWa || defaultWhatsapp,
        phone: chosen.phone || chosen.whatsapp || defaultPhone,
        email: chosen.email || defaultEmail,
        university: uniId.toUpperCase(),
      };
    }

    // 2. Query users collection for a Level 4 admin assigned to this university (At)
    const adminQuery = query(
      collection(db, 'users'),
      where('At', '==', uniId),
      where('level', '==', '4')
    );
    const adminSnap = await getDocs(adminQuery);

    if (!adminSnap.empty) {
      const adminData = adminSnap.docs[0].data();
      const rawContact = adminData.phoneNumber || adminData.phone || adminData.whatsapp || defaultPhone;
      const rawWa = rawContact.replace(/\D/g, '');
      const cleanWa = rawWa.startsWith('234') ? rawWa : (rawWa.startsWith('0') ? '234' + rawWa.substring(1) : (rawWa || defaultWhatsapp));

      return {
        name: adminData.username || adminData.displayName || `${uniId.toUpperCase()} Administrator`,
        whatsapp: cleanWa,
        phone: rawContact,
        email: adminData.email || defaultEmail,
        university: uniId.toUpperCase(),
      };
    }
  } catch (err) {
    console.warn("[AdminContactService] Failed to load university admin details, using fallback:", err);
  }

  return fallbackInfo;
}
