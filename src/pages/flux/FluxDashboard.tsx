import React, { useEffect, useState } from 'react';
import { Trophy, Users, Star, Zap, ArrowRight, Compass, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

interface TrackSummary {
  id: string;
  title: string;
  category: string;
  enrolledCount?: number;
}

const FluxDashboard = () => {
  const { profile, user } = useAuth();
  const isActivated = profile?.isActivated;
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadFluxSummary = async () => {
      try {
        const tracksSnap = await getDocs(
          query(collection(db, 'flux_tracks'), orderBy('createdAt', 'desc'), limit(4))
        );
        if (active) {
          setTracks(tracksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        }
        if (user?.uid) {
          const enrollSnap = await getDocs(
            query(collection(db, 'flux_enrollments'), where('userId', '==', user.uid))
          );
          if (active) {
            setEnrolledCount(enrollSnap.size);
            setCompletedCount(enrollSnap.docs.filter((d) => d.data().status === 'completed').length);
          }
        }
      } catch (err) {
        console.error('Failed to load Flux dashboard data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFluxSummary();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  return (
    <div className="space-y-8 pb-12">
      <div className="relative overflow-hidden rounded-3xl bg-stone-900 border border-white/5 p-8 md:p-10">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
            CoLearn Flux
          </h1>
          <p className="text-stone-400 text-base md:text-lg">
            Build practical skills alongside your university courses{profile?.username ? `, ${profile.username}` : ''}.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/flux/browse"
              className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Browse Tracks <ArrowRight size={16} />
            </Link>
            <Link
              to="/flux/tracks"
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-stone-200 font-semibold px-5 py-2.5 rounded-xl text-sm border border-white/10 transition-colors"
            >
              My Tracks
            </Link>
          </div>

          {!isActivated && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 mt-4">
              <Zap className="text-amber-400 shrink-0" size={18} />
              <p className="text-sm text-amber-200">
                Activate your CoLearn account to enroll in all skill tracks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Real Enrollment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Compass}
          label="Enrolled Tracks"
          value={loading ? '—' : String(enrolledCount)}
          color="pink"
          subtitle="Active enrollments"
        />
        <StatCard
          icon={Trophy}
          label="Completed"
          value={loading ? '—' : String(completedCount)}
          color="violet"
          subtitle="Finished tracks"
        />
        <StatCard
          icon={LayoutGrid}
          label="Available Tracks"
          value={loading ? '—' : String(tracks.length)}
          color="indigo"
          subtitle="Ready to join"
        />
      </div>

      {/* Available Tracks Preview */}
      <div className="bg-stone-900/50 border border-white/5 rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-white">
            <Star size={18} className="text-pink-500" /> Skill Tracks
          </h3>
          <Link to="/flux/browse" className="text-pink-500 text-sm font-semibold flex items-center gap-1 hover:underline">
            Browse all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-stone-500 py-6">Loading tracks...</p>
        ) : tracks.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-sm">
            No skill tracks published yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tracks.map((track) => (
              <Link
                key={track.id}
                to="/flux/browse"
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
              >
                <div>
                  <p className="font-bold text-white group-hover:text-pink-400 transition-colors">{track.title}</p>
                  <p className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                    <span>{track.category || 'General'}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> {track.enrolledCount || 0} learners
                    </span>
                  </p>
                </div>
                <ArrowRight size={16} className="text-stone-600 group-hover:text-white transition-colors" />
              </Link>
            ))}
          </div>
        )}
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
    <div className="bg-stone-900/50 border border-white/5 p-6 rounded-2xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-bold text-white">{value}</h4>
        <span className="text-xs text-stone-500">{subtitle}</span>
      </div>
    </div>
  );
};

export default FluxDashboard;

