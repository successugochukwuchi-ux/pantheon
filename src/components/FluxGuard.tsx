import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface FluxGuardProps {
  children: React.ReactNode;
}

export const FluxGuard: React.FC<FluxGuardProps> = ({ children }) => {
  const { systemConfig, profile } = useAuth();

  // If fluxEnabled is explicitly set to false, check permissions
  // By default, it is enabled (undefined or true)
  const isFluxEnabled = systemConfig?.fluxEnabled !== false;
  const isLevel4Admin = profile?.level === '4';

  if (!isFluxEnabled && !isLevel4Admin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-pink-500/20 blur-xl rounded-full scale-150 animate-pulse" />
          <div className="relative p-6 bg-stone-900 border border-pink-500/30 rounded-3xl text-pink-500">
            <Zap className="w-12 h-12 fill-pink-500 animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white mb-4">
          COLEARN FLUX OFFLINE
        </h1>
        
        <p className="max-w-md text-stone-400 text-sm md:text-base leading-relaxed mb-8">
          The Extracurricular Wing is currently undergoing structural upgrades. 
          Level 4 Administrators are engineering next-gen skill tracks. Standard access will resume shortly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link to="/dashboard">
            <Button className="bg-white text-black hover:bg-stone-200 font-bold px-6 py-5 rounded-xl flex items-center gap-2 shadow-lg">
              <ArrowLeft size={16} /> Return to Dashboard
            </Button>
          </Link>
          
          {profile?.level === '3' && (
            <div className="flex items-center gap-2 text-stone-500 text-xs px-4 py-2 border border-white/5 rounded-xl bg-stone-900/50">
              <ShieldAlert size={14} /> Level 3 Admin (Access Restricted)
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
