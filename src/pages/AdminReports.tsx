import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertCircle, CheckCircle, Trash2, Shield, MessageSquare, ExternalLink, User, Eye, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Report, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

export default function AdminReports() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportEvidence, setSelectedReportEvidence] = useState<Report | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || (profile?.level !== '3' && profile?.level !== '4')) {
      navigate('/dashboard');
      return;
    }

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    getDocs(q).then((snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    }).catch((err) => {
      setLoading(false);
      console.error("Reports fetch failed:", err);
    });
  }, [user, profile, navigate, authLoading]);

  const handleUpdateStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
      toast.success(`Report ${status}`);
    } catch (err) {
      toast.error('Failed to update report');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case 'resolved': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Resolved</Badge>;
      case 'dismissed': return <Badge variant="outline" className="bg-muted text-muted-foreground">Dismissed</Badge>;
      default: return null;
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Report Management
        </h1>
        <p className="text-muted-foreground">Review and manage user-reported chat conversations.</p>
      </div>

      <div className="grid gap-4">
        {reports.length > 0 ? (
          reports.map(report => (
            <Card key={report.id} className={report.status === 'pending' ? 'border-amber-200 shadow-sm' : ''}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Report #{report.id.slice(0, 8)}</CardTitle>
                    {getStatusBadge(report.status)}
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <User className="h-3 w-3" /> Reported by {report.reporterName} on {new Date(report.createdAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1"
                    onClick={() => setSelectedReportEvidence(report)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    See Evidence
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Reason
                  </p>
                  <p className="text-sm font-medium italic">"{report.reason}"</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Type: {report.chatType?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <span>Targeted UIDs: {report.targetUids?.join(', ') || 'None'}</span>
                </div>

                {report.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 h-8 font-bold"
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Mark Resolved
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No reports to review.</p>
              <p className="text-sm">Great! The community is keeping it clean.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedReportEvidence} onOpenChange={(open) => !open && setSelectedReportEvidence(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Report Evidence Stream
            </DialogTitle>
            <DialogDescription>
              Reviewing conversation log for Report #{selectedReportEvidence?.id?.slice(0, 8)}. Highlighted messages are the submitted evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {selectedReportEvidence && (!selectedReportEvidence.evidence || selectedReportEvidence.evidence.length === 0) ? (
              <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm font-semibold">No evidence data found</p>
                <p className="text-xs">This report was submitted before the context and evidence selection system was active.</p>
              </div>
            ) : (
              selectedReportEvidence && (
                <div className="space-y-3">
                  {[
                    ...(selectedReportEvidence.contextBefore || []).map((m: any) => ({ ...m, type: 'context' })),
                    ...(selectedReportEvidence.evidence || []).map((m: any) => ({ ...m, type: 'evidence' })),
                    ...(selectedReportEvidence.contextAfter || []).map((m: any) => ({ ...m, type: 'context' }))
                  ].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((msg: any, idx) => {
                    const isEvidence = msg.type === 'evidence';
                    return (
                      <div 
                        key={msg.id || idx}
                        className={cn(
                          "p-3 rounded-xl border transition-all",
                          isEvidence 
                            ? "bg-destructive/10 border-destructive/30 shadow-sm ring-1 ring-destructive/20" 
                            : "bg-muted/40 border-muted-foreground/10 opacity-75"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-bold text-foreground">
                              {msg.senderName}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-mono px-1.5 py-0",
                              isEvidence ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground"
                            )}>
                              StudentID: {msg.senderStudentId || 'N/A'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                            <span>{new Date(msg.createdAt).toLocaleString()}</span>
                            <Badge className={cn(
                              "text-[9px] px-1 py-0 uppercase shrink-0 font-bold",
                              isEvidence 
                                ? "bg-destructive text-destructive-foreground" 
                                : "bg-muted-foreground/30 text-foreground"
                            )}>
                              {isEvidence ? "Evidence" : "Context"}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-1">
                          {msg.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          <div className="pt-4 border-t shrink-0 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSelectedReportEvidence(null)}>
              Close View
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
