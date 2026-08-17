import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { FeedbackItem, FeedbackStatus, FeedbackType } from '../../types';
import { 
  MessageSquare, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Trash2, 
  ShieldAlert, 
  User, 
  Building2, 
  GraduationCap, 
  Send,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  CheckCircle,
  XCircle,
  Sparkles,
  Inbox,
  ShieldCheck
} from 'lucide-react';

const UNIVERSITIES = [
  { id: 'futo', name: 'FUTO - Federal Univ of Tech Owerri' },
  { id: 'unilag', name: 'UNILAG - University of Lagos' },
  { id: 'uniben', name: 'UNIBEN - University of Benin' },
  { id: 'oau', name: 'OAU - Obafemi Awolowo Univ' },
  { id: 'unn', name: 'UNN - Univ of Nigeria Nsukka' },
  { id: 'abu', name: 'ABU - Ahmadu Bello Univ' },
  { id: 'ui', name: 'UI - University of Ibadan' },
  { id: 'general', name: 'General / Other Institutions' }
];

export function AdminFeedback() {
  const { user, profile } = useAuth();
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedUniFilter, setSelectedUniFilter] = useState<string>('all');
  
  // Modals state
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState('');
  const [escalating, setEscalating] = useState(false);

  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('resolved');
  const [savingResponse, setSavingResponse] = useState(false);

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FeedbackItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isLevel5 = profile?.level === '5' || profile?.email === 'successugochukwuchi@gmail.com' || user?.email === 'successugochukwuchi@gmail.com';
  const adminUni = profile?.At || 'futo';

  // Fetch feedback scoped to the university for Level 4 admins, or all for Level 5
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    try {
      let q;
      if (isLevel5) {
        // Level 5 can see everything or all feedback
        q = query(collection(db, 'feedback'));
      } else {
        // Level 4 Admin: Scoped strictly to their university
        q = query(
          collection(db, 'feedback'),
          where('At', '==', adminUni)
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FeedbackItem[];
        
        // Sort newest first
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFeedbackList(items);
        setLoading(false);
      }, (err) => {
        console.error("Error subscribing to admin feedback:", err);
        toast.error("Failed to load feedback messages");
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize admin feedback listener:", err);
      setLoading(false);
    }
  }, [user, isLevel5, adminUni]);

  // Push Feedback to Level 5 Overseer
  const handlePushToLevel5 = async () => {
    if (!selectedFeedback) return;
    setEscalating(true);
    const toastId = toast.loading("Escalating feedback to Level 5 Overseer...");

    try {
      const feedbackRef = doc(db, 'feedback', selectedFeedback.id);
      await updateDoc(feedbackRef, {
        pushedToLevel5: true,
        status: 'pushed_to_level5',
        pushedAt: new Date().toISOString(),
        pushedBy: profile?.username || profile?.email || user?.uid,
        pushedByAdminLevel: profile?.level || '4',
        ...(escalateNote.trim() ? { escalationNote: escalateNote.trim() } : {})
      });

      toast.success("Feedback successfully pushed to Level 5 Overseers!", { id: toastId });
      setEscalateModalOpen(false);
      setEscalateNote('');
      setSelectedFeedback(null);
    } catch (error: any) {
      console.error("Error pushing to Level 5:", error);
      toast.error(`Escalation failed: ${error.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setEscalating(false);
    }
  };

  // Submit Admin Response / Update Status
  const handleSaveResponse = async () => {
    if (!selectedFeedback) return;
    setSavingResponse(true);
    const toastId = toast.loading("Saving response & updating feedback status...");

    try {
      const feedbackRef = doc(db, 'feedback', selectedFeedback.id);
      const updatePayload: any = {
        status: newStatus,
        respondedBy: profile?.username || profile?.email || user?.uid,
        respondedAt: new Date().toISOString()
      };

      if (adminResponseText.trim()) {
        updatePayload.adminResponse = adminResponseText.trim();
      }

      await updateDoc(feedbackRef, updatePayload);

      toast.success("Feedback updated and response recorded!", { id: toastId });
      setResponseModalOpen(false);
      setAdminResponseText('');
      setSelectedFeedback(null);
    } catch (error: any) {
      console.error("Error saving response:", error);
      toast.error(`Failed to update: ${error.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setSavingResponse(false);
    }
  };

  // Delete Feedback
  const handleDeleteFeedback = async () => {
    if (!deleteConfirmItem) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting feedback record...");

    try {
      await deleteDoc(doc(db, 'feedback', deleteConfirmItem.id));
      toast.success("Feedback deleted successfully", { id: toastId });
      setDeleteConfirmItem(null);
    } catch (error: any) {
      console.error("Error deleting feedback:", error);
      toast.error(`Failed to delete: ${error.message}`, { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  // Filtered List
  const filteredFeedback = feedbackList.filter(item => {
    // University filter for Level 5
    if (isLevel5 && selectedUniFilter !== 'all' && item.At !== selectedUniFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'pending' && item.status !== 'pending' && item.status !== undefined) return false;
    if (statusFilter === 'pushed_to_level5' && !item.pushedToLevel5 && item.status !== 'pushed_to_level5') return false;
    if (statusFilter === 'reviewed' && item.status !== 'reviewed') return false;
    if (statusFilter === 'resolved' && item.status !== 'resolved') return false;

    // Category filter
    if (categoryFilter !== 'all' && item.type !== categoryFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.username?.toLowerCase().includes(q);
      const matchEmail = item.email?.toLowerCase().includes(q);
      const matchSubject = item.subject?.toLowerCase().includes(q);
      const matchMessage = item.message?.toLowerCase().includes(q);
      const matchStudentId = item.studentId?.toLowerCase().includes(q);
      const matchDept = item.department?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchSubject && !matchMessage && !matchStudentId && !matchDept) {
        return false;
      }
    }

    return true;
  });

  // Calculate Metrics
  const totalCount = feedbackList.length;
  const pendingCount = feedbackList.filter(f => f.status === 'pending' || !f.status).length;
  const escalatedCount = feedbackList.filter(f => f.pushedToLevel5 || f.status === 'pushed_to_level5').length;
  const resolvedCount = feedbackList.filter(f => f.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            University User Feedback Panel
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLevel5 ? (
              <span>Platform Overseer view: managing feedback across all affiliated universities.</span>
            ) : (
              <span>Managing feedback received from students and users of <strong className="uppercase font-semibold text-foreground">{adminUni}</strong>.</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20 text-xs font-semibold">
            {isLevel5 ? 'Level 5 (Platform Overseer)' : `Level 4 Admin (${adminUni.toUpperCase()})`}
          </Badge>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-none border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Total Feedback</div>
            <div className="text-2xl font-bold mt-1">{totalCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Pending Review
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> Pushed to Level 5
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">{escalatedCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{resolvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls Bar */}
      <Card className="shadow-none border">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student name, ID, subject, text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="pushed_to_level5">Pushed to Level 5</SelectItem>
                  <SelectItem value="reviewed">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Bug Report">Bug Report</SelectItem>
                  <SelectItem value="Academic Content Issue">Academic Content</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="General Feedback">General Feedback</SelectItem>
                  <SelectItem value="Platform Inquiry">Platform Inquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Level 5 University Selector */}
            {isLevel5 && (
              <div className="md:col-span-2">
                <Select value={selectedUniFilter} onValueChange={setSelectedUniFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="University" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Universities</SelectItem>
                    {UNIVERSITIES.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.id.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Messages List */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl bg-card">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">Loading university feedback records...</p>
        </div>
      ) : filteredFeedback.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground space-y-3">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-base font-semibold">No feedback records found</p>
            <p className="text-xs max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search criteria or status filter.'
                : `There are currently no feedback submissions received from ${adminUni.toUpperCase()} users.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((item) => {
            const isPushed = item.pushedToLevel5 || item.status === 'pushed_to_level5';
            return (
              <Card 
                key={item.id} 
                className={`transition-all border ${
                  isPushed 
                    ? 'border-amber-500/40 bg-amber-500/[0.02]' 
                    : item.status === 'resolved' 
                    ? 'border-emerald-500/30' 
                    : 'hover:border-primary/30'
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {item.type || 'General Feedback'}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] uppercase font-mono font-bold bg-muted/40">
                          {item.At || adminUni}
                        </Badge>
                        {isPushed && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" /> Pushed to Level 5 Overseer
                          </Badge>
                        )}
                        {item.status === 'resolved' && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Resolved
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold pt-1">
                        {item.subject || item.type}
                      </CardTitle>
                    </div>

                    {/* Sender profile snippet */}
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 text-xs">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {item.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="leading-tight">
                        <div className="font-bold flex items-center gap-1">
                          <span>{item.username}</span>
                          {item.studentId && <span className="font-mono text-[10px] text-muted-foreground">({item.studentId})</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.department || 'General'} • {item.academicLevel || '100'}L
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-1 space-y-4">
                  {/* Feedback message */}
                  <div className="bg-muted/30 p-3.5 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap">
                    {item.message}
                  </div>

                  {/* Escalation Notes if any */}
                  {isPushed && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1">
                      <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" /> Escalated by {item.pushedBy || 'Admin'}
                        {item.pushedAt && ` on ${new Date(item.pushedAt).toLocaleDateString()}`}
                      </div>
                      {(item as any).escalationNote && (
                        <p className="text-muted-foreground italic pl-4">
                          Note: "{(item as any).escalationNote}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Admin Response if provided */}
                  {item.adminResponse && (
                    <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg space-y-1 text-xs">
                      <div className="font-bold text-primary flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" /> Admin Official Response ({item.respondedBy || 'Staff'}):
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {item.adminResponse}
                      </p>
                    </div>
                  )}

                  {/* Meta footer and action buttons */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>Submitted: {new Date(item.createdAt).toLocaleString()}</span>
                      {item.email && <span className="font-mono text-[11px]">({item.email})</span>}
                    </div>

                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      {/* Push to Level 5 Button */}
                      {!isPushed && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedFeedback(item);
                            setEscalateNote('');
                            setEscalateModalOpen(true);
                          }}
                          className="h-8 text-xs font-bold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-1"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Push to Level 5
                        </Button>
                      )}

                      {/* Respond / Resolve button */}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedFeedback(item);
                          setAdminResponseText(item.adminResponse || '');
                          setNewStatus(item.status === 'resolved' ? 'resolved' : 'reviewed');
                          setResponseModalOpen(true);
                        }}
                        className="h-8 text-xs font-bold flex items-center gap-1"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {item.adminResponse ? 'Edit Response' : 'Respond & Status'}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteConfirmItem(item)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Delete Feedback"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Push to Level 5 Modal */}
      <Dialog open={escalateModalOpen} onOpenChange={setEscalateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ArrowUpRight className="h-5 w-5" />
              Push Feedback to Level 5 Overseer
            </DialogTitle>
            <DialogDescription>
              Escalate this feedback item directly to Level 5 platform administrators for high-priority review and system-level action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
              <div className="font-bold text-foreground">{selectedFeedback?.subject || selectedFeedback?.type}</div>
              <div className="text-muted-foreground line-clamp-2">{selectedFeedback?.message}</div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Student: <strong>{selectedFeedback?.username}</strong> ({selectedFeedback?.At?.toUpperCase()})
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Escalation Note (Optional)
              </Label>
              <textarea
                rows={3}
                value={escalateNote}
                onChange={(e) => setEscalateNote(e.target.value)}
                placeholder="Add context for Level 5 overseers (e.g. Critical platform bug, requires root database fix, cross-university issue)..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEscalateModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handlePushToLevel5}
              disabled={escalating}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {escalating ? 'Pushing...' : 'Confirm Escalation to L5'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond & Status Dialog */}
      <Dialog open={responseModalOpen} onOpenChange={setResponseModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Respond & Update Status
            </DialogTitle>
            <DialogDescription>
              Write an official response visible to the student and update the review status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Status Action
              </Label>
              <Select value={newStatus} onValueChange={(val) => setNewStatus(val as FeedbackStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewed">Mark as Under Review</SelectItem>
                  <SelectItem value="resolved">Mark as Resolved</SelectItem>
                  <SelectItem value="pending">Keep as Pending</SelectItem>
                  <SelectItem value="dismissed">Dismiss / Close</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Official Admin Response (Visible to Student)
              </Label>
              <textarea
                rows={5}
                value={adminResponseText}
                onChange={(e) => setAdminResponseText(e.target.value)}
                placeholder="Explain the resolution, steps taken, or answer the student's inquiry..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResponseModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveResponse} disabled={savingResponse} className="font-bold">
              {savingResponse ? 'Saving...' : 'Save & Publish Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Feedback Record?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this feedback submission? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteFeedback} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
