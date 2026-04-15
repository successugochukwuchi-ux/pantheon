import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';

export default function Activate() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

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
        await updateDoc(doc(db, 'users', user!.uid), {
          isActivated: true
        });
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

  if (profile?.isActivated || user?.email === 'successugochukwuchi@gmail.com') {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Activate Account</CardTitle>
          <CardDescription className="text-center">
            Enter your 12-digit activation pin for the current semester.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleActivate}>
          <CardContent className="space-y-4">
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
      </Card>
    </div>
  );
}
