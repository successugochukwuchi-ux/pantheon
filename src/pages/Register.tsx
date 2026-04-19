import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { formatAuthError } from '../lib/auth-errors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DEPARTMENTS } from '../constants/departments';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [level, setLevel] = useState('100');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isPreActivated = searchParams.get('activated') === 'true';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!department) {
      toast.error('Please select your department');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile
      const studentId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
      const referrerUid = searchParams.get('ref');
      
      // Small delay to ensure Auth state is ready for Firestore rules
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        await updateProfile(user, { photoURL });
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          studentId: studentId,
          email: user.email,
          username: username,
          department: department,
          mobileNumber: mobileNumber,
          academicLevel: level,
          level: user.email === 'successugochukwuchi@gmail.com' ? '4' : '1',
          isActivated: isPreActivated || user.email === 'successugochukwuchi@gmail.com',
          referralCount: 0,
          referredBy: referrerUid || null,
          theme: 'light',
          photoURL: photoURL,
          createdAt: new Date().toISOString()
        });

        // Increment referrer count if applicable
        if (referrerUid) {
          try {
            const referrerRef = doc(db, 'users', referrerUid);
            const referrerSnap = await getDoc(referrerRef);
            if (referrerSnap.exists()) {
              const currentCount = referrerSnap.data().referralCount || 0;
              await updateDoc(referrerRef, { referralCount: currentCount + 1 });
            }
          } catch (refError) {
            console.error("Failed to update referrer:", refError);
          }
        }
        
        toast.success('Account created successfully');
        if (isPreActivated || user.email === 'successugochukwuchi@gmail.com') {
          navigate('/dashboard');
        } else {
          navigate('/activate');
        }
      } catch (error) {
        console.error("Profile creation failed:", error);
        // Even if profile creation fails, the user is created in Auth.
        // The AuthContext will try to auto-create the profile on next load.
        toast.info('Account created, setting up your profile...');
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(formatAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-muted/30 px-4 py-12">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-3xl font-bold tracking-tighter text-primary">PANTHEON</Link>
          <p className="text-muted-foreground mt-2">Join the community of FUTO scholars</p>
        </div>

        <Card className="border-none shadow-2xl bg-background/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold">Register</CardTitle>
            <CardDescription>
              {isPreActivated 
                ? 'Scan detected! Create your pre-activated account.' 
                : 'Create an account to start your learning journey'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  placeholder="johndoe" 
                  required 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@futo.edu.ng" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input 
                  id="mobile" 
                  type="tel" 
                  placeholder="08012345678" 
                  required 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Current Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 Level</SelectItem>
                    <SelectItem value="200">200 Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-6 pt-4">
              <Button className="w-full h-12 text-lg rounded-full" type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Register'}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
