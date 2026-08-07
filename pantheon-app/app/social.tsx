import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { F } from '../components/Theme';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function TrashIcon() {
  return <Text style={{ fontSize: 18, color: '#E74C3C' }}>✕</Text>;
}

export default function SocialHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        {/* Simple Header */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.headerBtn}>
            <Text style={{ fontSize: 28, color: C.ink, marginLeft: 8 }}>‹</Text>
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            SOCIAL HUB
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>💬</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Social Hub Locked
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
            Social Hub and peer-to-peer chat are premium features reserved for activated accounts. Activate your student profile using an activation pin to connect with friends, join study groups, and discuss course topics!
          </Text>

          <TouchableOpacity
            style={{ width: '100%', height: 56, backgroundColor: C.ink, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ width: '100%', height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const [activeTab, setActiveTab] = useState<'Friends' | 'Requests' | 'Groups'>('Friends');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Lists
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);

  // Search local list inputs
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch live groups and chats from Firestore
  useEffect(() => {
    if (!profile) return;

    setLoading(true);

    // Live groups observer
    const qGroups = query(
      collection(db, 'chats'),
      where('type', '==', 'group'),
      where('uids', 'array-contains', profile.uid)
    );
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroupsList(list);
    });

    // Live private messages observer to establish friends listing
    const qDMs = query(
      collection(db, 'chats'),
      where('type', '==', 'dm'),
      where('uids', 'array-contains', profile.uid)
    );
    const unsubDMs = onSnapshot(qDMs, async (snapshot) => {
      const dmRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Resolve other user names
      const resolvedFriends = await Promise.all(dmRooms.map(async (room) => {
        const otherUid = room.uids.find((id: string) => id !== profile.uid);
        if (!otherUid) return null;

        try {
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            return {
              chatId: room.id,
              uid: otherUid,
              name: data.username || data.name || 'Student',
              dept: data.department || 'General Science',
              level: data.academicLevel || '100 Level',
              photoURL: data.photoURL || null
            };
          }
        } catch (e) {
          console.error("Error resolving friend user payload:", e);
        }
        return {
          chatId: room.id,
          uid: otherUid,
          name: 'Classmate',
          dept: 'CoLearn Student',
          level: '100 Level',
          photoURL: null
        };
      }));

      setFriendsList(resolvedFriends.filter(Boolean));
      setLoading(false);
    });

    // Live pending friend request observer
    const qRequests = query(
      collection(db, 'friend_requests'),
      where('toUid', '==', profile.uid),
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequestsList(list);
    });

    return () => {
      unsubGroups();
      unsubDMs();
      unsubRequests();
    };
  }, [profile]);

  // 2. Request Actions
  const handleAcceptRequest = async (request: any) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'friend_requests', request.id), { status: 'accepted' });
      await addDoc(collection(db, 'friendships'), {
        uids: [profile.uid, request.fromUid],
        createdAt: new Date().toISOString()
      });

      // Also auto create a DM chat session if it does not already exist
      await addDoc(collection(db, 'chats'), {
        type: 'dm',
        uids: [profile.uid, request.fromUid],
        lastMessage: 'Friendship establish',
        lastSenderId: profile.uid,
        lastUpdatedAt: new Date().toISOString()
      });

      Alert.alert('Request Accepted', `You are now friends with ${request.fromName || 'Student'}!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to approve request.');
    }
  };

  const handleDeclineRequest = async (request: any) => {
    try {
      await updateDoc(doc(db, 'friend_requests', request.id), { status: 'declined' });
      Alert.alert('Declined', 'Friend request has been ignored.');
    } catch (e) {
      console.error(e);
    }
  };

  const displayedFriends = friendsList.filter(f => {
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const displayedGroups = groupsList.filter(g => {
    if (!searchQuery.trim()) return true;
    return (g.name || 'Study Group').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => setSidebarOpen(true)}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <Text style={[s.pageTitle, { color: C.ink }]}>Social Hub</Text>
        <Text style={[s.pageSubtitle, { color: C.inkMid }]}>
          Build study alliances, manage comrades, and discuss lecture blocks in real-time.
        </Text>

        {/* Tab Controls */}
        <View style={[s.tabContainer, { backgroundColor: C.tabBg }]}>
          {(['Friends', 'Requests', 'Groups'] as const).map(tab => {
            const isSel = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tab, isSel && [s.tabActive, { backgroundColor: C.surface }]]}
                onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
              >
                <Text style={[s.tabText, isSel && [s.tabTextActive, { color: C.ink }]]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CREATE STUDY GROUP (Groups tab only) */}
        {activeTab === 'Groups' && (
          <TouchableOpacity 
            style={[s.createGroupCard, { backgroundColor: C.surfaceDark }]} 
            onPress={() => router.push('/create-group')}
            activeOpacity={0.9}
          >
             <View style={[s.plusCircle, { backgroundColor: C.surface }]}>
                <Text style={[s.plusText, { color: C.ink }]}>+</Text>
             </View>
             <View style={{ flex: 1 }}>
                <Text style={s.createTitle}>Establish Group</Text>
                <Text style={s.createSubtitle}>Create an academic alliance & share resources.</Text>
             </View>
          </TouchableOpacity>
        )}

        {/* PENDING REGISTER REQUESTS (Requests tab only) */}
        {activeTab === 'Requests' && (
          <View style={{ marginBottom: 24 }}>
            <Text style={[s.sectionLabel, { color: C.inkMid }]}>PENDING FRIEND REQUESTS</Text>
            {loading ? (
              <ActivityIndicator color={C.activeText} style={{ marginVertical: 12 }} />
            ) : requestsList.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: C.border }]}>
                <Text style={[s.emptyText, { color: C.inkLight }]}>No new pending requests at this time.</Text>
                <TouchableOpacity style={[s.lookupBtn, { backgroundColor: C.ink }]} onPress={() => router.push('/search')}>
                   <Text style={[s.lookupBtnText, { color: C.bg }]}>LOOKUP COMRADES</Text>
                </TouchableOpacity>
              </View>
            ) : (
              requestsList.map((req) => (
                <View key={req.id} style={[s.pendingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Image 
                    source={{ uri: req.fromPhoto || req.fromPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.fromUid || 'Student'}` }} 
                    style={s.pendingAvatar} 
                  />
                  <View style={s.requestInfo}>
                    <Text style={[s.requestName, { color: C.ink }]}>{req.fromName || 'Student'}</Text>
                    <Text style={[s.requestDept, { color: C.inkMid }]}>{req.fromDept || 'CoLearn Student'}</Text>
                  </View>
                  <View style={s.requestActions}>
                    <TouchableOpacity style={[s.acceptBtn, { backgroundColor: C.ink }]} onPress={() => handleAcceptRequest(req)}>
                      <Text style={[s.btnIcon, { color: C.bg }]}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.declineBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => handleDeclineRequest(req)}>
                      <TrashIcon />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* MAIN LISTINGS */}
        {activeTab === 'Friends' && (
          <>
            <View style={s.friendsHeaderRow}>
               <Text style={[s.sectionLabel, { color: C.inkMid, marginBottom: 0 }]}>YOUR COMRADES ({displayedFriends.length})</Text>
               <View style={[s.searchRow, { backgroundColor: C.bgAlt }]}>
                  <SearchIcon color={C.inkLight} size={14} />
                  <TextInput 
                     style={[s.searchInput, { color: C.ink }]}
                     placeholder="Search..."
                     placeholderTextColor={C.inkLight}
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                  />
               </View>
            </View>

            {loading ? (
              <ActivityIndicator color={C.activeText} style={{ marginTop: 40 }} />
            ) : displayedFriends.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: C.border }]}>
                <Text style={[s.emptyText, { color: C.inkLight }]}>
                  {searchQuery ? "No comrades match your filters." : "You have not established any partnerships yet."}
                </Text>
                <TouchableOpacity style={[s.lookupBtn, { backgroundColor: C.ink }]} onPress={() => router.push('/search')}>
                   <Text style={[s.lookupBtnText, { color: C.bg }]}>LOOKUP COMRADES</Text>
                </TouchableOpacity>
              </View>
            ) : (
                displayedFriends.map((friend) => (
                  <View key={friend.uid} style={[s.friendCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                     <View style={s.friendTop}>
                        <View style={s.friendAvatarBox}>
                           {friend.photoURL ? (
                             <Image source={{ uri: friend.photoURL }} style={s.friendAvatar} />
                           ) : (
                             <View style={[s.avatarPlaceholder, { backgroundColor: C.tagBg || C.bgAlt, borderColor: C.border }]}>
                                <Text style={[s.initials, { color: C.inkMid }]}>{friend.name.charAt(0).toUpperCase()}</Text>
                             </View>
                           )}
                        </View>
                        <View style={s.friendDetails}>
                           <Text style={[s.friendName, { color: C.ink }]}>{friend.name}</Text>
                           <Text style={[s.friendDept, { color: C.inkMid }]}>{friend.dept} • {friend.level}</Text>
                        </View>
                     </View>
                     
                     <View style={s.friendBtnRow}>
                        <TouchableOpacity style={[s.chatBtn, { backgroundColor: C.ink }]} onPress={() => router.push({ pathname: '/chat-room', params: { id: friend.chatId } })}>
                           <Text style={[s.chatBtnText, { color: C.bg }]}>SEND DM</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
                ))
            )}
          </>
        )}

        {activeTab === 'Groups' && (
          <>
            <View style={s.friendsHeaderRow}>
               <Text style={[s.sectionLabel, { color: C.inkMid, marginBottom: 0 }]}>STUDY ALLIANCES ({displayedGroups.length})</Text>
               <View style={[s.searchRow, { backgroundColor: C.bgAlt }]}>
                  <SearchIcon color={C.inkLight} size={14} />
                  <TextInput 
                     style={[s.searchInput, { color: C.ink }]}
                     placeholder="Search..."
                     placeholderTextColor={C.inkLight}
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                  />
               </View>
            </View>

            {loading ? (
              <ActivityIndicator color={C.activeText} style={{ marginTop: 40 }} />
            ) : displayedGroups.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: C.border }]}>
                <Text style={[s.emptyText, { color: C.inkLight }]}>
                  {searchQuery ? "No study groups found." : "You are not a member of any study groups yet."}
                </Text>
              </View>
            ) : (
                displayedGroups.map((group) => (
                  <View key={group.id} style={[s.friendCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                     <View style={s.friendTop}>
                        <View style={s.friendAvatarBox}>
                           <View style={[s.groupPlaceholderBox, { backgroundColor: C.tagBg || C.bgAlt, borderColor: C.border }]}>
                              <Text style={[s.initials, { color: C.inkMid }]}>👥</Text>
                           </View>
                        </View>
                        <View style={s.friendDetails}>
                           <Text style={[s.friendName, { color: C.ink }]}>{group.name || 'Study Group'}</Text>
                           <Text style={[s.friendDept, { color: C.inkMid }]}>{(group.uids || []).length} Allies joined</Text>
                        </View>
                     </View>
                     
                     <View style={s.friendBtnRow}>
                        <TouchableOpacity style={[s.chatBtn, { backgroundColor: C.ink }]} onPress={() => router.push({ pathname: '/chat-room', params: { id: group.id } })}>
                           <Text style={[s.chatBtnText, { color: C.bg }]}>ENTER COMPANION CHAT</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
                ))
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 20, letterSpacing: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  pageTitle: { fontFamily: F.bold, fontSize: 32, marginBottom: 8 },
  pageSubtitle: { fontFamily: F.body, fontSize: 16, lineHeight: 22, marginBottom: 24 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 32,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { },
  tabText: { fontFamily: F.bold, fontSize: 14 },
  tabTextActive: { },
  
  createGroupCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  plusCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plusText: { fontSize: 24, fontWeight: 'bold' },
  createTitle: { fontFamily: F.bold, fontSize: 18, color: '#fff', marginBottom: 4 },
  createSubtitle: { fontFamily: F.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  sectionLabel: { fontFamily: F.bold, fontSize: 12, opacity: 0.6, letterSpacing: 1, marginBottom: 12 },

  // Pending Requests
  pendingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  requestInfo: { flex: 1 },
  requestName: { fontFamily: F.bold, fontSize: 16, marginBottom: 4 },
  requestDept: { fontFamily: F.semibold, fontSize: 13, opacity: 0.8 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  declineBtn: {
    width: 36, height: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  btnIcon: { fontSize: 16, fontWeight: 'bold' },

  // Friends Section
  friendsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    width: 160,
  },
  searchInput: { flex: 1, marginLeft: 8, fontFamily: F.bold, fontSize: 13 },

  // Friend Card
  friendCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  friendTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  friendAvatarBox: { marginRight: 14 },
  friendAvatar: { width: 64, height: 64, borderRadius: 12 },
  groupPlaceholderBox: { borderRadius: 12, width: 64, height: 64, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarPlaceholder: { borderRadius: 12, width: 64, height: 64, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  initials: { fontFamily: F.bold, fontSize: 18 },
  friendDetails: { flex: 1 },
  friendName: { fontFamily: F.bold, fontSize: 17, marginBottom: 4 },
  friendDept: { fontFamily: F.bold, fontSize: 12, opacity: 0.7 },
  
  friendBtnRow: { flexDirection: 'row', gap: 10 },
  chatBtn: {
    flex: 1, borderRadius: 10, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  chatBtnText: { fontFamily: F.bold, fontSize: 14 },

  lookupBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  lookupBtnText: { fontFamily: F.bold, fontSize: 13 },

  emptyCard: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  emptyText: { fontFamily: F.semibold, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
