import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Users, Zap, Compass, Star, LogIn, Lock } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Carry over activation from original Pantheon
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setIsActivated(data.isActivated || data.subscription === 'active');
        }
      } else {
        setIsActivated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-50 selection:bg-pink-500/30">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-pink-500 to-violet-500 p-2 rounded-lg">
            <Zap className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">Pantheon <span className="text-pink-500">FLUX</span></span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-400">
          <a href="#" className="hover:text-pink-500 transition-colors">Clubs</a>
          <a href="#" className="hover:text-pink-500 transition-colors">Competitions</a>
          <a href="#" className="hover:text-pink-500 transition-colors">Portfolio</a>
          <a href="#" className="hover:text-pink-500 transition-colors">Network</a>
        </nav>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-stone-500 uppercase">Status</span>
              <span className={isActivated ? "text-xs font-bold text-green-500" : "text-xs font-bold text-yellow-500"}>
                {isActivated ? "ACTIVATED" : "BASIC ACCESS"}
              </span>
            </div>
            <img src={user.photoURL || undefined} className="w-8 h-8 rounded-full border border-white/10" alt="Profile" />
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="bg-white text-stone-950 px-4 py-2 rounded-full text-sm font-semibold hover:bg-stone-200 transition-colors flex items-center gap-2"
          >
            <LogIn size={16} /> Sign In
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* Main Dashboard / Hero */}
        {!user || !isActivated ? (
          <section className="text-center mb-32">
            <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter">
              WHERE PASSION <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500">
                MEETS FLUX.
              </span>
            </h1>
            <p className="text-stone-400 text-xl max-w-2xl mx-auto mb-12">
              The extracurricular wing of Pantheon. Build your portfolio, join elite clubs, 
              and dominate competitions while your academic journey stays energized.
            </p>
            
            {!user ? (
              <button 
                onClick={handleLogin}
                className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
              >
                Get Started with Pantheon Account
              </button>
            ) : (
              <div className="bg-stone-900 border border-white/10 p-12 rounded-3xl max-w-2xl mx-auto">
                <Lock className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-4">Activation Required</h2>
                <p className="text-stone-400 mb-8">
                  FLUX features are unlocked automatically when you activate your main Pantheon account.
                  Bonus: One activation covers the entire ecosystem.
                </p>
                <a 
                  href="https://pantheon.com.ng/billing" 
                  className="inline-block bg-pink-500 hover:bg-pink-600 text-white px-8 py-4 rounded-xl font-bold transition-all"
                >
                  Activate My Account
                </a>
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-4xl font-bold">Welcome back, {user.displayName?.split(' ')[0]}</h2>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <Trophy size={18} className="text-yellow-500" />
                <span className="text-sm font-bold">Top 5% Global Participant</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-32">
               {/* Active Clubs */}
               <div className="bg-gradient-to-br from-pink-500/10 to-transparent p-8 rounded-3xl border border-white/5">
                 <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                   <Users size={20} className="text-pink-500" /> My Clubs
                 </h3>
                 <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold">Robotics & AI</p>
                        <p className="text-xs text-stone-500">Next meetup: Friday, 4pm</p>
                      </div>
                      <span className="bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded">LEADER</span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold">Debating Society</p>
                        <p className="text-xs text-stone-500">Regional Finals approaching</p>
                      </div>
                      <span className="bg-white/10 text-white text-[10px] font-black px-2 py-1 rounded">MEMBER</span>
                    </div>
                 </div>
               </div>

               {/* Portfolio Stats */}
               <div className="bg-gradient-to-br from-violet-500/10 to-transparent p-8 rounded-3xl border border-white/5">
                 <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                   <Star size={20} className="text-violet-500" /> Impact Score
                 </h3>
                 <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-4xl font-black text-violet-500">840</p>
                      <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-1">Total Points</p>
                    </div>
                    <div className="h-12 w-px bg-white/10"></div>
                    <div className="text-center">
                      <p className="text-4xl font-black text-white">12</p>
                      <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-1">Badges Earned</p>
                    </div>
                    <div className="h-12 w-px bg-white/10"></div>
                    <div className="text-center">
                      <p className="text-4xl font-black text-white">3</p>
                      <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-1">Certifications</p>
                    </div>
                 </div>
               </div>
            </div>
          </section>
        )}

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-stone-900/50 p-8 rounded-3xl border border-white/5 hover:border-pink-500/50 transition-all group">
            <Compass className="w-12 h-12 text-pink-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold mb-3">Skill Tracks</h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Master robotics, creative writing, debating, or programming through structured, peer-led paths.
            </p>
          </div>
          
          <div className="bg-stone-900/50 p-8 rounded-3xl border border-white/5 hover:border-violet-500/50 transition-all group">
            <Trophy className="w-12 h-12 text-violet-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold mb-3">Global Contests</h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Curated access to regional and international competitions. Represent Pantheon and win big.
            </p>
          </div>

          <div className="bg-stone-900/50 p-8 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all group">
            <Star className="w-12 h-12 text-indigo-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold mb-3">Smart Portfolio</h3>
            <p className="text-stone-400 text-sm leading-relaxed">
              Automatically track your achievements and generate a professional profile for college applications.
            </p>
          </div>
        </section>

        {/* Dynamic section placeholder */}
        <section className="mt-32 border border-white/10 rounded-[3rem] overflow-hidden bg-stone-900/30">
          <div className="grid md:grid-cols-2 gap-12 items-center p-12 md:p-20">
            <div>
              <span className="inline-flex items-center gap-2 bg-pink-500/10 text-pink-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                Active Integration
              </span>
              <h2 className="text-4xl font-bold mb-6">One Identity, <br />Dual Mastery.</h2>
              <p className="text-stone-400 mb-8 leading-relaxed">
                Your FLUX profile is synced with your Pantheon account. Progress in extracurriculars 
                earns you Pantheon Points and exclusive badges that showcase your versatility.
              </p>
              <div className="flex items-center gap-4 py-4 border-t border-white/5">
                <Users className="text-stone-500 w-5 h-5" />
                <span className="text-stone-300 font-medium">1,200+ Students actively participating</span>
              </div>
            </div>
            <div className="aspect-square bg-gradient-to-br from-pink-500/20 to-violet-500/20 rounded-2xl flex items-center justify-center">
               <Sparkles className="w-24 h-24 text-pink-500/50 animate-pulse" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-6 py-12 mt-20 text-center">
        <p className="text-stone-500 text-sm">© 2024 Pantheon FLUX. Part of the Pantheon Ecosystem.</p>
        <p className="text-stone-700 text-[10px] mt-2 uppercase tracking-tighter">Domain: flux.pantheon.com.ng</p>
      </footer>
    </div>
  );
}

export default App;
