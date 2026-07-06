import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, addDoc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { ShieldCheck, School, BookOpen, DollarSign, Calendar, TrendingUp, Key, Plus, List, Eye, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface UniversityItem {
  id: string;
  name: string;
  shortName: string;
  departments: string[];
}

interface DisciplineItem {
  id: string;
  name: string;
}

interface PriceHistoryRecord {
  id?: string;
  standardPrice: number;
  plusPrice: number;
  updatedAt: string;
}

export default function OverseerControl() {
  const { profile, user } = useAuth();

  // Elevate level 4 admin states
  const [elevateStudentId, setElevateStudentId] = useState('');
  const [elevateLoading, setElevateLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // University creation states
  const [uniName, setUniName] = useState('');
  const [uniShortName, setUniShortName] = useState('');
  const [uniDeps, setUniDeps] = useState('');
  const [uniLoading, setUniLoading] = useState(false);
  const [universities, setUniversities] = useState<UniversityItem[]>([]);

  // Discipline creation states
  const [disciplineName, setDisciplineName] = useState('');
  const [disciplineLoading, setDisciplineLoading] = useState(false);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);

  // Price configuration states
  const [standardPrice, setStandardPrice] = useState(1000);
  const [plusPrice, setPlusPrice] = useState(2000);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);

  // Revenue states
  const [revUni, setRevUni] = useState('');
  const [revYear, setRevYear] = useState(new Date().getFullYear().toString());
  const [revMonth, setRevMonth] = useState((new Date().getMonth() + 1).toString());
  const [revLoading, setRevLoading] = useState(false);
  const [calculatedRevenue, setCalculatedRevenue] = useState<{
    standardTransferred: number;
    standardUsedDirect: number;
    plusTransferred: number;
    plusUsedDirect: number;
    standardTotalRevenue: number;
    plusTotalRevenue: number;
    grandTotal: number;
    details: string[];
  } | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      // Fetch Universities
      const uniSnap = await getDocs(collection(db, 'universities'));
      const uniList = uniSnap.docs.map(d => ({ id: d.id, ...d.data() } as UniversityItem));
      setUniversities(uniList);
      if (uniList.length > 0) {
        setRevUni(uniList[0].id);
      }

      // Fetch Disciplines
      const discSnap = await getDocs(collection(db, 'disciplines'));
      const discList = discSnap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineItem));
      setDisciplines(discList);

      // Fetch Pricing Config
      const configDoc = await getDoc(doc(db, 'system', 'config'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        setStandardPrice(data.standardPrice ?? 1000);
        setPlusPrice(data.plusPrice ?? 2000);
      }

      // Fetch Price History
      const historySnap = await getDocs(query(collection(db, 'priceHistory'), orderBy('updatedAt', 'desc')));
      const historyList = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceHistoryRecord));
      setPriceHistory(historyList);
    } catch (err) {
      console.error("Error loading overseer data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Elevate user to Level 4
  const handleElevate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!elevateStudentId.trim()) return;

    setElevateLoading(true);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', elevateStudentId.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User with this School ID / Student ID was not found!");
        setElevateLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (userData.level === '4' || userData.level === '5') {
        toast.error(`User is already an Admin/Overseer (Level ${userData.level})`);
        setElevateLoading(false);
        return;
      }

      const targetAt = userData.At || 'futo';

      await updateDoc(doc(db, 'users', userDoc.id), {
        level: '4'
      });

      toast.success(`Success! Elevated ${userData.username || 'User'} to Level 4 Admin for university: ${targetAt.toUpperCase()}`);
      setElevateStudentId('');
    } catch (err: any) {
      console.error("Error elevating user:", err);
      toast.error(err.message || "Failed to elevate user");
    } finally {
      setElevateLoading(false);
    }
  };

  // Give target user the 'At' of FUTO
  const handleSetAtToFuto = async () => {
    if (!elevateStudentId.trim()) {
      toast.error("Please enter a Target User School ID / Student ID first!");
      return;
    }

    setElevateLoading(true);
    try {
      const q = query(collection(db, 'users'), where('studentId', '==', elevateStudentId.trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("User with this School ID / Student ID was not found!");
        setElevateLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      await updateDoc(doc(db, 'users', userDoc.id), {
        At: 'futo'
      });

      toast.success(`Success! Set university (At) to FUTO for user: ${userData.username || 'User'}`);
    } catch (err: any) {
      console.error("Error setting user At to FUTO:", err);
      toast.error(err.message || "Failed to update user's university");
    } finally {
      setElevateLoading(false);
    }
  };

  // Give logged-in user themselves the 'At' of FUTO
  const handleSetMyAtToFuto = async () => {
    if (!user?.uid) {
      toast.error("You are not authenticated!");
      return;
    }

    setElevateLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        At: 'futo'
      });
      toast.success("Success! Set your own university (At) to FUTO. Please reload the panel to see changes.");
    } catch (err: any) {
      console.error("Error setting own At to FUTO:", err);
      toast.error("Failed to update your own university.");
    } finally {
      setElevateLoading(false);
    }
  };

  // Set all courses to FUTO and remove At fields from notes & questionSheets
  const handleMigrateToFuto = async () => {
    setMigrating(true);
    const toastId = toast.loading("Starting database migration to FUTO...");
    try {
      const { deleteField, writeBatch } = await import('firebase/firestore');
      
      // 1. Migrate courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      let coursesUpdated = 0;
      let courseBatch = writeBatch(db);
      let opCount = 0;

      for (const courseDoc of coursesSnap.docs) {
        courseBatch.update(doc(db, 'courses', courseDoc.id), {
          At: 'futo'
        });
        coursesUpdated++;
        opCount++;
        
        if (opCount === 400) {
          await courseBatch.commit();
          courseBatch = writeBatch(db);
          opCount = 0;
        }
      }
      if (opCount > 0) {
        await courseBatch.commit();
      }

      // 2. Clean notes (remove At field)
      const notesSnap = await getDocs(collection(db, 'notes'));
      let notesCleaned = 0;
      let notesBatch = writeBatch(db);
      opCount = 0;

      for (const noteDoc of notesSnap.docs) {
        const data = noteDoc.data();
        if (data.At !== undefined) {
          notesBatch.update(doc(db, 'notes', noteDoc.id), {
            At: deleteField()
          });
          notesCleaned++;
          opCount++;
          
          if (opCount === 400) {
            await notesBatch.commit();
            notesBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }
      if (opCount > 0) {
        await notesBatch.commit();
      }

      // 3. Clean questionSheets (remove At field)
      const sheetsSnap = await getDocs(collection(db, 'questionSheets'));
      let sheetsCleaned = 0;
      let sheetsBatch = writeBatch(db);
      opCount = 0;

      for (const sheetDoc of sheetsSnap.docs) {
        const data = sheetDoc.data();
        if (data.At !== undefined) {
          sheetsBatch.update(doc(db, 'questionSheets', sheetDoc.id), {
            At: deleteField()
          });
          sheetsCleaned++;
          opCount++;
          
          if (opCount === 400) {
            await sheetsBatch.commit();
            sheetsBatch = writeBatch(db);
            opCount = 0;
          }
        }
      }
      if (opCount > 0) {
        await sheetsBatch.commit();
      }

      toast.success(
        `Migration Successful!\nUpdated ${coursesUpdated} courses to FUTO.\nCleaned At field from ${notesCleaned} notes and ${sheetsCleaned} past questions.`, 
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(`Migration failed: ${err.message}`, { id: toastId });
    } finally {
      setMigrating(false);
    }
  };

  // 2. Create University
  const handleCreateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniName.trim() || !uniShortName.trim()) {
      toast.error("Please fill in university name and short abbreviation");
      return;
    }

    setUniLoading(true);
    try {
      const uId = uniShortName.trim().toLowerCase();
      const departmentsArray = uniDeps
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const uniDocData = {
        name: uniName.trim(),
        shortName: uniShortName.trim().toUpperCase(),
        departments: departmentsArray
      };

      await setDoc(doc(db, 'universities', uId), uniDocData);
      toast.success(`University ${uniShortName.toUpperCase()} created successfully with ${departmentsArray.length} departments!`);
      
      setUniName('');
      setUniShortName('');
      setUniDeps('');
      fetchData();
    } catch (err: any) {
      console.error("Error creating university:", err);
      toast.error("Failed to create university");
    } finally {
      setUniLoading(false);
    }
  };

  // 3. Create Discipline
  const handleCreateDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplineName.trim()) return;

    setDisciplineLoading(true);
    try {
      const dId = disciplineName.trim().toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'disciplines', dId), {
        name: disciplineName.trim()
      });
      toast.success(`Discipline "${disciplineName.trim()}" created successfully!`);
      setDisciplineName('');
      fetchData();
    } catch (err) {
      console.error("Error creating discipline:", err);
      toast.error("Failed to create discipline");
    } finally {
      setDisciplineLoading(false);
    }
  };

  // 4. Save Prices
  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setPriceLoading(true);
    try {
      const nowStr = new Date().toISOString();
      
      // Update system config
      await updateDoc(doc(db, 'system', 'config'), {
        standardPrice,
        plusPrice,
        pricesUpdatedAt: nowStr
      });

      // Save to price history
      await addDoc(collection(db, 'priceHistory'), {
        standardPrice,
        plusPrice,
        updatedAt: nowStr
      });

      toast.success("Activation pin prices updated successfully!");
      fetchData();
    } catch (err: any) {
      console.error("Error saving prices:", err);
      toast.error("Failed to update pricing");
    } finally {
      setPriceLoading(false);
    }
  };

  // 5. Calculate Revenue with Price Changes
  const handleCalculateRevenue = async () => {
    if (!revUni) {
      toast.error("Please select a university");
      return;
    }
    setRevLoading(true);
    try {
      const targetYear = parseInt(revYear);
      const targetMonth = parseInt(revMonth); // 1-12

      // Start and end of the chosen month
      const startOfChosenMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfChosenMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      // Fetch all pins for this university
      const pinsQ = query(collection(db, 'activationCodes'), where('At', '==', revUni));
      const pinsSnap = await getDocs(pinsQ);

      const allPins = pinsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Filter pins transferred or used in the selected month
      // Standard / Plus pin transferred or used directly:
      // - Transferred: has a vendor (assignedTo is set). Transfer date = createdAt.
      // - Used directly: isUsed is true, no vendor (assignedTo is not set). Usage date = usedAt.
      
      const standardTransferred: any[] = [];
      const standardUsedDirect: any[] = [];
      const plusTransferred: any[] = [];
      const plusUsedDirect: any[] = [];

      allPins.forEach(pin => {
        const isPlus = pin.type === 'plus';
        
        if (pin.assignedTo) {
          // Transferred Pin
          if (pin.createdAt) {
            const transferDate = new Date(pin.createdAt);
            if (transferDate >= startOfChosenMonth && transferDate <= endOfChosenMonth) {
              if (isPlus) {
                plusTransferred.push(pin);
              } else {
                standardTransferred.push(pin);
              }
            }
          }
        } else if (pin.isUsed) {
          // Used Directly Pin
          if (pin.usedAt) {
            const usageDate = new Date(pin.usedAt);
            if (usageDate >= startOfChosenMonth && usageDate <= endOfChosenMonth) {
              if (isPlus) {
                plusUsedDirect.push(pin);
              } else {
                standardUsedDirect.push(pin);
              }
            }
          }
        }
      });

      // Get Price history sorted chronologically to trace mid-month price changes
      const priceHistoryQ = query(collection(db, 'priceHistory'), orderBy('updatedAt', 'asc'));
      const pHSnap = await getDocs(priceHistoryQ);
      const historyPoints = pHSnap.docs.map(d => d.data() as PriceHistoryRecord);

      // Helper function to get applicable prices at any given timestamp
      const getPricesAtDate = (dateIso: string): { standard: number; plus: number } => {
        const timestamp = new Date(dateIso).getTime();
        let activeStandard = 1000;
        let activePlus = 2000;
        
        // Find latest price change that occurred before or equal to this timestamp
        for (const pt of historyPoints) {
          if (new Date(pt.updatedAt).getTime() <= timestamp) {
            activeStandard = pt.standardPrice;
            activePlus = pt.plusPrice;
          }
        }
        return { standard: activeStandard, plus: activePlus };
      };

      // Calculate Revenue
      let standardTotalRevenue = 0;
      let plusTotalRevenue = 0;
      const details: string[] = [];

      // Process standard transferred
      standardTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        standardTotalRevenue += prices.standard;
      });
      if (standardTransferred.length > 0) {
        details.push(`Transferred Standard PINs: ${standardTransferred.length}`);
      }

      // Process standard used direct
      standardUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        standardTotalRevenue += prices.standard;
      });
      if (standardUsedDirect.length > 0) {
        details.push(`Directly Used Standard PINs: ${standardUsedDirect.length}`);
      }

      // Process plus transferred
      plusTransferred.forEach(p => {
        const prices = getPricesAtDate(p.createdAt);
        plusTotalRevenue += prices.plus;
      });
      if (plusTransferred.length > 0) {
        details.push(`Transferred PLUS PINs: ${plusTransferred.length}`);
      }

      // Process plus used direct
      plusUsedDirect.forEach(p => {
        const prices = getPricesAtDate(p.usedAt);
        plusTotalRevenue += prices.plus;
      });
      if (plusUsedDirect.length > 0) {
        details.push(`Directly Used PLUS PINs: ${plusUsedDirect.length}`);
      }

      // Display pricing in effect during this month
      const monthPriceChanges = historyPoints.filter(pt => {
        const ptDate = new Date(pt.updatedAt);
        return ptDate >= startOfChosenMonth && ptDate <= endOfChosenMonth;
      });

      if (monthPriceChanges.length > 0) {
        details.push("--- Price changes during this month ---");
        monthPriceChanges.forEach(pt => {
          details.push(`Date: ${new Date(pt.updatedAt).toLocaleDateString()} -> Standard: ₦${pt.standardPrice}, PLUS: ₦${pt.plusPrice}`);
        });
      } else {
        // Find price point before month start
        let activeStandard = 1000;
        let activePlus = 2000;
        for (const pt of historyPoints) {
          if (new Date(pt.updatedAt).getTime() < startOfChosenMonth.getTime()) {
            activeStandard = pt.standardPrice;
            activePlus = pt.plusPrice;
          }
        }
        details.push(`Price Point: Standard: ₦${activeStandard}, PLUS: ₦${activePlus}`);
      }

      setCalculatedRevenue({
        standardTransferred: standardTransferred.length,
        standardUsedDirect: standardUsedDirect.length,
        plusTransferred: plusTransferred.length,
        plusUsedDirect: plusUsedDirect.length,
        standardTotalRevenue,
        plusTotalRevenue,
        grandTotal: standardTotalRevenue + plusTotalRevenue,
        details
      });

      toast.success("Revenue report calculated successfully!");
    } catch (err) {
      console.error("Revenue calculation failure:", err);
      toast.error("Failed to calculate monthly revenue");
    } finally {
      setRevLoading(false);
    }
  };

  const downloadRevenuePDF = () => {
    if (!calculatedRevenue) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const selectedSchool = universities.find(u => u.id === revUni);
      const schoolName = selectedSchool ? selectedSchool.name : revUni.toUpperCase();
      const schoolShort = selectedSchool ? selectedSchool.shortName : revUni.toUpperCase();
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];
      const monthName = monthNames[parseInt(revMonth) - 1] || revMonth;

      // 1. Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 45, "F");

      // Draw elegant bottom accent bar
      doc.setFillColor(217, 119, 6); // amber-600
      doc.rect(0, 43, 210, 2, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.text("COLEARN STUDY PORTAL", 15, 18);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(156, 163, 175); // light grey
      doc.text("OFFICIAL ACADEMIC REVENUE AUDIT STATEMENT", 15, 25);

      doc.setFont("Helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(209, 213, 219);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 34);

      // 2. Metadata Information Block
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(15, 55, 180, 25, "FD");

      // Column 1
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("UNIVERSITY INSTITUTION", 20, 62);
      
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${schoolShort}`, 20, 68);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${schoolName.substring(0, 50)}${schoolName.length > 50 ? '...' : ''}`, 20, 73);

      // Column 2
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("AUDIT REPORT PERIOD", 130, 62);

      doc.setTextColor(217, 119, 6); // amber-600
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${monthName.toUpperCase()} ${revYear}`, 130, 69);
      
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`System ID: REF-${revUni.toUpperCase()}-${revYear}`, 130, 74);

      // 3. Financial Summary Cards
      // Card 1: Grand Total
      doc.setFillColor(254, 243, 199); // amber-100 background
      doc.setDrawColor(245, 158, 11); // amber-500 border
      doc.rect(15, 90, 56, 32, "FD");
      
      doc.setTextColor(146, 64, 14); // amber-800
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("GRAND TOTAL REVENUE", 20, 97);
      
      doc.setTextColor(217, 119, 6); // amber-600
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`N${calculatedRevenue.grandTotal.toLocaleString()}`, 20, 107);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text("Fully Audited Income", 20, 115);

      // Card 2: Standard PIN
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(77, 90, 56, 32, "FD");

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("STANDARD PIN INCOME", 82, 97);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`N${calculatedRevenue.standardTotalRevenue.toLocaleString()}`, 82, 107);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${calculatedRevenue.standardTransferred + calculatedRevenue.standardUsedDirect} Pins Processed`, 82, 115);

      // Card 3: PLUS PIN
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(139, 90, 56, 32, "FD");

      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("PLUS PIN INCOME", 144, 97);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`N${calculatedRevenue.plusTotalRevenue.toLocaleString()}`, 144, 107);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${calculatedRevenue.plusTransferred + calculatedRevenue.plusUsedDirect} Pins Processed`, 144, 115);

      // 4. Breakdown Table
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("ACTIVATION SOURCE & BREAKDOWN", 15, 133);

      // Table Header Row
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(15, 137, 180, 8, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("ACTIVATION PIN DESCRIPTION", 18, 142);
      doc.text("TRANSFERRED", 100, 142, { align: "center" });
      doc.text("USED DIRECT", 135, 142, { align: "center" });
      doc.text("TOTAL PINS", 165, 142, { align: "center" });

      // Row helper function
      const drawRow = (yPos: number, description: string, transCount: number, directCount: number, bgEven: boolean) => {
        if (bgEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, yPos, 180, 10, "F");
        }
        doc.setDrawColor(241, 245, 249);
        doc.line(15, yPos + 10, 195, yPos + 10);

        doc.setTextColor(51, 65, 85);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.text(description, 18, yPos + 6);
        
        doc.setFont("Helvetica", "bold");
        doc.text(transCount.toString(), 100, yPos + 6, { align: "center" });
        doc.text(directCount.toString(), 135, yPos + 6, { align: "center" });
        
        doc.setTextColor(15, 23, 42);
        doc.text((transCount + directCount).toString(), 165, yPos + 6, { align: "center" });
      };

      // Draw rows
      drawRow(145, "Standard Pin Activations (Regular Grade Access)", calculatedRevenue.standardTransferred, calculatedRevenue.standardUsedDirect, false);
      drawRow(155, "PLUS Pin Activations (Premium Advanced Access)", calculatedRevenue.plusTransferred, calculatedRevenue.plusUsedDirect, true);

      // 5. Audit Log Details
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("CHRONOLOGICAL CALCULATION STEPS", 15, 178);

      // Log Panel background
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      
      const logBoxHeight = Math.min(80, 10 + (calculatedRevenue.details.length * 6));
      doc.rect(15, 182, 180, logBoxHeight, "FD");

      doc.setTextColor(71, 85, 105);
      doc.setFont("Courier", "normal"); // Monospaced feel
      doc.setFontSize(8);

      let lineY = 188;
      calculatedRevenue.details.forEach((line) => {
        if (lineY < 182 + logBoxHeight - 4) {
          doc.text(line, 20, lineY);
          lineY += 5.5;
        }
      });

      // 6. Security & Verification Footer
      const footerY = 275;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, footerY - 5, 195, footerY - 5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("COLEARN SYSTEM PROTOCOL VERIFIED REPORT", 15, footerY);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("This report is programmatically generated directly from live system node logs. Access is strictly governed under Overseer guidelines.", 15, footerY + 4);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Page 1 of 1", 195, footerY, { align: "right" });

      doc.save(`CoLearn_Revenue_Report_${schoolShort}_${monthName}_${revYear}.pdf`);
      toast.success("Stylized revenue report downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      toast.error(`PDF generation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Elevate Level 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-500" />
            Confidential Admin Provisioning
          </CardTitle>
          <CardDescription>
            Elevate any existing platform user to a Level 4 Admin or set their university to FUTO. All course/past-question sheets are currently loaded on FUTO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleElevate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="elevateId">Target User School ID / Student ID</Label>
              <Input 
                id="elevateId"
                placeholder="Enter unique StudentID (e.g. 2021110052)" 
                value={elevateStudentId}
                onChange={(e) => setElevateStudentId(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button type="submit" disabled={elevateLoading} className="flex-1 md:flex-initial bg-violet-600 hover:bg-violet-700">
                {elevateLoading ? 'Elevating...' : 'Elevate to Level 4'}
              </Button>
              <Button 
                type="button" 
                onClick={handleSetAtToFuto} 
                disabled={elevateLoading} 
                variant="outline" 
                className="flex-1 md:flex-initial border-violet-500 text-violet-700 hover:bg-violet-50"
              >
                Set At to FUTO
              </Button>
            </div>
          </form>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Are you logged in and need to test FUTO datasets yourself? Give yourself FUTO access instantly.
            </div>
            <Button 
              type="button" 
              onClick={handleSetMyAtToFuto} 
              disabled={elevateLoading} 
              variant="outline" 
              className="w-full sm:w-auto bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Set My 'At' to FUTO
            </Button>
          </div>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <strong>Temporary Migration Tool:</strong> Update all available courses to be associated with university "FUTO" ("At" field), and purge any legacy "At" fields from Notes and Past Question sheets.
            </div>
            <Button 
              type="button" 
              onClick={handleMigrateToFuto} 
              disabled={migrating} 
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
            >
              {migrating ? 'Migrating Database...' : "Migrate Courses & Notes to FUTO"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. PIN Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Activation PIN Pricing (Overseer Authority Only)
          </CardTitle>
          <CardDescription>
            Change the default prices for standard and plus activation pins platform-wide. All price changes are securely logged to facilitate revenue calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSavePrices} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="standardPrice">Standard PIN Price (₦)</Label>
                <Input 
                  id="standardPrice"
                  type="number"
                  min="0"
                  value={standardPrice}
                  onChange={(e) => setStandardPrice(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plusPrice">PLUS PIN Price (₦)</Label>
                <Input 
                  id="plusPrice"
                  type="number"
                  min="0"
                  value={plusPrice}
                  onChange={(e) => setPlusPrice(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={priceLoading} className="bg-green-600 hover:bg-green-700">
              {priceLoading ? 'Saving Price...' : 'Update Pricing & Record'}
            </Button>
          </form>

          {priceHistory.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <h4 className="font-bold text-sm text-muted-foreground flex items-center gap-1">
                <List className="h-4 w-4" /> Recent Price Log History
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1.5 border rounded-lg p-3 text-xs font-mono">
                {priceHistory.map((pt, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span>{new Date(pt.updatedAt).toLocaleString()}</span>
                    <span className="font-bold text-primary">Standard: ₦{pt.standardPrice} | PLUS: ₦{pt.plusPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. University Management */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-blue-500" />
              Create University & Departments
            </CardTitle>
            <CardDescription>
              Deploy new universities onto the CoLearn ecosystem, adding their initial catalog of departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUniversity} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uniName">Full University Name</Label>
                <Input 
                  id="uniName"
                  placeholder="e.g. Federal University of Technology, Owerri" 
                  value={uniName}
                  onChange={(e) => setUniName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uniShort">Abbreviation / ID (Uppercase, e.g. FUTO)</Label>
                <Input 
                  id="uniShort"
                  placeholder="e.g. FUTO, UNILAG" 
                  value={uniShortName}
                  onChange={(e) => setUniShortName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uniDeps">Initial Departments (Comma-separated list)</Label>
                <textarea 
                  id="uniDeps"
                  placeholder="e.g. Computer Science, Mechanical Engineering, Electrical"
                  value={uniDeps}
                  onChange={(e) => setUniDeps(e.target.value)}
                  className="w-full min-h-[80px] p-2 border rounded-md text-sm bg-background"
                  required
                />
              </div>
              <Button type="submit" disabled={uniLoading} className="w-full">
                {uniLoading ? 'Creating...' : 'Create University'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" />
              Global Disciplines & Active Universities
            </CardTitle>
            <CardDescription>
              Deploy universal disciplines shared nationwide, or monitor deployed schools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleCreateDiscipline} className="space-y-2">
              <Label htmlFor="discName">Deploy Universal Discipline</Label>
              <div className="flex gap-2">
                <Input 
                  id="discName"
                  placeholder="e.g. Engineering, Sciences, Agriculture" 
                  value={disciplineName}
                  onChange={(e) => setDisciplineName(e.target.value)}
                  required
                />
                <Button type="submit" disabled={disciplineLoading}>
                  <Plus className="h-4 w-4 mr-1" /> Deploy
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Universities ({universities.length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {universities.map(u => (
                  <div key={u.id} className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{u.shortName}</span>
                      <span className="text-xs text-muted-foreground italic">{u.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Departments: {u.departments?.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Monthly Revenue Reporting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Monthly Revenue Calculator
          </CardTitle>
          <CardDescription>
            Audit and calculate pin-sale dividends of any university. Factoring in precise historical price records in effect during that time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Select University</Label>
              <Select value={revUni} onValueChange={setRevUni}>
                <SelectTrigger><SelectValue placeholder="Select School" /></SelectTrigger>
                <SelectContent>
                  {universities.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.shortName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={revYear} onValueChange={setRevYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={revMonth} onValueChange={setRevMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCalculateRevenue} disabled={revLoading} className="self-end w-full bg-amber-600 hover:bg-amber-700">
              {revLoading ? 'Calculating...' : 'Generate Revenue Audit'}
            </Button>
          </div>

          {calculatedRevenue && (
            <div className="p-6 border rounded-xl bg-amber-500/5 border-amber-500/20 space-y-4">
              <div className="flex justify-between items-start border-b pb-4 gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">Revenue Report for {revUni.toUpperCase()}</h3>
                  <p className="text-xs text-muted-foreground">Month: {revMonth}/{revYear}</p>
                  <Button 
                    size="sm" 
                    onClick={downloadRevenuePDF} 
                    className="mt-2 bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 h-8 rounded-lg cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download Stylized PDF
                  </Button>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Grand Total Income</span>
                  <span className="text-2xl font-black text-amber-600">₦{calculatedRevenue.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1 p-3 bg-background border rounded-lg">
                  <span className="text-xs text-muted-foreground block">Standard Pin Income</span>
                  <span className="font-bold text-lg text-primary">₦{calculatedRevenue.standardTotalRevenue.toLocaleString()}</span>
                  <p className="text-xs text-muted-foreground">
                    Transferred: {calculatedRevenue.standardTransferred} • Used directly: {calculatedRevenue.standardUsedDirect}
                  </p>
                </div>
                <div className="space-y-1 p-3 bg-background border rounded-lg">
                  <span className="text-xs text-muted-foreground block">PLUS Pin Income</span>
                  <span className="font-bold text-lg text-primary">₦{calculatedRevenue.plusTotalRevenue.toLocaleString()}</span>
                  <p className="text-xs text-muted-foreground">
                    Transferred: {calculatedRevenue.plusTransferred} • Used directly: {calculatedRevenue.plusUsedDirect}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Detailed Calculations Audit Log
                </h4>
                <div className="max-h-40 overflow-y-auto bg-background p-4 border rounded-lg font-mono text-xs space-y-1">
                  {calculatedRevenue.details.map((d, i) => (
                    <div key={i} className="py-0.5 border-b border-muted/30 last:border-0">{d}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
