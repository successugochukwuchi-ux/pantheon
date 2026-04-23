import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { User, Search as SearchIcon, Loader2, ArrowLeft, Shield, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      if (queryParam.length < 2) return;
      
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        
        const usernameQuery = query(
          usersRef,
          where('username', '>=', queryParam),
          where('username', '<=', queryParam + '\uf8ff'),
          limit(20)
        );
        
        const studentIdQuery = query(
          usersRef,
          where('studentId', '==', queryParam),
          limit(20)
        );
        
        const [usernameSnap, studentIdSnap] = await Promise.all([
          getDocs(usernameQuery),
          getDocs(studentIdQuery)
        ]);
        
        const usernameResults = usernameSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        const studentIdResults = studentIdSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        
        const combinedResults = [...usernameResults, ...studentIdResults];
        const uniqueResults = combinedResults.filter((user, index, self) =>
          index === self.findIndex((u) => u.uid === user.uid)
        );
        
        setResults(uniqueResults);
      } catch (error) {
        console.error("Search error:", error);
        toast.error('Failed to load search results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [queryParam]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Results</h1>
          <p className="text-muted-foreground">
            Showing results for "<span className="font-semibold text-foreground">{queryParam}</span>"
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Searching the database...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4">
          {results.map((user, index) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate('/profile/' + user.uid)}
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardContent className="p-6 flex items-center gap-6">
                  <Avatar className="h-16 w-16 border-2 border-primary/5">
                    <AvatarImage src={user.photoURL || ''} alt={user.username} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {(user.username || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold truncate group-hover:text-primary transition-colors">
                        {user.username || 'Anonymous Student'}
                      </h3>
                      {user.isActivated && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] h-5">
                          Activated
                        </Badge>
                      )}
                      {(user.level === '3' || user.level === '4') && (
                        <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                          <Shield className="h-3 w-3" /> Admin
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2 allow-copy">
                        <p className="text-sm text-muted-foreground font-mono">
                          Student ID: {user.studentId}
                        </p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(user.studentId);
                            toast.success('Student ID copied!');
                          }}
                          className="p-1 px-1.5 hover:bg-primary/10 rounded-md transition-colors flex items-center gap-1 group/btn text-[10px] font-bold text-primary"
                        >
                          <Copy className="h-3 w-3" />
                          COPY
                        </button>
                      </div>
                      <div className="flex items-center gap-2 allow-copy">
                        <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                          Firebase ID: {user.uid}
                        </p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(user.uid);
                            toast.success('Firebase UID copied!');
                          }}
                          className="p-1 px-1.5 hover:bg-primary/10 rounded-md transition-colors flex items-center gap-1 group/btn text-[10px] font-bold text-primary"
                        >
                          <Copy className="h-3 w-3" />
                          COPY
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3">
                      <div className="text-xs px-2 py-1 bg-muted rounded-md font-medium">
                        {(user.level === '3' || user.level === '4') ? `Level ${user.level}` : `${user.academicLevel || user.level} Level`}
                      </div>
                      <div className="text-xs px-2 py-1 bg-muted rounded-md font-medium">
                        {user.referralCount} Referrals
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="hidden sm:flex" onClick={(e) => {
                    e.stopPropagation();
                    navigate('/profile/' + user.uid);
                  }}>
                    View Profile
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 space-y-6 bg-muted/30 rounded-3xl border-2 border-dashed">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto">
            <SearchIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No students found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              We couldn't find any students matching your search. Try a different username or Student ID.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
