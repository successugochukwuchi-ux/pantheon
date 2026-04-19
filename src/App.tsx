import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { MathJaxContext } from 'better-react-mathjax';

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
import PastQuestions from './pages/PastQuestions';
import VideoLibrary from './pages/VideoLibrary';
import Chat from './pages/Chat';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

import { MaintenanceGuard } from './components/MaintenanceGuard';

export default function App() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    };

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
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
        <MathJaxContext config={mathJaxConfig}>
          <Router>
          <MaintenanceGuard>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/banned" element={<Banned />} />

              {/* Protected Routes (Require Auth) */}
              <Route path="/activate" element={
                <ProtectedRoute requireActivation={false}>
                  <Layout>
                    <Activate />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Protected Routes (Require Auth & Activation) */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/notes" element={
                <ProtectedRoute>
                  <Layout>
                    <StudyMaterials />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/past-questions" element={
                <ProtectedRoute>
                  <Layout>
                    <PastQuestions />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/punch" element={
                <ProtectedRoute>
                  <Layout>
                    <StudyMaterials />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/cbt" element={
                <ProtectedRoute>
                  <Layout>
                    <CBTPractice />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/cbt/results" element={
                <ProtectedRoute>
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
                <ProtectedRoute>
                  <Layout>
                    <Friends />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/video-library" element={
                <ProtectedRoute>
                  <Layout>
                    <VideoLibrary />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/chat" element={
                <ProtectedRoute>
                  <Layout>
                    <Chat />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/notifications" element={
                <ProtectedRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/discussions/:courseId" element={
                <ProtectedRoute>
                  <Layout>
                    <CourseDiscussion />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/profile/:userId" element={
                <ProtectedRoute>
                  <Layout>
                    <PublicProfile />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/search" element={
                <ProtectedRoute>
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

              {/* Admin Routes */}
              <Route path="/administrator/*" element={
                <ProtectedRoute minLevel="3">
                  <Layout>
                    <AdminPanel />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MaintenanceGuard>
          <Toaster position="top-center" />
        </Router>
      </MathJaxContext>
    </AuthProvider>
  </ThemeProvider>
  );
}
