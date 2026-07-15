import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { 
  User, 
  Phone, 
  Building2, 
  BookOpen, 
  ChevronDown, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Search, 
  Sparkles 
} from 'lucide-react';
import { DEPARTMENTS } from '../constants/departments';
import { motion, AnimatePresence } from 'motion/react';

export default function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('100');

  // Dropdowns and searches
  const [universities, setUniversities] = useState<any[]>([]);
  const [uniDropdownOpen, setUniDropdownOpen] = useState(false);
  const [uniSearch, setUniSearch] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  // Set initial state from existing profile
  useEffect(() => {
    if (profile) {
      if (profile.username && profile.username !== 'Admin' && !profile.username.startsWith('user')) {
        setUsername(profile.username);
      } else if (profile.username) {
        setUsername(profile.username);
      }
      if (profile.mobileNumber) {
        if (profile.mobileNumber.startsWith('+234')) {
          setMobileNumber(profile.mobileNumber.slice(4));
        } else {
          setMobileNumber(profile.mobileNumber);
        }
      }
      if (profile.At) setSelectedUniversityId(profile.At);
      if (profile.department) setDepartment(profile.department);
      if (profile.academicLevel) setLevel(profile.academicLevel);
    }
  }, [profile]);

  // Load Universities
  useEffect(() => {
    const fetchUniversities = async () => {
      const defaultUni = {
        id: 'futo',
        name: 'Federal University of Technology, Owerri',
        shortName: 'FUTO',
        departments: DEPARTMENTS
      };
      try {
        const snap = await getDocs(collection(db, 'universities'));
        if (snap.empty) {
          setUniversities([defaultUni]);
          if (!selectedUniversityId) setSelectedUniversityId('futo');
        } else {
          const unis = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUniversities(unis);
          if (unis.length > 0 && !selectedUniversityId) {
            setSelectedUniversityId(unis[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading universities:", err);
        setUniversities([defaultUni]);
        if (!selectedUniversityId) setSelectedUniversityId('futo');
      }
    };
    fetchUniversities();
  }, [selectedUniversityId]);

  const selectedUni = universities.find(u => u.id === selectedUniversityId);
  const availableDepartments = selectedUni 
    ? (Array.isArray(selectedUni.departments) ? selectedUni.departments : DEPARTMENTS)
    : [];

  // Filter lists based on search queries
  const filteredUnis = universities.filter(uni => 
    uni.name?.toLowerCase().includes(uniSearch.toLowerCase()) || 
    uni.shortName?.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const filteredDepts = availableDepartments.filter((dept: string) => 
    dept?.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const validateStep1 = () => {
    if (!username.trim()) {
      toast.error("Please enter a username");
      return false;
    }
    if (username.trim().length < 3) {
      toast.error("Username must be at least 3 characters");
      return false;
    }
    if (!mobileNumber.trim()) {
      toast.error("Please enter your mobile number");
      return false;
    }
    if (mobileNumber.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits (excluding the leading 0)");
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
    }
  };

  const handlePrevStep = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;
    if (!user) return;

    setLoading(true);
    try {
      const cleanUsername = username.trim();

      await updateDoc(doc(db, 'users', user.uid), {
        username: cleanUsername,
        username_lower: cleanUsername.toLowerCase(),
        mobileNumber: `+234${mobileNumber.trim()}`,
        At: selectedUniversityId,
        department: department,
        academicLevel: level,
        isOnboarded: true
      });

      toast.success('Onboarding completed successfully! Welcome to CoLearn.');
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Onboarding submission failed:", error);
      toast.error('Failed to save your details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-muted/30 px-4 py-12">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Welcome to <span className="text-primary">COLEARN</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You registered successfully with Google. Let's customize your profile to get the most out of your learning experience.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        <Card className="border-none shadow-2xl bg-background/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="space-y-1 pb-6 md:pb-8 border-b border-border/50">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
              <Sparkles className="h-4 w-4 animate-pulse" />
              Step {step} of 2
            </div>
            <CardTitle className="text-2xl font-bold">
              {step === 1 ? 'Personalize Profile' : 'Academic Profile'}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? 'Create your customized username and enter contact info.' 
                : 'Provide your institution details and current level.'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={step === 2 ? handleCompleteOnboarding : (e) => e.preventDefault()}>
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
                      <p className="text-[10px] text-muted-foreground">Usernames can contain capital letters, numbers and underscores. Must be unique.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mobile" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile Phone Number</Label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 flex items-center pointer-events-none gap-2">
                          <Phone className="h-5 w-5 text-muted-foreground/80" />
                          <span className="text-sm font-bold text-muted-foreground/90 border-r border-border pr-2">+234</span>
                        </div>
                        <Input 
                          id="mobile" 
                          type="tel" 
                          placeholder="8031234567" 
                          required 
                          value={mobileNumber}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.startsWith('0')) {
                              toast.error("Phone number cannot start with 0. The country code +234 is already applied.");
                              val = val.replace(/^0+/, '');
                            }
                            setMobileNumber(val.slice(0, 10));
                          }}
                          className="h-12 pl-24 rounded-xl bg-muted/25 border-border focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium animate-none"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Please ensure this phone number is active and linked to WhatsApp so admins can contact you easily.</p>
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
                        <button
                          type="button"
                          onClick={() => setLevel("300")}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all ${
                            level === "300" 
                              ? 'border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/5' 
                              : 'border-border/50 hover:border-border hover:bg-muted/30 text-muted-foreground font-medium bg-muted/10'
                          }`}
                        >
                          <span className="text-sm">300 Level</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Junior Year</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLevel("400")}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all ${
                            level === "400" 
                              ? 'border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/5' 
                              : 'border-border/50 hover:border-border hover:bg-muted/30 text-muted-foreground font-medium bg-muted/10'
                          }`}
                        >
                          <span className="text-sm">400 Level</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Senior Year</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLevel("500")}
                          className={`col-span-2 flex flex-col items-center justify-center p-4 rounded-2xl border-2 text-center transition-all ${
                            level === "500" 
                              ? 'border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/5' 
                              : 'border-border/50 hover:border-border hover:bg-muted/30 text-muted-foreground font-medium bg-muted/10'
                          }`}
                        >
                          <span className="text-sm">500 Level</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Professional Year (Engineering/Science)</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="flex justify-between p-6 md:p-8 bg-muted/20 border-t border-border/50 rounded-b-2xl">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePrevStep}
                  disabled={loading}
                  className="rounded-xl h-12 px-6 hover:bg-muted/80 font-semibold gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step === 1 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="rounded-xl h-12 px-6 ml-auto font-bold gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/10"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl h-12 px-8 ml-auto font-extrabold gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 bg-primary hover:bg-primary/95 text-primary-foreground"
                >
                  {loading ? 'Completing Setup...' : 'Complete Profile'}
                  <Sparkles className="h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
