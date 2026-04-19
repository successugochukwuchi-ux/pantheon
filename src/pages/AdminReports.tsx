import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertCircle, CheckCircle, Trash2, Shield, MessageSquare, ExternalLink, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Report, UserProfile } from '../types';

export default function AdminReports() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (profile?.level !== '3' && profile?.level !== '4')) {
      navigate('/dashboard');
      return;
    }

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile, navigate]);

  const handleUpdateStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
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
                    onClick={() => navigate(`/chat?id=${report.chatId}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit Chat
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
                    <MessageSquare className="h-3 w-3" /> Type: {report.chatType.toUpperCase()}
                  </span>
                  <span>Targeted UIDs: {report.targetUids.join(', ')}</span>
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
    </div>
  );
}
