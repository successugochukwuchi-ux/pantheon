import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Input } from './ui/input';
import { Search, User, Loader2, X, Copy, Check as CheckIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const UserSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const usersRef = collection(db, 'users');
          
          // Perform two separate queries to avoid composite index requirements for OR queries with multiple fields
          const usernameQuery = query(
            usersRef,
            where('username', '>=', searchTerm),
            where('username', '<=', searchTerm + '\uf8ff'),
            limit(5)
          );
          
          const studentIdQuery = query(
            usersRef,
            where('studentId', '==', searchTerm),
            limit(5)
          );
          
          const [usernameSnap, studentIdSnap] = await Promise.all([
            getDocs(usernameQuery),
            getDocs(studentIdQuery)
          ]);
          
          const usernameResults = usernameSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
          const studentIdResults = studentIdSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
          
          // Merge results and remove duplicates
          const combinedResults = [...usernameResults, ...studentIdResults];
          const uniqueResults = combinedResults.filter((user, index, self) =>
            index === self.findIndex((u) => u.uid === user.uid)
          );
          
          setResults(uniqueResults.slice(0, 5));
          setIsOpen(true);
        } catch (error) {
          console.error("Search error:", error);
          toast.error('Search failed. Please try again.');
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchTerm.length >= 2) {
      setIsOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={searchRef}>
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search students by username or ID..."
          className="pl-10 pr-10 h-10 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
        />
        {searchTerm && (
          <button 
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Search Results
                  </p>
                  {results.map((user) => (
                    <button
                      key={user.uid}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left group"
                      onClick={() => {
                        setIsOpen(false);
                        setSearchTerm('');
                        navigate(`/profile/${user.uid}`);
                      }}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden border">
                        <img 
                          src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || user.uid}`} 
                          alt={user.username}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                            {user.username || 'Anonymous'}
                          </p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">Lvl {user.academicLevel || `${user.level}00`}</span>
                        </div>
                        <div className="flex flex-col gap-1 mt-0.5">
                          <div className="flex items-center gap-2 allow-copy">
                            <p className="text-[10px] text-muted-foreground font-mono">
                              ID: {user.studentId}
                            </p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(user.studentId);
                                toast.success('Student ID copied!');
                              }}
                              className="p-1 hover:bg-primary/10 rounded transition-colors"
                            >
                              <Copy className="h-2.5 w-2.5 text-primary" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 allow-copy">
                            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                              UID: {user.uid}
                            </p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(user.uid);
                                toast.success('Firebase UID copied!');
                              }}
                              className="p-1 hover:bg-primary/10 rounded transition-colors"
                            >
                              <Copy className="h-2.5 w-2.5 text-primary" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={handleSearch}
                    className="w-full p-2 text-xs text-center text-primary font-bold hover:underline border-t mt-1"
                  >
                    See all results for "{searchTerm}"
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No students found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
