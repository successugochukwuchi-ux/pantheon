import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit, getDocs, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Send, MessageSquare, Users, Search, ArrowLeft, MoreVertical, Shield, Plus, Check, FileText, BookOpen, ChevronRight, LogOut, Flag, Reply, X as CloseIcon, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { UserProfile, Note, Course } from '../types';
import { useTitle } from '../hooks/useTitle';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
import { deleteDoc } from 'firebase/firestore';

interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  referencedNoteId?: string;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  createdAt: string;
}

interface ChatRoom {
  id: string;
  type: 'dm' | 'group' | 'discussion';
  uids: string[];
  name?: string;
  lastMessage?: string;
  lastUpdatedAt?: string;
  friendProfile?: UserProfile;
  typing?: { [uid: string]: boolean };
}

interface Friend {
  uid: string;
  profile: UserProfile;
}

export default function Chat() {
  useTitle('Chat');
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetUid = searchParams.get('uid');
  
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isNoteSelectorOpen, setIsNoteSelectorOpen] = useState(false);
  const [userNotes, setUserNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseForNote, setSelectedCourseForNote] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [reportStep, setReportStep] = useState<'evidence' | 'reason'>('evidence');
  const [memberProfiles, setMemberProfiles] = useState<{ [uid: string]: UserProfile }>({});

  const handleOpenReportDialog = () => {
    setSelectedEvidenceIds([]);
    setReportStep('evidence');
    setReportReason('');
    setIsReportDialogOpen(true);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Sound effects
  const messageSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'));
  const notificationSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'));

  // Fetch profiles for active chat members to ensure consistent avatars
  useEffect(() => {
    if (!activeChat) return;
    
    const fetchProfiles = async () => {
      const uidsToFetch = activeChat.uids.filter(uid => !memberProfiles[uid]);
      if (uidsToFetch.length === 0) return;

      const newProfiles = { ...memberProfiles };
      let changed = false;

      for (const uid of uidsToFetch) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            newProfiles[uid] = userDoc.data() as UserProfile;
            changed = true;
          }
        } catch (err) {
          console.error(`Failed to fetch profile for ${uid}:`, err);
        }
      }

      if (changed) {
        setMemberProfiles(newProfiles);
      }
    };

    fetchProfiles();
  }, [activeChat, memberProfiles]);

  // Fetch user notes for reference
  useEffect(() => {
    if (!user || !profile) return;
    
    const q = query(collection(db, 'notes')); 
    getDocs(q).then((snapshot) => {
      setUserNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    }).catch((error) => {
      // Don't show technical error to Level 1 students for this auxiliary data
      const isLowLevel = profile.level === '1';
      if (!isLowLevel) {
        handleFirestoreError(error, OperationType.LIST, 'notes');
      }
    });
  }, [user, profile]);

  // Fetch all courses for note selector
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'courses'), orderBy('code', 'asc'));
    getDocs(q).then((snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }).catch((error) => {
      const isLowLevel = profile.level === '1';
      if (!isLowLevel) {
        handleFirestoreError(error, OperationType.LIST, 'courses');
      }
    });
  }, [profile]);

  // Fetch all chats and discussions for the user
  useEffect(() => {
    if (!user) return;

    // Simplified query to avoid composite index requirement
    const q = query(collection(db, 'chats'), where('uids', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updateData = async () => {
        try {
          const chatList: ChatRoom[] = [];
          for (const d of snapshot.docs) {
            const data = d.data();
            let friendProfile: UserProfile | undefined;
            
            if (data.type === 'dm') {
              const friendUid = data.uids.find((id: string) => id !== user.uid);
              if (!friendUid) continue;

              // Verify friendship exists in the friendships collection as chatting is restricted to friends or study group members
              const fQuery = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
              const fSnap = await getDocs(fQuery);
              const isFriend = fSnap.docs.some(doc => (doc.data().uids || []).includes(friendUid));

              if (!isFriend) {
                // Skip chats with people who are no longer friends
                continue;
              }

              const friendDoc = await getDoc(doc(db, 'users', friendUid));
              if (friendDoc.exists()) {
                friendProfile = friendDoc.data() as UserProfile;
              }
            }
            
            chatList.push({ id: d.id, ...data, friendProfile } as ChatRoom);
          }

          // Fetch Course Discussions
          const systemDoc = await getDoc(doc(db, 'system', 'config'));
          const systemConfig = systemDoc.exists() ? systemDoc.data() : null;
          const currentSemester = systemConfig?.currentSemester || '1st';

          const qCourses = query(
            collection(db, 'courses'),
            where('semester', '==', currentSemester)
          );
          const courseSnap = await getDocs(qCourses);
          const userCourses = courseSnap.docs.map(doc_ => ({ id: doc_.id, ...doc_.data() } as Course));
          
          const discussionList = userCourses.map(c => ({
              id: c.id,
              type: 'discussion',
              name: `${c.code} Discussion`,
              lastMessage: `Join ${c.code} study group`
          } as any));

          const allConversations = [...chatList, ...discussionList];

          // Sort in memory
          allConversations.sort((a, b) => {
            const timeA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
            const timeB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
            return timeB - timeA;
          });
          
          setChats(allConversations);
          
          // Sync activeChat to pick up typing changes
          setActiveChat(prev => {
            if (!prev) return null;
            const updated = allConversations.find(c => c.id === prev.id);
            return updated ? { ...prev, ...updated } : prev;
          });
          
          setLoading(false);
        } catch (error) {
          console.error("Error processing chats:", error);
          setLoading(false);
        }
      };

      updateData();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch friends for group chat creation
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    getDocs(q).then((snapshot) => {
      const updateFriends = async () => {
        try {
          const friendList: Friend[] = [];
          for (const d of snapshot.docs) {
            const friendUid = d.data().uids.find((id: string) => id !== user.uid);
            const friendDoc = await getDoc(doc(db, 'users', friendUid));
            if (friendDoc.exists()) {
              friendList.push({
                uid: friendUid,
                profile: friendDoc.data() as UserProfile
              });
            }
          }
          setFriends(friendList);
        } catch (error) {
          console.error("Error processing friends:", error);
        }
      };
      
      updateFriends();
    }).catch((error) => {
      handleFirestoreError(error, OperationType.LIST, 'friendships');
    });
  }, [user]);

  // Handle targetUid from URL (start a new chat or open existing)
  useEffect(() => {
    if (!user || !targetUid || loading) return;

    const openChat = async () => {
      // Verify friendship first before opening or creating a new DM session
      const fQuery = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
      const fSnap = await getDocs(fQuery);
      const isFriend = fSnap.docs.some(d => (d.data().uids || []).includes(targetUid));

      if (!isFriend) {
        toast.error('Access Restricted: Chatting is only available between friends or study group members.');
        navigate('/chat');
        return;
      }

      // Check if DM already exists
      const existingChat = chats.find(c => c.type === 'dm' && c.uids.includes(targetUid));
      if (existingChat) {
        setActiveChat(existingChat);
      } else {
        // Create new DM
        try {
          await addDoc(collection(db, 'chats'), {
            type: 'dm',
            uids: [user.uid, targetUid],
            lastMessage: 'Chat started',
            lastSenderId: user.uid,
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString()
          });
        } catch (err) {
          toast.error('Failed to start chat');
        }
      }
    };

    openChat();
  }, [targetUid, user, loading, chats]);

  // Listen for messages in active chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    let q;
    if (activeChat.type === 'discussion') {
      q = query(
        collection(db, 'discussions'),
        where('courseId', '==', activeChat.id),
        limit(100)
      );
    } else {
      q = query(
        collection(db, 'chats', activeChat.id, 'messages'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
              id: doc.id, 
              ...data,
              // Normalize field names if they differ
              createdAt: data.createdAt,
              senderUid: data.senderUid || data.userId,
              senderName: data.senderName || data.username,
              text: data.text
          } as Message;
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.senderUid !== user?.uid) {
          const lastMsgTime = new Date(lastMsg.createdAt).getTime();
          if (Date.now() - lastMsgTime < 5000) {
            messageSound.current.play().catch(() => {});
          }
        }
      }
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `messages_${activeChat.id}`);
    });

    return () => unsubscribe();
  }, [activeChat, user]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || (!newMessage.trim() && !selectedNote) || !activeChat) return;

    const text = newMessage.trim();
    const noteId = selectedNote?.id;
    const currentReply = replyingTo;
    
    setNewMessage('');
    setSelectedNote(null);
    setReplyingTo(null);
    handleStopTyping(); // Clear typing status immediately on send

    try {
      const msgData: any = {
        senderUid: user.uid,
        senderName: profile.username || 'User',
        senderPhotoURL: profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        text,
        referencedNoteId: noteId || null,
        createdAt: new Date().toISOString()
      };

      if (activeChat.type === 'discussion') {
          // Discussion specific fields
          msgData.courseId = activeChat.id;
          msgData.userId = user.uid;
          msgData.username = profile.username || 'User';
          msgData.userLevel = profile.level || '1';
          msgData.userAcademicLevel = profile.academicLevel || '100';
          
          await addDoc(collection(db, 'discussions'), msgData);
      } else {
          if (currentReply) {
            msgData.replyTo = {
              messageId: currentReply.id,
              text: currentReply.text,
              senderName: currentReply.senderName
            };
          }

          await addDoc(collection(db, 'chats', activeChat.id, 'messages'), msgData);
          
          // Update last message in chat doc
          await updateDoc(doc(db, 'chats', activeChat.id), {
            lastMessage: text || `Shared a note: ${selectedNote?.title}`,
            lastUpdatedAt: new Date().toISOString(),
            lastSenderId: user.uid
          });
      }
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !groupName.trim() || selectedFriends.length === 0) {
      toast.error('Please provide a group name and select at least one friend');
      return;
    }

    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        type: 'group',
        name: groupName.trim(),
        uids: [user.uid, ...selectedFriends],
        lastMessage: `Group "${groupName.trim()}" created`,
        lastSenderId: user.uid,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      });
      
      setGroupName('');
      setSelectedFriends([]);
      setIsCreateGroupOpen(false);
      toast.success('Group chat created!');
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const toggleFriendSelection = (uid: string) => {
    setSelectedFriends(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleLeaveGroup = async () => {
    if (!user || !activeChat || activeChat.type !== 'group') return;
    
    if (!confirm('Are you sure you want to leave this group?')) return;

    try {
      const newUids = activeChat.uids.filter(id => id !== user.uid);
      
      if (newUids.length === 0) {
        // Last member leaving, delete the group
        await deleteDoc(doc(db, 'chats', activeChat.id));
        toast.success('Group deleted as you were the last member.');
      } else {
        // Just remove the user
        await updateDoc(doc(db, 'chats', activeChat.id), {
          uids: newUids,
          lastMessage: `${profile?.username || 'A user'} left the group`,
          lastUpdatedAt: new Date().toISOString()
        });
        toast.success('You left the group');
      }
      setActiveChat(null);
    } catch (err) {
      toast.error('Failed to leave group');
    }
  };

  const handleReportChat = async () => {
    if (!user || !activeChat || !reportReason.trim() || selectedEvidenceIds.length === 0) return;
    
    try {
      // Find the messages & context before/after
      const selectedIndices = messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(item => selectedEvidenceIds.includes(item.msg.id));
      
      const minIdx = selectedIndices.length > 0 ? Math.min(...selectedIndices.map(x => x.idx)) : -1;
      const maxIdx = selectedIndices.length > 0 ? Math.max(...selectedIndices.map(x => x.idx)) : -1;
      
      const contextBeforeRaw = minIdx > 0 ? messages.slice(Math.max(0, minIdx - 3), minIdx) : [];
      const contextAfterRaw = (maxIdx > -1 && maxIdx < messages.length - 1) ? messages.slice(maxIdx + 1, maxIdx + 4) : [];
      const selectedMsgsRaw = messages.filter(msg => selectedEvidenceIds.includes(msg.id));

      const mapMessageToDoc = (msg: Message) => ({
        id: msg.id,
        senderUid: msg.senderUid,
        senderName: msg.senderName,
        senderStudentId: msg.senderUid === user.uid ? (profile?.studentId || 'N/A') : (memberProfiles[msg.senderUid]?.studentId || 'N/A'),
        text: msg.text || (msg.referencedNoteId ? "Shared a note" : ""),
        createdAt: msg.createdAt
      });

      const evidence = selectedMsgsRaw.map(mapMessageToDoc);
      const contextBefore = contextBeforeRaw.map(mapMessageToDoc);
      const contextAfter = contextAfterRaw.map(mapMessageToDoc);

      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterName: profile?.username || 'User',
        chatId: activeChat.id,
        chatType: activeChat.type,
        targetUids: activeChat.uids.filter(id => id !== user.uid),
        reason: reportReason.trim(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        evidence,
        contextBefore,
        contextAfter
      });

      toast.success('Chat reported to administrators');
      setIsReportDialogOpen(false);
      setReportReason('');
      setSelectedEvidenceIds([]);
      setReportStep('evidence');
    } catch (err) {
      toast.error('Failed to submit report');
    }
  };

  const handleTyping = () => {
    if (!user || !activeChat) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // If not already marked as typing, mark it
    if (!activeChat.typing?.[user.uid]) {
      updateDoc(doc(db, 'chats', activeChat.id), {
        [`typing.${user.uid}`]: true
      });
    }
    
    // Set timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  };

  const handleStopTyping = () => {
    if (!user || !activeChat) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    updateDoc(doc(db, 'chats', activeChat.id), {
      [`typing.${user.uid}`]: false
    });
  };

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
  if (isUnactivatedStudent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4 max-w-2xl mx-auto py-20">
        <Lock className="h-16 w-16 text-amber-500 animate-pulse" />
        <h1 className="text-3xl font-bold tracking-tight">Chat Features Locked</h1>
        <p className="text-muted-foreground animate-pulse">
          Standard accounts must buy an activation pin to unlock private chat rooms, file sharing, group threads, and lecture-connected chats.
        </p>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Chat with classmates and start collaborations in real time by activating your account now!
        </p>
        <div className="pt-2">
          <Button size="lg" onClick={() => window.location.href = '/activate'}>
            Go to Activation Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] flex gap-4 overflow-hidden">
      {/* Sidebar - Chat List */}
      <Card className={cn("w-full md:w-80 flex flex-col overflow-hidden", activeChat && "hidden md:flex")}>
        <CardHeader className="border-b p-4">
          <CardTitle className="text-lg flex items-center justify-between">
            Messages
            <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogTrigger render={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              } />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Group Chat</DialogTitle>
                  <DialogDescription>
                    Select friends to add to your new group chat.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Enter group name" 
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Select Friends</Label>
                    <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1">
                      {friends.length > 0 ? (
                        friends.map(friend => (
                          <div 
                            key={friend.uid}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent",
                              selectedFriends.includes(friend.uid) && "bg-accent"
                            )}
                            onClick={() => toggleFriendSelection(friend.uid)}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={friend.profile.photoURL} />
                                <AvatarFallback>{friend.profile.username?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{friend.profile.username}</span>
                            </div>
                            {selectedFriends.includes(friend.uid) && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center text-muted-foreground py-4">No friends found to add.</p>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateGroup}>Create Group</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {chats.length > 0 ? (
            <div className="divide-y">
              {chats.map((chat) => (
                <div 
                  key={chat.id} 
                  className={cn(
                    "p-4 cursor-pointer hover:bg-accent transition-colors flex items-center gap-3",
                    activeChat?.id === chat.id && "bg-accent"
                  )}
                  onClick={() => setActiveChat(chat)}
                >
                  <Avatar className="h-10 w-10 border shadow-sm">
                    <AvatarImage src={chat.friendProfile?.photoURL || (chat.type === 'dm' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.uids.find(id => id !== user?.uid) || chat.id}` : undefined)} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {(chat.name || chat.friendProfile?.username || 'C')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm truncate">{chat.name || chat.friendProfile?.username || 'Chat'}</h4>
                      {chat.lastUpdatedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(chat.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || 'No messages yet'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-50">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p className="text-sm">No conversations yet.</p>
              <Button variant="link" onClick={() => navigate('/friends')}>Find friends to chat</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className={cn("flex-1 flex flex-col overflow-hidden", !activeChat && "hidden md:flex")}>
        {activeChat ? (
          <>
            <CardHeader className="border-b p-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveChat(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10 border shadow-sm">
                  <AvatarImage src={activeChat.friendProfile?.photoURL || (activeChat.type === 'dm' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.uids.find(id => id !== user?.uid) || activeChat.id}` : undefined)} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {(activeChat.name || activeChat.friendProfile?.username || 'C')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-bold">{activeChat.name || activeChat.friendProfile?.username || 'Chat'}</CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    {Object.entries(activeChat.typing || {})
                      .filter(([uid, isTyping]) => isTyping && uid !== user?.uid)
                      .length > 0 
                      ? "User is typing..." 
                      : (activeChat.type === 'dm' ? 'Direct Message' : 'Group Chat')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                  <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col p-6 overflow-hidden">
                    <DialogHeader className="pb-4 border-b">
                      <DialogTitle className="flex items-center gap-2">
                        <Flag className="h-5 w-5 text-amber-500" />
                        Report Conversation
                      </DialogTitle>
                      <DialogDescription>
                        {reportStep === 'evidence' 
                          ? "Step 1: Select evidence messages. For every selected message of the reported user, you must select one of your own messages to keep the report factual." 
                          : "Step 2: Provide details about why you are filing this report."}
                      </DialogDescription>
                    </DialogHeader>

                    {reportStep === 'evidence' ? (
                      <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                        <div className="flex items-center justify-between text-xs font-semibold px-1">
                          <span className="text-muted-foreground">
                            Recent Messages ({messages.length})
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded",
                            (messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid === user?.uid).length >= messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length && messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length > 0)
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-amber-500/10 text-amber-500"
                          )}>
                            Your Messages: {messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid === user?.uid).length} vs Reported User's: {messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-2 bg-muted/5">
                          {messages.length === 0 ? (
                            <p className="text-center text-xs text-muted-foreground p-8">No messages available in this chat room.</p>
                          ) : (
                            messages.map((msg) => {
                              const isMe = msg.senderUid === user?.uid;
                              const isSelected = selectedEvidenceIds.includes(msg.id);
                              return (
                                <div 
                                  key={msg.id}
                                  onClick={() => {
                                    setSelectedEvidenceIds(prev => 
                                      prev.includes(msg.id) 
                                        ? prev.filter(id => id !== msg.id) 
                                        : [...prev, msg.id]
                                    );
                                  }}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-muted/30",
                                    isSelected 
                                      ? "border-primary bg-primary/5 shadow-sm" 
                                      : "border-border bg-card",
                                    isMe ? "ml-6" : "mr-6"
                                  )}
                                >
                                  <div className="flex items-center justify-center pt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <div 
                                      onClick={() => {
                                        setSelectedEvidenceIds(prev => 
                                          prev.includes(msg.id) 
                                            ? prev.filter(id => id !== msg.id) 
                                            : [...prev, msg.id]
                                        );
                                      }}
                                      className={cn(
                                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                        isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                                      )}
                                    >
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={cn("text-xs font-bold truncate", isMe ? "text-primary" : "text-foreground")}>
                                        {isMe ? "You" : msg.senderName}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground break-words">{msg.text || (msg.referencedNoteId ? "📎 Shared a note" : "")}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length > 0 && 
                         messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid === user?.uid).length < messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length && (
                          <p className="text-xs text-amber-500 font-medium animate-pulse px-1">
                            * To ensure reports are factual, you need to select at least {messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length} of your own messages (currently selected: {messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid === user?.uid).length}).
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 py-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reason" className="text-sm font-semibold">Reason for Reporting</Label>
                          <textarea 
                            id="reason" 
                            placeholder="Please explain the details of the issue so our administrators can take action..." 
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      </div>
                    )}

                    <DialogFooter className="pt-4 border-t flex flex-row justify-end gap-2 shrink-0">
                      {reportStep === 'evidence' ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button>
                          <Button 
                            size="sm"
                            disabled={
                              messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length === 0 ||
                              messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid === user?.uid).length < messages.filter(m => selectedEvidenceIds.includes(m.id) && m.senderUid !== user?.uid).length
                            }
                            onClick={() => setReportStep('reason')}
                          >
                            Continue to Reason
                            <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setReportStep('evidence')}>Back</Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={handleReportChat} 
                            disabled={!reportReason.trim()}
                          >
                            Submit Report
                          </Button>
                        </>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleOpenReportDialog} className="text-amber-600 focus:text-amber-700">
                      <Flag className="mr-2 h-4 w-4" />
                      Report Chat
                    </DropdownMenuItem>
                    {activeChat.type === 'group' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLeaveGroup} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Leave Group
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10"
            >
              {messages.map((msg) => {
                const isMe = msg.senderUid === user?.uid;
                const refNote = userNotes.find(n => n.id === msg.referencedNoteId);
                
                const senderProfile = memberProfiles[msg.senderUid];
                const avatarUrl = senderProfile?.photoURL || msg.senderPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderUid}`;
                
                return (
                  <div key={msg.id} className={cn("flex gap-3 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "flex-row")}>
                    <Avatar className="h-8 w-8 mt-1 border shrink-0 shadow-sm">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-muted text-[10px]">{msg.senderName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {activeChat.type === 'group' && !isMe && (
                        <span className="text-[10px] font-bold mb-1 px-1 text-muted-foreground">
                          {msg.senderName}
                        </span>
                      )}
                      <div className={cn(
                        "px-4 py-2 rounded-2xl text-sm shadow-sm space-y-2 relative group",
                        isMe 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-card border rounded-tl-none text-foreground"
                      )}>
                        {msg.replyTo && (
                          <div className={cn(
                            "mb-2 p-2 rounded-lg border-l-4 text-[11px] opacity-80",
                            isMe ? "bg-black/10 border-white/40" : "bg-muted border-primary/40 truncate"
                          )}>
                            <p className="font-bold mb-0.5">{msg.replyTo.senderName}</p>
                            <p className="truncate italic">{msg.replyTo.text}</p>
                          </div>
                        )}
                        {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                        {refNote && (
                          <div 
                            className={cn(
                              "p-3 rounded-xl border flex items-center gap-3 cursor-pointer hover:bg-black/5 transition-colors",
                              isMe ? "bg-white/10 border-white/20" : "bg-muted border-primary/10"
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
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className={cn(
                            "h-6 w-6 rounded-full absolute -top-3 transition-all z-10 border shadow-md",
                            "flex items-center justify-center bg-background",
                            // On mobile: always visible but smaller/subtler, pushed inside more
                            // On desktop: hover to show, pushed further out
                            "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 scale-90 lg:scale-100",
                            isMe ? "-left-3 lg:-left-8" : "-right-3 lg:-right-8"
                          )}
                          onClick={() => setReplyingTo(msg)}
                        >
                          <Reply className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-[8px] text-muted-foreground mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>

            <CardFooter className="p-4 border-t flex flex-col gap-3 bg-background">
              {replyingTo && (
                <div className="flex items-center justify-between w-full bg-muted p-2 px-3 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex flex-col min-w-0">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Replying to {replyingTo.senderName}</p>
                    <p className="text-xs truncate italic text-muted-foreground">{replyingTo.text}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setReplyingTo(null)}>
                    <CloseIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
                        {selectedCourseForNote ? 'Select a note to share in this chat.' : 'Select a course to view its notes.'}
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
                <div className="flex-1 relative">
                  <Input 
                    placeholder={selectedNote ? "Add a comment to this note..." : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onBlur={handleStopTyping}
                    className="bg-muted/50 border-none h-10 rounded-xl px-4 focus-visible:ring-primary/20"
                  />
                </div>
                <Button type="submit" size="icon" className="shrink-0 h-10 w-10 rounded-xl shadow-lg shadow-primary/20" disabled={!newMessage.trim() && !selectedNote}>
                  <Send className="h-5 w-5" />
                </Button>
              </form>
            </CardFooter>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <MessageSquare className="h-16 w-16 mb-4" />
            <h3 className="text-xl font-bold">Select a chat</h3>
            <p>Pick a conversation from the sidebar to start messaging.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
