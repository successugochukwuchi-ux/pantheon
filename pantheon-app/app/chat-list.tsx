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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { F } from '../components/Theme';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ChatListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const [activeTab, setActiveTab] = useState<'DMs' | 'Groups'>('DMs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chatRooms, setChatRooms] = useState<any[]>([]);

  // Observe active chat rooms for current user in real-time
  useEffect(() => {
    if (!profile) return;

    setLoading(true);

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('uids', 'array-contains', profile.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const roomList = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

      // Resolve names and details of the recipient for DMs
      const hydratedRooms = await Promise.all(roomList.map(async (room) => {
        if (room.type === 'dm') {
          const otherUid = room.uids?.find((id: string) => id !== profile.uid);
          if (!otherUid) return null;

          try {
            const userDoc = await getDoc(doc(db, 'users', otherUid));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              return {
                ...room,
                name: uData.username || uData.name || 'Student Comrade',
                image: uData.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
                isGroup: false,
              };
            }
          } catch (e) {
            console.error("Failed to hydrate user DM profile in lists:", e);
          }

          return {
            ...room,
            name: 'Classmate',
            image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
            isGroup: false,
          };
        } else {
          // Study Group
          return {
            ...room,
            name: room.name || 'FUTO Study Alliance',
            image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=200&auto=format&fit=crop',
            isGroup: true,
          };
        }
      }));

      // Filter nulls and sort by lastUpdatedAt declining
      const filteredHydrated = hydratedRooms
        .filter(Boolean)
        .sort((a, b) => {
          const dateA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
          const dateB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
          return dateB - dateA;
        });

      setChatRooms(filteredHydrated);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredChats = useMemo(() => {
    return chatRooms.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === 'Groups' ? c.isGroup : !c.isGroup;
      return matchesSearch && matchesTab;
    });
  }, [chatRooms, search, activeTab]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} activeOpacity={0.7} style={s.iconBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <View style={[s.searchSection, { backgroundColor: C.bg }]}>
        <View style={[s.tabToggle, { backgroundColor: C.tabBg }]}>
          <TouchableOpacity 
            style={[s.tabItem, activeTab === 'DMs' && [s.tabItemActive, { backgroundColor: C.surface }]]} 
            onPress={() => setActiveTab('DMs')}
          >
            <Text style={[s.tabLabel, activeTab === 'DMs' && [s.tabLabelActive, { color: C.ink }]]}>Direct Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.tabItem, activeTab === 'Groups' && [s.tabItemActive, { backgroundColor: C.surface }]]} 
            onPress={() => setActiveTab('Groups')}
          >
            <Text style={[s.tabLabel, activeTab === 'Groups' && [s.tabLabelActive, { color: C.ink }]]}>Study Groups</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.searchWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
          <SearchIcon color={C.inkLight} />
          <TextInput
            style={[s.searchInput, { color: C.ink }]}
            placeholder="Search channels or partners..."
            placeholderTextColor={C.inkLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[s.sectionTitle, { color: C.inkLight }]}>ACTIVE STUDY CHATS</Text>

        {loading ? (
          <ActivityIndicator color={C.activeText} style={{ marginTop: 40 }} />
        ) : filteredChats.length === 0 ? (
          <View style={[s.emptyCard, { borderColor: C.border }]}>
             <Text style={[s.emptyCardText, { color: C.inkMid }]}>
               {search ? "No matches fit your query." : `Your list of configured ${activeTab === 'DMs' ? 'Direct Messages' : 'Groups'} is empty.`}
             </Text>
             <TouchableOpacity style={[s.primaryActionButton, { backgroundColor: C.ink }]} onPress={() => router.push('/social')}>
                <Text style={[s.primaryActionButtonText, { color: C.bg }]}>ACCESS SOCIAL HUB</Text>
             </TouchableOpacity>
          </View>
        ) : (
          filteredChats.map((chat) => (
            <TouchableOpacity 
              key={chat.id} 
              style={[s.chatItem, { backgroundColor: C.surface, borderColor: C.border }]} 
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/chat-room', params: { id: chat.id, name: chat.name, isGroup: chat.isGroup ? 'true' : 'false' } })}
            >
              <View style={s.avatarContainer}>
                {chat.isGroup ? (
                  <View style={[s.groupAvatarMock, { backgroundColor: C.tagBg || C.bgAlt, borderColor: C.border }]}>
                     <Text style={{ fontSize: 20 }}>👥</Text>
                  </View>
                ) : (
                  <Image source={{ uri: chat.image }} style={s.avatar} />
                )}
                {chat.unreadCount > 0 && <View style={[s.unreadIndicator, { borderColor: C.surface }]} />}
              </View>
              <View style={s.chatInfo}>
                <View style={s.chatHeader}>
                  <Text style={[s.chatName, { color: C.ink }]} numberOfLines={1}>{chat.name}</Text>
                  <Text style={[s.chatTime, { color: C.inkLight }]}>
                    {chat.lastUpdatedAt ? new Date(chat.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
                <View style={s.chatFooter}>
                  <Text style={[s.lastMsg, { color: C.inkMid }]} numberOfLines={1}>
                    {chat.lastMessage || 'Open thread to discuss blocks.'}
                  </Text>
                  {chat.unreadCount > 0 && (
                    <View style={[s.unreadBadge, { backgroundColor: C.ink }]}>
                      <Text style={[s.unreadText, { color: C.bg }]}>{chat.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - Create study alliance / add friend shortcut */}
      <TouchableOpacity style={[s.fab, { backgroundColor: C.ink }]} activeOpacity={0.8} onPress={() => router.push('/social')}>
        <Text style={[s.fabText, { color: C.bg }]}>+</Text>
      </TouchableOpacity>

      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Bottom Navigation */}
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

  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: { fontFamily: F.medium, fontSize: 13 },
  tabLabelActive: { fontFamily: F.bold },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: F.medium,
    fontSize: 14,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  sectionTitle: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1, marginBottom: 16 },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 12 },
  groupAvatarMock: { width: 54, height: 54, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
    borderWidth: 2,
  },
  chatInfo: { flex: 1, marginLeft: 14 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontFamily: F.bold, fontSize: 16, flex: 1, marginRight: 8 },
  chatTime: { fontFamily: F.medium, fontSize: 12 },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontFamily: F.body, fontSize: 14, flex: 1, marginRight: 12 },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { fontSize: 10, fontFamily: F.bold },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 32, fontFamily: F.bold, marginTop: -2 },

  emptyCard: {
     padding: 24,
     borderWidth: 1,
     borderRadius: 16,
     alignItems: 'center',
     backgroundColor: 'rgba(0,0,0,0.01)',
  },
  emptyCardText: {
     fontFamily: F.medium,
     fontSize: 13,
     textAlign: 'center',
     lineHeight: 18,
     marginBottom: 16,
  },
  primaryActionButton: {
     paddingVertical: 12,
     paddingHorizontal: 20,
     borderRadius: 12,
  },
  primaryActionButtonText: {
     fontFamily: F.bold,
     fontSize: 13,
  }
});
