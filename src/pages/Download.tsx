import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTitle } from '../hooks/useTitle';
import { DottedWavesAnimation } from '../components/DottedWavesAnimation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  BookOpen, 
  HelpCircle, 
  Copy, 
  Share2, 
  ArrowLeft,
  ExternalLink,
  Laptop
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DownloadPage() {
  useTitle('Download Android App');
  const { systemConfig } = useAuth();
  const [copied, setCopied] = useState(false);

  // Android detection logic
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /android/i.test(userAgent);

  // Download link set by Overseer Level 5, or fallback
  const downloadUrl = systemConfig?.appDownloadUrl || 'https://colearn-app.com/download/colearn-v1.0.apk';
  const appVersion = systemConfig?.appVersion || 'v1.0.4';

  const handleDownload = () => {
    if (!downloadUrl) {
      toast.error('Download link not set by administrator');
      return;
    }
    toast.success('Starting CoLearn Mobile App Download...');
    
    // Create hidden anchor element to initiate direct download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', 'CoLearn-Mobile.apk');
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyPageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Download page link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors font-semibold text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-500/10 px-3 py-1 gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Android Release {appVersion}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        
        {/* Hero Section with Dotted Waves Animation */}
        <div className="relative rounded-3xl overflow-hidden border border-indigo-500/30 bg-slate-900/60 p-6 md:p-10 shadow-2xl">
          {/* Background Dotted Waves Animation */}
          <div className="absolute inset-0 z-0">
            <DottedWavesAnimation className="w-full h-full rounded-3xl opacity-80" dotColor="129, 140, 248" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-6 pt-4 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold tracking-wide uppercase">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Verified Android Package (APK)
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
              CoLearn Mobile App for Android
            </h1>

            <p className="text-slate-300 text-base md:text-lg leading-relaxed">
              Carry your lecture notes, past questions, and CBT practice tests directly in your pocket. Built for zero-latency, offline learning on Android.
            </p>

            {/* Primary Download Button */}
            <div className="w-full max-w-md pt-2 space-y-3">
              <Button 
                onClick={handleDownload} 
                size="lg" 
                className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:to-purple-600 text-white shadow-xl shadow-indigo-500/25 border border-indigo-400/30 flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Download className="h-6 w-6 animate-bounce" />
                <span>Download APK Now</span>
              </Button>

              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <span>Format: Android APK</span>
                <span>Size: ~18.5 MB</span>
                <span>Requirement: Android 6.0+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Non-Android Device Notice */}
        {!isAndroid && (
          <Card className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            <CardContent className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <Laptop className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-amber-100">Non-Android Device Detected</h4>
                  <p className="text-xs md:text-sm text-amber-300/90 mt-1">
                    You are currently visiting from a non-Android browser. Open this page on your Android device to install directly, or copy the link below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <Button 
                  onClick={copyPageLink} 
                  variant="outline" 
                  size="sm" 
                  className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20 w-full sm:w-auto"
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  {copied ? 'Copied!' : 'Copy Page Link'}
                </Button>
                <Button 
                  onClick={handleDownload} 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features & Advantages Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <div className="p-2.5 w-fit rounded-xl bg-blue-500/10 text-blue-400 mb-2">
                <BookOpen className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">Full Offline Vault</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Access all lecture notes and past questions even when you don't have internet connection.
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <div className="p-2.5 w-fit rounded-xl bg-purple-500/10 text-purple-400 mb-2">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">Instant CBT Exam Engine</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Practice timed exams with automated scoring, detailed explanations, and performance history.
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">Lightweight & Fast</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              Optimized memory footprint designed to run smoothly on any Android phone without lag.
            </CardContent>
          </Card>
        </div>

        {/* Installation Instructions */}
        <Card className="bg-slate-900/70 border-slate-800 text-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
              Quick Installation Steps
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Follow these simple steps to install the CoLearn Android application on your phone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Step 1</span>
                <p className="font-semibold text-slate-200">Tap "Download APK Now"</p>
                <p className="text-xs text-slate-400">The `.apk` package file will download directly to your Android device.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Step 2</span>
                <p className="font-semibold text-slate-200">Open Downloaded File</p>
                <p className="text-xs text-slate-400">Tap the notification when finished or locate the file in your Downloads app.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Step 3</span>
                <p className="font-semibold text-slate-200">Allow Unknown Sources</p>
                <p className="text-xs text-slate-400">If prompted, enable "Allow installation from this source" in your browser settings.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Step 4</span>
                <p className="font-semibold text-slate-200">Launch & Learn</p>
                <p className="text-xs text-slate-400">Tap "Install", open the app, and sign in with your student account!</p>
              </div>
            </div>

            {/* Direct URL Box */}
            <div className="pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="truncate text-slate-400 font-mono">
                  <span className="text-indigo-400 font-bold mr-2">Link:</span>
                  {downloadUrl}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={copyPageLink} title="Copy link">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 CoLearn Education Platform</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-slate-300">Terms</Link>
            <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
            <button onClick={copyPageLink} className="hover:text-slate-300">Share Download Link</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
