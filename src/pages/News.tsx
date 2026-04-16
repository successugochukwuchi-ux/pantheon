import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Newspaper, Calendar, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Badge } from '../components/ui/badge';
import { useTitle } from '../hooks/useTitle';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category?: string;
}

export default function News() {
  useTitle('News Board');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">News Board</h1>
        <p className="text-muted-foreground">Stay updated with the latest academic news and announcements.</p>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <div className="h-40 bg-muted" />
            </Card>
          ))}
        </div>
      ) : news.length > 0 ? (
        <div className="grid gap-6">
          {news.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-primary group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      Announcement
                    </Badge>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-2xl group-hover:text-primary transition-colors">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                    {item.content.split('\n').map((paragraph, i) => (
                      <p key={i} className="mb-4 last:mb-0">{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
          <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-xl font-semibold">No news yet</h3>
          <p className="text-muted-foreground">Check back later for updates.</p>
        </div>
      )}
    </div>
  );
}
