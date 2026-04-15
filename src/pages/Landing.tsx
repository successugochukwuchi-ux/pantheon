import React from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { BookOpen, Shield, Zap, Users, GraduationCap, ChevronRight, MessageCircle, History } from 'lucide-react';

export default function Landing() {
  const openWhatsApp = () => {
    const message = encodeURIComponent("Hello, I'm interested in the Pantheon Study App for FUTO.");
    window.open(`https://wa.me/2348118429150?text=${message}`, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden bg-background">
        <div className="container px-4 mx-auto relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <GraduationCap className="h-4 w-4" />
              <span>Built Exclusively for FUTO Students</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Master Your Courses with PANTHEON
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
              The ultimate study companion for FUTO students. Lecture notes, past questions, CBT practice, and calculator shortcuts—all in one place, even offline.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/register" 
                className={cn(buttonVariants({ size: 'lg' }), "rounded-full px-8 h-12 text-lg")}
              >
                Get Started Now <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
              <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-lg" onClick={openWhatsApp}>
                <MessageCircle className="mr-2 h-5 w-5 text-green-500" />
                Contact Admin
              </Button>
            </div>
          </div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Excel</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Designed by students, for students. We know the FUTO curriculum inside out.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BookOpen className="h-8 w-8 text-blue-500" />}
              title="Lecture Notes"
              description="Comprehensive, easy-to-understand notes for all FUTO courses, organized by semester."
            />
            <FeatureCard 
              icon={<History className="h-8 w-8 text-purple-500" />}
              title="Past Questions"
              description="Practice with years of real exam questions to know exactly what to expect."
            />
            <FeatureCard 
              icon={<Zap className="h-8 w-8 text-orange-500" />}
              title="Punch Notes"
              description="Master calculator shortcuts and exam hacks that save you precious time during tests."
            />
            <FeatureCard 
              icon={<Shield className="h-8 w-8 text-green-500" />}
              title="Offline Access"
              description="Download your study materials and view them anytime, anywhere—no data required."
            />
            <FeatureCard 
              icon={<Users className="h-8 w-8 text-pink-500" />}
              title="Community News"
              description="Stay updated with the latest news from the Pantheon team and FUTO campus."
            />
            <FeatureCard 
              icon={<GraduationCap className="h-8 w-8 text-indigo-500" />}
              title="CBT Practice"
              description="Simulate real exam conditions with our Computer Based Test practice module."
            />
          </div>
        </div>
      </section>

      {/* Pricing/Activation Section */}
      <section className="py-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-5xl mx-auto bg-primary text-primary-foreground rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
            <div className="p-12 md:w-2/3">
              <h2 className="text-4xl font-bold mb-6">Semester Activation</h2>
              <p className="text-primary-foreground/80 text-lg mb-8">
                Get full access to all Pantheon features for the current semester. Choose between semester or yearly plans.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <span>Semester Plan: ₦3,000</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <span>Yearly Plan: ₦5,000 (Save ₦1,000)</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <span>Full access to Notes, CBT & Punch Notes</span>
                </li>
              </ul>
              <Button size="lg" variant="secondary" className="rounded-full px-8" onClick={openWhatsApp}>
                Get Your Pin Now
              </Button>
            </div>
            <div className="bg-white/10 p-12 md:w-1/3 flex flex-col items-center justify-center text-center border-l border-white/10">
              <div className="text-6xl font-bold mb-2">₦3k</div>
              <div className="text-primary-foreground/60 uppercase tracking-widest text-sm font-bold">Per Semester</div>
              <div className="mt-4 text-2xl font-bold">₦5k Yearly</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container px-4 mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-2xl font-bold tracking-tighter">PANTHEON</span>
            <p className="text-muted-foreground text-sm max-w-xs">Empowering FUTO students through technology and accessible education.</p>
          </div>
          <div className="flex gap-8">
            <Link to="/login" className="text-sm hover:text-primary">Login</Link>
            <Link to="/register" className="text-sm hover:text-primary">Register</Link>
            <button onClick={openWhatsApp} className="text-sm hover:text-primary">Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div 
      className="p-8 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
