import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { History, Award, Clock, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { CBTSession, Course } from '../types';
import { Link } from 'react-router-dom';

export default function CBTResults() {
  const { user, profile, systemConfig } = useAuth();
  const [sessions, setSessions] = useState<CBTSession[]>([]);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) return;

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'cbt_sessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CBTSession))
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setSessions(sessionData);
      setLoading(false);
    });

    const isAdmin = profile.level === '3' || profile.level === '4';

    // Fetch courses for labels - filter by semester if not admin
    let coursesQ = query(collection(db, 'courses'));
    if (!isAdmin) {
      if (systemConfig?.currentSemester && systemConfig.currentSemester !== 'none') {
        coursesQ = query(
          collection(db, 'courses'),
          where('semester', '==', systemConfig.currentSemester)
        );
      }
    }

    const unsubCourses = onSnapshot(coursesQ, (snapshot) => {
      const courseMap: Record<string, Course> = {};
      snapshot.docs.forEach(doc => {
        courseMap[doc.id] = { id: doc.id, ...doc.data() } as Course;
      });
      setCourses(courseMap);
    }, (err) => {
      console.error("Courses fetch error in CBTResults:", err);
    });

    return () => {
      unsubscribe();
      unsubCourses();
    };
  }, [user, profile, systemConfig]);

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 70) return 'text-green-500';
    if (percentage >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My CBT Results</h1>
        <p className="text-muted-foreground">Track your performance and progress over time.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions.length > 0 
                ? Math.round(sessions.reduce((acc, s) => acc + (s.score / s.totalQuestions), 0) / sessions.length * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(sessions.reduce((acc, s) => acc + s.timeSpent, 0) / 60)} mins
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="h-5 w-5" /> Recent Sessions
        </h2>
        
        <div className="grid gap-4">
          {sessions.length > 0 ? (
            sessions.map(session => {
              const course = courses[session.courseId];
              return (
                <Card key={session.id} className="overflow-hidden">
                  <div className="flex items-center p-6 gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{course?.code || 'Unknown Course'}</h3>
                        <Badge variant="outline">{course?.title || 'Course Title'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.completedAt).toLocaleDateString()} at {new Date(session.completedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-8 px-4 border-x hidden sm:flex">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold">Score</p>
                        <p className={cn("text-xl font-bold", getScoreColor(session.score, session.totalQuestions))}>
                          {session.score}/{session.totalQuestions}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold">Time</p>
                        <p className="text-xl font-bold">{Math.floor(session.timeSpent / 60)}:{(session.timeSpent % 60).toString().padStart(2, '0')}</p>
                      </div>
                    </div>

                    <Button variant="ghost" size="icon">
                      <Link to={`/cbt?courseId=${session.courseId}`}>
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>You haven't completed any CBT sessions yet.</p>
                <Button variant="link" className="mt-2">
                  <Link to="/cbt">Start practicing now</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
