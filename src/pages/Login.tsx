import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatAuthError } from '../lib/auth-errors';
import { 
  Card, 
  CardContent, 
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
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  Sparkles, 
  GraduationCap, 
  ShieldCheck, 
  KeyRound,
  HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';

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
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      // Set persistence based on user preference
      await setPersistence(
        auth, 
        stayLoggedIn ? browserLocalPersistence : browserSessionPersistence
      );
      
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(formatAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
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
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-muted/30 px-4 py-8">
      {/* Ambient Glow Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[15%] w-[30%] h-[30%] bg-purple-500/15 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md space-y-6"
      >
        {/* Top Branding Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-xs mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            Academic Scholar Portal
          </div>
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-foreground hover:opacity-90 transition-opacity">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shadow-sm">
                <img src="/icon.png" alt="CoLearn" className="h-full w-full rounded-lg object-contain" />
              </div>
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                COLEARN
              </span>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            Welcome back to your high-performance study hub
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-border/40 shadow-2xl bg-card/85 backdrop-blur-md rounded-3xl overflow-hidden">
          {/* Header Accent Bar */}
          <div className="bg-muted/30 border-b border-border/50 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Secure Sign In
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" />
              Encrypted
            </span>
          </div>

          <form onSubmit={handleLogin}>
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  Access Your Account
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enter your credentials to continue studying and preparing for exams.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@university.edu.ng" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 pl-11 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Password
                    </Label>

                    <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                      <DialogTrigger
                        type="button"
                        className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0"
                      >
                        Forgot password?
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl p-6">
                        <DialogHeader className="space-y-2 text-left">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
                            <KeyRound className="h-5 w-5" />
                          </div>
                          <DialogTitle className="text-lg font-bold">Reset Password</DialogTitle>
                          <DialogDescription className="text-xs text-muted-foreground">
                            Enter the email associated with your account and we'll send you an encrypted password recovery link.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Email Address
                            </Label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                              <Input
                                id="reset-email"
                                type="email"
                                placeholder="name@university.edu.ng"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="h-11 pl-11 rounded-xl bg-muted/25 border-border focus:bg-background text-sm"
                                required
                              />
                            </div>
                          </div>
                          <DialogFooter className="pt-2">
                            <Button 
                              type="submit" 
                              disabled={resetLoading} 
                              className="w-full h-11 rounded-xl font-semibold shadow-md"
                            >
                              {resetLoading ? 'Sending Recovery Link...' : 'Send Reset Link'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••••••"
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pl-11 pr-11 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground transition-colors p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Stay Logged In Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setStayLoggedIn(!stayLoggedIn)}
                    className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none py-1"
                  >
                    {stayLoggedIn ? (
                      <CheckSquare className="h-4 w-4 text-primary fill-primary/15" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    <span className="font-medium">Stay signed in on this browser</span>
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 p-6 sm:p-8 pt-0">
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 group flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="text-xs text-center text-muted-foreground">
                Don't have an account yet?{' '}
                <Link to="/register" className="text-primary font-bold hover:underline">
                  Create an account
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer Note */}
        <footer className="text-center text-xs text-muted-foreground space-y-1">
          <p>© 2026 Pillara Education • Built for Academic Excellence</p>
        </footer>
      </motion.div>
    </div>
  );
}
