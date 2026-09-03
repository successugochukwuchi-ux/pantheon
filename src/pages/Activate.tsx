import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, writeBatch, collection, query, where, getDocs, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { MessageCircle, Gift, Info, Star } from 'lucide-react';
import { sendTelegramAlert } from '../services/telegramService';
import { getContactWhatsAppNumber } from '../services/credentialService';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../components/ui/dialog';

export default function Activate() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPromoSuccess, setShowPromoSuccess] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);
  const { user, profile, promoConfig, systemConfig } = useAuth();
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState('2348118429150');

  useEffect(() => {
    getContactWhatsAppNumber(profile?.At).then(num => {
      setWhatsappNumber(num);
    });
  }, [profile?.At]);

  const handlePromoActivate = async () => {
    if (!user || !promoConfig?.isActive) return;
    
    setLoading(true);
    try {
      // 1. Check if quota still exists (double check)
      const promoRef = doc(db, 'system', 'promo');
      const promoSnap = await getDoc(promoRef);
      const currentPromo = promoSnap.data();

      if (!currentPromo?.isActive || currentPromo.count >= currentPromo.quota) {
        toast.error("Promo mode has just ended. Please use a pin.");
        setLoading(false);
        return;
      }

      // 2. Atomic update via batch
      const batch = writeBatch(db);
      const isPromoEnded = (currentPromo.count || 0) + 1 >= currentPromo.quota;
      
      batch.update(promoRef, {
        count: (currentPromo.count || 0) + 1,
        // Auto-disable if quota reached
        isActive: !isPromoEnded
      });

      batch.update(doc(db, 'users', user.uid), {
        isActivated: true,
        activatedViaPromo: true
      });

      await batch.commit();

      if (isPromoEnded) {
        sendTelegramAlert(
          `<b>🎉 ALERT: PROMO MODE COMPLETED</b>\n\n` +
          `<b>Source:</b> {source}\n` +
          `<b>Completed Because:</b> Quota fully completed!\n` +
          `<b>Original Quota:</b> ${currentPromo.quota}\n` +
          `<b>Total Activations:</b> ${currentPromo.quota}\n` +
          `<b>Time Completed:</b> ${new Date().toLocaleString()}`
        );
      }

      setShowPromoSuccess(true);
    } catch (error: any) {
      console.error("Promo Activation Error:", error);
      // Check for common ad-blocker or network blockage indicators
      const errorStr = String(error);
      if (errorStr.includes('ERR_BLOCKED_BY_CLIENT') || errorStr.includes('blocked-by-client') || errorStr.includes('Network Error')) {
        toast.error("Activation Blocked: It seems your browser or an ad-blocker is preventing the connection. Please disable Ad-Blockers and try again.", {
          duration: 10000
        });
      } else {
        handleFirestoreError(error, OperationType.WRITE, `Promo Activation (promo + users/${user?.uid})`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 12) {
      toast.error('Activation pin must be 12 digits');
      return;
    }

    setLoading(true);
    try {
      const pinPath = `activationCodes/${pin}`;
      let pinSnap;
      try {
        const pinRef = doc(db, 'activationCodes', pin);
        pinSnap = await getDoc(pinRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, pinPath);
        return;
      }

      if (!pinSnap.exists()) {
        toast.error('Invalid activation pin');
        return;
      }

      const pinData = pinSnap.data();
      if (pinData.isUsed) {
        toast.error('This pin has already been used');
        return;
      }

      // Mark pin as used
      try {
        const pinRef = doc(db, 'activationCodes', pin);
        
        let lentWholesalePrice = pinData.lentWholesalePrice;
        if (pinData.isLent && lentWholesalePrice === undefined) {
          try {
            const configSnap = await getDoc(doc(db, 'system', 'config'));
            if (configSnap.exists()) {
              const cfg = configSnap.data();
              lentWholesalePrice = pinData.type === 'plus' 
                ? (cfg.plusWholesalePrice ?? 1500) 
                : (cfg.standardWholesalePrice ?? 800);
            } else {
              lentWholesalePrice = pinData.type === 'plus' ? 1500 : 800;
            }
          } catch (e) {
            lentWholesalePrice = pinData.type === 'plus' ? 1500 : 800;
          }
        }

        const pinUpdatePayload: any = {
          isUsed: true,
          usedBy: user?.uid,
          usedByStudentId: profile?.studentId || '',
          usedAt: new Date().toISOString()
        };

        if (pinData.isLent && pinData.lentWholesalePrice === undefined) {
          pinUpdatePayload.lentWholesalePrice = lentWholesalePrice;
          if (pinData.settled === undefined) {
            pinUpdatePayload.settled = false;
          }
        }

        await updateDoc(pinRef, pinUpdatePayload);

        // Update stats unused/used pin counts
        try {
          await setDoc(doc(db, 'system', 'stats'), {
            totalUnusedPins: increment(-1),
            totalUsedPins: increment(1)
          }, { merge: true });
        } catch (statsErr) {
          console.error("Failed to update stats on activation:", statsErr);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, pinPath);
        return;
      }

      // Activate user
      const userPath = `users/${user!.uid}`;
      try {
        const updateData: any = {
          isActivated: true,
          level: pinData.type === 'plus' ? '2' : '1'
        };
        await updateDoc(doc(db, 'users', user!.uid), updateData);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
        return;
      }

      // Automatically check and upgrade referrer if they have reached 5 activated referrals
      if (profile?.referredBy) {
        try {
          const referrerRef = doc(db, 'users', profile.referredBy);
          const referrerSnap = await getDoc(referrerRef);
          if (referrerSnap.exists()) {
            const referrerData = referrerSnap.data();
            // Query count of other activated referrals
            const referredQ = query(
              collection(db, 'users'),
              where('referredBy', '==', profile.referredBy),
              where('isActivated', '==', true)
            );
            const referredSnap = await getDocs(referredQ);
            
            // This newly activated user is counted (they might not be in query snapshot yet depending on latency)
            const count = referredSnap.docs.filter(d => d.id !== user!.uid).length + 1;
            
            if (count >= 5 && referrerData.level === '1') {
              await updateDoc(referrerRef, { level: '2' });
              toast.success('Your referrer has been upgraded to Level 2!');
            }
          }
        } catch (error) {
          console.error("Failed to upgrade referrer on active referrals:", error);
        }
      }

      toast.success('Account activated successfully!');

      // Get pin creator profile for telegram alert metadata
      let isCreatorLevel4 = false;
      let creatorStudentId = 'N/A';
      let creatorAt = 'N/A';
      
      if (pinData.createdBy) {
        try {
          const creatorRef = doc(db, 'users', pinData.createdBy);
          const creatorSnap = await getDoc(creatorRef);
          if (creatorSnap.exists()) {
            const creatorData = creatorSnap.data();
            creatorStudentId = creatorData?.studentId || 'N/A';
            creatorAt = creatorData?.At || 'N/A';
            if (creatorData?.level === '4' || creatorData?.level === '5') {
              isCreatorLevel4 = true;
            }
          }
        } catch (error) {
          console.error("Failed to get creator snap:", error);
        }
      }

      // If we couldn't resolve via createdBy, let's query users by studentId matching the pin's owner field to check if they are level 4
      if (!isCreatorLevel4 && pinData.owner) {
        try {
          const usersQ = query(collection(db, 'users'), where('studentId', '==', pinData.owner), where('level', 'in', ['4', '5']));
          const usersSnap = await getDocs(usersQ);
          if (!usersSnap.empty) {
            isCreatorLevel4 = true;
            creatorStudentId = pinData.owner;
            const adminDoc = usersSnap.docs[0].data();
            creatorAt = adminDoc?.At || 'N/A';
          }
        } catch (err) {
          console.error("Failed to query user by pin owner studentId:", err);
        }
      }

      // Telegram Alert if the pin was not assigned to any vendor and owned/created by a Level 4 Admin
      if (!pinData.assignedTo && isCreatorLevel4) {
        const headerTitle = '🔔 ALERT: LEVEL 4 ADMIN AP-PIN USED';
        sendTelegramAlert(
          `<b>${headerTitle}</b>\n\n` +
          `<b>Source:</b> {source}\n` +
          `<b>Pin Code:</b> ${pin}\n` +
          `<b>Pin Type:</b> ${pinData.type?.toUpperCase() || 'STANDARD'}\n` +
          `<b>User Student ID:</b> ${profile?.studentId || 'N/A'}\n` +
          `<b>User At:</b> ${profile?.At || 'N/A'}\n` +
          `<b>Time Used:</b> ${new Date().toLocaleString()}\n` +
          `<b>Pin Created At:</b> ${pinData.createdAt ? new Date(pinData.createdAt).toLocaleString() : 'N/A'}\n` +
          `<b>Creator/Owner Student ID:</b> ${creatorStudentId}\n` +
          `<b>Creator At:</b> ${creatorAt}\n` +
          `<b>Pool Status:</b> Master Pool`
        );
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate account');
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent("Hello, I want to purchase an activation pin for CoLearn App.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  useEffect(() => {
    if (profile?.isActivated || user?.email === 'successugochukwuchi@gmail.com') {
      navigate('/dashboard');
    }
  }, [profile, user, navigate]);

  if (profile?.isActivated || user?.email === 'successugochukwuchi@gmail.com') {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-16rem)] p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {promoConfig?.isActive && (
          <div className="bg-amber-500 text-white p-3 text-center text-sm font-bold flex items-center justify-center gap-2 animate-pulse">
            <Gift className="h-4 w-4" />
            FREE PROMO MODE ACTIVE
          </div>
        )}
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Activate Account</CardTitle>
          <CardDescription className="text-center">
            {promoConfig?.isActive && !usePinMode
              ? "You're in luck! Current promo allows free activation." 
              : "Enter your 12-digit activation pin for the current semester."}
          </CardDescription>
        </CardHeader>
        
        {promoConfig?.isActive && !usePinMode ? (
          <>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-4 text-center">
                <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                  <Gift className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Limited Tokens Available</h3>
                  <p className="text-sm text-muted-foreground italic">
                    Quota Remaining: {promoConfig.quota - promoConfig.count}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl border-2 border-dashed border-amber-500/30">
                  <p className="text-xs text-muted-foreground">
                    By clicking activate, you'll gain full access for the current semester at no cost.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg font-bold" onClick={handlePromoActivate} disabled={loading}>
                {loading ? 'Processing...' : 'Activate Free Now'}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => setUsePinMode(true)}>Or use physical pin</span>
                </div>
              </div>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleActivate}>
            <CardContent className="space-y-4">
              {promoConfig?.isActive && usePinMode && (
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  className="mb-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => setUsePinMode(false)}
                >
                  ← Use Free Promo
                </Button>
              )}
              <div className="space-y-2 text-center py-4">
                <p className="text-sm font-medium">Pricing & Activation</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Semester: ₦{(systemConfig?.standardPrice ?? 3000).toLocaleString()} | Two Semesters (PLUS): ₦{(systemConfig?.plusPrice ?? 5000).toLocaleString()}
                </p>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full bg-green-500 hover:bg-green-600 text-white border-none"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Get Pin via WhatsApp
                </Button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or enter pin</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">12-Digit Pin</Label>
                <Input 
                  id="pin" 
                  placeholder="000000000000" 
                  maxLength={12}
                  required 
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-xl tracking-[0.5em] font-mono"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={loading || pin.length !== 12}>
                {loading ? 'Activating...' : 'Activate Now'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      <Dialog open={showPromoSuccess} onOpenChange={(open) => !open && navigate('/dashboard')}>
        <DialogContent className="sm:max-w-md border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 backdrop-blur-xl">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-amber-500 rounded-full flex items-center justify-center text-white animate-bounce shadow-lg shadow-amber-500/40">
                <Star className="h-8 w-8 fill-current" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-black text-center text-amber-600 dark:text-amber-400">CONGRATULATIONS!</DialogTitle>
            <DialogDescription className="text-center text-base space-y-4 pt-4">
              <p className="font-bold text-foreground">You have been successfully activated under the current PROMO MODE!</p>
              
              <div className="space-y-3 text-sm text-foreground/80 text-left bg-white/50 dark:bg-black/20 p-4 rounded-xl border">
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white shrink-0">1</div>
                  <p>You now have full access to all lecture notes, Past Questions & CBT practice for this semester.</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white shrink-0">2</div>
                  <p>Please note that <strong>next semester will NOT be free</strong>. Plan accordingly!</p>
                </div>
                <div className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-white shrink-0">3</div>
                  <p className="font-bold text-amber-600 dark:text-amber-500">PRO TIP: Refer 10 friends to earn an extra semester for FREE!</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12" 
              onClick={() => {
                setShowPromoSuccess(false);
                navigate('/dashboard');
              }}
            >
              Start Studying Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
