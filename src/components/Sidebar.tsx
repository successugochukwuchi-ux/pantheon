import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  MessageSquare,
  UserPlus,
  LogOut,
  BookOpen, 
  Settings, 
  Newspaper, 
  Calculator, 
  History, 
  LayoutDashboard,
  Shield,
  Users,
  Key,
  BookPlus,
  ChevronRight,
  FileText,
  HelpCircle,
  CheckCircle,
  Award
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { UserSearch } from './UserSearch';

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { profile } = useAuth();
  const location = useLocation();

  const isAdmin = profile?.level === '3' || profile?.level === '4';
  const isAdminPath = location.pathname.startsWith('/administrator');

  const studentNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Lecture Notes', path: '/notes?type=lecture', icon: BookOpen },
    { name: 'Past Questions', path: '/past-questions?type=past_question', icon: History },
    { name: 'CBT Practice', path: '/cbt', icon: HelpCircle },
    { name: 'CBT Results', path: '/cbt/results', icon: Award },
    { name: 'Punch Notes', path: '/punch?type=punch', icon: Calculator },
    { name: 'News Board', path: '/news', icon: Newspaper },
    { name: 'Chat', path: '/chat', icon: MessageSquare },
    { name: 'Friends', path: '/friends', icon: UserPlus },
    { name: 'Referrals', path: '/referrals', icon: Users },
  ];

  const adminNavItems = [
    { name: 'Admin Overview', path: '/administrator', icon: Shield },
    { name: 'User Management', path: '/administrator/users', icon: Users },
    { name: 'Verification Queue', path: '/administrator/verifications', icon: CheckCircle },
    { name: 'Course Management', path: '/administrator/courses', icon: BookPlus },
    { name: 'Notes Management', path: '/administrator/notes', icon: FileText },
    { name: 'CBT Management', path: '/administrator/cbt', icon: HelpCircle },
    { name: 'News Management', path: '/administrator/news', icon: Newspaper },
    { name: 'Activation Pins', path: '/administrator/pins', icon: Key },
  ];

  const level4NavItems = [
    ...adminNavItems,
    { name: 'System Control', path: '/administrator/system', icon: Settings },
  ];

  const navItems = isAdminPath 
    ? (profile?.level === '4' ? level4NavItems : adminNavItems) 
    : studentNavItems;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r shadow-sm">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-2xl tracking-tighter text-sidebar-primary">
          PANTHEON
        </Link>
        <p className="text-[10px] text-sidebar-foreground/60 font-medium uppercase tracking-widest mt-1">
          {isAdminPath ? 'Admin Portal' : 'Student Portal'}
        </p>
      </div>

      <div className="px-6 mb-4 md:hidden">
        <UserSearch />
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="py-2">
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Main Menu
          </p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground")} />
                  {item.name}
                </div>
                {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
              </Link>
            );
          })}
        </div>

        {isAdmin && !isAdminPath && (
          <div className="py-4 border-t border-sidebar-border mt-4">
            <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              Administration
            </p>
            <Link
              to="/administrator"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/20 space-y-2">
        <Link
          to="/settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            location.pathname === '/settings' 
              ? "bg-sidebar-primary/10 text-sidebar-primary" 
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          onClick={async () => {
            const { signOut } = await import('firebase/auth');
            const { auth } = await import('../firebase');
            await signOut(auth);
            if (onClose) onClose();
          }}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
};
