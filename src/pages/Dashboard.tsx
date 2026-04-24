import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { NewsItem, Course } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BookOpen, History, Calculator, Newspaper, AlertCircle, Info, HelpCircle, Trophy, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useTitle } from '../hooks/useTitle';
import { SystemStatus } from '../components/SystemStatus';
import { Progress } from '../components/ui/progress';

export default function Dashboard() {
  useTitle('Dashboard');
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>({});
  const { profile, systemConfig, loading, isSystemConfigReady, user } = useAuth();

  useEffect(() => {
    if (!profile || !systemConfig || systemConfig.currentSemester === 'none') return;

    // Fetch courses for the current semester to show progress
    const q = query(
      collection(db, 'courses'),
      where('semester', '==', systemConfig.currentSemester)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'courses');
    });

    // Fetch user progress for courses
    const progQ = query(
      collection(db, 'progress'),
      where('uid', '==', user?.uid),
      where('type', '==', 'course')
    );
    const unsubProg = onSnapshot(progQ, (snapshot) => {
      const progMap: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        progMap[data.targetId] = data.percentage || 0;
      });
      setCourseProgress(progMap);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'progress');
    });

    return () => {
      unsub();
      unsubProg();
    };
  }, [profile, systemConfig, user]);

  useEffect(() => {
    if (!profile) return;

    const path = 'news';
    const q = query(collection(db, 'news'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as NewsItem))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNews(newsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, [profile]);

  const quickLinks = [
    { name: 'Lecture Notes', path: '/notes?type=lecture', icon: BookOpen, color: 'bg-blue-500' },
    { name: 'Past Questions', path: '/past-questions?type=past_question', icon: History, color: 'bg-purple-500' },
    { name: 'CBT Practice', path: '/cbt', icon: HelpCircle, color: 'bg-green-500' },
    { name: 'Punch Notes', path: '/punch?type=punch', icon: Calculator, color: 'bg-orange-500' },
  ];

  const isHoliday = isSystemConfigReady && (systemConfig?.currentSemester === 'none' || !systemConfig);
  const isUnactivated = profile && !profile.isActivated;

  if (loading || !isSystemConfigReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground animate-pulse">Syncing platform status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {profile?.username || 'Student'}!</h1>
        <p className="text-muted-foreground">Access your study materials and stay updated with the latest news.</p>
      </div>

      {isUnactivated && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-500/5">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <AlertTitle className="text-orange-600">Account Not Activated</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Your account is currently inactive. Please activate your account to access all study materials.</span>
            <Button 
              size="sm" 
              className="bg-orange-600 hover:bg-orange-700 text-white border-none w-fit"
              onClick={() => navigate('/activate')}
            >
              Activate Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="md:hidden">
        <SystemStatus />
      </div>

      {isHoliday && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Courses Restricted</AlertTitle>
          <AlertDescription>
            The academic semester has ended. Access to course materials is restricted until the next semester starts.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.path} to={isHoliday ? '#' : link.path} className={isHoliday ? 'cursor-not-allowed opacity-50' : ''}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full border-primary/10 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                <div className={`p-3 rounded-full ${link.color} text-white shadow-lg`}>
                  <link.icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-sm text-center">{link.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Course Progress Section */}
      {!isHoliday && courses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-primary/80 uppercase tracking-tight">Academic Progress</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const progress = courseProgress[course.id] || 0;
              return (
                <Card key={course.id} className="group relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`} />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      {course.code}
                      {progress === 100 && <Trophy className="h-4 w-4 text-amber-500" />}
                    </CardTitle>
                    <CardDescription className="text-xs truncate">{course.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-muted-foreground uppercase">Completion</span>
                      <span className={progress === 100 ? 'text-green-600' : 'text-primary'}>{progress}%</span>
                    </div>
                    <Progress value={progress} className={`h-1.5 ${progress === 100 ? 'bg-green-100 dark:bg-green-900/20' : ''}`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* News Board */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">News Board</h2>
        </div>
        <div className="grid gap-4">
          {news.length > 0 ? (
            news.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{new Date(item.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm line-clamp-3">{item.content}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No news updates yet. Check back later!
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
