import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { MathJaxContext } from 'better-react-mathjax';
import { TooltipProvider } from './components/ui/tooltip';
import { FluxProvider } from './contexts/FluxContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Activate from './pages/Activate';
import Dashboard from './pages/Dashboard';
import StudyMaterials from './pages/StudyMaterials';
import CBTPractice from './pages/CBTPractice';
import CBTResults from './pages/CBTResults';
import Referrals from './pages/Referrals';
import Notifications from './pages/Notifications';
import CourseDiscussion from './pages/CourseDiscussion';
import PublicProfile from './pages/PublicProfile';
import SearchResults from './pages/SearchResults';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import Banned from './pages/Banned';
import News from './pages/News';
import Friends from './pages/Friends';
import Compete from './pages/Compete';
import PastQuestions from './pages/PastQuestions';
import VideoLibrary from './pages/VideoLibrary';
import Chat from './pages/Chat';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import StudyTimetable from './pages/StudyTimetable';
import Onboarding from './pages/Onboarding';

import { MaintenanceGuard } from './components/MaintenanceGuard';
import Diagnostic from './pages/Diagnostic';
import FluxDashboard from './pages/flux/FluxDashboard';
import FluxAdmin from './pages/flux/FluxAdmin';
import FluxBrowse from './pages/flux/FluxBrowse';
import FluxTracks from './pages/flux/FluxTracks';
import FluxPortfolio from './pages/flux/FluxPortfolio';
import { FluxGuard } from './components/FluxGuard';

export default function App() {
  console.log("[COLEARN] App Rendering. URL:", window.location.pathname);
  
  useEffect(() => {
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
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
    };
  }, []);

  const mathJaxConfig = {
    loader: { load: ["[tex]/mhchem", "[tex]/physics"] },
    tex: {
      packages: { "[+]": ["mhchem", "physics"] },
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      macros: {
        degree: "^{\\circ}"
      }
    }
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <FluxProvider>
            <MathJaxContext config={mathJaxConfig}>
              <TooltipProvider>
                <MaintenanceGuard>
                  <Toaster position="top-center" />
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/banned" element={<Banned />} />
                    <Route path="/diag" element={<Diagnostic />} />
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
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <StudyTimetable />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/notes" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <StudyMaterials />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/past-questions" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <PastQuestions />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/cbt" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <CBTPractice />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/cbt/results" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <CBTResults />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/referrals" element={
                      <ProtectedRoute>
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
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Friends />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/compete" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <Compete />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/video-library" element={
                      <ProtectedRoute requireActivation={false}>
                        <Layout>
                          <VideoLibrary />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="/chat" element={
                      <ProtectedRoute requireActivation={false}>
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
                      <ProtectedRoute requireActivation={false}>
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

                    <Route path="/administrator/*" element={
                      <ProtectedRoute minLevel="2">
                        <Layout>
                          <AdminPanel />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MaintenanceGuard>
              </TooltipProvider>
            </MathJaxContext>
          </FluxProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
