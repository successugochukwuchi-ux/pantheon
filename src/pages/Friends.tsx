import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button, buttonVariants } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  UserPlus, 
  UserMinus, 
  Check, 
  X, 
  MessageSquare, 
  Users, 
  Search,
  MoreVertical,
  User,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { useTitle } from '../hooks/useTitle';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
  useTitle('Network');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const friendsRef = React.useRef<Friendship[]>([]);

  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);

  useEffect(() => {
    if (!user) return;

    // Listen for friend requests
    const qRequests = query(collection(db, 'friend_requests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friend_requests');
    });

    // Listen for friendships
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsubFriends = onSnapshot(qFriends, (snapshot) => {
      const friendshipsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const updateList = async () => {
        const updatedFriendsList: Friendship[] = [];
        const currentFriends = friendsRef.current;
        
        for (const data of friendshipsData) {
          const friendUid = data.uids.find((id: string) => id !== user.uid);
          if (!friendUid) continue;

          const existingFriend = currentFriends.find(f => f.friendUid === friendUid);
          
          if (existingFriend && existingFriend.friendProfile) {
            updatedFriendsList.push({
              id: data.id,
              uids: data.uids,
              friendUid,
              friendProfile: existingFriend.friendProfile
            });
          } else {
            try {
              const friendDoc = await getDoc(doc(db, 'users', friendUid));
              const friendProfile = friendDoc.exists() ? friendDoc.data() as UserProfile : undefined;
              
              updatedFriendsList.push({
                id: data.id,
                uids: data.uids,
                friendUid,
                friendProfile
              });
            } catch (error) {
              console.error("Error fetching friend profile:", error);
              updatedFriendsList.push({
                id: data.id,
                uids: data.uids,
                friendUid
              });
            }
          }
        }
        setFriends(updatedFriendsList);
        setLoading(false);
      };

      updateList();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendships');
      setLoading(false);
    });

    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [user]);

  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      await addDoc(collection(db, 'friendships'), {
        uids: [user!.uid, request.fromUid],
        createdAt: new Date().toISOString()
      });
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

  const filteredFriends = friends.filter(f => 
    f.friendProfile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.friendProfile?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.friendProfile?.studentId?.includes(searchQuery)
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 min-h-screen bg-background text-foreground">
      <Tabs defaultValue="friends" className="w-full">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left Column: Navigation & Controls */}
          <div className="lg:w-72 shrink-0 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight">Network</h1>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold">
                    {friends.length}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                  Academic Circle
                </p>
              </div>

              <Button 
                onClick={() => navigate('/search')} 
                className="w-full rounded-2xl h-12 font-bold shadow-lg shadow-primary/10 transition-transform hover:scale-[1.02] active:scale-98"
                variant="default"
              >
                <UserPlus className="h-4 w-4 mr-2" /> Find New Friends
              </Button>
            </motion.div>

            <div className="space-y-2">
              <p className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                Navigation
              </p>
              <TabsList className="bg-transparent h-auto p-0 flex flex-row lg:flex-col gap-1 w-full overflow-x-auto sm:overflow-visible no-scrollbar">
                <TabsTrigger 
                  value="friends" 
                  className="flex-1 lg:flex-none justify-start h-12 px-4 rounded-xl border border-transparent data-[state=active]:border-primary/10 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm transition-all flex gap-3 group"
                >
                  <Users className="h-4 w-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Friends
                  <span className="ml-auto opacity-40 font-mono text-[10px] tabular-nums">{friends.length}</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="requests" 
                  className="flex-1 lg:flex-none relative justify-start h-12 px-4 rounded-xl border border-transparent data-[state=active]:border-primary/10 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm transition-all flex gap-3 group"
                >
                  <Clock className="h-4 w-4 opacity-50 group-data-[state=active]:opacity-100" />
                  Requests
                  {requests.length > 0 ? (
                    <span className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-lg font-black min-w-[20px] flex items-center justify-center">
                      {requests.length}
                    </span>
                  ) : (
                    <span className="ml-auto opacity-40 font-mono text-[10px] tabular-nums">0</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="hidden lg:block pt-6 border-t border-muted/20">
              <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                Connect with colleagues, share study materials, and collaborate on projects to enhance your academic journey.
              </p>
            </div>
          </div>

          {/* Right Column: Search & Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Integrated Search Bar */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input 
                type="text"
                placeholder="Search by name, department, or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 pl-11 pr-4 bg-muted/30 border-2 border-transparent rounded-[1.25rem] focus:bg-background focus:border-primary/20 transition-all outline-none font-bold text-sm text-foreground shadow-sm placeholder:text-muted-foreground/50"
              />
            </motion.div>

            <TabsContent value="friends" className="mt-0 focus-visible:outline-none outline-none">
              {loading ? (
                 <div className="space-y-4">
                   {[1, 2, 3, 4, 5, 6].map(i => (
                     <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-2xl" />
                   ))}
                 </div>
              ) : filteredFriends.length > 0 ? (
                <div className="bg-card/30 border border-muted/20 rounded-[2rem] overflow-hidden shadow-sm">
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col"
                  >
                    {filteredFriends.map((friend, index) => (
                      <motion.div 
                        key={friend.id}
                        variants={itemVariants}
                        className={cn(
                          "group relative flex items-center gap-4 py-4 px-4 sm:px-6 transition-all duration-200 hover:bg-primary/[0.02]",
                          index !== filteredFriends.length - 1 && "border-b border-muted/10"
                        )}
                      >
                        <div 
                          className="relative shrink-0 cursor-pointer" 
                          onClick={() => navigate(`/profile/${friend.friendUid}`)}
                        >
                          <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-full ring-2 ring-background border border-muted/30 shadow-sm transition-transform group-hover:scale-105">
                            <AvatarImage src={friend.friendProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.friendUid}`} />
                            <AvatarFallback className="bg-primary/5 text-primary text-lg font-black uppercase">
                              {(friend.friendProfile?.username || 'U')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0.5 right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background shadow-sm" />
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                            <h3 
                              className="font-bold text-base sm:text-lg leading-tight truncate hover:text-primary cursor-pointer transition-colors"
                              onClick={() => navigate(`/profile/${friend.friendUid}`)}
                            >
                              {friend.friendProfile?.username || 'Anonymous'}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 sm:mt-0">
                              <Badge variant="outline" className="bg-muted/10 border-transparent text-[10px] font-bold h-4.5 px-1.5 uppercase shrink-0">
                                Lvl {friend.friendProfile?.academicLevel || `${friend.friendProfile?.level}00`}
                              </Badge>
                              <span className="hidden sm:block h-1 w-1 rounded-full bg-muted-foreground/30 shrink-0" />
                              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-tight truncate">
                                {friend.friendProfile?.department || 'General Studies'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-muted-foreground/60 font-mono tracking-tighter uppercase font-bold">
                              ID: {friend.friendProfile?.studentId || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="hidden sm:flex h-9 rounded-xl hover:bg-primary/10 hover:text-primary font-bold gap-2 px-3 transition-all"
                            onClick={() => navigate(`/chat?uid=${friend.friendUid}`)}
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs">Chat</span>
                          </Button>
                          
                          <div className="flex sm:hidden">
                             <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary"
                              onClick={() => navigate(`/chat?uid=${friend.friendUid}`)}
                            >
                              <MessageSquare className="h-4.5 w-4.5" />
                            </Button>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "rounded-full hover:bg-muted transition-colors opacity-60 hover:opacity-100")}>
                              <MoreVertical className="h-4.5 w-4.5 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-xl border-muted/20">
                              <DropdownMenuItem 
                                className="rounded-lg px-3 py-2 cursor-pointer gap-2 font-semibold text-sm"
                                onClick={() => navigate(`/profile/${friend.friendUid}`)}
                              >
                                <User className="h-4 w-4" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="rounded-lg px-3 py-2 cursor-pointer gap-2 font-semibold text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleUnfriend(friend.id)}
                              >
                                <UserMinus className="h-4 w-4" /> Unfriend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 px-6 text-center border-2 border-dashed border-muted/40 rounded-[2.5rem] bg-muted/5">
                  <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mb-6">
                    <Users className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Build your Network</h3>
                  <p className="text-muted-foreground text-sm max-w-[280px] mb-8 font-medium">
                    {searchQuery ? "We couldn't find any friends matching your search." : "Start connecting with students from your department and level."}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => navigate('/search')} className="rounded-full px-8 shadow-xl shadow-primary/20 font-bold transition-transform hover:scale-105 active:scale-95">
                      Discover Students
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requests" className="mt-0 focus-visible:outline-none outline-none">
              <div className="bg-card/30 border border-muted/20 rounded-[2rem] overflow-hidden shadow-sm">
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col"
                >
                  {requests.length > 0 ? (
                    requests.map((req, index) => (
                      <motion.div 
                        key={req.id}
                        variants={itemVariants}
                        className={cn(
                          "group flex items-center gap-4 py-4 px-4 sm:px-6 transition-all duration-200 hover:bg-primary/[0.02]",
                          index !== requests.length - 1 && "border-b border-muted/10"
                        )}
                      >
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full ring-2 ring-background border border-muted/30 shadow-sm">
                          <AvatarImage src={req.fromPhoto} />
                          <AvatarFallback className="bg-primary/5 text-primary text-lg font-black uppercase">
                            {req.fromName[0]}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <h3 
                              className="font-bold text-base sm:text-lg leading-tight truncate hover:text-primary cursor-pointer transition-colors"
                              onClick={() => navigate(`/profile/${req.fromUid}`)}
                            >
                              {req.fromName}
                            </h3>
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest px-1.5 py-0 border-none">New Request</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-0.5">
                            <Clock className="h-3 w-3" /> Received {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="rounded-xl h-9 px-4 font-bold text-[11px] shadow-sm transition-all" 
                            onClick={() => handleAcceptRequest(req)}
                          >
                            Accept
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" 
                            onClick={() => handleRejectRequest(req.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 px-6 text-center w-full col-span-full">
                      <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mb-6">
                        <UserPlus className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">No Requests</h3>
                      <p className="text-muted-foreground text-sm max-w-[280px] font-medium">
                        When other students want to connect with you, they'll appear here.
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
