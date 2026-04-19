import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Bell, Newspaper, CheckCircle, BookOpen, AlertCircle, Trash2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Notification, Announcement } from '../types';
import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { toast } from 'sonner';

export default function Notifications() {
  useTitle('Notifications');
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);
  const [clearedAnnouncements, setClearedAnnouncements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRead = localStorage.getItem(`read_announcements_${user?.uid}`);
    if (savedRead) setReadAnnouncements(JSON.parse(savedRead));
    
    const savedCleared = localStorage.getItem(`cleared_announcements_${user?.uid}`);
    if (savedCleared) setClearedAnnouncements(JSON.parse(savedCleared));
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Specific notifications
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubNotifs = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
    });

    // General announcements
    const unsubAnn = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const allAnn = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      
      // Filter based on user profile
      const filtered = allAnn.filter(ann => {
        if (ann.targetType === 'all') return true;
        if (ann.targetType === 'uid' && ann.targetValue === user.uid) return true;
        if (!profile) return false;
        if (ann.targetType === 'level' && ann.targetValue === profile.level) return true;
        if (ann.targetType === 'academicLevel' && ann.targetValue === profile.academicLevel) return true;
        if (ann.targetType === 'department' && ann.targetValue === profile.department) return true;
        if (ann.targetType === 'level_dept') {
          return ann.targetValue === `${profile.academicLevel}_${profile.department}`;
        }
        return false;
      });
      setAnnouncements(filtered);
      setLoading(false);
    });

    return () => {
      unsubNotifs();
      unsubAnn();
    };
  }, [user, profile]);

  const allMessages = [
    ...notifications.map(n => ({ ...n, isAnnouncement: false })),
    ...announcements
      .filter(a => !clearedAnnouncements.includes(a.id))
      .map(a => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        isRead: readAnnouncements.includes(a.id),
        createdAt: a.createdAt,
        isAnnouncement: true,
        link: undefined as string | undefined
      }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const markAsRead = async (id: string, isAnnouncement: boolean) => {
    if (isAnnouncement) {
      if (!readAnnouncements.includes(id)) {
        const next = [...readAnnouncements, id];
        setReadAnnouncements(next);
        localStorage.setItem(`read_announcements_${user?.uid}`, JSON.stringify(next));
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    // Notifications
    const batch = writeBatch(db);
    notifications.filter(n => !n.isRead).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    if (notifications.filter(n => !n.isRead).length > 0) {
      await batch.commit();
    }

    // Announcements
    const unreadAnnIds = announcements.filter(a => !readAnnouncements.includes(a.id)).map(a => a.id);
    if (unreadAnnIds.length > 0) {
      const next = [...new Set([...readAnnouncements, ...unreadAnnIds])];
      setReadAnnouncements(next);
      localStorage.setItem(`read_announcements_${user?.uid}`, JSON.stringify(next));
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    
    // 1. Delete specific notifications
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    if (notifications.length > 0) {
      await batch.commit();
    }

    // 2. Hide current announcements
    const currentAnnIds = announcements.map(a => a.id);
    if (currentAnnIds.length > 0) {
      const nextCleared = [...new Set([...clearedAnnouncements, ...currentAnnIds])];
      setClearedAnnouncements(nextCleared);
      localStorage.setItem(`cleared_announcements_${user.uid}`, JSON.stringify(nextCleared));
    }
    
    toast.success('Notification history cleared');
  };

  const deleteNotification = async (id: string, isAnnouncement: boolean) => {
    if (isAnnouncement) {
      const nextCleared = [...clearedAnnouncements, id];
      setClearedAnnouncements(nextCleared);
      localStorage.setItem(`cleared_announcements_${user?.uid}`, JSON.stringify(nextCleared));
      toast.success('Announcement hidden');
      return;
    }
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'news': return <Newspaper className="h-4 w-4 text-blue-500" />;
      case 'verification': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'material': return <BookOpen className="h-4 w-4 text-purple-500" />;
      default: return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with the latest activity.</p>
        </div>
        <div className="flex items-center gap-2">
          {allMessages.some(n => !n.isRead) && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
          {allMessages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllNotifications} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Clear history
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {allMessages.length > 0 ? (
          allMessages.map(notif => (
            <Card key={notif.id} className={cn("transition-colors group", !notif.isRead && "border-primary/50 bg-primary/5")}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="mt-1 p-2 rounded-full bg-background border">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <h3 className={cn("font-semibold", !notif.isRead && "text-primary")}>{notif.title}</h3>
                        {notif.isAnnouncement && <Badge variant="secondary" className="w-fit text-[8px] h-3 px-1 mt-0.5">Announcement</Badge>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleDateString()}</span>
                        <Button variant="ghost" size="icon" onClick={() => deleteNotification(notif.id, notif.isAnnouncement)} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <div className="flex items-center justify-between mt-4">
                      {notif.link ? (
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => markAsRead(notif.id, notif.isAnnouncement)}>
                          <Link to={notif.link}>View Details</Link>
                        </Button>
                      ) : <div />}
                      {!notif.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id, notif.isAnnouncement)} className="h-8 text-xs">
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No notifications yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
