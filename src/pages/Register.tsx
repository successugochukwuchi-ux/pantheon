import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, increment, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { formatAuthError } from '../lib/auth-errors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { 
  AlertCircle, 
  Eye, 
  EyeOff, 
  GraduationCap, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  BookOpen, 
  ChevronDown, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Search, 
  Sparkles, 
  Lock,
  Compass,
  Briefcase
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DEPARTMENTS } from '../constants/departments';
import { motion, AnimatePresence } from 'motion/react';

export default function Register() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [level, setLevel] = useState('100');
  const [universities, setUniversities] = useState<any[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search dropdown states
  const [uniSearch, setUniSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [uniDropdownOpen, setUniDropdownOpen] = useState(false);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);

  const isPreActivated = searchParams.get('activated') === 'true';

  useEffect(() => {
    const fetchUniversities = async () => {
      const defaultUni = {
        id: 'futo',
        name: 'Federal University of Technology, Owerri',
        shortName: 'FUTO',
        departments: DEPARTMENTS.map(name => ({ name, disciplineId: null })),
        createdAt: new Date().toISOString()
      };

      try {
        const snap = await getDocs(collection(db, 'universities'));
        if (snap.empty) {
          setUniversities([defaultUni]);
          setSelectedUniversityId('futo');

          // Seeding in background
          setDoc(doc(db, 'universities', 'futo'), defaultUni).catch(e => {
            console.warn("Seeding default university failed (expected for unauthenticated users):", e.message);
          });
        } else {
          const unis = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUniversities(unis);
          if (unis.length > 0) {
            setSelectedUniversityId(unis[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading universities:", err);
        setUniversities([defaultUni]);
        setSelectedUniversityId('futo');
      }
    };
    fetchUniversities();
  }, []);

  const selectedUni = universities.find(u => u.id === selectedUniversityId);
  const availableDepartments = selectedUni 
    ? (selectedUni.departments || []).map((dept: any) => typeof dept === 'string' ? dept : dept.name)
    : [];

  // Filter lists based on search queries
  const filteredUnis = universities.filter(uni => 
    uni.name?.toLowerCase().includes(uniSearch.toLowerCase()) || 
    uni.shortName?.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const filteredDepts = availableDepartments.filter((dept: string) => 
    dept?.toLowerCase().includes(deptSearch.toLowerCase())
  );

  // Validate step transitions
  const validateStep1 = () => {
    if (!username.trim()) {
      toast.error("Please enter a username");
      return false;
    }
    if (username.trim().length < 3) {
      toast.error("Username must be at least 3 characters");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!mobileNumber.trim()) {
      toast.error("Please enter your mobile number");
      return false;
    }
    if (mobileNumber.length < 10) {
      toast.error("Mobile number must be at least 10 digits");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!selectedUniversityId) {
      toast.error("Please select a university");
      return false;
    }
    if (!department) {
      toast.error("Please select your department");
      return false;
    }
    if (!level) {
      toast.error("Please select your current level");
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    if (!password) {
      toast.error('Please enter a password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const studentId = Math.floor(10000000000 + Math.random() * 90000000000).toString();
      const referrerUid = searchParams.get('ref');
      
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
        await updateProfile(user, { photoURL });
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          studentId: studentId,
          email: user.email,
          username: username.trim(),
          username_lower: username.trim().toLowerCase(),
          department: department,
          mobileNumber: mobileNumber,
          academicLevel: level,
          level: user.email === 'successugochukwuchi@gmail.com' ? '4' : '1',
          isActivated: isPreActivated || user.email === 'successugochukwuchi@gmail.com',
          referralCount: 0,
          referredBy: referrerUid || null,
          theme: 'light',
          photoURL: photoURL,
          createdAt: new Date().toISOString(),
          At: selectedUniversityId
        });

        try {
          await setDoc(doc(db, 'system', 'stats'), {
            totalUsers: increment(1)
          }, { merge: true });
        } catch (statsErr) {
          console.error("Failed to update stats user count:", statsErr);
        }

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
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background px-4 py-12 md:py-16">
      {/* Visual Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-25%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-25%] left-[-10%] w-[60%] h-[60%] bg-muted rounded-full blur-[130px]" />
      </div>

      <div className="w-full max-w-lg space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group.test">
            <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15 transition-transform duration-300 group-hover:scale-105">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-primary">
              COLEARN
            </span>
          </Link>
          <p className="text-sm text-muted-foreground font-medium">Join the community of elite academic scholars</p>
        </div>

        <Card className="border border-border/40 shadow-2xl bg-card/85 backdrop-blur-md rounded-3xl overflow-hidden">
          {/* Progress Header */}
          <div className="bg-muted/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-bold tracking-wider uppercase mb-3">
              <span>Step {step} of 3</span>
              <span className="text-primary font-semibold">
                {step === 1 && "Account Information"}
                {step === 2 && "Academic Details"}
                {step === 3 && "Secure Password"}
              </span>
            </div>
            {/* Real Progress Bar */}
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={step === 3 ? handleRegister : (e) => e.preventDefault()}>
            <CardContent className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: 12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-foreground">Create your Profile</h3>
                      <p className="text-xs text-muted-foreground">Enter your basic credentials to get registered on the platform.</p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                          <Input 
                            id="username" 
                            placeholder="johndoe" 
                            required 
                            value={username}
                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            className="h-12 pl-11 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                          <Input 
                            id="email" 
                            type="email" 
                            placeholder="your.name@university.edu.ng" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 pl-11 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mobile" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile Phone Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                          <Input 
                            id="mobile" 
                            type="tel" 
                            placeholder="08012345678" 
                            required 
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                            className="h-12 pl-11 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ x: 12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-foreground">Academic Details</h3>
                      <p className="text-xs text-muted-foreground">Select your institution details and current academic level.</p>
                    </div>

                    <div className="space-y-4 pt-2">
                      {/* Searchable University Selector */}
                      <div className="relative">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">University</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setUniDropdownOpen(!uniDropdownOpen);
                            setDeptDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-muted/40 text-left font-medium"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-primary shrink-0" />
                            <span className="truncate text-foreground/90">
                              {selectedUni ? `${selectedUni.name} (${selectedUni.shortName})` : "Select University"}
                            </span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${uniDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {uniDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setUniDropdownOpen(false)} />
                            <div className="absolute z-40 w-full mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
                              <div className="p-3 border-b border-border/50 bg-muted/45">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <input
                                    type="text"
                                    placeholder="Type to search university..."
                                    value={uniSearch}
                                    onChange={(e) => setUniSearch(e.target.value)}
                                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium text-foreground"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-border/40 bg-card">
                                {filteredUnis.map((uni) => {
                                  const isSelected = uni.id === selectedUniversityId;
                                  return (
                                    <button
                                      key={uni.id}
                                      type="button"
                                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs text-left transition-all ${
                                        isSelected 
                                          ? 'bg-primary/10 text-primary font-bold' 
                                          : 'hover:bg-muted/50 text-foreground/80 font-medium'
                                      }`}
                                      onClick={() => {
                                        setSelectedUniversityId(uni.id);
                                        setDepartment('');
                                        setUniDropdownOpen(false);
                                        setUniSearch('');
                                      }}
                                    >
                                      <span className="pr-2">{uni.name} ({uni.shortName})</span>
                                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                                {filteredUnis.length === 0 && (
                                  <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    No universities match search
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Searchable Department Selector */}
                      <div className="relative">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Department</Label>
                        <button
                          type="button"
                          disabled={!selectedUniversityId}
                          onClick={() => {
                            setDeptDropdownOpen(!deptDropdownOpen);
                            setUniDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-muted/40 text-left font-medium"
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-primary shrink-0" />
                            <span className="truncate text-foreground/90">
                              {department || (selectedUniversityId ? "Select Department" : "Select University First")}
                            </span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${deptDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {deptDropdownOpen && selectedUniversityId && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setDeptDropdownOpen(false)} />
                            <div className="absolute z-40 w-full mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 slide-in-from-top-2 duration-150">
                              <div className="p-3 border-b border-border/50 bg-muted/45">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <input
                                    type="text"
                                    placeholder="Type to search department..."
                                    value={deptSearch}
                                    onChange={(e) => setDeptSearch(e.target.value)}
                                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium text-foreground"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-border/40 bg-card">
                                {filteredDepts.map((deptName) => {
                                  const isSelected = deptName === department;
                                  return (
                                    <button
                                      key={deptName}
                                      type="button"
                                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs text-left transition-all ${
                                        isSelected 
                                          ? 'bg-primary/10 text-primary font-bold' 
                                          : 'hover:bg-muted/50 text-foreground/80 font-medium'
                                      }`}
                                      onClick={() => {
                                        setDepartment(deptName);
                                        setDeptDropdownOpen(false);
                                        setDeptSearch('');
                                      }}
                                    >
                                      <span className="truncate pr-2">{deptName}</span>
                                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                                {filteredDepts.length === 0 && (
                                  <div className="p-4 text-center text-xs text-muted-foreground italic">
                                    No departments match search
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Level Selection Grid Cards */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">Current Level</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setLevel("100")}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all ${
                              level === "100" 
                                ? 'border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/5' 
                                : 'border-border/50 hover:border-border hover:bg-muted/30 text-muted-foreground font-medium bg-muted/10'
                            }`}
                          >
                            <span className="text-sm">100 Level</span>
                            <span className="text-[10px] text-muted-foreground mt-1">Freshman Year</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setLevel("200")}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all ${
                              level === "200" 
                                ? 'border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/5' 
                                : 'border-border/50 hover:border-border hover:bg-muted/30 text-muted-foreground font-medium bg-muted/10'
                            }`}
                          >
                            <span className="text-sm">200 Level</span>
                            <span className="text-[10px] text-muted-foreground mt-1">Sophomore Year</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ x: 12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -12, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-foreground">Secure your Account</h3>
                      <p className="text-xs text-muted-foreground">Create a secure password to protect your account and stats history.</p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                          <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"} 
                            required 
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 pl-11 pr-10 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/80" />
                          <Input 
                            id="confirmPassword" 
                            type={showConfirmPassword ? "text" : "password"} 
                            required 
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-12 pl-11 pr-10 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {password && confirmPassword && (
                          <div className="flex items-center gap-1.5 pt-1">
                            {password === confirmPassword ? (
                              <span className="text-[11px] font-semibold text-green-600 flex items-center gap-1">
                                <Check className="h-3 w-3" /> Passwords match perfectly
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Passwords do not match yet
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 p-6 md:p-8 border-t border-border/40 bg-muted/10">
              <div className="flex items-center gap-3 w-full">
                {step > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePrevStep}
                    className="h-12 px-6 rounded-2xl flex items-center justify-center gap-2 border-border text-foreground hover:bg-muted/40 font-bold"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                
                {step < 3 ? (
                  <Button 
                    type="button" 
                    onClick={handleNextStep}
                    className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2 font-bold"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2 font-bold" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Creating account...' : 'Complete Registration'}
                  </Button>
                )}
              </div>

              <div className="text-xs text-center text-muted-foreground font-medium mt-1">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-bold">
                  Sign In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        <footer className="text-center text-xs text-muted-foreground/60 font-semibold tracking-wider uppercase pt-2">
          © 2026 Pillara Education. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
