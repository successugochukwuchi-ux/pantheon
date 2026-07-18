import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  MessageSquare,
  UserPlus,
  LogOut,
  BookOpen, 
  Settings, 
  Newspaper, 
  History, 
  LayoutDashboard,
  LayoutGrid,
  Shield,
  Users,
  Key,
  BookPlus,
  ChevronRight,
  FileText,
  HelpCircle,
  CheckCircle,
  Award,
  PlayCircle,
  Bell,
  Zap,
  Sparkles,
  Trophy,
  Compass,
  Star,
  Calendar,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFlux } from '../contexts/FluxContext';
import { cn } from '../lib/utils';
import { UserSearch } from './UserSearch';
import { SystemStatus } from './SystemStatus';
import { Button } from './ui/button';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Notification, Announcement } from '../types';

interface SidebarProps {
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, isCollapsed = false, onToggleCollapse, unreadCount = 0 }) => {
  const { profile, user } = useAuth();
  const { isFluxMode, setFluxMode } = useFlux();
  const location = useLocation();

  const isAtLeastLevel2 = profile?.level === '2' || profile?.level === '3' || profile?.level === '4' || profile?.level === '5';
  const isAdmin = profile?.level === '3' || profile?.level === '4' || profile?.level === '5';
  const isAdminPath = location.pathname.startsWith('/administrator');
  const isColodgePath = location.pathname.startsWith('/colodge');

  interface SidebarNavItem {
    name: string;
    path: string;
    icon: any;
    badge?: number;
  }

  const studentNavItems: SidebarNavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Study Timetable', path: '/timetable', icon: Calendar },
    { name: 'CoLodge', path: '/colodge', icon: Home },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { name: 'Video Library', path: '/video-library', icon: PlayCircle },
    { name: 'Lecture Notes', path: '/notes?type=lecture', icon: BookOpen },
    { name: 'Past Questions', path: '/past-questions?type=past_question', icon: History },
    { name: 'CBT Practice', path: '/cbt', icon: HelpCircle },
    { name: 'CBT Results', path: '/cbt/results', icon: Award },
    { name: 'News Board', path: '/news', icon: Newspaper },
    { name: 'Chat', path: '/chat', icon: MessageSquare },
    { name: 'Friends', path: '/friends', icon: UserPlus },
    { name: 'Compete', path: '/compete', icon: Trophy },
    { name: 'Referrals', path: '/referrals', icon: Users },
  ];

  const colodgeNavItems: SidebarNavItem[] = [
    { name: 'Lodge Towns', path: '/colodge?view=student_locations', icon: Compass },
    ...(profile?.colodge_agent ? [
      { name: 'Agent Dashboard', path: '/colodge?view=agent_dashboard', icon: LayoutDashboard },
    ] : [
      { name: 'Become an Agent', path: '/colodge?view=become_agent', icon: Award }
    ]),
    { name: 'Back to Main Menu', path: '/dashboard', icon: ChevronRight }
  ];

  const adminNavItems: SidebarNavItem[] = [
    { name: 'Admin Overview', path: '/administrator', icon: Shield },
    { name: 'User Management', path: '/administrator/users', icon: Users },
    { name: 'Course Management', path: '/administrator/courses', icon: BookPlus },
    { name: 'Notes Management', path: '/administrator/notes', icon: FileText },
    { name: 'Question Management', path: '/administrator/questions', icon: HelpCircle },
    { name: 'News Management', path: '/administrator/news', icon: Newspaper },
    { name: 'Activation Pins', path: '/administrator/pins', icon: Key },
    { name: 'Video Management', path: '/administrator/videos', icon: PlayCircle },
    { name: 'Admin Manual', path: '/administrator/manual', icon: BookOpen },
  ];

  const level2AdminNavItems: SidebarNavItem[] = [
    { name: 'Admin Overview', path: '/administrator', icon: Shield },
    { name: 'Activation Pins', path: '/administrator/pins', icon: Key },
    { name: 'Admin Manual', path: '/administrator/manual', icon: BookOpen },
  ];

  const level3AdminNavItems: SidebarNavItem[] = [
    { name: 'Activation Pins', path: '/administrator/pins', icon: Key },
  ];

  const level4NavItems: SidebarNavItem[] = [
    ...adminNavItems,
    { name: 'Credentials', path: '/administrator/credentials', icon: Key },
    { name: 'System Control', path: '/administrator/system', icon: Settings },
    { name: 'System Reports', path: '/administrator/reports', icon: FileText },
  ];

  const fluxNavItems: SidebarNavItem[] = [
    { name: 'FLUX Dashboard', path: '/flux', icon: Zap },
    { name: 'Track Browser', path: '/flux/browse', icon: LayoutGrid },
    { name: 'Skill Tracks', path: '/flux/tracks', icon: Compass },
    { name: 'Smart Portfolio', path: '/flux/portfolio', icon: Star },
  ];

  const fluxAdminNavItems: SidebarNavItem[] = [
    { name: 'FLUX Admin', path: '/administrator/flux', icon: Shield },
  ];

  const getNavItems = () => {
    if (isFluxMode) {
      if (isAdminPath) return fluxAdminNavItems;
      return fluxNavItems;
    }
    
    if (isAdminPath) {
      if (profile?.level === '4' || profile?.level === '5') return level4NavItems;
      if (profile?.level === '3') return level3AdminNavItems;
      return level2AdminNavItems;
    }

    if (isColodgePath) {
      return colodgeNavItems;
    }
    
    return studentNavItems;
  };

  const navItems = getNavItems();

  return (
    <div className={cn(
      "flex flex-col h-full text-sidebar-foreground border-r shadow-sm transition-all duration-300",
      isFluxMode ? "bg-stone-950 border-pink-500/10" : "bg-sidebar"
    )}>
      <div className={cn(
        "flex items-center justify-between p-6",
        isCollapsed ? "flex-col gap-4 px-2 py-6" : ""
      )}>
        <Link 
          to={isFluxMode ? "/flux" : "/"} 
          className={cn(
            "flex items-center gap-2 font-bold transition-all",
            isCollapsed ? "text-xl justify-center text-center self-center" : "text-2xl tracking-tighter",
            isFluxMode ? "text-pink-500" : "text-sidebar-primary"
          )}
        >
          {isFluxMode ? <Zap className="fill-pink-500 h-5 w-5" /> : null}
          {isCollapsed ? (
            <span className="font-extrabold tracking-tighter text-sidebar-primary">C</span>
          ) : (
            <>
              {isColodgePath ? (
                <span className="text-sidebar-primary flex items-center gap-1">CO<span className="text-neutral-800 dark:text-neutral-200">LODGE</span></span>
              ) : (
                <>COLEARN {isFluxMode && <span className="text-white">FLUX</span>}</>
              )}
            </>
          )}
        </Link>
        {!onClose && onToggleCollapse && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rotate-180 transition-transform duration-300" />}
          </Button>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-6 mb-4 md:hidden">
          <UserSearch />
        </div>
      )}

      {isCollapsed && !isFluxMode && (
        <div className="px-2 mb-4 flex justify-center">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
        </div>
      )}

      {!isCollapsed && !isFluxMode && (
        <div className="px-6 mb-4">
          <SystemStatus />
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="py-2">
          {!isCollapsed && (
            <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              {isFluxMode ? 'Flux Ecosystem' : isColodgePath ? 'CoLodge Menu' : 'Main Menu'}
            </p>
          )}
          {navItems.map((item) => {
            const itemPathName = item.path.split('?')[0];
            const itemQuery = item.path.split('?')[1];
            const isPathActive = location.pathname === itemPathName;
            
            let isActive = false;
            if (isPathActive) {
              if (!itemQuery) {
                // If this is the plain /colodge but we clicked it, check search params
                if (itemPathName === '/colodge') {
                  isActive = !location.search || location.search.includes('view=student_locations');
                } else {
                  isActive = true;
                }
              } else {
                isActive = location.search.includes(itemQuery);
              }
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group mb-0.5",
                  isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-between",
                  isActive 
                    ? (isFluxMode 
                        ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" 
                        : "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20") 
                    : (isFluxMode 
                        ? "text-stone-400 hover:bg-white/5 hover:text-white" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4", isActive ? "" : (isFluxMode ? "text-stone-500 group-hover:text-pink-400" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"))} />
                  {!isCollapsed && <span>{item.name}</span>}
                </div>
                {item.badge && !isCollapsed && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                    {item.badge}
                  </span>
                )}
                {isActive && !item.badge && !isCollapsed && <ChevronRight className="h-4 w-4 opacity-50" />}
              </Link>
            );
          })}
        </div>

        {isAtLeastLevel2 && !isAdminPath && !isFluxMode && !isCollapsed && (
          <div className="py-4 border-t border-sidebar-border mt-4">
            <p className="px-3 text-xs font-bold text-primary uppercase tracking-widest mb-3">
              Privileged Access
            </p>
            <Link
              to={profile?.level === '3' ? "/administrator/pins" : "/administrator"}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm border border-primary/20"
            >
              <Shield className="h-4 w-4" />
              {profile?.level === '3' ? 'Vendor Dashboard' : 'Admin Control Panel'}
            </Link>
          </div>
        )}
      </nav>

      <div className={cn(
        "p-4 border-t space-y-2",
        "border-sidebar-border bg-sidebar-accent/20",
        isCollapsed ? "p-2 space-y-1" : ""
      )}>
        <Link
          to="/settings"
          onClick={onClose}
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "",
            location.pathname === '/settings' 
              ? "bg-sidebar-primary/10 text-sidebar-primary" 
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
        
        <button
          onClick={async () => {
            const { signOut } = await import('firebase/auth');
            const { auth } = await import('../firebase');
            await signOut(auth);
            if (onClose) onClose();
          }}
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all cursor-pointer",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "w-full"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};
