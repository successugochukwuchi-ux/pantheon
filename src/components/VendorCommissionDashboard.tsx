import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActivationCode } from '../types';
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
  Package, 
  RefreshCw, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Loader2, 
  Building2, 
  CreditCard, 
  ArrowRight, 
  FileText, 
  Sparkles,
  ShieldCheck,
  Download,
  Key
} from 'lucide-react';
import { TakanoPayService, RestockOrderResult } from '../services/takanoPayService';

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
  // Pricing from systemConfig
  const standardPrice = systemConfig?.standardPrice ?? 1000;
  const plusPrice = systemConfig?.plusPrice ?? 2000;

  // Vendor's assigned pins
  const myUnusedPins = useMemo(() => {
    return unusedPins.filter(p => p.assignedTo === user?.uid || p.owner === profile?.studentId);
  }, [unusedPins, user?.uid, profile?.studentId]);

  const myUsedPins = useMemo(() => {
    return usedPins.filter(p => p.assignedTo === user?.uid || p.owner === profile?.studentId);
  }, [usedPins, user?.uid, profile?.studentId]);

  // Dialog States
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Restock Form State
  const [restockNumStandard, setRestockNumStandard] = useState(5);
  const [restockNumPlus, setRestockNumPlus] = useState(0);
  const [orderCreating, setOrderCreating] = useState(false);

  // Active Takano Order State
  const [activeOrder, setActiveOrder] = useState<RestockOrderResult | null>(null);
  const [bankDetails, setBankDetails] = useState<{ bankName: string; accountNumber: string; accountName: string }>({
    bankName: 'PalmPay',
    accountNumber: '8123456789',
    accountName: 'Takano Activation Pins Ltd'
  });
  const [orderPolling, setOrderPolling] = useState(false);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(15 * 60);
  const [isCopiedAccount, setIsCopiedAccount] = useState(false);
  const [isCopiedAmount, setIsCopiedAmount] = useState(false);
  const [copiedPinCode, setCopiedPinCode] = useState<string | null>(null);

  // Fulfilled Order Result
  const [dispensedPins, setDispensedPins] = useState<{ code: string; type: 'standard' | 'plus' }[]>([]);

  // Search & Filter in Inventory
  const [pinSearch, setPinSearch] = useState('');
  const [pinTypeFilter, setPinTypeFilter] = useState<'all' | 'standard' | 'plus'>('all');
  const [usedSearch, setUsedSearch] = useState('');

  // --------------------------------------------------------------------------
  // RESTOCK PRICING CALCULATIONS
  // Rule: 1 to 4 pins: 60% of retail. 5+ pins: 50% of retail.
  // --------------------------------------------------------------------------
  const totalRestockPins = (Number(restockNumStandard) || 0) + (Number(restockNumPlus) || 0);
  const discountRatePercent = totalRestockPins >= 5 ? 50 : 60;
  const standardCostPerPin = Math.round(standardPrice * (discountRatePercent / 100));
  const plusCostPerPin = Math.round(plusPrice * (discountRatePercent / 100));
  const estimatedSubtotal = ((Number(restockNumStandard) || 0) * standardCostPerPin) + 
                            ((Number(restockNumPlus) || 0) * plusCostPerPin);
  const retailValue = ((Number(restockNumStandard) || 0) * standardPrice) + 
                      ((Number(restockNumPlus) || 0) * plusPrice);
  const estimatedProfit = retailValue - estimatedSubtotal;

  // Timer countdown for checkout modal
  useEffect(() => {
    let timer: any = null;
    if (showCheckoutModal && activeOrder && activeOrder.status === 'PENDING') {
      const expiresAtMs = new Date(activeOrder.expiresAt).getTime();
      const updateTimer = () => {
        const diff = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
        setTimeRemainingSeconds(diff);
        if (diff <= 0) {
          handleOrderExpired();
        }
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showCheckoutModal, activeOrder]);

  // Polling order status every 4 seconds while checkout modal is open
  useEffect(() => {
    let pollInterval: any = null;
    if (showCheckoutModal && activeOrder && activeOrder.status === 'PENDING') {
      pollInterval = setInterval(async () => {
        try {
          const res = await TakanoPayService.getOrderStatus(activeOrder.id);
          if (res.success && res.order) {
            if (res.order.status === 'PAID') {
              handleOrderPaid(res.order);
            } else if (res.order.status === 'EXPIRED') {
              handleOrderExpired();
            }
          }
        } catch (err) {
          // ignore transient poll errors
        }
      }, 4000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [showCheckoutModal, activeOrder]);

  const handleOrderPaid = (paidOrder: RestockOrderResult) => {
    setActiveOrder(paidOrder);
    setDispensedPins(paidOrder.pins || []);
    setShowCheckoutModal(false);
    setShowSuccessModal(true);
    onRefresh();
    toast.success(`Payment Confirmed! Generated ${paidOrder.pins?.length || paidOrder.totalPins} Activation PINs.`);
  };

  const handleOrderExpired = () => {
    toast.error("Checkout reservation has expired. Please initiate a new restock order.");
    setShowCheckoutModal(false);
    setActiveOrder(null);
  };

  const handleOpenRestock = () => {
    setRestockNumStandard(5);
    setRestockNumPlus(0);
    setShowRestockModal(true);
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalRestockPins < 1) {
      toast.error("Please enter at least 1 PIN to restock.");
      return;
    }

    setOrderCreating(true);
    try {
      const res = await TakanoPayService.createRestockOrder({
        vendorId: user?.uid || profile?.studentId || 'vendor',
        vendorStudentId: profile?.studentId || user?.uid || '',
        vendorName: profile?.username || profile?.displayName || 'Vendor',
        numStandard: Number(restockNumStandard) || 0,
        numPlus: Number(restockNumPlus) || 0,
        university: profile?.At || 'futo'
      });

      if (!res.success || !res.order) {
        throw new Error(res.error || "Failed to create restock order");
      }

      setActiveOrder(res.order);
      if (res.bankDetails) {
        setBankDetails(res.bankDetails);
      }
      setShowRestockModal(false);
      setShowCheckoutModal(true);
    } catch (err: any) {
      console.error("Restock order creation error:", err);
      toast.error(err.message || "Failed to initialize payment slot.");
    } finally {
      setOrderCreating(false);
    }
  };

  const handleCheckStatusManual = async () => {
    if (!activeOrder) return;
    setOrderPolling(true);
    try {
      const res = await TakanoPayService.getOrderStatus(activeOrder.id);
      if (res.success && res.order) {
        if (res.order.status === 'PAID') {
          handleOrderPaid(res.order);
        } else {
          toast.info("Still waiting for transfer alert. Banks usually take 10-30 seconds to deliver alerts.");
        }
      }
    } catch (err: any) {
      toast.error("Status check failed: " + err.message);
    } finally {
      setOrderPolling(false);
    }
  };

  const handleCancelActiveOrder = async () => {
    if (!activeOrder) return;
    try {
      await TakanoPayService.cancelOrder(activeOrder.id);
      toast.info("Order cancelled. Reserved slot released.");
    } catch (err) {}
    setShowCheckoutModal(false);
    setActiveOrder(null);
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(bankDetails.accountNumber);
    setIsCopiedAccount(true);
    toast.success("Account number copied!");
    setTimeout(() => setIsCopiedAccount(false), 2000);
  };

  const handleCopyAmount = () => {
    if (!activeOrder) return;
    navigator.clipboard.writeText(activeOrder.exactPayableAmount.toFixed(2));
    setIsCopiedAmount(true);
    toast.success(`Copied amount ₦${activeOrder.exactPayableAmount.toFixed(2)} to clipboard!`);
    setTimeout(() => setIsCopiedAmount(false), 2000);
  };

  const handleCopySinglePin = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPinCode(code);
    toast.success(`Copied PIN: ${code}`);
    setTimeout(() => setCopiedPinCode(null), 2000);
  };

  const handleCopyAllDispensedPins = () => {
    const text = dispensedPins.map(p => `${p.code} (${p.type.toUpperCase()})`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Copied all generated PINs to clipboard!");
  };

  const handleDownloadDispensedPins = () => {
    const text = `COLEARN / TAKANO PAY ACTIVATION PINS\n` +
                 `Order ID: ${activeOrder?.id || ''}\n` +
                 `Date: ${new Date().toLocaleString()}\n` +
                 `Total: ${dispensedPins.length} PINs\n\n` +
                 dispensedPins.map((p, i) => `${i + 1}. ${p.code} - ${p.type.toUpperCase()}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CoLearn_Pins_${activeOrder?.id || 'restock'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAvailablePins = () => {
    if (myUnusedPins.length === 0) {
      toast.error("No available PINs to export.");
      return;
    }
    const text = `COLEARN ACTIVATION PINS INVENTORY\n` +
                 `Exported: ${new Date().toLocaleString()}\n` +
                 `Total Available: ${myUnusedPins.length}\n\n` +
                 myUnusedPins.map((p, i) => `${i + 1}. ${p.code} - ${(p.type || 'standard').toUpperCase()}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CoLearn_Available_Pins_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered PINs
  const filteredUnusedPins = useMemo(() => {
    return myUnusedPins.filter(pin => {
      if (pinTypeFilter === 'standard' && pin.type === 'plus') return false;
      if (pinTypeFilter === 'plus' && pin.type !== 'plus') return false;
      if (pinSearch.trim()) {
        const q = pinSearch.toLowerCase();
        return pin.code?.toLowerCase().includes(q) || pin.type?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [myUnusedPins, pinSearch, pinTypeFilter]);

  const filteredUsedPins = useMemo(() => {
    return myUsedPins.filter(pin => {
      if (!usedSearch.trim()) return true;
      const q = usedSearch.toLowerCase();
      return (
        pin.code?.toLowerCase().includes(q) ||
        pin.usedByStudentId?.toLowerCase().includes(q) ||
        pin.type?.toLowerCase().includes(q)
      );
    });
  }, [myUsedPins, usedSearch]);

  const minutesLeft = Math.floor(timeRemainingSeconds / 60);
  const secondsLeft = timeRemainingSeconds % 60;
  const timeFormatted = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header Banner */}
      <div className="p-5 rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-background to-emerald-500/10 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                <Package className="h-6 w-6 text-primary" /> Vendor Restock & PIN Inventory
              </h2>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[10px] font-bold">
                Takano Pay Engine
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Restock activation PINs via automated direct bank transfer. 
              Enjoy <strong>60% of retail</strong> for 1–4 PINs, or <strong>50% wholesale</strong> for 5+ PINs. Instant automated dispensation upon transfer detection.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh} 
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Inventory
            </Button>
            <Button 
              size="sm" 
              onClick={handleOpenRestock} 
              className="text-xs h-9 font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <Package className="h-4 w-4" /> Restock PINs
            </Button>
          </div>
        </div>

        {/* Wholesale Rates Notice */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl border bg-card/60 backdrop-blur-xs flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 1 to 4 PINs Tier (60% of Retail)
              </div>
              <div className="text-muted-foreground text-[11px] mt-0.5">
                Standard: <strong>₦{Math.round(standardPrice * 0.6).toLocaleString()}</strong> | PLUS: <strong>₦{Math.round(plusPrice * 0.6).toLocaleString()}</strong>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">40% Profit</Badge>
          </div>

          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xs flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> 5+ Bulk Restock (50% Wholesale)
              </div>
              <div className="text-muted-foreground text-[11px] mt-0.5">
                Standard: <strong>₦{Math.round(standardPrice * 0.5).toLocaleString()}</strong> | PLUS: <strong>₦{Math.round(plusPrice * 0.5).toLocaleString()}</strong>
              </div>
            </div>
            <Badge variant="default" className="bg-emerald-600 text-[10px] font-bold">50% Profit (Max)</Badge>
          </div>
        </div>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Total Available PINs */}
        <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Available PINs</span>
            <Package className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {myUnusedPins.length}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t">
            <span>Ready to sell</span>
            <button type="button" onClick={handleOpenRestock} className="text-primary hover:underline font-semibold">Restock</button>
          </div>
        </div>

        {/* Standard PINs in Stock */}
        <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Standard PINs</span>
            <Key className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {myUnusedPins.filter(p => p.type !== 'plus').length}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t">
            <span>Retail value: ₦{standardPrice.toLocaleString()}</span>
          </div>
        </div>

        {/* PLUS PINs in Stock */}
        <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">PLUS PINs</span>
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
            {myUnusedPins.filter(p => p.type === 'plus').length}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t">
            <span>Retail value: ₦{plusPrice.toLocaleString()}</span>
          </div>
        </div>

        {/* Redeemed PINs */}
        <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Redeemed / Sold</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {myUsedPins.length}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t">
            <span>Successfully activated</span>
          </div>
        </div>
      </div>

      {/* 3. Inventory Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="inventory" className="text-xs font-semibold px-3 py-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
              Available PINs ({myUnusedPins.length})
            </TabsTrigger>
            <TabsTrigger value="sold" className="text-xs font-semibold px-3 py-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs">
              Redeemed History ({myUsedPins.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportAvailablePins} 
              disabled={myUnusedPins.length === 0}
              className="text-xs h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export Available PINs (.txt)
            </Button>
          </div>
        </div>

        {/* TAB 1: ACTIVE INVENTORY */}
        <TabsContent value="inventory" className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search PIN codes..."
                value={pinSearch}
                onChange={(e) => setPinSearch(e.target.value)}
                className="pl-9 h-8 text-xs font-mono"
              />
              {pinSearch && (
                <button 
                  type="button" 
                  onClick={() => setPinSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setPinTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  pinTypeFilter === 'all' 
                    ? 'bg-primary text-primary-foreground font-semibold' 
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
              >
                All ({myUnusedPins.length})
              </button>
              <button
                type="button"
                onClick={() => setPinTypeFilter('standard')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  pinTypeFilter === 'standard' 
                    ? 'bg-primary text-primary-foreground font-semibold' 
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setPinTypeFilter('plus')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  pinTypeFilter === 'plus' 
                    ? 'bg-primary text-primary-foreground font-semibold' 
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
              >
                PLUS
              </button>
            </div>
          </div>

          {filteredUnusedPins.length === 0 ? (
            <div className="p-10 border border-dashed rounded-xl text-center space-y-3 bg-muted/20">
              <Package className="h-9 w-9 text-muted-foreground/40 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  {pinSearch || pinTypeFilter !== 'all' ? 'No PINs match your search' : 'No PINs in Stock'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {pinSearch || pinTypeFilter !== 'all' 
                    ? 'Try clearing the search query or changing your filter criteria.'
                    : 'Restock your inventory now to get instant PINs at discounted rates.'}
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" onClick={handleOpenRestock} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 font-bold">
                  <Package className="h-3.5 w-3.5" /> Restock PINs Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredUnusedPins.map((pin) => (
                <div 
                  key={pin.code} 
                  className="p-3.5 rounded-xl border bg-card hover:border-primary/40 transition-all flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={pin.type === 'plus' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                      {pin.type === 'plus' ? 'PLUS PIN' : 'STANDARD'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Unused</span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-base font-extrabold tracking-widest text-foreground">
                      {pin.code}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Added: {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : 'Active'}
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleCopySinglePin(pin.code)}
                    className="w-full h-7 text-xs font-semibold gap-1.5"
                  >
                    {copiedPinCode === pin.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedPinCode === pin.code ? 'Copied' : 'Copy PIN'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: REDEEMED / SOLD HISTORY */}
        <TabsContent value="sold" className="space-y-4 pt-1">
          <div className="relative max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search redeemed PINs or student IDs..."
              value={usedSearch}
              onChange={(e) => setUsedSearch(e.target.value)}
              className="pl-9 h-8 text-xs font-mono"
            />
          </div>

          {filteredUsedPins.length === 0 ? (
            <div className="p-8 border border-dashed rounded-xl text-center text-xs text-muted-foreground italic">
              No redeemed PINs found.
            </div>
          ) : (
            <div className="border rounded-xl divide-y bg-card overflow-hidden">
              {filteredUsedPins.map((pin) => (
                <div key={pin.code} className="p-3 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="space-y-0.5">
                    <div className="font-mono font-bold text-foreground flex items-center gap-2">
                      <span>{pin.code}</span>
                      <Badge variant={pin.type === 'plus' ? 'default' : 'outline'} className="text-[9px] py-0 px-1.5">
                        {pin.type === 'plus' ? 'PLUS' : 'STD'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Activated by: <strong className="text-foreground">{pin.usedByStudentId || pin.usedBy || 'Student'}</strong>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1 text-emerald-600 font-semibold justify-end">
                      <CheckCircle2 className="h-3 w-3" /> Activated
                    </div>
                    {pin.usedAt && <span>{new Date(pin.usedAt).toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===================================================================== */}
      {/* RESTOCK CONFIGURATION DIALOG                                          */}
      {/* ===================================================================== */}
      <Dialog open={showRestockModal} onOpenChange={setShowRestockModal}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Package className="h-5 w-5" /> Restock PIN Inventory
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Select any number of PINs. <strong>1–4 PINs</strong> are discounted at 60% of retail; <strong>5+ PINs</strong> qualify for 50% wholesale pricing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleProceedToPayment} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="numStd" className="text-xs font-semibold">Standard PINs</Label>
                <Input 
                  id="numStd"
                  type="number"
                  min="0"
                  value={restockNumStandard}
                  onChange={(e) => setRestockNumStandard(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-sm font-semibold"
                />
                <p className="text-[10px] text-muted-foreground">Retail: ₦{standardPrice.toLocaleString()}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numPlus" className="text-xs font-semibold">PLUS PINs</Label>
                <Input 
                  id="numPlus"
                  type="number"
                  min="0"
                  value={restockNumPlus}
                  onChange={(e) => setRestockNumPlus(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-sm font-semibold"
                />
                <p className="text-[10px] text-muted-foreground">Retail: ₦{plusPrice.toLocaleString()}</p>
              </div>
            </div>

            {/* Dynamic Price Summary Card */}
            <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Total PINs:</span>
                <span className="font-bold text-foreground">{totalRestockPins} PIN{totalRestockPins !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Discount Applied:</span>
                <Badge variant={discountRatePercent === 50 ? 'default' : 'secondary'} className={discountRatePercent === 50 ? 'bg-emerald-600 text-white' : ''}>
                  {discountRatePercent}% of Retail ({100 - discountRatePercent}% off)
                </Badge>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground">Cost per Standard PIN:</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">₦{standardCostPerPin.toLocaleString()}</span>
              </div>

              {restockNumPlus > 0 && (
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-muted-foreground">Cost per PLUS PIN:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">₦{plusCostPerPin.toLocaleString()}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-sm font-extrabold text-foreground">
                <span>Estimated Subtotal:</span>
                <span className="text-emerald-600 font-mono">₦{estimatedSubtotal.toLocaleString()}</span>
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                <span>Retail Value: ₦{retailValue.toLocaleString()}</span>
                <span className="text-emerald-600 font-semibold">Your Profit: +₦{estimatedProfit.toLocaleString()}</span>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRestockModal(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={orderCreating || totalRestockPins < 1} 
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
              >
                {orderCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {orderCreating ? 'Reserving Slot...' : 'Proceed to Transfer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* TAKANO PAY TRANSFER CHECKOUT MODAL                                    */}
      {/* ===================================================================== */}
      <Dialog open={showCheckoutModal} onOpenChange={(open) => { if (!open) handleCancelActiveOrder(); }}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Building2 className="h-5 w-5" /> Bank Transfer Checkout
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-3 w-3 mr-1" /> {timeFormatted}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Order #{activeOrder?.id || ''} for {activeOrder?.totalPins} Activation PINs
            </DialogDescription>
          </DialogHeader>

          {activeOrder && (
            <div className="space-y-4 pt-2">
              {/* EXACT AMOUNT HIGHLIGHT BANNER */}
              <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-center space-y-1 shadow-xs">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Transfer EXACT Amount Including Kobo Cents
                </div>
                <div className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                  <span>₦{activeOrder.exactPayableAmount.toFixed(2)}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={handleCopyAmount}
                    className="h-8 w-8 text-amber-700 hover:bg-amber-200/50"
                    title="Copy Exact Amount"
                  >
                    {isCopiedAmount ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  Dynamic Kobo Slot: <strong>₦{activeOrder.koboSlot.toFixed(2)}</strong>. Do NOT round up to ₦{Math.ceil(activeOrder.exactPayableAmount).toLocaleString()}!
                </p>
              </div>

              {/* BANK DETAILS CARD */}
              <div className="p-4 rounded-xl border bg-card space-y-3 text-xs shadow-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold">Bank Name:</span>
                  <span className="font-bold text-foreground text-sm">{bankDetails.bankName}</span>
                </div>

                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground font-semibold">Account Number:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground text-sm tracking-wider">
                      {bankDetails.accountNumber}
                    </span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleCopyAccount}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    >
                      {isCopiedAccount ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Account Name:</span>
                  <span className="font-medium text-foreground text-right">{bankDetails.accountName}</span>
                </div>
              </div>

              {/* LIVE POLLING STATUS */}
              <div className="p-3 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-teal-600 animate-spin shrink-0" />
                  <span className="text-teal-900 dark:text-teal-200 font-medium">
                    Waiting for bank transfer alert...
                  </span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCheckStatusManual}
                  disabled={orderPolling}
                  className="h-7 text-[11px] border-teal-300 text-teal-700 hover:bg-teal-100"
                >
                  {orderPolling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Check Status'}
                </Button>
              </div>

              <div className="text-[11px] text-muted-foreground text-center">
                Once your transfer is received by the bank, our IMAP daemon verifies the amount and dispenses your PINs instantly.
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={handleCancelActiveOrder} className="w-full sm:w-auto text-xs text-muted-foreground">
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* RESTOCK SUCCESS / PIN DISPENSATION MODAL                              */}
      {/* ===================================================================== */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-lg w-full p-6">
          <DialogHeader className="pb-3 border-b text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-foreground">
              Payment Confirmed & PINs Dispensed!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Successfully generated <strong>{dispensedPins.length} activation PIN{dispensedPins.length !== 1 ? 's' : ''}</strong> and added them to your inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Generated Codes:</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={handleCopyAllDispensedPins} className="h-7 text-xs gap-1">
                  <Copy className="h-3 w-3" /> Copy All
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadDispensedPins} className="h-7 text-xs gap-1">
                  <Download className="h-3 w-3" /> Download TXT
                </Button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 border rounded-xl p-3 bg-muted/30">
              {dispensedPins.map((pin, index) => (
                <div key={pin.code} className="p-2 rounded-lg bg-background border flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px]">{index + 1}.</span>
                    <span className="font-extrabold tracking-wider text-foreground">{pin.code}</span>
                    <Badge variant={pin.type === 'plus' ? 'default' : 'secondary'} className="text-[9px] py-0 px-1.5 font-sans">
                      {pin.type.toUpperCase()}
                    </Badge>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleCopySinglePin(pin.code)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    {copiedPinCode === pin.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button onClick={() => setShowSuccessModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Done & View Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
