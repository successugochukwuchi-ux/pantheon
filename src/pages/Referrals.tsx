import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Users, Copy, Share2, Award, Gift, CheckCircle, AlertOctagon } from 'lucide-react';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Referrals() {
  const { profile, user } = useAuth();
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setReferredUsers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const referralLink = `${window.location.origin}/register?ref=${user?.uid}`;
  const isRestricted = profile?.level === '1+' || profile?.level === '2' || profile?.level === '3' || profile?.level === '4';

  const copyToClipboard = () => {
    if (isRestricted) {
      toast.error('Level 1+ accounts are not permitted to make referrals.');
      return;
    }
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied to clipboard!');
  };

  const shareLink = async () => {
    if (isRestricted) {
      toast.error('Level 1+ accounts are not permitted to make referrals.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Pantheon Student Portal',
          text: 'Join me on Pantheon to access lecture notes, past questions, and CBT practice!',
          url: referralLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
        <p className="text-muted-foreground">Invite your friends to Pantheon and earn rewards.</p>
      </div>

      {isRestricted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              <CardTitle className="text-sm font-bold">Referrals Restricted</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Level 1+ and Administrative accounts are not eligible to participate in the referral program to ensure fair rewards for standard students.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className={cn("grid gap-6 md:grid-cols-2", isRestricted && "opacity-60 grayscale pointer-events-none select-none")}>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Your Referral Link
            </CardTitle>
            <CardDescription>Share this link with your classmates to earn referrals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="bg-background" />
              <Button size="icon" variant="outline" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full gap-2" onClick={shareLink}>
              <Share2 className="h-4 w-4" /> Share Link
            </Button>
          </CardContent>
          <CardFooter className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold text-center justify-center">
            Earn 1 point for every activated student
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Referrals</p>
              <p className="text-3xl font-bold">{profile?.referralCount || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground mb-1">Activated</p>
              <p className="text-3xl font-bold text-green-500">
                {referredUsers.filter(u => u.isActivated).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Referred Students
        </h2>
        
        <div className="grid gap-4">
          {referredUsers.length > 0 ? (
            referredUsers.map(u => (
              <Card key={u.uid}>
                <CardContent className="flex items-center p-4 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-primary">
                      {u.username?.[0].toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium">{u.username || 'Anonymous User'}</p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.isActivated ? (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 gap-1">
                        <CheckCircle className="h-3 w-3" /> Activated
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending Activation</Badge>
                    )}
                    <Badge variant="outline">Level {u.level}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>You haven't referred anyone yet.</p>
                <p className="text-sm">Classmates who use your link will appear here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
