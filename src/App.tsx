import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Activate from './pages/Activate';
import Dashboard from './pages/Dashboard';
import LectureNotes from './pages/LectureNotes';
import CBTPractice from './pages/CBTPractice';
import SearchResults from './pages/SearchResults';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import Banned from './pages/Banned';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
                  <LectureNotes />
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
          <Toaster position="top-center" />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
