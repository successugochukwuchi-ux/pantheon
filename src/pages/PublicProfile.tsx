import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft, Calendar, Award, Users, BookOpen, Shield, UserPlus, MessageSquare, UserMinus, Clock } from 'lucide-react';
import { UserProfile, CBTSession, Course } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { addDoc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentCBT, setRecentCBT] = useState<CBTSession[]>([]);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !currentUser) return;

    // Check friendship status
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', currentUser.uid));
    const unsubFriends = onSnapshot(qFriends, (snapshot) => {
      const friendship = snapshot.docs.find(d => d.data().uids.includes(userId));
      if (friendship) {
        setFriendStatus('friends');
        setFriendshipId(friendship.id);
      } else {
        // Check pending requests
        const qReqSent = query(collection(db, 'friend_requests'), where('fromUid', '==', currentUser.uid), where('toUid', '==', userId));
        const qReqRecv = query(collection(db, 'friend_requests'), where('fromUid', '==', userId), where('toUid', '==', currentUser.uid));
        
        getDocs(qReqSent).then(snap => {
          if (!snap.empty) {
            setFriendStatus('pending');
            setRequestId(snap.docs[0].id);
          } else {
            getDocs(qReqRecv).then(snap2 => {
              if (!snap2.empty) {
                setFriendStatus('pending');
                setRequestId(snap2.docs[0].id);
              } else {
                setFriendStatus('none');
              }
            });
          }
        });
      }
    });

    return () => unsubFriends();
  }, [userId, currentUser]);

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
      } else {
        setLoading(false);
      }
    };

    fetchProfile();

    const q = query(
      collection(db, 'cbt_sessions'),
      where('userId', '==', userId),
      orderBy('completedAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentCBT(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CBTSession)));
      setLoading(false);
    });

    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const courseMap: Record<string, Course> = {};
      snapshot.docs.forEach(doc => {
        courseMap[doc.id] = { id: doc.id, ...doc.data() } as Course;
      });
      setCourses(courseMap);
    });

    return () => {
      unsubscribe();
      unsubCourses();
    };
  }, [userId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!profile) return <div className="text-center py-12"><p className="text-muted-foreground">User not found.</p><Button variant="link" onClick={() => navigate(-1)}>Go back</Button></div>;

  const isAdmin = profile.level === '3' || profile.level === '4';

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <Card className="w-full md:w-80 shrink-0 overflow-hidden">
          <div className="h-24 bg-primary/10 w-full" />
          <CardContent className="relative pt-0 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 border-4 border-background -mt-12 mb-4">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} />
              <AvatarFallback>{profile.username?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
    <div className="space-y-1 mb-6">
      <h2 className="text-2xl font-bold">{profile.username}</h2>
      <div className="flex items-center justify-center gap-2">
        <Badge variant={isAdmin ? "destructive" : "secondary"} className="gap-1">
          {isAdmin && <Shield className="h-3 w-3" />}
          Level {profile.level}
        </Badge>
        {profile.isActivated && <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Activated</Badge>}
      </div>
    </div>

    {currentUser && currentUser.uid !== userId && (
      <div className="flex flex-col w-full gap-2 mb-6">
        {friendStatus === 'friends' ? (
          <>
            <Button className="w-full gap-2" onClick={() => navigate(`/chat?uid=${userId}`)}>
              <MessageSquare className="h-4 w-4" /> Message
            </Button>
            <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive" onClick={async () => {
              if (friendshipId) await deleteDoc(doc(db, 'friendships', friendshipId));
              toast.info('Unfriended');
            }}>
              <UserMinus className="h-4 w-4" /> Unfriend
            </Button>
          </>
        ) : friendStatus === 'pending' ? (
          <Button variant="outline" className="w-full gap-2" disabled>
            <Clock className="h-4 w-4" /> Request Pending
          </Button>
        ) : (
          <Button className="w-full gap-2" onClick={async () => {
            try {
              await addDoc(collection(db, 'friend_requests'), {
                fromUid: currentUser.uid,
                fromName: currentProfile?.username || 'User',
                fromPhoto: currentUser.photoURL || '',
                toUid: userId,
                status: 'pending',
                createdAt: new Date().toISOString()
              });
              toast.success('Friend request sent!');
            } catch (err) {
              toast.error('Failed to send request');
            }
          }}>
            <UserPlus className="h-4 w-4" /> Add Friend
          </Button>
        )}
      </div>
    )}
            <div className="w-full grid grid-cols-2 gap-2 py-4 border-t">
              <div className="text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Referrals</p>
                <p className="font-bold">{profile.referralCount || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">Joined</p>
                <p className="font-bold text-xs">{new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 space-y-6 w-full">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-orange-500" />
                Recent Achievements
              </CardTitle>
              <CardDescription>Latest CBT practice sessions and scores.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCBT.length > 0 ? (
                  recentCBT.map(session => {
                    const course = courses[session.courseId];
                    const percentage = Math.round((session.score / session.totalQuestions) * 100);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">{course?.code || 'CBT'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(session.completedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold">{percentage}%</p>
                            <p className="text-[10px] text-muted-foreground">{session.score}/{session.totalQuestions}</p>
                          </div>
                          <div className="h-8 w-1 bg-primary/20 rounded-full overflow-hidden">
                            <div className="bg-primary w-full" style={{ height: `${percentage}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No recent CBT activity.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
