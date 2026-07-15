import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Sub-components & Icons with Dynamic Theming ───────────────────────────────

function BackIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function UserSquareIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 20, height: 20, borderWidth: 1.8, borderColor: C.ink, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.ink }} />
      <View style={{ width: 12, height: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1.5, borderColor: C.ink, borderBottomWidth: 0 }} />
    </View>
  );
}

function SpeakerIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 22, height: 22, backgroundColor: C.ink, borderRadius: 11, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 6, height: 4, backgroundColor: C.bg, borderTopRightRadius: 4, borderBottomRightRadius: 4, marginRight: 4 }} />
      <View style={{ position: 'absolute', right: 5, width: 6, height: 10, borderRightWidth: 1.5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: C.bg, borderTopRightRadius: 5, borderBottomRightRadius: 5, borderLeftWidth: 0 }} />
      <View style={{ position: 'absolute', right: 8, width: 3, height: 6, borderRightWidth: 1.5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: C.bg, borderTopRightRadius: 3, borderBottomRightRadius: 3, borderLeftWidth: 0 }} />
    </View>
  );
}

function GroupIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 32, height: 32, backgroundColor: C.tagBg || C.bgAlt, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: -2, marginBottom: -2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.inkLight }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.inkLight }} />
      </View>
      <View style={{ width: 14, height: 5, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: C.inkLight }} />
    </View>
  );
}

function CheckCircleIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 32, height: 32, backgroundColor: C.tagBg || C.bgAlt, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: C.inkLight, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
         <View style={{ width: 10, height: 2, backgroundColor: C.inkLight, borderRadius: 1, transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: 0 }] }} />
         <View style={{ position: 'absolute', width: 5, height: 2, backgroundColor: C.inkLight, borderRadius: 1, transform: [{ rotate: '-45deg' }, { translateX: -3 }, { translateY: 2 }] }} />
      </View>
    </View>
  );
}

function ClockIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 32, height: 32, backgroundColor: C.tagBg || C.bgAlt, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: C.inkLight, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 1.5, height: 6, backgroundColor: C.inkLight, borderRadius: 0.75, position: 'absolute', top: 3 }} />
        <View style={{ width: 4, height: 1.5, backgroundColor: C.inkLight, borderRadius: 0.75, position: 'absolute', right: 4, top: 8 }} />
      </View>
    </View>
  );
}

interface NotificationItemProps {
  icon: React.ReactNode;
  sender: string;
  time: string;
  title: string;
  desc: string;
  isUnread?: boolean;
}

function NotificationCard({ icon, sender, time, title, desc, isUnread }: NotificationItemProps) {
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  return (
    <TouchableOpacity style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]} activeOpacity={0.7}>
      <View style={s.cardIconArea}>
        {icon}
        {isUnread && <View style={[s.unreadDot, { backgroundColor: C.activeText || C.ink, borderColor: C.surface }]} />}
      </View>
      <View style={s.cardContent}>
        <View style={s.cardHeader}>
          <Text style={[s.cardSender, { color: C.ink }]}>{sender}</Text>
          <Text style={[s.cardTime, { color: C.inkMid }]}>{time}</Text>
        </View>
        <Text style={[s.cardTitle, { color: C.ink }]}>{title}</Text>
        <Text style={[s.cardDesc, { color: C.inkMid }]} numberOfLines={2}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [clearedAnnouncements, setClearedAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    const loadCleared = async () => {
      try {
        const stored = await AsyncStorage.getItem(`cleared_announcements_${profile.uid}`);
        if (stored) {
          setClearedAnnouncements(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Error loading cleared announcements:", err);
      }
    };
    loadCleared();
  }, [profile]);

  const items = useMemo(() => {
    return rawItems.filter((item) => {
      if (item.isAnnouncement) {
        return !clearedAnnouncements.includes(item.id);
      }
      return true;
    });
  }, [rawItems, clearedAnnouncements]);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchNotificationsAndAnnouncements = async () => {
      try {
        // 1. Fetch user notifications
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', profile.uid)
        );
        const snapshot = await getDocs(notifQuery);
        const userNotifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isAnnouncement: false,
        }));

        // 2. Fetch general announcements and filter
        const annSnapshot = await getDocs(collection(db, 'announcements'));
        const allAnn = annSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isAnnouncement: true,
        }));

        // Filter based on user profile
        const userDept = (profile.department || '').toLowerCase();
        const userLevel = (profile.academicLevel || '100').replace('LVL', '').replace('lvl', '');

        const filteredAnn = allAnn.filter((ann: any) => {
          // Check university filter
          if (ann.At && profile.At && ann.At !== profile.At) return false;

          if (ann.targetType === 'all') return true;
          if (ann.targetType === 'uid' && ann.targetValue === profile.uid) return true;
          
          const annDept = (ann.targetValue || '').toLowerCase();
          if (ann.targetType === 'department' && (annDept === userDept || userDept.includes(annDept))) return true;
          
          const annLvl = (ann.targetValue || '').replace('LVL', '').replace('lvl', '');
          if (ann.targetType === 'academicLevel' && annLvl === userLevel) return true;
          return false;
        });

        // Parse date for sorting
        const formatTime = (dateStr: any) => {
          if (!dateStr) return 0;
          try {
            return new Date(dateStr).getTime();
          } catch {
            return 0;
          }
        };

        // Combine and Sort descending by date
        const combined = [...userNotifs, ...filteredAnn].sort((a, b) => {
          return formatTime(b.createdAt) - formatTime(a.createdAt);
        });

        setRawItems(combined);
        setLoading(false);
      } catch (err) {
        console.error("Notifications/Announcements fetch error:", err);
        setLoading(false);
      }
    };

    fetchNotificationsAndAnnouncements();
  }, [profile]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (!profile || items.length === 0) return;
    try {
      const batch = writeBatch(db);
      let count = 0;
      items.forEach(item => {
        if (!item.isAnnouncement && !item.isRead) {
          batch.update(doc(db, 'notifications', item.id), { isRead: true });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        Alert.alert('Success', 'All notifications marked as read!');
      } else {
        Alert.alert('Info', 'No unread notifications.');
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  // Delete all notifications
  const handleDeleteAll = async () => {
    if (!profile || items.length === 0) return;
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to clear your entire notification history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const batch = writeBatch(db);
              let userNotifsCount = 0;
              const newClearedAnnIds = [...clearedAnnouncements];

              rawItems.forEach(item => {
                if (!item.isAnnouncement) {
                  batch.delete(doc(db, 'notifications', item.id));
                  userNotifsCount++;
                } else {
                  if (!newClearedAnnIds.includes(item.id)) {
                    newClearedAnnIds.push(item.id);
                  }
                }
              });

              if (userNotifsCount > 0) {
                await batch.commit();
              }

              if (newClearedAnnIds.length > clearedAnnouncements.length) {
                setClearedAnnouncements(newClearedAnnIds);
                await AsyncStorage.setItem(
                  `cleared_announcements_${profile.uid}`,
                  JSON.stringify(newClearedAnnIds)
                );
              }

              Alert.alert('Success', 'Notification history cleared!');
            } catch (err) {
              console.error("Error clearing notifications:", err);
            }
          }
        }
      ]
    );
  };

  // Helper to format dates to relative time
  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'some time ago';
    try {
      const ms = new Date().getTime() - new Date(dateStr).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'recent';
    }
  };

  const hasUnread = items.some(it => !it.isAnnouncement && !it.isRead);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.ink }]}>Notifications</Text>
        <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/profile-settings')}>
          <UserSquareIcon />
        </TouchableOpacity>
      </View>

      {/* Tabs / Actions */}
      <View style={s.actionRow}>
        <View style={s.tabContainer}>
           <TouchableOpacity 
             style={[s.tabActive, { backgroundColor: hasUnread ? C.ink : C.border }]} 
             onPress={handleMarkAllRead}
             disabled={!hasUnread}
           >
             <Text style={[s.tabTextActive, { color: C.bg }]}>Mark all as read</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[s.tab, { borderColor: C.border }]}
             onPress={handleDeleteAll}
           >
             <Text style={[s.tabText, { color: C.ink }]}>Delete all</Text>
           </TouchableOpacity>
        </View>
        <Text style={[s.sectionHeaderLabel, { color: C.inkMid }]}>LOGS</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.ink} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🔔</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.ink, marginBottom: 8 }}>All caught up!</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.inkLight, textAlign: 'center' }}>
              No notifications or announcements found.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const timeStr = getRelativeTime(item.createdAt);
            const icon = item.isAnnouncement ? <SpeakerIcon /> : <ClockIcon />;
            const senderName = item.isAnnouncement ? "Announcement" : (item.sender || item.title || "COLEARN");
            const titleText = item.title || "New System Notification";
            const descText = item.desc || item.message || item.detail || "Notification update details.";

            return (
              <NotificationCard
                key={item.id}
                icon={icon}
                sender={senderName}
                time={timeStr}
                title={titleText}
                desc={descText}
                isUnread={!item.isAnnouncement && !item.isRead}
              />
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="social" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 32, flex: 1, marginLeft: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  profileBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  actionRow: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tabActive: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tab: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabTextActive: { fontFamily: F.bold, fontSize: 13 },
  tabText: { fontFamily: F.bold, fontSize: 13 },

  sectionHeaderLabel: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 2,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  sectionHeaderLabelCenter: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 2,
    marginHorizontal: 12,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardIconArea: {
    marginRight: 12,
    position: 'relative',
    height: 44,
    justifyContent: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardSender: { fontFamily: F.bold, fontSize: 16 },
  cardTime: { fontFamily: F.medium, fontSize: 12 },
  cardTitle: { fontFamily: F.bold, fontSize: 15, marginBottom: 8 },
  cardDesc: { fontFamily: F.medium, fontSize: 13, lineHeight: 18 },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: { flex: 1, height: 1 },
});
