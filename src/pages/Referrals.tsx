import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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
  const { profile, user, systemConfig } = useAuth();
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const rawThreshold = Number(systemConfig?.referralThresholdForLevel2);
  const level2Threshold = Number.isFinite(rawThreshold) && rawThreshold >= 1 ? Math.floor(rawThreshold) : 5;

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', user.uid)
    );

    getDocs(q).then(async (snapshot) => {
      const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setReferredUsers(users);
      setLoading(false);

      // Keep own referralCount & Level 2 upgrade in sync safely
      const activatedCount = users.filter(u => u.isActivated).length;
      const updates: Record<string, any> = {};
      if (users.length !== (profile?.referralCount || 0)) {
        updates.referralCount = users.length;
      }
      if (profile?.level === '1' && activatedCount >= level2Threshold) {
        updates.level = '2';
      }
      if (Object.keys(updates).length > 0) {
        try {
          await updateDoc(doc(db, 'users', user.uid), updates);
          if (updates.level === '2') {
            toast.success(`Congratulations! You reached ${level2Threshold} activated referrals and unlocked Level 2!`);
          }
        } catch (err) {
          console.error('Failed to sync referral progress:', err);
        }
      }
    }).catch((err) => {
      console.error("Error fetching referrals:", err);
      setLoading(false);
    });
  }, [user, level2Threshold, profile?.level, profile?.referralCount]);

  const referralLink = `${window.location.origin}/register?ref=${user?.uid}`;
  const referralCode = profile?.studentId || user?.uid || '';
  const isRestricted = profile?.level === '2' || profile?.level === '3' || profile?.level === '4' || profile?.level === '5';
  const activatedCount = referredUsers.filter(u => u.isActivated).length;
  const totalCount = Math.max(profile?.referralCount || 0, referredUsers.length);
  const progressPct = Math.min(100, Math.round((activatedCount / level2Threshold) * 100));
  const remainingForLevel2 = Math.max(0, level2Threshold - activatedCount);

  const copyToClipboard = (value: string = referralLink, label: string = 'Referral link') => {
    if (isRestricted) {
      toast.error('Level 2 and Administrative accounts are not permitted to make referrals.');
      return;
    }
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard!`);
  };

  const shareLink = async () => {
    if (isRestricted) {
      toast.error('Level 2 and Administrative accounts are not permitted to make referrals.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CoLearn Student Portal',
          text: `Join me on CoLearn to access lecture notes, past questions, and CBT practice! Use my referral code: ${referralCode}`,
          url: referralLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard(referralLink, 'Referral link');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
        <p className="text-muted-foreground">
          Invite your friends to CoLearn and unlock Level 2 after {level2Threshold} activated {level2Threshold === 1 ? 'referral' : 'referrals'}.
        </p>
      </div>

      {isRestricted && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              <CardTitle className="text-sm font-bold">Referrals Restricted</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Level 2 and Administrative accounts are not eligible to participate in the referral program to ensure fair rewards for standard students.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className={cn("grid gap-6 md:grid-cols-2", isRestricted && "opacity-60 grayscale pointer-events-none select-none")}>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Your Referral Link &amp; Code
            </CardTitle>
            <CardDescription>Share this link or your mobile referral code with classmates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mobile Referral Code</p>
              <div className="flex gap-2">
                <Input value={referralCode} readOnly className="bg-background font-mono font-semibold" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(referralCode, 'Referral code')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invite Link</p>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly className="bg-background" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(referralLink, 'Referral link')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full gap-2" onClick={shareLink}>
              <Share2 className="h-4 w-4" /> Share Link
            </Button>
          </CardContent>
          <CardFooter className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold text-center justify-center">
            Reach {level2Threshold} activated {level2Threshold === 1 ? 'student' : 'students'} to unlock Level 2
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              Your Stats &amp; Level 2 Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Referrals</p>
                <p className="text-3xl font-bold">{totalCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground mb-1">Activated</p>
                <p className="text-3xl font-bold text-green-500">
                  {activatedCount}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Level 2 Progress</span>
                <span className="font-bold">
                  {activatedCount} / {level2Threshold} Activated
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {remainingForLevel2 === 0
                  ? 'Target reached! Level 2 unlocked.'
                  : `${remainingForLevel2} more activated ${remainingForLevel2 === 1 ? 'referral' : 'referrals'} needed for Level 2.`}
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
          {!loading && referredUsers.length > 0 ? (
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
                <p>{loading ? 'Loading your referrals...' : "You haven't referred anyone yet."}</p>
                {!loading && <p className="text-sm">Classmates who use your link or code will appear here.</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
