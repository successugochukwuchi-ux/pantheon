import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Menu, 
  Bell,
  Shield
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Sidebar } from './Sidebar';
import { UserSearch } from './UserSearch';
import { PWAInstall } from './PWAInstall';
import { toast } from 'sonner';
import { Notification } from '../types';
import { cn } from '../lib/utils';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [recentNotifications, setRecentNotifications] = React.useState<Notification[]>([]);

  React.useEffect(() => {
    if (!user) return;

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentNotifications(notifs.slice(0, 5));
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="min-h-screen bg-background flex transition-opacity duration-150 opacity-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50">
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Toggle */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger render={
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                  </Button>
                } />
                <SheetContent side="left" className="p-0 w-72">
                  <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
              
              <h2 className="text-sm font-semibold text-muted-foreground hidden lg:block">
                {location.pathname === '/dashboard' ? 'Overview' : 
                 location.pathname.startsWith('/administrator') ? 'Administration' : 
                 'Academic Portal'}
              </h2>
            </div>

            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <UserSearch />
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {user && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground relative"
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-destructive text-[10px] font-bold text-destructive-foreground rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              )}

              {user ? (
                <Button 
                  variant="ghost" 
                  className="relative h-9 w-9 rounded-full border p-0 hover:bg-muted"
                  onClick={() => navigate(`/profile/${user.uid}`)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || ''} alt={profile?.username || user.email || ''} />
                    <AvatarFallback>{(profile?.username || user.email || 'U')[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              ) : (
                <Button onClick={() => navigate('/login')} size="sm">Sign In</Button>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t py-6 px-4 md:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              Built for FUTO Students. © 2026 Pantheon Team.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/terms" className="hover:underline">Terms</Link>
              <Link to="/privacy" className="hover:underline">Privacy</Link>
            </div>
          </div>
        </footer>

        {/* PWA Install Prompt */}
        <PWAInstall />
      </div>
    </div>
  );
};
