import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { MessageCircle, Gift, Info, Star } from 'lucide-react';
import { sendTelegramAlert } from '../services/telegramService';
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
  const { user, profile, promoConfig } = useAuth();
  const navigate = useNavigate();

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
      
      batch.update(promoRef, {
        count: (currentPromo.count || 0) + 1,
        // Auto-disable if quota reached
        isActive: (currentPromo.count || 0) + 1 < currentPromo.quota
      });

      batch.update(doc(db, 'users', user.uid), {
        isActivated: true,
        activatedViaPromo: true
      });

      await batch.commit();

      // Telegram Alert for Promo
      sendTelegramAlert(
        `<b>ALERT: PROMO ACTIVATION</b>\n\n` +
        `<b>ACCOUNT ACTIVATED:</b> ${profile?.studentId || 'N/A'}, ${user?.uid}\n` +
        `<b>METHOD:</b> FREE PROMO MODE\n` +
        `<b>ACTIVATION TIME:</b> ${new Date().toLocaleString()}`
      );

      setShowPromoSuccess(true);
    } catch (error: any) {
      toast.error("Failed to activate via promo");
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
        await updateDoc(pinRef, {
          isUsed: true,
          usedBy: user?.uid,
          usedByStudentId: profile?.studentId,
          usedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, pinPath);
      }

      // Activate user
      const userPath = `users/${user!.uid}`;
      try {
        const updateData: any = {
          isActivated: true
        };
        
        // Grant Level 1+ if it's a PLUS pin
        if (pinData.type === 'plus') {
          updateData.level = '1+';
        }
        
        await updateDoc(doc(db, 'users', user!.uid), updateData);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }

      // If pin was created by a Level 2 admin, create a verification request
      const creatorPath = `users/${pinData.createdBy}`;
      let creatorSnap;
      try {
        const creatorRef = doc(db, 'users', pinData.createdBy);
        creatorSnap = await getDoc(creatorRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, creatorPath);
        return;
      }

      if (creatorSnap.exists() && creatorSnap.data().level === '2') {
        const verPath = `verificationRequests/${user!.uid}_${pin}`;
        try {
          await setDoc(doc(db, 'verificationRequests', `${user!.uid}_${pin}`), {
            uid: user!.uid,
            studentId: profile?.studentId,
            username: profile?.username,
            code: pin,
            timestamp: new Date().toISOString(),
            status: 'pending'
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, verPath);
        }
        toast.info('Account in verification mode. An admin will confirm shortly.');
      } else {
        toast.success('Account activated successfully!');
      }

      // Telegram Alert
      sendTelegramAlert(
        `<b>ALERT: ACTIVATION PIN USED</b>\n\n` +
        `<b>ACCOUNT ACTIVATED:</b> ${profile?.studentId || 'N/A'}, ${user?.uid}\n` +
        `<b>PIN USED:</b> ${pin}\n` +
        `<b>PIN TYPE:</b> ${pinData.type?.toUpperCase() || 'STANDARD'}\n` +
        `<b>ACTIVATION TIME:</b> ${new Date().toLocaleString()}\n` +
        `<b>PIN CREATOR:</b> ${creatorSnap.data()?.level || 'N/A'}, ${creatorSnap.data()?.studentId || 'N/A'}, ${pinData.createdBy}`
      );

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate account');
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent("Hello, I want to purchase an activation pin for Pantheon App.");
    window.open(`https://wa.me/2348118429150?text=${message}`, '_blank');
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
                  Semester: ₦3,000 | Yearly: ₦5,000 (Save ₦1,000)
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
