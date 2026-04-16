import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Bell, Newspaper, CheckCircle, BookOpen, AlertCircle, Trash2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Notification } from '../types';
import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { toast } from 'sonner';

export default function Notifications() {
  useTitle('Notifications');
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.isRead).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  };

  const clearAllNotifications = async () => {
    if (!user || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
    toast.success('All notifications cleared');
  };

  const deleteNotification = async (id: string) => {
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
          {notifications.some(n => !n.isRead) && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
              <Check className="h-4 w-4" /> Mark as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllNotifications} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {notifications.length > 0 ? (
          notifications.map(notif => (
            <Card key={notif.id} className={cn("transition-colors group", !notif.isRead && "border-primary/50 bg-primary/5")}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="mt-1 p-2 rounded-full bg-background border">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className={cn("font-semibold", !notif.isRead && "text-primary")}>{notif.title}</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleDateString()}</span>
                        <Button variant="ghost" size="icon" onClick={() => deleteNotification(notif.id)} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <div className="flex items-center justify-between mt-4">
                      {notif.link ? (
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => markAsRead(notif.id)}>
                          <Link to={notif.link}>View Details</Link>
                        </Button>
                      ) : <div />}
                      {!notif.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id)} className="h-8 text-xs">
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
