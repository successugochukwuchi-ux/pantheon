import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useTitle } from '../hooks/useTitle';
import { FeedbackItem, FeedbackType } from '../types';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Bug, 
  Lightbulb, 
  HelpCircle, 
  BookOpen, 
  ArrowUpRight, 
  Building2, 
  GraduationCap, 
  ShieldCheck, 
  Sparkles,
  History,
  MessageCircle
} from 'lucide-react';

const FEEDBACK_CATEGORIES: { type: FeedbackType; label: string; icon: any; description: string }[] = [
  { 
    type: 'Bug Report', 
    label: 'Bug Report', 
    icon: Bug, 
    description: 'Report an error, glitch, or unexpected app behavior' 
  },
  { 
    type: 'Academic Content Issue', 
    label: 'Academic Issue', 
    icon: BookOpen, 
    description: 'Report note inaccuracies, past question errors, or syllabus issues' 
  },
  { 
    type: 'Feature Request', 
    label: 'Feature Request', 
    icon: Lightbulb, 
    description: 'Suggest new features or improvements for CoLearn' 
  },
  { 
    type: 'General Feedback', 
    label: 'General Feedback', 
    icon: MessageSquare, 
    description: 'Share your general thoughts, praises, or student experience' 
  },
  { 
    type: 'Platform Inquiry', 
    label: 'Platform Inquiry', 
    icon: HelpCircle, 
    description: 'Ask questions regarding accounts, activation pins, or courses' 
  }
];

export default function Feedback() {
  useTitle('Feedback & Support');
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<FeedbackType>('General Feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const userUni = (profile?.At || 'futo').toUpperCase();

  // Load user's previous feedback
  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'feedback'),
        where('uid', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as FeedbackItem[];
        // Sort descending by creation date
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMyFeedback(items);
        setLoadingHistory(false);
      }, (err) => {
        console.error("Error subscribing to feedback:", err);
        setLoadingHistory(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to load feedback history:", err);
      setLoadingHistory(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be signed in to submit feedback');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter your feedback message');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Sending feedback to university administrators...');

    try {
      const feedbackPayload = {
        uid: user.uid,
        userId: user.uid,
        username: profile?.username || 'Student',
        email: profile?.email || user.email || '',
        studentId: profile?.studentId || '',
        department: profile?.department || '',
        academicLevel: profile?.academicLevel || profile?.level || '100',
        level: profile?.level || '1',
        type: category,
        subject: subject.trim() || category,
        message: message.trim(),
        status: 'pending',
        pushedToLevel5: false,
        createdAt: new Date().toISOString(),
        At: profile?.At || 'futo'
      };

      await addDoc(collection(db, 'feedback'), feedbackPayload);

      toast.success(`Feedback delivered to ${userUni} Admin Team!`, { id: toastId });
      setSubject('');
      setMessage('');
      setCategory('General Feedback');
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(`Failed to submit feedback: ${error.message || 'Network error'}`, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, pushedToLevel5?: boolean) => {
    if (pushedToLevel5 || status === 'pushed_to_level5') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 font-medium text-xs">
          <ArrowUpRight className="h-3 w-3" /> Escalated to Overseer (L5)
        </Badge>
      );
    }
    switch (status) {
      case 'resolved':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1 font-medium text-xs">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 flex items-center gap-1 font-medium text-xs">
            <Clock className="h-3 w-3" /> Under Review
          </Badge>
        );
      case 'dismissed':
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Closed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20 flex items-center gap-1 font-medium text-xs">
            <Clock className="h-3 w-3" /> Pending Review
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-7 w-7 text-primary" />
            Student Feedback & Inquiries
          </h1>
          <p className="text-muted-foreground mt-1">
            Send direct messages, bug reports, and academic requests to your university administrators.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Building2 className="h-3.5 w-3.5" />
          <span>Routing to: <strong className="font-bold uppercase">{userUni}</strong> Admins</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Feedback Submission Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-sm border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Submit New Feedback
              </CardTitle>
              <CardDescription>
                Choose a category below and describe your feedback in detail.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                {/* Category Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FEEDBACK_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.type;
                      return (
                        <button
                          key={cat.type}
                          type="button"
                          onClick={() => setCategory(cat.type)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold">{cat.label}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">{cat.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject Field */}
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Subject / Title (Optional)
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Issue with MTH201 notes, Question regarding CBT..."
                    className="h-10"
                  />
                </div>

                {/* Detailed Message Field */}
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Your Message <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide detailed explanation or suggestions so administrators can assist you efficiently..."
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  />
                </div>

                {/* Student Identity Snapshot info */}
                <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    <span>Sender: <strong>{profile?.username || 'Student'}</strong></span>
                  </div>
                  {profile?.studentId && (
                    <div className="font-mono">ID: <strong>{profile.studentId}</strong></div>
                  )}
                  <div>Dept: <strong>{profile?.department || 'General'}</strong></div>
                  <div>Uni: <strong>{userUni}</strong></div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button 
                  type="submit" 
                  disabled={submitting || !message.trim()}
                  className="w-full sm:w-auto ml-auto flex items-center gap-2 font-bold px-6"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Delivering...' : 'Send Feedback'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Previous Feedback Submissions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Submission History
            </h2>
            <Badge variant="outline" className="text-xs">
              {myFeedback.length} {myFeedback.length === 1 ? 'Message' : 'Messages'}
            </Badge>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
              Loading your feedback history...
            </div>
          ) : myFeedback.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">No feedback submitted yet</p>
                <p className="text-xs max-w-xs mx-auto">
                  When you submit inquiries or bug reports, you will see responses and review status right here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {myFeedback.map((item) => (
                <Card key={item.id} className="border shadow-none hover:border-primary/30 transition-all">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-primary">{item.type}</div>
                        <CardTitle className="text-sm font-bold mt-0.5">{item.subject || 'Feedback'}</CardTitle>
                      </div>
                      <div>
                        {getStatusBadge(item.status, item.pushedToLevel5)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg">
                      {item.message}
                    </p>

                    {/* Admin Response if available */}
                    {item.adminResponse && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Administrator Response:</span>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap">
                          {item.adminResponse}
                        </p>
                        {item.respondedAt && (
                          <div className="text-[10px] text-muted-foreground pt-1">
                            Answered on {new Date(item.respondedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-1 border-t">
                      <span>Submitted: {new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className="uppercase font-mono text-[10px]">{item.At || userUni}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
