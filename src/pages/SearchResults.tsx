import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { User, Search as SearchIcon, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

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
            >
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardContent className="p-6 flex items-center gap-6">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border-2 border-primary/5">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold truncate group-hover:text-primary transition-colors">
                        {user.username || 'Anonymous Student'}
                      </h3>
                      {user.isActivated && (
                        <div className="h-2 w-2 rounded-full bg-green-500" title="Activated Account" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      Student ID: {user.studentId}
                    </p>
                    <div className="flex gap-4 mt-3">
                      <div className="text-xs px-2 py-1 bg-muted rounded-md font-medium">
                        Level {user.level}
                      </div>
                      <div className="text-xs px-2 py-1 bg-muted rounded-md font-medium">
                        {user.referralCount} Referrals
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="hidden sm:flex">
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
