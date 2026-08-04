import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Download, Smartphone, CheckCircle, ExternalLink, ArrowLeft, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobileSystemRelease {
  versionNumber: string;
  avuuid: string;
  changelog: string;
  isMandatory: boolean;
  hostMode: 'colearn' | 'playstore';
  downloadUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
  updatedAt?: string;
}

export default function DownloadPage() {
  const navigate = useNavigate();
  const [release, setRelease] = useState<MobileSystemRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActiveRelease() {
      try {
        const snap = await getDoc(doc(db, 'system', 'mobile'));
        if (snap.exists()) {
          setRelease(snap.data() as MobileSystemRelease);
        } else {
          // Fallback to query app_versions where isActive == true
          const q = query(collection(db, 'app_versions'), where('isActive', '==', true), limit(1));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            setRelease(querySnap.docs[0].data() as MobileSystemRelease);
          }
        }
      } catch (err) {
        console.error('Failed to fetch active release:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActiveRelease();
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent" />

      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 relative z-10">
        <Button 
          variant="ghost" 
          className="text-stone-400 hover:text-white gap-2"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Website
        </Button>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-emerald-400" />
          <span className="font-bold tracking-tight text-white">CoLearn Mobile</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto my-auto py-12 relative z-10 space-y-6">
        <Card className="bg-stone-900/90 border-stone-800 shadow-2xl backdrop-blur">
          <CardHeader className="text-center space-y-3 pb-6 border-b border-stone-800/80">
            <div className="mx-auto h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
              <Download className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-extrabold text-white">
                Download CoLearn for Android
              </CardTitle>
              <CardDescription className="text-stone-400 mt-1">
                Access your study materials, CBT exams, and discussions natively on your mobile device.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {loading ? (
              <div className="py-12 text-center text-stone-400 animate-pulse space-y-2">
                <Smartphone className="h-8 w-8 mx-auto text-emerald-500" />
                <p>Loading latest release package...</p>
              </div>
            ) : release ? (
              <>
                {/* Version & Badge Meta */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-950 p-4 rounded-xl border border-stone-800">
                  <div>
                    <div className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Latest Version</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">v{release.versionNumber}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 py-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified Build
                    </Badge>
                    <Badge variant="outline" className="text-stone-300 border-stone-700 capitalize">
                      {release.hostMode === 'playstore' ? 'Google Play' : 'Direct APK'}
                    </Badge>
                  </div>
                </div>

                {/* Release Notes */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-stone-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    What's New in v{release.versionNumber}
                  </h4>
                  <div className="bg-stone-950/60 p-4 rounded-xl border border-stone-800/80 text-sm text-stone-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {release.changelog || 'General performance enhancements and bug fixes.'}
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="space-y-3 pt-2">
                  {release.hostMode === 'colearn' ? (
                    <a 
                      href={release.downloadUrl || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button className="w-full h-13 text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-stone-950 gap-2 shadow-lg shadow-emerald-500/20">
                        <Download className="h-5 w-5" />
                        Download Direct APK (v{release.versionNumber})
                      </Button>
                    </a>
                  ) : (
                    <a 
                      href={release.playStoreUrl || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button className="w-full h-13 text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-stone-950 gap-2 shadow-lg shadow-emerald-500/20">
                        <Store className="h-5 w-5" />
                        Install from Google Play Store
                      </Button>
                    </a>
                  )}

                  {release.playStoreUrl && release.hostMode === 'colearn' && (
                    <a 
                      href={release.playStoreUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button variant="outline" className="w-full border-stone-700 text-stone-300 hover:bg-stone-800 gap-2">
                        <Store className="h-4 w-4" />
                        Alternative: Get on Google Play
                      </Button>
                    </a>
                  )}

                  {release.appStoreUrl && (
                    <a 
                      href={release.appStoreUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button variant="ghost" className="w-full text-stone-400 hover:text-stone-200 text-xs gap-1">
                        iOS user? View CoLearn on Apple App Store
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-stone-400">
                No active mobile build available at the moment. Check back soon!
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t border-stone-800/80 pt-4 text-xs text-stone-500">
            CoLearn Mobile Application • Official FUTO Edition
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-stone-500 py-4 relative z-10">
        © {new Date().getFullYear()} CoLearn Education. All rights reserved.
      </footer>
    </div>
  );
}
