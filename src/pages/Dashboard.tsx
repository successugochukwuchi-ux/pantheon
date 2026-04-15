import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { NewsItem } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BookOpen, History, Calculator, Newspaper, AlertCircle, Info, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export default function Dashboard() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const { profile, systemConfig } = useAuth();

  useEffect(() => {
    if (!profile) return;

    const path = 'news';
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
      setNews(newsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, [profile]);

  const quickLinks = [
    { name: 'Lecture Notes', path: '/notes', icon: BookOpen, color: 'bg-blue-500' },
    { name: 'Past Questions', path: '/past-questions', icon: History, color: 'bg-purple-500' },
    { name: 'CBT Practice', path: '/cbt', icon: HelpCircle, color: 'bg-green-500' },
    { name: 'Punch Notes', path: '/punch', icon: Calculator, color: 'bg-orange-500' },
  ];

  const isHoliday = !systemConfig || systemConfig.currentSemester === 'none';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {profile?.username || 'Student'}!</h1>
        <p className="text-muted-foreground">Access your study materials and stay updated with the latest news.</p>
      </div>

      {isHoliday ? (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Semester Ended</AlertTitle>
          <AlertDescription>
            The academic semester has ended. Access to course materials is restricted until the next semester starts.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-primary/50 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">{systemConfig.currentSemester} Semester Active</AlertTitle>
          <AlertDescription>
            You are currently in the {systemConfig.currentSemester} semester. All relevant courses are now available.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.path} to={isHoliday ? '#' : link.path} className={isHoliday ? 'cursor-not-allowed opacity-50' : ''}>
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                <div className={`p-3 rounded-full ${link.color} text-white`}>
                  <link.icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-sm text-center">{link.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

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
