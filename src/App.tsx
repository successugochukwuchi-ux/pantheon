import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense, ComponentType } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { FluxProvider } from './contexts/FluxContext';
import { MaintenanceGuard } from './components/MaintenanceGuard';
import {
  canAttemptChunkReload,
  isChunkLoadError,
  triggerChunkRecoveryReload,
} from './lib/chunkRecovery';

// Keep the initial landing route eager so "/" renders immediately without a second fetch waterfall
import Landing from './pages/Landing';

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstErr) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        return await factory();
      } catch (secondErr) {
        const finalErr = secondErr || firstErr;
        if (isChunkLoadError(finalErr) && canAttemptChunkReload()) {
          triggerChunkRecoveryReload(true);
          return await new Promise<never>(() => {});
        }
        throw finalErr;
      }
    }
  });
}

// Lazy-load Layout and guards only when entering authenticated routes
const Layout = lazyWithRetry(() =>
  import('./components/Layout').then((m) => ({ default: m.Layout }))
);
const FluxGuard = lazyWithRetry(() =>
  import('./components/FluxGuard').then((m) => ({ default: m.FluxGuard }))
);

// Route-level code splitting for fast initial launch
const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const Activate = lazyWithRetry(() => import('./pages/Activate'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const StudyMaterials = lazyWithRetry(() => import('./pages/StudyMaterials'));
const CBTPractice = lazyWithRetry(() => import('./pages/CBTPractice'));
const CBTResults = lazyWithRetry(() => import('./pages/CBTResults'));
const Referrals = lazyWithRetry(() => import('./pages/Referrals'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const CourseDiscussion = lazyWithRetry(() => import('./pages/CourseDiscussion'));
const PublicProfile = lazyWithRetry(() => import('./pages/PublicProfile'));
const SearchResults = lazyWithRetry(() => import('./pages/SearchResults'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Feedback = lazyWithRetry(() => import('./pages/Feedback'));
const Banned = lazyWithRetry(() => import('./pages/Banned'));
const News = lazyWithRetry(() => import('./pages/News'));
const Friends = lazyWithRetry(() => import('./pages/Friends'));
const PastQuestions = lazyWithRetry(() => import('./pages/PastQuestions'));
const Chat = lazyWithRetry(() => import('./pages/Chat'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'));
const DownloadPage = lazyWithRetry(() => import('./pages/Download'));
const StudyTimetable = lazyWithRetry(() => import('./pages/StudyTimetable'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));

const FluxDashboard = lazyWithRetry(() => import('./pages/flux/FluxDashboard'));
const FluxBrowse = lazyWithRetry(() => import('./pages/flux/FluxBrowse'));
const FluxTracks = lazyWithRetry(() => import('./pages/flux/FluxTracks'));
const FluxPortfolio = lazyWithRetry(() => import('./pages/flux/FluxPortfolio'));

const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'));
const FluxAdmin = lazyWithRetry(() => import('./pages/flux/FluxAdmin'));
const Diagnostic = lazyWithRetry(() => import('./pages/Diagnostic'));
const VideoLibrary = lazyWithRetry(() => import('./pages/VideoLibrary'));
const Compete = lazyWithRetry(() => import('./pages/Compete'));
const PlxVerifier = lazyWithRetry(() => import('./pages/PlxVerifier'));

const PageLoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-base tracking-tight">CoLearn</h3>
        <p className="text-xs text-muted-foreground">Loading page...</p>
      </div>
    </div>
  </div>
);

export default function App() {
  useEffect(() => {
    try {
      sessionStorage.removeItem('colearn_boot_retried');
      const url = new URL(window.location.href);
      if (url.searchParams.has('_cb')) {
        url.searchParams.delete('_cb');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch {}

    // Warm likely next route only during idle time after initial paint
    const scheduleIdle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? (cb: () => void) => (window as any).requestIdleCallback(cb, { timeout: 3500 })
        : (cb: () => void) => window.setTimeout(cb, 2500);
    const cancelIdle =
      typeof window !== 'undefined' && 'cancelIdleCallback' in window
        ? (id: number) => (window as any).cancelIdleCallback(id)
        : (id: number) => window.clearTimeout(id);

    const idleId = scheduleIdle(() => {
      import('./pages/Login').catch(() => {});
    });

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('.allow-copy') ||
        (window.getSelection()?.toString() && target.closest('.allow-copy-container'))
      ) return;
      e.preventDefault();
    };

    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    return () => {
      cancelIdle(idleId);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <FluxProvider>
            <TooltipProvider>
              <MaintenanceGuard>
                <Toaster position="top-center" />
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/download" element={<DownloadPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/banned" element={<Banned />} />
                    <Route path="/diag" element={<Diagnostic />} />
                    <Route path="/plx-verifier" element={<PlxVerifier />} />
                    <Route path="/onboarding" element={
                      <ProtectedRoute requireActivation={false} requireOnboarding={false}>
                        <Onboarding />
                      </ProtectedRoute>
                    } />

                    {/* FLUX Routes */}
                    <Route path="/flux" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <FluxDashboard />
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/flux/browse" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <FluxBrowse />
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/flux/clubs" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <div className="flex items-center justify-center min-h-[60vh] text-stone-500 font-bold uppercase tracking-widest italic">Clubs coming soon to FLUX</div>
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/flux/tracks" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <FluxTracks />
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/flux/competitions" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <div className="flex items-center justify-center min-h-[60vh] text-stone-500 font-bold uppercase tracking-widest italic">Competitions coming soon to FLUX</div>
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/flux/portfolio" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <FluxGuard>
                            <FluxPortfolio />
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/administrator/flux" element={
                      <ProtectedRoute minLevel="3">
                        <Layout>
                          <FluxGuard>
                            <FluxAdmin />
                          </FluxGuard>
                        </Layout>
                      </ProtectedRoute>
                    } />

                    {/* Protected Routes */}
                    <Route path="/activate" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Activate />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/dashboard" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Dashboard />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/timetable" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <StudyTimetable />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/notes" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <StudyMaterials />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/past-questions" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <PastQuestions />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/cbt" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <CBTPractice />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/cbt/results" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <CBTResults />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/referrals" element={
                      <ProtectedRoute blockVendors>
                        <Layout>
                          <Referrals />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/news" element={
                      <ProtectedRoute>
                        <Layout>
                          <News />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/friends" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <Friends />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/compete" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <Compete />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/video-library" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <VideoLibrary />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/chat" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <Chat />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/notifications" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Notifications />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/discussions/:courseId" element={
                      <ProtectedRoute blockVendors requireActivation={false}>
                        <Layout>
                          <CourseDiscussion />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/profile/:userId" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <PublicProfile />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/search" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <SearchResults />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <Layout>
                          <Settings />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/feedback" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Feedback />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/administrator/*" element={
                      <ProtectedRoute minLevel="2">
                        <Layout>
                          <AdminPanel />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </MaintenanceGuard>
            </TooltipProvider>
          </FluxProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
