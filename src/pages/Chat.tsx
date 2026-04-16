import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, getDoc, limit, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Send, MessageSquare, Users, Search, ArrowLeft, MoreVertical, Shield, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import { useTitle } from '../hooks/useTitle';

interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: string;
}

interface ChatRoom {
  id: string;
  type: 'dm' | 'group';
  uids: string[];
  name?: string;
  lastMessage?: string;
  lastUpdatedAt?: string;
  friendProfile?: UserProfile;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all chats for the user
  useEffect(() => {
    if (!user) return;

    // Simplified query to avoid composite index requirement
    const q = query(collection(db, 'chats'), where('uids', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: ChatRoom[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let friendProfile: UserProfile | undefined;
        
        if (data.type === 'dm') {
          const friendUid = data.uids.find((id: string) => id !== user.uid);
          const friendDoc = await getDoc(doc(db, 'users', friendUid));
          if (friendDoc.exists()) {
            friendProfile = friendDoc.data() as UserProfile;
          }
        }
        
        chatList.push({ id: d.id, ...data, friendProfile } as ChatRoom);
      }
      // Sort in memory
      chatList.sort((a, b) => {
        const timeA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
        const timeB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
        return timeB - timeA;
      });
      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch friends for group chat creation
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [user]);

  // Handle targetUid from URL (start a new chat or open existing)
  useEffect(() => {
    if (!user || !targetUid || loading) return;

    const openChat = async () => {
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

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeChat]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newMessage.trim() || !activeChat) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      const msgData = {
        senderUid: user.uid,
        senderName: profile.username || 'User',
        text,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), msgData);
      
      // Update last message in chat doc
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: text,
        lastUpdatedAt: new Date().toISOString()
      });
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
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={chat.friendProfile?.photoURL} />
                    <AvatarFallback>{(chat.name || chat.friendProfile?.username || 'C')[0].toUpperCase()}</AvatarFallback>
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
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={activeChat.friendProfile?.photoURL} />
                  <AvatarFallback>{(activeChat.name || activeChat.friendProfile?.username || 'C')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-bold">{activeChat.name || activeChat.friendProfile?.username || 'Chat'}</CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    {activeChat.type === 'dm' ? 'Direct Message' : 'Group Chat'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10"
            >
              {messages.map((msg) => {
                const isMe = msg.senderUid === user?.uid;
                return (
                  <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "items-start")}>
                    {!isMe && activeChat.type === 'group' && (
                      <span className="text-[10px] font-bold mb-1 px-1 text-muted-foreground">
                        {msg.senderName}
                      </span>
                    )}
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm shadow-sm",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </CardContent>

            <CardFooter className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                <Input 
                  placeholder="Type a message..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="bg-muted/50"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
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
