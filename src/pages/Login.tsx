import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatAuthError } from '../lib/auth-errors';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { AlertCircle, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Set persistence based on user preference
      await setPersistence(
        auth, 
        stayLoggedIn ? browserLocalPersistence : browserSessionPersistence
      );
      
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(formatAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user profile already exists
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        const studentId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
        const defaultUniId = 'futo';
        const defaultDept = 'Computer Science';
        const defaultLevel = '100';

        const photoURL = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        
        let baseUsername = user.displayName?.replace(/[^a-zA-Z0-9_]/g, '') || user.email?.split('@')[0] || 'user';
        if (baseUsername.length < 3) {
          baseUsername = baseUsername + '123';
        }
        
        let finalUsername = baseUsername;
        let isUnique = false;
        let attempt = 0;
        
        while (!isUnique && attempt < 10) {
          const checkUsername = attempt === 0 ? finalUsername : `${baseUsername}${Math.floor(100 + Math.random() * 900)}`;
          const q = query(collection(db, 'users'), where('username_lower', '==', checkUsername.toLowerCase()));
          const snap = await getDocs(q);
          if (snap.empty) {
            finalUsername = checkUsername;
            isUnique = true;
          }
          attempt++;
        }

        await setDoc(profileRef, {
          uid: user.uid,
          studentId: studentId,
          email: user.email,
          username: finalUsername,
          username_lower: finalUsername.toLowerCase(),
          department: defaultDept,
          mobileNumber: '',
          academicLevel: defaultLevel,
          level: user.email === 'successugochukwuchi@gmail.com' ? '4' : '1',
          isActivated: user.email === 'successugochukwuchi@gmail.com',
          referralCount: 0,
          referredBy: null,
          theme: 'light',
          photoURL: photoURL,
          createdAt: new Date().toISOString(),
          At: defaultUniId
        });

        try {
          await setDoc(doc(db, 'system', 'stats'), {
            totalUsers: increment(1)
          }, { merge: true });
        } catch (statsErr) {
          console.error("Failed to update stats user count:", statsErr);
        }

        toast.success('Account created with Google! Complete your setup if needed.');
      } else {
        toast.success('Logged in with Google successfully!');
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      toast.error(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Password reset email sent! Check your inbox.');
      setIsResetOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast.error(formatAuthError(error.code));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-muted/30 px-4">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-3xl font-bold tracking-tighter text-primary">COLEARN</Link>
          <p className="text-muted-foreground mt-2">Welcome back to your study hub</p>
        </div>

        <Card className="border-none shadow-2xl bg-background/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold">Login</CardTitle>
            <CardDescription>Enter your email and password to access your account</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@university.edu.ng" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                    <DialogTrigger className="text-xs text-primary hover:underline">
                      Forgot password?
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                          Enter your email address and we'll send you a link to reset your password.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword}>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="name@university.edu.ng"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={resetLoading} className="w-full">
                            {resetLoading ? 'Sending...' : 'Send Reset Link'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
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
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStayLoggedIn(!stayLoggedIn)}
                  className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {stayLoggedIn ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  <span>Stay logged in</span>
                </button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-4">
              <Button className="w-full h-12 text-lg rounded-full" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              <div className="relative flex py-2 items-center w-full">
                <div className="flex-grow border-t border-muted-foreground/15"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase font-medium tracking-wider">Or continue with</span>
                <div className="flex-grow border-t border-muted-foreground/15"></div>
              </div>

              <Button 
                type="button"
                variant="outline"
                className="w-full h-12 rounded-full flex items-center justify-center gap-2 border-border hover:bg-muted/50 cursor-pointer font-semibold"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="text-sm text-center text-muted-foreground mt-2">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  Register
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
        <footer className="mt-8 text-center text-xs text-muted-foreground">
          © 2026 Pillara Education 2026
        </footer>
      </div>
    </div>
  );
}
