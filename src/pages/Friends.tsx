import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { UserPlus, UserMinus, Check, X, Ban, MessageSquare, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { useTitle } from '../hooks/useTitle';

interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto?: string;
  toUid: string;
  status: 'pending';
  createdAt: string;
}

interface Friendship {
  id: string;
  uids: string[];
  friendUid: string;
  friendProfile?: UserProfile;
}

export default function Friends() {
  useTitle('Friends');
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen for friend requests
    const qRequests = query(collection(db, 'friend_requests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    });

    // Listen for friendships
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsubFriends = onSnapshot(qFriends, async (snapshot) => {
      const friendsList: Friendship[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const friendUid = data.uids.find((id: string) => id !== user.uid);
        
        // Fetch friend profile
        const friendDoc = await getDoc(doc(db, 'users', friendUid));
        const friendProfile = friendDoc.exists() ? friendDoc.data() as UserProfile : undefined;
        
        friendsList.push({
          id: d.id,
          uids: data.uids,
          friendUid,
          friendProfile
        });
      }
      setFriends(friendsList);
      setLoading(false);
    });

    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [user]);

  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      // Create friendship
      await addDoc(collection(db, 'friendships'), {
        uids: [user!.uid, request.fromUid],
        createdAt: new Date().toISOString()
      });
      // Delete request
      await deleteDoc(doc(db, 'friend_requests', request.id));
      toast.success('Friend request accepted!');
    } catch (err) {
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
      toast.info('Friend request rejected');
    } catch (err) {
      toast.error('Failed to reject request');
    }
  };

  const handleUnfriend = async (friendshipId: string) => {
    try {
      await deleteDoc(doc(db, 'friendships', friendshipId));
      toast.info('Friend removed');
    } catch (err) {
      toast.error('Failed to remove friend');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
        <p className="text-muted-foreground">Manage your connections and friend requests.</p>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="friends" className="gap-2">
            <Users className="h-4 w-4" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 relative">
            <UserPlus className="h-4 w-4" />
            Requests
            {requests.length > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                {requests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-6">
          {friends.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {friends.map((friend) => (
                <Card key={friend.id} className="hover:bg-accent/50 transition-colors group">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={friend.friendProfile?.photoURL} />
                      <AvatarFallback>{(friend.friendProfile?.username || 'U')[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{friend.friendProfile?.username || 'Anonymous'}</h3>
                      <p className="text-xs text-muted-foreground">Level {friend.friendProfile?.level}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/chat?uid=${friend.friendUid}`)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleUnfriend(friend.id)}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-semibold">No friends yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Connect with other students to start chatting.</p>
              <Button onClick={() => navigate('/dashboard')} className="gap-2">
                <Search className="h-4 w-4" /> Find Students
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          {requests.length > 0 ? (
            <div className="grid gap-4">
              {requests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={req.fromPhoto} />
                      <AvatarFallback>{req.fromName[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{req.fromName}</h3>
                      <p className="text-xs text-muted-foreground">Sent a friend request</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="default" size="sm" className="gap-2" onClick={() => handleAcceptRequest(req)}>
                        <Check className="h-4 w-4" /> Accept
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => handleRejectRequest(req.id)}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-semibold">No pending requests</h3>
              <p className="text-sm text-muted-foreground">When someone sends you a request, it will appear here.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
