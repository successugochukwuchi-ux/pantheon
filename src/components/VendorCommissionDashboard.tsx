import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  writeBatch, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ActivationCode, WalletTransaction } from '../types';
import { PaystackService, PaystackBank, PaystackTransactionSuccess } from '../services/paystackService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';
import { toast } from 'sonner';
import { 
  Wallet, 
  CreditCard, 
  ArrowDownLeft, 
  Zap, 
  Package, 
  RefreshCw, 
  Copy, 
  Check, 
  CheckCircle, 
  AlertCircle, 
  Building, 
  Search, 
  Settings, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  Coins, 
  TrendingUp, 
  History, 
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Lock
} from 'lucide-react';

interface VendorCommissionDashboardProps {
  user: any;
  profile: any;
  systemConfig: any;
  unusedPins: ActivationCode[];
  usedPins: ActivationCode[];
  onRefresh: () => void;
}

export default function VendorCommissionDashboard({
  user,
  profile,
  systemConfig,
  unusedPins,
  usedPins,
  onRefresh
}: VendorCommissionDashboardProps) {
  // Vendor Wallet & Profile States
  const [walletBalance, setWalletBalance] = useState<number>(profile?.walletBalance || 0);
  const [totalEarned, setTotalEarned] = useState<number>(profile?.totalEarned || 0);
  const [totalWithdrawn, setTotalWithdrawn] = useState<number>(profile?.totalWithdrawn || 0);
  const [accountNumber, setAccountNumber] = useState<string>(profile?.accountNumber || '');
  const [bankCode, setBankCode] = useState<string>(profile?.bankCode || '');
  const [bankName, setBankName] = useState<string>(profile?.bankName || '');
  const [accountName, setAccountName] = useState<string>(profile?.accountName || '');
  const [recipientCode, setRecipientCode] = useState<string>(profile?.recipientCode || '');

  // Pricing & Configuration loaded from system/config
  const standardPrice = systemConfig?.standardPrice ?? 1000;
  const plusPrice = systemConfig?.plusPrice ?? 2000;
  const bulkStandardPrice = systemConfig?.bulkStandardPrice ?? systemConfig?.standardWholesalePrice ?? 800;
  const bulkPlusPrice = systemConfig?.bulkPlusPrice ?? systemConfig?.plusWholesalePrice ?? 1500;
  const commissionPercentage = systemConfig?.vendorCommissionPercentage ?? 15;
  const paystackPublicKey = systemConfig?.paystackPublicKey || '';
  const paystackSecretKey = systemConfig?.paystackSecretKey || '';

  // Calculate expected on-demand commission
  const onDemandCommission = Math.round(standardPrice * (commissionPercentage / 100));

  // Vendor's assigned pins
  const myUnusedPins = useMemo(() => {
    return unusedPins.filter(p => p.assignedTo === user?.uid);
  }, [unusedPins, user?.uid]);

  const myUsedPins = useMemo(() => {
    return usedPins.filter(p => p.assignedTo === user?.uid);
  }, [usedPins, user?.uid]);

  // Dialog States
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showOnDemandDialog, setShowOnDemandDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showPinSuccessDialog, setShowPinSuccessDialog] = useState(false);
  const [showRestockSuccessDialog, setShowRestockSuccessDialog] = useState(false);

  // Settings / Bank Verification State
  const [banksList, setBanksList] = useState<PaystackBank[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tempAccountName, setTempAccountName] = useState('');
  const [tempAccountNumber, setTempAccountNumber] = useState('');
  const [tempBankCode, setTempBankCode] = useState('');
  const [tempBankName, setTempBankName] = useState('');

  // On-Demand Transaction State
  const [studentEmail, setStudentEmail] = useState('');
  const [onDemandProcessing, setOnDemandProcessing] = useState(false);
  const [generatedOnDemandPin, setGeneratedOnDemandPin] = useState<string | null>(null);

  // Restock State
  const [restockNumStandard, setRestockNumStandard] = useState(5);
  const [restockNumPlus, setRestockNumPlus] = useState(0);
  const [restockProcessing, setRestockProcessing] = useState(false);
  const [restockedPinsResult, setRestockedPinsResult] = useState<string[]>([]);

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Transaction Ledger State
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Real-time listener for current vendor user doc (wallet balance & recipient details)
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setWalletBalance(d.walletBalance ?? 0);
        setTotalEarned(d.totalEarned ?? 0);
        setTotalWithdrawn(d.totalWithdrawn ?? 0);
        if (d.accountNumber) setAccountNumber(d.accountNumber);
        if (d.bankCode) setBankCode(d.bankCode);
        if (d.bankName) setBankName(d.bankName);
        if (d.accountName) setAccountName(d.accountName);
        if (d.recipientCode) setRecipientCode(d.recipientCode);
      }
    });

    return () => unsub();
  }, [user?.uid]);

  // Real-time listener for vendor's wallet transactions
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingTransactions(true);
    const q = query(
      collection(db, 'wallet_transactions'),
      where('vendorId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(items);
      setLoadingTransactions(false);
    }, (err) => {
      console.warn("Could not listen to wallet transactions:", err);
      setLoadingTransactions(false);
    });

    return () => unsub();
  }, [user?.uid]);

  // Fetch banks from Paystack when settings dialog opens
  useEffect(() => {
    if (showSettingsDialog && banksList.length === 0) {
      loadBanks();
    }
  }, [showSettingsDialog]);

  const loadBanks = async () => {
    setLoadingBanks(true);
    try {
      const banks = await PaystackService.getBanks(paystackSecretKey);
      setBanksList(banks);
    } catch (err: any) {
      console.error("Failed to load Paystack banks:", err);
      toast.error("Could not fetch banks from Paystack. Check internet connection.");
    } finally {
      setLoadingBanks(false);
    }
  };

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return banksList;
    const q = bankSearch.toLowerCase();
    return banksList.filter(b => b.name.toLowerCase().includes(q) || b.code.includes(q));
  }, [banksList, bankSearch]);

  // Initialize temp settings modal inputs
  const handleOpenSettings = () => {
    setTempAccountNumber(accountNumber);
    setTempBankCode(bankCode);
    setTempBankName(bankName);
    setTempAccountName(accountName);
    setShowSettingsDialog(true);
  };

  // NUBAN Account Verification
  const handleResolveAccount = async () => {
    if (!tempAccountNumber || tempAccountNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit Nigerian NUBAN account number.");
      return;
    }
    if (!tempBankCode) {
      toast.error("Please select a bank from the list.");
      return;
    }

    setResolvingAccount(true);
    try {
      const res = await PaystackService.resolveAccount(tempAccountNumber, tempBankCode, paystackSecretKey);
      if (res.status && res.data?.account_name) {
        setTempAccountName(res.data.account_name);
        toast.success(`Account verified: ${res.data.account_name}`);
      } else {
        toast.error(res.message || "Could not resolve account name. Verify bank and account number.");
      }
    } catch (err: any) {
      console.error("Error resolving account:", err);
      toast.error(err.message || "Failed to verify account");
    } finally {
      setResolvingAccount(false);
    }
  };

  // Save Bank Details & Generate Recipient Code
  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempAccountNumber || tempAccountNumber.length !== 10) {
      toast.error("Please enter a valid 10-digit account number.");
      return;
    }
    if (!tempBankCode) {
      toast.error("Please select your bank.");
      return;
    }
    if (!tempAccountName) {
      toast.error("Please verify your account number to confirm the account name before saving.");
      return;
    }

    setSavingSettings(true);
    try {
      // 1. Create Paystack Transfer Recipient via backend proxy
      const recipientRes = await PaystackService.createTransferRecipient(
        tempAccountName,
        tempAccountNumber,
        tempBankCode,
        paystackSecretKey
      );

      if (!recipientRes.status || !recipientRes.data?.recipient_code) {
        throw new Error(recipientRes.message || "Failed to generate Paystack recipient code.");
      }

      const newRecipientCode = recipientRes.data.recipient_code;

      // 2. Persist in vendor's user document and vendor profile
      await updateDoc(doc(db, 'users', user.uid), {
        accountNumber: tempAccountNumber,
        bankCode: tempBankCode,
        bankName: tempBankName,
        accountName: tempAccountName,
        recipientCode: newRecipientCode
      });

      // Also save in vendor_profiles/{uid}
      await setDoc(doc(db, 'vendor_profiles', user.uid), {
        uid: user.uid,
        studentId: profile?.studentId || '',
        accountNumber: tempAccountNumber,
        bankCode: tempBankCode,
        bankName: tempBankName,
        accountName: tempAccountName,
        recipientCode: newRecipientCode,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setAccountNumber(tempAccountNumber);
      setBankCode(tempBankCode);
      setBankName(tempBankName);
      setAccountName(tempAccountName);
      setRecipientCode(newRecipientCode);

      setShowSettingsDialog(false);
      toast.success("Bank details saved & Paystack payout recipient created successfully!");
    } catch (err: any) {
      console.error("Error saving vendor bank settings:", err);
      toast.error(err.message || "Failed to save bank details");
    } finally {
      setSavingSettings(false);
    }
  };

  // --------------------------------------------------------------------------
  // ON-DEMAND PIN FLOW
  // --------------------------------------------------------------------------
  const handleOpenOnDemand = () => {
    if (!paystackPublicKey) {
      toast.error("Paystack has not been configured by an Overseer yet. Please contact support.");
      return;
    }
    setStudentEmail(profile?.email || '');
    setShowOnDemandDialog(true);
  };

  const handleLaunchOnDemandPayment = () => {
    if (!studentEmail.trim()) {
      toast.error("Please enter a student email for the payment receipt.");
      return;
    }
    if (!paystackPublicKey) {
      toast.error("Paystack public key is not configured.");
      return;
    }

    setOnDemandProcessing(true);

    const paymentRef = `ondemand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    PaystackService.openInlinePayment({
      publicKey: paystackPublicKey,
      email: studentEmail.trim(),
      amountInNaira: standardPrice,
      reference: paymentRef,
      metadata: {
        vendorId: user.uid,
        vendorStudentId: profile?.studentId,
        type: 'on_demand_standard_pin',
        standardPrice,
        commissionAmount: onDemandCommission,
        university: profile?.At || 'futo'
      },
      onSuccess: async (res: PaystackTransactionSuccess) => {
        try {
          // 1. Generate 12-digit standard activation PIN
          const newPinCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          const nowStr = new Date().toISOString();

          const pinData = {
            code: newPinCode,
            type: 'standard',
            isUsed: false,
            assignedTo: user.uid,
            assignedToStudentId: profile?.studentId || '',
            assignedToName: profile?.username || 'Vendor',
            createdBy: user.uid,
            createdAt: nowStr,
            owner: profile?.studentId || user.uid,
            At: profile?.At || 'futo',
            // On-Demand specific commission flags
            isOnDemand: true,
            commissionEarned: false,
            commissionAmount: onDemandCommission,
            price: standardPrice,
            paymentReference: res.reference || paymentRef
          };

          await setDoc(doc(db, 'activationCodes', newPinCode), pinData);

          // 2. Increment unused pins in stats
          try {
            await setDoc(doc(db, 'system', 'stats'), {
              totalUnusedPins: increment(1)
            }, { merge: true });
          } catch (e) {}

          // 3. Record in vendor transaction history
          await addDoc(collection(db, 'wallet_transactions'), {
            vendorId: user.uid,
            vendorStudentId: profile?.studentId || '',
            type: 'commission',
            amount: onDemandCommission,
            pinCode: newPinCode,
            reference: res.reference || paymentRef,
            status: 'pending',
            description: `On-Demand Standard PIN generated (#${newPinCode}). ₦${onDemandCommission.toLocaleString()} commission will credit when activated.`,
            createdAt: nowStr
          });

          setGeneratedOnDemandPin(newPinCode);
          setShowOnDemandDialog(false);
          setShowPinSuccessDialog(true);
          onRefresh();
          toast.success("Payment confirmed! Standard PIN generated successfully.");
        } catch (err: any) {
          console.error("Error creating on-demand pin:", err);
          toast.error("Payment succeeded but failed to save PIN. Contact admin with reference: " + (res.reference || paymentRef));
        } finally {
          setOnDemandProcessing(false);
        }
      },
      onCancel: () => {
        setOnDemandProcessing(false);
        toast.info("Paystack payment cancelled by student/vendor.");
      },
      onError: (err: any) => {
        setOnDemandProcessing(false);
        console.error("Paystack Inline error:", err);
        toast.error("Payment error: " + (err.message || 'Payment could not be completed'));
      }
    });
  };

  // --------------------------------------------------------------------------
  // RESTOCK PIN FLOW (Bulk Purchase)
  // --------------------------------------------------------------------------
  const restockTotalPins = restockNumStandard + restockNumPlus;
  const restockTotalCost = (restockNumStandard * bulkStandardPrice) + (restockNumPlus * bulkPlusPrice);
  const restockPotentialRetail = (restockNumStandard * standardPrice) + (restockNumPlus * plusPrice);
  const restockPotentialProfit = restockPotentialRetail - restockTotalCost;

  const handleOpenRestock = () => {
    if (!paystackPublicKey) {
      toast.error("Paystack has not been configured by an Overseer yet. Please contact support.");
      return;
    }
    setRestockNumStandard(5);
    setRestockNumPlus(0);
    setShowRestockDialog(true);
  };

  const handleLaunchRestockPayment = () => {
    if (restockTotalPins < 5) {
      toast.error("Minimum bulk restock purchase is 5 PINs.");
      return;
    }
    if (!paystackPublicKey) {
      toast.error("Paystack public key is not configured.");
      return;
    }

    setRestockProcessing(true);
    const paymentRef = `restock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    PaystackService.openInlinePayment({
      publicKey: paystackPublicKey,
      email: profile?.email || user?.email || 'vendor@colearn.edu',
      amountInNaira: restockTotalCost,
      reference: paymentRef,
      metadata: {
        vendorId: user.uid,
        vendorStudentId: profile?.studentId,
        type: 'bulk_restock',
        numStandard: restockNumStandard,
        numPlus: restockNumPlus,
        totalPins: restockTotalPins,
        totalCost: restockTotalCost
      },
      onSuccess: async (res: PaystackTransactionSuccess) => {
        try {
          const batch = writeBatch(db);
          const generatedList: string[] = [];
          const nowStr = new Date().toISOString();

          // Generate Standard PINs
          for (let i = 0; i < restockNumStandard; i++) {
            const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            generatedList.push(code);
            batch.set(doc(db, 'activationCodes', code), {
              code,
              type: 'standard',
              isUsed: false,
              assignedTo: user.uid,
              assignedToStudentId: profile?.studentId || '',
              assignedToName: profile?.username || 'Vendor',
              createdBy: user.uid,
              createdAt: nowStr,
              owner: profile?.studentId || user.uid,
              At: profile?.At || 'futo',
              isBulkRestocked: true,
              price: bulkStandardPrice,
              paymentReference: res.reference || paymentRef
            });
          }

          // Generate PLUS PINs
          for (let i = 0; i < restockNumPlus; i++) {
            const code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            generatedList.push(code);
            batch.set(doc(db, 'activationCodes', code), {
              code,
              type: 'plus',
              isUsed: false,
              assignedTo: user.uid,
              assignedToStudentId: profile?.studentId || '',
              assignedToName: profile?.username || 'Vendor',
              createdBy: user.uid,
              createdAt: nowStr,
              owner: profile?.studentId || user.uid,
              At: profile?.At || 'futo',
              isBulkRestocked: true,
              price: bulkPlusPrice,
              paymentReference: res.reference || paymentRef
            });
          }

          await batch.commit();

          // Update stats
          try {
            await setDoc(doc(db, 'system', 'stats'), {
              totalUnusedPins: increment(restockTotalPins)
            }, { merge: true });
          } catch (e) {}

          // Record in vendor transaction history
          await addDoc(collection(db, 'wallet_transactions'), {
            vendorId: user.uid,
            vendorStudentId: profile?.studentId || '',
            type: 'bulk_purchase',
            amount: restockTotalCost,
            reference: res.reference || paymentRef,
            status: 'success',
            description: `Bulk restock: purchased ${restockNumStandard} Standard and ${restockNumPlus} PLUS PINs for ₦${restockTotalCost.toLocaleString()}.`,
            createdAt: nowStr
          });

          setRestockedPinsResult(generatedList);
          setShowRestockDialog(false);
          setShowRestockSuccessDialog(true);
          onRefresh();
          toast.success(`Restock Complete! Added ${restockTotalPins} PINs to your inventory.`);
        } catch (err: any) {
          console.error("Error committing restocked pins:", err);
          toast.error("Payment succeeded but saving PINs failed: " + err.message);
        } finally {
          setRestockProcessing(false);
        }
      },
      onCancel: () => {
        setRestockProcessing(false);
        toast.info("Bulk restock payment was cancelled.");
      },
      onError: (err: any) => {
        setRestockProcessing(false);
        console.error("Bulk restock Paystack error:", err);
        toast.error("Payment error: " + (err.message || 'Payment failed'));
      }
    });
  };

  // --------------------------------------------------------------------------
  // WALLET WITHDRAWAL FLOW
  // --------------------------------------------------------------------------
  const handleOpenWithdraw = () => {
    if (!recipientCode) {
      toast.error("Please add and verify your Bank Details in Vendor Settings before requesting a withdrawal.");
      handleOpenSettings();
      return;
    }
    if (walletBalance <= 0) {
      toast.error("Your wallet balance is ₦0. You cannot make a withdrawal at this time.");
      return;
    }
    setWithdrawAmount(walletBalance);
    setShowWithdrawDialog(true);
  };

  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0) {
      toast.error("Please enter a withdrawal amount greater than 0.");
      return;
    }
    if (withdrawAmount > walletBalance) {
      toast.error(`Withdrawal amount (₦${withdrawAmount.toLocaleString()}) exceeds available balance (₦${walletBalance.toLocaleString()}).`);
      return;
    }
    if (!recipientCode) {
      toast.error("Missing Paystack recipient code. Please re-save bank details.");
      return;
    }

    setWithdrawLoading(true);
    try {
      // 1. Trigger Paystack Transfer via backend proxy
      const transferRes = await PaystackService.initiateTransfer(
        withdrawAmount,
        recipientCode,
        "CoLearn Vendor Commission Payout",
        paystackSecretKey
      );

      if (!transferRes.status) {
        throw new Error(transferRes.message || "Transfer initiation failed. Please check balance or bank status.");
      }

      const transferData = transferRes.data || {};
      const nowStr = new Date().toISOString();

      // 2. Deduct from vendor wallet balance and increment totalWithdrawn
      await updateDoc(doc(db, 'users', user.uid), {
        walletBalance: increment(-withdrawAmount),
        totalWithdrawn: increment(withdrawAmount)
      });

      // 3. Record transaction log
      await addDoc(collection(db, 'wallet_transactions'), {
        vendorId: user.uid,
        vendorStudentId: profile?.studentId || '',
        type: 'withdrawal',
        amount: withdrawAmount,
        transferCode: transferData.transfer_code || transferData.reference || 'TRF_' + Date.now(),
        status: 'success',
        description: `Withdrew ₦${withdrawAmount.toLocaleString()} to ${bankName} (${accountNumber})`,
        createdAt: nowStr
      });

      setShowWithdrawDialog(false);
      toast.success(`Withdrawal of ₦${withdrawAmount.toLocaleString()} initiated successfully! Funds will arrive in your bank account.`);
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      toast.error(err.message || "Failed to process withdrawal");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string = 'PIN') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: No PINs (Hero Prompt for On-Demand & Restock) */}
      {myUnusedPins.length === 0 && (
        <Card className="border-amber-400 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/40 font-bold uppercase text-[11px]">
                    No Stock in Account
                  </Badge>
                  <span className="text-xs text-muted-foreground">• Vendor Capital Solutions</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  You currently have no activation PINs in your inventory
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sell to students right now without capital using <strong>On-Demand</strong> (the student pays directly at market price and you earn ₦{onDemandCommission.toLocaleString()} commission upon activation), or <strong>Restock</strong> in bulk at wholesale rates to maximize your profit margin.
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
                <Button 
                  size="lg"
                  onClick={handleOpenOnDemand}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold shadow-md flex items-center justify-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  On-Demand (₦0 Capital)
                </Button>

                <Button 
                  size="lg"
                  variant="outline"
                  onClick={handleOpenRestock}
                  className="w-full sm:w-auto border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 font-bold flex items-center justify-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Restock in Bulk
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Inventory Alert (Less than 3 PINs) */}
      {myUnusedPins.length > 0 && myUnusedPins.length < 3 && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Low Stock Warning: You have only {myUnusedPins.length} PIN{myUnusedPins.length === 1 ? '' : 's'} remaining!
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Restock your inventory now to keep selling smoothly without missing student sales.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenOnDemand}
                className="w-full sm:w-auto text-xs"
              >
                <Zap className="h-3.5 w-3.5 mr-1 text-amber-600" />
                On-Demand
              </Button>
              <Button
                size="sm"
                onClick={handleOpenRestock}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <Package className="h-3.5 w-3.5 mr-1" />
                Restock Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Vendor Financial & Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Available PINs Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Available Pins</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-baseline gap-2">
              <span>{myUnusedPins.length}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({myUnusedPins.filter(p => p.type === 'plus').length} PLUS, {myUnusedPins.filter(p => p.type !== 'plus').length} Std)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active inventory ready for students
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenRestock}
              className="w-full text-xs h-7 gap-1"
            >
              <Package className="h-3 w-3" /> Restock Pins
            </Button>
          </CardFooter>
        </Card>

        {/* 2. Wallet Balance Card */}
        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Wallet Balance</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ₦{walletBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Commission earned from student activations
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              size="sm" 
              onClick={handleOpenWithdraw}
              disabled={walletBalance <= 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 gap-1"
            >
              <ArrowDownLeft className="h-3 w-3" /> Withdraw Funds
            </Button>
          </CardFooter>
        </Card>

        {/* 3. Total Commission Earned Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              ₦{totalEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime commission payouts generated
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Rate: {commissionPercentage}% per activated PIN
            </div>
          </CardFooter>
        </Card>

        {/* 4. Total Withdrawn Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawn</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              ₦{totalWithdrawn.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Transferred to your linked bank account
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleOpenSettings}
              className="w-full text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
            >
              <Settings className="h-3 w-3" /> {recipientCode ? 'Bank Verified' : 'Setup Bank Details'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Vendor Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/30 rounded-xl border">
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={handleOpenOnDemand} 
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-xs"
          >
            <Zap className="h-4 w-4" /> On-Demand PIN (Zero Capital)
          </Button>

          <Button 
            variant="outline" 
            onClick={handleOpenRestock}
            className="border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs h-9 gap-1.5"
          >
            <Package className="h-4 w-4" /> Restock in Bulk (Wholesale)
          </Button>

          <Button 
            variant="outline" 
            onClick={handleOpenWithdraw}
            disabled={walletBalance <= 0}
            className="text-xs h-9 gap-1.5"
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> Withdraw to Bank
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleOpenSettings}
            className="text-xs h-9 gap-1.5"
          >
            <Building className="h-4 w-4 text-primary" />
            {recipientCode ? (
              <span className="flex items-center gap-1">
                <span>{bankName || 'Bank'}: ••••{accountNumber.slice(-4)}</span>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 ml-1" />
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Setup Bank Details
              </span>
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRefresh}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Refresh Inventory"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Vendor Content Tabs: Inventory, Sold History, Transactions Ledger */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="inventory">
            Available PINs ({myUnusedPins.length})
          </TabsTrigger>
          <TabsTrigger value="sold">
            Sold & Activated ({myUsedPins.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Wallet Activity ({transactions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Available Inventory */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-base">Active PIN Inventory</CardTitle>
                <CardDescription>
                  12-digit activation codes in your inventory ready to be given or sold to students.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleOpenOnDemand} className="text-xs h-8 gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-600" /> On-Demand
                </Button>
                <Button size="sm" onClick={handleOpenRestock} className="text-xs h-8 gap-1 bg-primary text-primary-foreground">
                  <Package className="h-3.5 w-3.5" /> Restock
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myUnusedPins.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">No Available Activation PINs</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Use <strong>On-Demand</strong> to generate a PIN instantly for a paying student without upfront cost, or <strong>Restock</strong> in bulk (min 5) to buy at wholesale rates.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button size="sm" onClick={handleOpenOnDemand} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                      <Zap className="h-3.5 w-3.5 mr-1" /> Create On-Demand PIN
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleOpenRestock} className="text-xs">
                      <Package className="h-3.5 w-3.5 mr-1" /> Restock in Bulk
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myUnusedPins.map((pin) => (
                    <div 
                      key={pin.id || pin.code}
                      className="p-3.5 rounded-xl border bg-card/60 hover:bg-card transition-all flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant={pin.type === 'plus' ? 'default' : 'secondary'} 
                            className="text-[10px] font-bold tracking-wider"
                          >
                            {pin.type === 'plus' ? 'PLUS GRADE' : 'STANDARD GRADE'}
                          </Badge>
                          {pin.isOnDemand && (
                            <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 font-semibold">
                              ON-DEMAND (AWAITING ACTIVATION)
                            </Badge>
                          )}
                          {pin.isBulkRestocked && (
                            <Badge variant="outline" className="text-[9px] border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                              WHOLESALE RESTOCK
                            </Badge>
                          )}
                        </div>

                        <div className="pt-1">
                          <code className="text-lg font-mono font-bold tracking-wider text-foreground select-all">
                            {pin.code}
                          </code>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          Created on {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-muted/60 text-xs">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Retail: ₦{(pin.type === 'plus' ? plusPrice : standardPrice).toLocaleString()}
                        </span>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => copyToClipboard(pin.code)} 
                          className="h-7 text-xs px-2.5 gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Sold & Activated History */}
        <TabsContent value="sold" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sold & Activated PINs History</CardTitle>
              <CardDescription>
                Records of activation codes redeemed by students through your vendor portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myUsedPins.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No activation pins have been redeemed yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] uppercase bg-muted/40 text-muted-foreground border-b">
                      <tr>
                        <th className="px-3 py-2.5">PIN Code</th>
                        <th className="px-3 py-2.5">Grade</th>
                        <th className="px-3 py-2.5">Origin / Channel</th>
                        <th className="px-3 py-2.5">Used By Student ID</th>
                        <th className="px-3 py-2.5">Activation Date</th>
                        <th className="px-3 py-2.5 text-right">Commission Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {myUsedPins.map((pin) => (
                        <tr key={pin.id || pin.code} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5 font-mono font-bold">{pin.code}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={pin.type === 'plus' ? 'default' : 'secondary'} className="text-[10px]">
                              {pin.type === 'plus' ? 'PLUS' : 'STANDARD'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            {pin.isOnDemand ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">On-Demand</span>
                            ) : pin.isBulkRestocked ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Bulk Restock</span>
                            ) : (
                              <span className="text-muted-foreground">Standard Transfer</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono">{pin.usedByStudentId || 'N/A'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {pin.usedAt ? new Date(pin.usedAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {pin.isOnDemand ? (
                              pin.commissionEarned ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  +₦{(pin.commissionAmount || onDemandCommission).toLocaleString()} Credited
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 text-[10px]">
                                  Processing
                                </Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Direct Retail Profit</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Wallet Transactions */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Wallet Ledger & Payout History</CardTitle>
                <CardDescription>
                  Complete audit trail of earned commissions, bulk inventory restocks, and bank withdrawals.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOpenWithdraw}
                disabled={walletBalance <= 0}
                className="text-xs h-8"
              >
                <ArrowDownLeft className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Request Withdrawal
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading wallet transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] uppercase bg-muted/40 text-muted-foreground border-b">
                      <tr>
                        <th className="px-3 py-2.5">Date & Time</th>
                        <th className="px-3 py-2.5">Transaction Type</th>
                        <th className="px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5">Reference / PIN</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-3 py-2.5">
                            {tx.type === 'commission' && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Commission
                              </Badge>
                            )}
                            {tx.type === 'withdrawal' && (
                              <Badge variant="outline" className="border-indigo-500 text-indigo-600 text-[10px]">
                                Bank Payout
                              </Badge>
                            )}
                            {tx.type === 'bulk_purchase' && (
                              <Badge variant="secondary" className="text-[10px]">
                                Bulk Restock
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 max-w-xs truncate">{tx.description}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">{tx.pinCode || tx.transferCode || tx.reference || '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {tx.type === 'commission' ? (
                              <span className="text-emerald-600">+₦{tx.amount.toLocaleString()}</span>
                            ) : tx.type === 'withdrawal' ? (
                              <span className="text-indigo-600">-₦{tx.amount.toLocaleString()}</span>
                            ) : (
                              <span className="text-foreground">₦{tx.amount.toLocaleString()}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* 1. VENDOR SETTINGS MODAL: BANK DETAILS & RECIPIENT CODE                 */}
      {/* ========================================================================= */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Vendor Payout Settings (Bank Details)
            </DialogTitle>
            <DialogDescription>
              Link your Nigerian bank account to automatically receive payouts when you withdraw your commission balance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBankSettings} className="space-y-4 py-2">
            {/* Search Bank */}
            <div className="space-y-2">
              <Label htmlFor="bankSearch">Select Bank</Label>
              <div className="relative">
                <Input
                  id="bankSearch"
                  placeholder="Type to filter banks (e.g. Zenith, Access, OPay, Palmpay)..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="pr-8 text-xs"
                />
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-3" />
              </div>

              <div className="max-h-36 overflow-y-auto border rounded-lg p-1.5 space-y-1 bg-background text-xs">
                {loadingBanks ? (
                  <p className="p-2 text-center text-muted-foreground flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading banks...
                  </p>
                ) : filteredBanks.length === 0 ? (
                  <p className="p-2 text-center text-muted-foreground">No bank found matching "{bankSearch}"</p>
                ) : (
                  filteredBanks.slice(0, 50).map((b) => (
                    <button
                      type="button"
                      key={b.id || b.code}
                      onClick={() => {
                        setTempBankCode(b.code);
                        setTempBankName(b.name);
                        setTempAccountName(''); // reset resolved name when bank changes
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs transition-colors ${
                        tempBankCode === b.code 
                          ? 'bg-primary text-primary-foreground font-semibold' 
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span>{b.name}</span>
                      {tempBankCode === b.code && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))
                )}
              </div>
              {tempBankName && (
                <p className="text-xs text-primary font-medium flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Selected: <strong>{tempBankName}</strong> (Code: {tempBankCode})
                </p>
              )}
            </div>

            {/* Account Number & Verify */}
            <div className="space-y-2">
              <Label htmlFor="accountNum">10-Digit NUBAN Account Number</Label>
              <div className="flex gap-2">
                <Input
                  id="accountNum"
                  maxLength={10}
                  placeholder="e.g. 0123456789"
                  value={tempAccountNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setTempAccountNumber(clean);
                    setTempAccountName(''); // reset when number changes
                  }}
                  className="font-mono text-sm tracking-wider"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResolveAccount}
                  disabled={resolvingAccount || tempAccountNumber.length !== 10 || !tempBankCode}
                  className="shrink-0 text-xs"
                >
                  {resolvingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Verify Account
                </Button>
              </div>
            </div>

            {/* Account Name Display */}
            {tempAccountName && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg space-y-1">
                <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Verified Account Name
                </span>
                <p className="font-bold text-sm text-emerald-950 dark:text-emerald-100 font-mono">
                  {tempAccountName}
                </p>
              </div>
            )}

            {recipientCode && (
              <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t pt-2">
                <span>Active Paystack Recipient Code:</span>
                <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{recipientCode}</code>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={savingSettings || !tempAccountName || tempAccountNumber.length !== 10 || !tempBankCode}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Bank Details & Generate Recipient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. ON-DEMAND MODAL                                                        */}
      {/* ========================================================================= */}
      <Dialog open={showOnDemandDialog} onOpenChange={setShowOnDemandDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Zap className="h-5 w-5" />
              Generate Standard PIN (On-Demand)
            </DialogTitle>
            <DialogDescription>
              Sell immediately with zero upfront capital. Have the student pay directly at retail price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">PIN Grade:</span>
                <Badge variant="secondary" className="font-bold">STANDARD ACCESS</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Student Pays:</span>
                <span className="font-bold text-base text-foreground">₦{standardPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t pt-1.5">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Your Commission ({commissionPercentage}%):
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  +₦{onDemandCommission.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 leading-snug">
                * Note: PLUS PINs are not supported for On-Demand. Your ₦{onDemandCommission.toLocaleString()} commission is automatically credited to your wallet as soon as the student activates the PIN.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentEmailInput">Student Email (Receipt will be sent here)</Label>
              <Input
                id="studentEmailInput"
                type="email"
                placeholder="student@example.com"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Paystack will email the student their payment receipt.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnDemandDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLaunchOnDemandPayment}
              disabled={onDemandProcessing || !studentEmail.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {onDemandProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
              Student Pay ₦{standardPrice.toLocaleString()} via Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ON-DEMAND CELEBRATION POPUP                                               */}
      {/* ========================================================================= */}
      <Dialog open={showPinSuccessDialog} onOpenChange={setShowPinSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
              Payment Received! PIN Generated
            </DialogTitle>
            <DialogDescription>
              Payment confirmed via Paystack. Give this Standard PIN to the student now.
            </DialogDescription>
          </DialogHeader>

          {generatedOnDemandPin && (
            <div className="space-y-4 py-4 text-center">
              <div className="p-4 bg-muted/60 border rounded-xl space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground block font-semibold">
                  Standard 12-Digit Activation PIN
                </span>
                <div className="text-3xl font-mono font-black tracking-widest text-primary select-all">
                  {generatedOnDemandPin}
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(generatedOnDemandPin)} 
                  className="mt-2 text-xs gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Code
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 text-left space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-emerald-600" />
                  Commission Tracking Active
                </p>
                <p className="text-[11px] leading-relaxed">
                  As soon as the student enters this PIN in the <strong>Activate Account</strong> dialog (on web or mobile), your <strong>₦{onDemandCommission.toLocaleString()}</strong> commission will instantly deposit into your wallet balance.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowPinSuccessDialog(false)} className="w-full">
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. RESTOCK IN BULK MODAL                                                  */}
      {/* ========================================================================= */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Package className="h-5 w-5" />
              Restock PIN Inventory in Bulk
            </DialogTitle>
            <DialogDescription>
              Buy PINs in bulk (minimum 5) at wholesale discount so you can sell directly to students at retail price and keep 100% of the profit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Wholesale Prices Card */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                <span className="font-semibold text-muted-foreground block">Standard Wholesale</span>
                <p className="text-lg font-bold text-foreground">₦{bulkStandardPrice.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ pin</span></p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Retail: ₦{standardPrice.toLocaleString()} (Profit: ₦{(standardPrice - bulkStandardPrice).toLocaleString()})</p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                <span className="font-semibold text-muted-foreground block">PLUS Wholesale</span>
                <p className="text-lg font-bold text-foreground">₦{bulkPlusPrice.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ pin</span></p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Retail: ₦{plusPrice.toLocaleString()} (Profit: ₦{(plusPrice - bulkPlusPrice).toLocaleString()})</p>
              </div>
            </div>

            {/* Quantity Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="standardQty">Number of Standard PINs</Label>
                <Input
                  id="standardQty"
                  type="number"
                  min="0"
                  value={restockNumStandard}
                  onChange={(e) => setRestockNumStandard(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plusQty">Number of PLUS PINs</Label>
                <Input
                  id="plusQty"
                  type="number"
                  min="0"
                  value={restockNumPlus}
                  onChange={(e) => setRestockNumPlus(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                />
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-4 rounded-xl border bg-muted/50 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span>Total PINs Ordered:</span>
                <span className="font-bold text-sm">{restockTotalPins} PINs {restockTotalPins < 5 && <span className="text-rose-600 text-xs font-normal">(Min. 5 required)</span>}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Order Cost (Wholesale):</span>
                <span className="font-bold text-base text-primary">₦{restockTotalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Expected Profit on Resale:</span>
                <span>+₦{restockPotentialProfit.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 italic">
                * Note: No commission is earned through bulk purchases as you are buying at wholesale discount and keep all cash directly from students.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLaunchRestockPayment}
              disabled={restockProcessing || restockTotalPins < 5}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {restockProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Package className="h-4 w-4 mr-1.5" />}
              Pay ₦{restockTotalCost.toLocaleString()} via Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESTOCK SUCCESS DIALOG */}
      <Dialog open={showRestockSuccessDialog} onOpenChange={setShowRestockSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
              Restock Successful!
            </DialogTitle>
            <DialogDescription>
              {restockedPinsResult.length} activation PINs have been generated and added to your inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              You can now view, copy, and distribute these codes to students directly from your <strong>Available PINs</strong> tab.
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 font-mono text-xs space-y-1 bg-muted/40">
              {restockedPinsResult.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-0.5">
                  <span>{c}</span>
                  <button type="button" onClick={() => copyToClipboard(c)} className="text-primary hover:underline text-[11px]">Copy</button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowRestockSuccessDialog(false)} className="w-full">
              Close & View Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. WITHDRAWAL MODAL                                                       */}
      {/* ========================================================================= */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <ArrowDownLeft className="h-5 w-5" />
              Withdraw Commission Balance
            </DialogTitle>
            <DialogDescription>
              Transfer your earned commission directly to your verified bank account via Paystack.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteWithdrawal} className="space-y-4 py-2">
            <div className="p-3 rounded-lg border bg-muted/50 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available to Withdraw:</span>
                <span className="font-bold text-foreground">₦{walletBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination Bank:</span>
                <span className="font-semibold text-foreground">{bankName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Holder:</span>
                <span className="font-mono text-foreground">{accountName || 'N/A'} ({accountNumber || '—'})</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="withdrawAmt">Amount (₦)</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setWithdrawAmount(walletBalance)}
                  className="text-xs h-6 px-1.5 text-primary"
                >
                  Quick Max
                </Button>
              </div>
              <Input
                id="withdrawAmt"
                type="number"
                min="100"
                max={walletBalance}
                value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(parseInt(e.target.value) || 0)}
                placeholder="Enter amount to withdraw"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowWithdrawDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={withdrawLoading || withdrawAmount <= 0 || withdrawAmount > walletBalance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowDownLeft className="h-4 w-4 mr-1.5" />}
                Transfer ₦{withdrawAmount.toLocaleString()} to Bank
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
