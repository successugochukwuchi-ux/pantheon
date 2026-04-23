import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Send, Users, MessageSquare, Shield, FileText, Check, Plus, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { DiscussionMessage, Course, Note } from '../types';
import { toast } from 'sonner';
import { MathJax } from 'better-react-mathjax';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

export default function CourseDiscussion() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNoteSelectorOpen, setIsNoteSelectorOpen] = useState(false);
  const [userNotes, setUserNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseForNote, setSelectedCourseForNote] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all notes for referencing
  useEffect(() => {
    if (!user || !profile) return;
    const q = query(collection(db, 'notes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    }, (error) => {
      const isLowLevel = profile.level === '1' || profile.level === '1+';
      if (!isLowLevel) {
        console.error('Notes fetch error:', error);
      }
    });
    return () => unsubscribe();
  }, [user, profile]);

  // Fetch all courses for note selector
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'courses'), orderBy('code', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => {
      const isLowLevel = profile.level === '1' || profile.level === '1+';
      if (!isLowLevel) {
        console.error('Courses fetch error:', error);
      }
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (isNoteSelectorOpen && !selectedCourseForNote && courseId) {
      setSelectedCourseForNote(courseId);
    }
  }, [isNoteSelectorOpen, courseId, selectedCourseForNote]);

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
    if (!user || (!newMessage.trim() && !selectedNote) || !courseId) return;

    const text = newMessage.trim();
    const noteId = selectedNote?.id;
    
    if (!text && !noteId) return;

    setNewMessage('');
    setSelectedNote(null);

    try {
      await addDoc(collection(db, 'discussions'), {
        courseId,
        userId: user.uid,
        username: profile?.username || user.displayName || 'Student',
        userLevel: profile?.level || '1',
        userAcademicLevel: profile?.academicLevel || profile?.level || '100',
        text,
        referencedNoteId: noteId || null,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error('Failed to send: ' + (err.message || 'Check connection'));
      // Restore the text if it failed
      setNewMessage(text);
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
                const refNote = userNotes.find(n => n.id === msg.referencedNoteId);
                
                return (
                  <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "items-start")}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {msg.username}
                      </span>
                      <Badge variant={isAdmin ? "destructive" : "secondary"} className="text-[8px] h-3 px-1 py-0 uppercase font-bold">
                        {isAdmin && <Shield className="h-2 w-2 mr-0.5 inline" />}
                        {isAdmin ? `Lvl ${msg.userLevel}` : (msg.userAcademicLevel || msg.userLevel)}
                      </Badge>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm shadow-sm space-y-2",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted rounded-tl-none"
                    )}>
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                      {refNote && (
                        <div 
                          className={cn(
                            "p-3 rounded-xl border flex items-center gap-3 cursor-pointer hover:bg-black/5 transition-colors",
                            isMe ? "bg-white/10 border-white/20" : "bg-background border-primary/10"
                          )}
                          onClick={() => navigate(`/notes?id=${refNote.id}`)}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            isMe ? "bg-white/20" : "bg-primary/10"
                          )}>
                            <FileText className={cn("h-5 w-5", isMe ? "text-white" : "text-primary")} />
                          </div>
                          <div className="min-w-0">
                            <p className={cn("font-bold text-xs truncate", isMe ? "text-white" : "text-foreground")}>{refNote.title}</p>
                            <p className={cn("text-[10px] opacity-70", isMe ? "text-white/80" : "text-muted-foreground")}>Click to view note</p>
                          </div>
                        </div>
                      )}
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

        <CardFooter className="p-4 border-t bg-muted/30 flex flex-col gap-3">
          {selectedNote && (
            <div className="flex items-center justify-between w-full bg-primary/5 p-2 px-3 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Referencing note</p>
                  <p className="text-xs font-bold truncate">{selectedNote.title}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedNote(null)}>
                <Plus className="h-4 w-4 rotate-45" />
              </Button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex w-full gap-2 relative">
            <Dialog open={isNoteSelectorOpen} onOpenChange={(open) => {
              setIsNoteSelectorOpen(open);
              if (!open) setSelectedCourseForNote(null);
            }}>
              <DialogTrigger render={
                <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10 rounded-xl hover:bg-primary/5 hover:text-primary transition-colors">
                  <FileText className="h-5 w-5" />
                </Button>
              } />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedCourseForNote ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => setSelectedCourseForNote(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                    {selectedCourseForNote ? courses.find(c => c.id === selectedCourseForNote)?.code : 'Refer a Note'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedCourseForNote ? 'Select a note to share in this discussion.' : 'Select a course to view its notes.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto space-y-2 py-4 pr-1">
                  {!selectedCourseForNote ? (
                    courses.length > 0 ? (
                      courses.map(course => (
                        <div 
                          key={course.id}
                          className="p-3 border rounded-xl hover:bg-accent hover:border-primary/20 cursor-pointer flex items-center justify-between group transition-all"
                          onClick={() => setSelectedCourseForNote(course.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{course.code}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{course.title}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground italic">No courses available.</div>
                    )
                  ) : (
                    userNotes.filter(n => n.courseId === selectedCourseForNote).length > 0 ? (
                      userNotes.filter(n => n.courseId === selectedCourseForNote).map(note => (
                        <div 
                          key={note.id}
                          className="p-3 border rounded-xl hover:bg-accent hover:border-primary/20 cursor-pointer flex items-center gap-3 transition-all active:scale-[0.98]"
                          onClick={() => {
                            setSelectedNote(note);
                            setIsNoteSelectorOpen(false);
                          }}
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{note.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded w-fit">
                                {note.type.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground space-y-3">
                        <FileText className="h-12 w-12 mx-auto opacity-10" />
                        <p className="text-sm">No notes found for this course.</p>
                        <Button variant="outline" size="sm" onClick={() => setSelectedCourseForNote(null)}>Back to courses</Button>
                      </div>
                    )
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Input 
              placeholder={selectedNote ? "Add a comment..." : "Type your message..."} 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="bg-background rounded-xl h-10"
            />
            <Button type="submit" size="icon" className="shrink-0 h-10 w-10 rounded-xl" disabled={!newMessage.trim() && !selectedNote}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
