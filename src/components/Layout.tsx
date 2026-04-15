import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings, 
  LogOut, 
  Menu, 
  Bell,
  Shield
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Sidebar } from './Sidebar';
import { UserSearch } from './UserSearch';
import { toast } from 'sonner';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const [isBlurred, setIsBlurred] = React.useState(false);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  React.useEffect(() => {
    const preventActions = (e: Event) => {
      e.preventDefault();
    };

    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'S')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.metaKey && e.shiftKey && (e.key === '4' || e.key === '3' || e.key === '5'))
      ) {
        if (e.key === 'PrintScreen') {
          setIsBlurred(true);
          setTimeout(() => setIsBlurred(false), 3000);
        }
        e.preventDefault();
        toast.error('Security: This action is disabled.');
      }
    };

    const handleBlur = () => {
      setIsBlurred(true);
    };
    const handleFocus = () => {
      // Small delay to prevent flickering but keep it secure
      setTimeout(() => {
        if (document.hasFocus()) setIsBlurred(false);
      }, 100);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      }
    };

    // Detect viewport changes that might indicate a screenshot tool cropping the window
    const handleResize = () => {
      setIsBlurred(true);
      setTimeout(() => {
        if (document.hasFocus()) setIsBlurred(false);
      }, 1000);
    };

    document.addEventListener('contextmenu', preventActions);
    document.addEventListener('keydown', preventKeys);
    document.addEventListener('copy', preventActions);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Mobile specific: detect touch start/end patterns that might indicate screenshot
    const handleTouch = () => {
      if (isBlurred) setIsBlurred(false);
    };
    window.addEventListener('touchstart', handleTouch);

    return () => {
      document.removeEventListener('contextmenu', preventActions);
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('copy', preventActions);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [isMobile]);

  return (
    <div className={`min-h-screen bg-background flex transition-opacity duration-150 ${isBlurred ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl">
          <div className="text-white text-center p-8 border border-white/10 rounded-3xl bg-black/40 shadow-2xl">
            <Shield className="h-16 w-16 mx-auto mb-6 text-destructive animate-pulse" />
            <h2 className="text-3xl font-bold mb-3">Security Shield Active</h2>
            <p className="text-white/50 max-w-xs mx-auto">Content is protected while window is inactive or during capture attempt.</p>
          </div>
        </div>
      )}
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
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle Menu</span>
                    </Button>
                  }
                />
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
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Bell className="h-5 w-5" />
              </Button>

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full border">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.photoURL || ''} alt={profile?.username || user.email || ''} />
                          <AvatarFallback>{(profile?.username || user.email || 'U')[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Button>
                    }
                  />
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.username || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
      </div>
    </div>
  );
};
