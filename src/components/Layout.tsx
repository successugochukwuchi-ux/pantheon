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
import { Badge } from './ui/badge';
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
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Sidebar } from './Sidebar';
import { UserSearch } from './UserSearch';
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

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/login');
  };

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
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-4 w-4 bg-destructive text-[10px] font-bold text-destructive-foreground rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                } />
                <DropdownMenuContent className="w-80" align="end">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Recent Notifications</span>
                    {unreadCount > 0 && <Badge variant="destructive" className="text-[10px] px-1 h-4">{unreadCount} new</Badge>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-[300px] overflow-y-auto">
                    {recentNotifications.length > 0 ? (
                      recentNotifications.map(notif => (
                        <DropdownMenuItem 
                          key={notif.id} 
                          className={cn("flex flex-col items-start gap-1 p-3 cursor-pointer", !notif.isRead && "bg-muted/50")}
                          onClick={() => navigate('/notifications')}
                        >
                          <p className={cn("text-sm font-medium", !notif.isRead && "text-primary")}>{notif.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="justify-center text-xs font-medium cursor-pointer" onClick={() => navigate('/notifications')}>
                    View all notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full border">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || ''} alt={profile?.username || user.email || ''} />
                        <AvatarFallback>{(profile?.username || user.email || 'U')[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Button>
                  } />
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
