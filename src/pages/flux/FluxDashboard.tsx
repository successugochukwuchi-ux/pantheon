import React from 'react';
import { Trophy, Users, Star, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

const FluxDashboard = () => {
  const { profile, user } = useAuth();
  const isActivated = profile?.isActivated;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-stone-900 border border-white/5 p-8 md:p-12">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Zap className="w-64 h-64 text-pink-500" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-pink-500/10 text-pink-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Sparkles size={14} /> FLUX Active
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black mb-6 tracking-tighter"
          >
            Where Passion <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-indigo-500">
              Meets Mastery.
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-stone-400 text-lg mb-8"
          >
            Welcome to the extracurricular heart of Pantheon, {user?.displayName?.split(' ')[0]}. 
            Build your legacy beyond the lecture halls.
          </motion.p>
          
          {!isActivated && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-center gap-4">
              <Zap className="text-yellow-500 shrink-0" />
              <p className="text-sm text-yellow-200">
                Activate your Pantheon account to unlock elite clubs and premium competition tracks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={Users} 
          label="Active Clubs" 
          value="4" 
          color="pink"
          subtitle="2 Lead roles"
        />
        <StatCard 
          icon={Star} 
          label="Impact Score" 
          value="840" 
          color="violet"
          subtitle="Top 5% student"
        />
        <StatCard 
          icon={Trophy} 
          label="Badges Earned" 
          value="12" 
          color="indigo"
          subtitle="3 New this month"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recommended Tracks */}
        <div className="bg-stone-900/50 border border-white/5 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap size={20} className="text-pink-500" /> Recommended Tracks
            </h3>
            <button className="text-pink-500 text-sm font-bold flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-4">
            <TrackItem title="Robotics & AI" level="Advanced" students="120" color="bg-pink-500" />
            <TrackItem title="Creative Writing" level="Intermediate" students="85" color="bg-violet-500" />
            <TrackItem title="Public Speaking" level="Beginner" students="240" color="bg-indigo-500" />
          </div>
        </div>

        {/* Upcoming Competitions */}
        <div className="bg-stone-900/50 border border-white/5 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Trophy size={20} className="text-violet-500" /> Upcoming Contests
            </h3>
            <button className="text-violet-500 text-sm font-bold flex items-center gap-1 hover:underline">
              Calendar <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-4">
            <CompetitionItem title="FUTO Hackathon 2024" date="May 15" status="Registration Open" />
            <CompetitionItem title="Regional Debate Finals" date="June 02" status="Invited" />
            <CompetitionItem title="Science Fair Expo" date="June 20" status="Coming soon" />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subtitle }: any) => {
  const colorMap: any = {
    pink: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className="bg-stone-900/50 border border-white/5 p-6 rounded-2xl hover:border-white/10 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-black">{value}</h4>
        <span className="text-[10px] font-bold text-stone-500 uppercase">{subtitle}</span>
      </div>
    </div>
  );
};

const TrackItem = ({ title, level, students, color }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group">
    <div className="flex items-center gap-4">
      <div className={`w-2 h-10 rounded-full ${color}`} />
      <div>
        <p className="font-bold group-hover:text-pink-400 transition-colors">{title}</p>
        <p className="text-xs text-stone-500">{level} • {students} students enrolled</p>
      </div>
    </div>
    <ArrowRight size={16} className="text-stone-700 group-hover:text-white transition-colors" />
  </div>
);

const CompetitionItem = ({ title, date, status }: any) => (
  <div className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
    <div>
      <p className="font-bold">{title}</p>
      <p className="text-xs text-stone-500">{date}</p>
    </div>
    <span className="text-[10px] font-black px-2 py-1 bg-stone-800 text-white rounded uppercase tracking-tighter">
      {status}
    </span>
  </div>
);

export default FluxDashboard;
