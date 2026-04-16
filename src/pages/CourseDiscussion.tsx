import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Send, Users, MessageSquare, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { DiscussionMessage, Course } from '../types';
import { toast } from 'sonner';

export default function CourseDiscussion() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (courseDoc.exists()) {
        setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
      } else {
        toast.error('Course not found');
        navigate('/dashboard');
      }
    };

    fetchCourse();

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'discussions'),
      where('courseId', '==', courseId),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as DiscussionMessage))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error('Discussion error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newMessage.trim() || !courseId) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'discussions'), {
        courseId,
        userId: user.uid,
        username: profile.username || 'Anonymous',
        userLevel: profile.level,
        text,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  if (!course) return null;

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5">{course.code}</Badge>
          <h1 className="font-bold text-lg hidden sm:block">{course.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Users className="h-4 w-4" />
          <span>Discussion Board</span>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Live Chat</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
          {messages.length > 0 ? (
            messages.map((msg) => {
              const isMe = msg.userId === user?.uid;
              const isAdmin = msg.userLevel === '3' || msg.userLevel === '4';
              
              return (
                <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "items-start")}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {msg.username}
                    </span>
                    <Badge variant={isAdmin ? "destructive" : "secondary"} className="text-[8px] h-3 px-1 py-0 uppercase font-bold">
                      {isAdmin && <Shield className="h-2 w-2 mr-0.5 inline" />}
                      Lvl {msg.userLevel}
                    </Badge>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-2xl text-sm shadow-sm",
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : "bg-muted rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] text-muted-foreground mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
              <MessageSquare className="h-12 w-12" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 border-t bg-muted/30">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input 
              placeholder="Type your message..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="bg-background"
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
