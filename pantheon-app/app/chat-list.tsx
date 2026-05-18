import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { Sidebar } from '../components/Sidebar';
import { HamburgerIcon, BellIcon, SearchIcon } from '../components/Icons';
import { C, F } from '../components/Theme';

const CHATS = [
  {
    id: '1',
    name: 'MTH 101 Study Group',
    lastMsg: 'Emeka: Does anyone have the solution to assigned problem 4?',
    time: '12:45 PM',
    unread: 3,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=200&auto=format&fit=crop',
    isGroup: true,
  },
  {
    id: '2',
    name: 'Kelechi Iheanacho',
    lastMsg: 'I just uploaded the mechanics notes.',
    time: 'Yesterday',
    unread: 0,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
    isGroup: false,
  },
  {
    id: '3',
    name: 'Amarachi Okafor',
    lastMsg: 'See you at the library by 4pm.',
    time: '2 days ago',
    unread: 0,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop',
    isGroup: false,
  },
  {
    id: '4',
    name: 'FUTO Freshmen 2024',
    lastMsg: 'Admin: Registration deadline has been extended.',
    time: '3 days ago',
    unread: 12,
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=200&auto=format&fit=crop',
    isGroup: true,
  },
];

export default function ChatListScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'DMs' | 'Groups'>('DMs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredChats = CHATS.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'Groups' ? c.isGroup : !c.isGroup;
    return matchesSearch && matchesTab;
  });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} activeOpacity={0.7} style={s.iconBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <View style={s.searchSection}>
        <View style={s.tabToggle}>
          <TouchableOpacity 
            style={[s.tabItem, activeTab === 'DMs' && s.tabItemActive]} 
            onPress={() => setActiveTab('DMs')}
          >
            <Text style={[s.tabLabel, activeTab === 'DMs' && s.tabLabelActive]}>Direct Messages</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.tabItem, activeTab === 'Groups' && s.tabItemActive]} 
            onPress={() => setActiveTab('Groups')}
          >
            <Text style={[s.tabLabel, activeTab === 'Groups' && s.tabLabelActive]}>Study Groups</Text>
          </TouchableOpacity>
        </View>

        <View style={s.searchWrap}>
          <SearchIcon />
          <TextInput
            style={s.searchInput}
            placeholder="Search chats or students..."
            placeholderTextColor={C.inkLight}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionTitle}>RECENT CONVERSATIONS</Text>

        {filteredChats.map((chat) => (
          <TouchableOpacity 
            key={chat.id} 
            style={s.chatItem} 
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/chat-room', params: { id: chat.id, name: chat.name, isGroup: chat.isGroup ? 'true' : 'false' } })}
          >
            <View style={s.avatarContainer}>
              <Image source={{ uri: chat.image }} style={s.avatar} />
              {chat.unread > 0 && <View style={s.unreadIndicator} />}
            </View>
            <View style={s.chatInfo}>
              <View style={s.chatHeader}>
                <Text style={s.chatName} numberOfLines={1}>{chat.name}</Text>
                <Text style={s.chatTime}>{chat.time}</Text>
              </View>
              <View style={s.chatFooter}>
                <Text style={s.lastMsg} numberOfLines={1}>{chat.lastMsg}</Text>
                {chat.unread > 0 && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadText}>{chat.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} activeOpacity={0.8}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Bottom Nav */}
      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 20, color: C.ink, letterSpacing: 1 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bg,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#EAE9F0',
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
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: { fontFamily: F.medium, fontSize: 13, color: C.inkLight },
  tabLabelActive: { fontFamily: F.bold, color: C.ink },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: F.medium,
    fontSize: 14,
    color: C.ink,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  sectionTitle: { fontFamily: F.bold, fontSize: 11, color: C.inkLight, letterSpacing: 1, marginBottom: 16 },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 12 },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
    borderWidth: 2,
    borderColor: C.surface,
  },
  chatInfo: { flex: 1, marginLeft: 14 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontFamily: F.bold, fontSize: 16, color: C.ink, flex: 1, marginRight: 8 },
  chatTime: { fontFamily: F.medium, fontSize: 12, color: C.inkLight },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontFamily: F.body, fontSize: 14, color: C.inkMid, flex: 1, marginRight: 12 },
  unreadBadge: {
    backgroundColor: C.ink,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { color: '#fff', fontSize: 10, fontFamily: F.bold },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.ink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, fontFamily: F.bold, marginTop: -2 },
});
