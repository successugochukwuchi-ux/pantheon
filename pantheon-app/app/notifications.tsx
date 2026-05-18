import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';

// ── Sub-components & Icons ───────────────────────────────────────────────────

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function UserSquareIcon() {
  return (
    <View style={{ width: 20, height: 20, borderWidth: 1.8, borderColor: C.ink, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.ink }} />
      <View style={{ width: 12, height: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1.5, borderColor: C.ink, borderBottomWidth: 0 }} />
    </View>
  );
}

function SpeakerIcon() {
  return (
    <View style={{ width: 22, height: 22, backgroundColor: '#000', borderRadius: 11, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 6, height: 4, backgroundColor: '#fff', borderTopRightRadius: 4, borderBottomRightRadius: 4, marginRight: 4 }} />
      <View style={{ position: 'absolute', right: 5, width: 6, height: 10, borderRightWidth: 1.5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#fff', borderTopRightRadius: 5, borderBottomRightRadius: 5, borderLeftWidth: 0 }} />
      <View style={{ position: 'absolute', right: 8, width: 3, height: 6, borderRightWidth: 1.5, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#fff', borderTopRightRadius: 3, borderBottomRightRadius: 3, borderLeftWidth: 0 }} />
    </View>
  );
}

function GroupIcon() {
  return (
    <View style={{ width: 32, height: 32, backgroundColor: '#E5E4DE', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: -2, marginBottom: -2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E8E' }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E8E' }} />
      </View>
      <View style={{ width: 14, height: 5, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#8E8E8E' }} />
    </View>
  );
}

function CheckCircleIcon() {
  return (
    <View style={{ width: 32, height: 32, backgroundColor: '#E5E4DE', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: '#8E8E8E', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
         <View style={{ width: 10, height: 2, backgroundColor: '#8E8E8E', borderRadius: 1, transform: [{ rotate: '45deg' }, { translateX: 2 }, { translateY: 0 }] }} />
         <View style={{ position: 'absolute', width: 5, height: 2, backgroundColor: '#8E8E8E', borderRadius: 1, transform: [{ rotate: '-45deg' }, { translateX: -3 }, { translateY: 2 }] }} />
      </View>
    </View>
  );
}

function ClockIcon() {
  return (
    <View style={{ width: 32, height: 32, backgroundColor: '#E5E4DE', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: '#8E8E8E', borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 1.5, height: 6, backgroundColor: '#8E8E8E', borderRadius: 0.75, position: 'absolute', top: 3 }} />
        <View style={{ width: 4, height: 1.5, backgroundColor: '#8E8E8E', borderRadius: 0.75, position: 'absolute', right: 4, top: 8 }} />
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
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.7}>
      <View style={s.cardIconArea}>
        {icon}
        {isUnread && <View style={s.unreadDot} />}
      </View>
      <View style={s.cardContent}>
        <View style={s.cardHeader}>
          <Text style={s.cardSender}>{sender}</Text>
          <Text style={s.cardTime}>{time}</Text>
        </View>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <TouchableOpacity style={s.profileBtn}>
          <UserSquareIcon />
        </TouchableOpacity>
      </View>

      {/* Tabs / Actions */}
      <View style={s.actionRow}>
        <View style={s.tabContainer}>
           <TouchableOpacity style={s.tabActive}>
             <Text style={s.tabTextActive}>Mark all as read</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.tab}>
             <Text style={s.tabText}>Delete all</Text>
           </TouchableOpacity>
        </View>
        <Text style={s.sectionHeaderLabel}>TODAY</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <NotificationCard
          icon={<SpeakerIcon />}
          sender="Pillara Education"
          time="2m ago"
          title="New Curriculum Update Available"
          desc="The engineering department has released the updated syllabus for the current academic session..."
          isUnread
        />

        <NotificationCard
          icon={<Image source={{ uri: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=100&auto=format&fit=crop' }} style={s.avatar} />}
          sender="Chukwuma Opara"
          time="45m ago"
          title="Shared a resource"
          desc='"Hey! I found those past questions for the CSC 201 mid-semester tests. I have uploaded them to the group folder."'
          isUnread
        />

        <NotificationCard
          icon={<GroupIcon />}
          sender="FUTO Tech 2027 Group"
          time="2h ago"
          title="New Event: PHY 101 Intensive Review"
          desc="Review has been scheduled for tomorrow at Hall 3, 4:00 PM. All group members are invited."
        />

        <View style={s.dividerContainer}>
           <View style={s.divider} />
           <Text style={s.sectionHeaderLabelCenter}>YESTERDAY</Text>
           <View style={s.divider} />
        </View>

        <NotificationCard
          icon={<CheckCircleIcon />}
          sender="Library Services"
          time="1d ago"
          title="Book return confirmed"
          desc="Your return of 'Advanced Engineering Mathematics' has been successfully processed at the main library."
        />

        <NotificationCard
          icon={<ClockIcon />}
          sender="Study Manager"
          time="1d ago"
          title="Focus streak milestone!"
          desc="Focus streak milestone! You've completed 5 focus sessions in a row. Keep going to reach your daily goal."
        />

        <View style={{ height: 100 }} />
      </ScrollView>

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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 32, color: C.ink, flex: 1, marginLeft: 8 },
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
    backgroundColor: '#000',
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
    borderColor: '#D0CEC4',
  },
  tabTextActive: { fontFamily: F.bold, fontSize: 13, color: '#fff' },
  tabText: { fontFamily: F.bold, fontSize: 13, color: C.ink },

  sectionHeaderLabel: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.inkMid,
    letterSpacing: 2,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  sectionHeaderLabelCenter: {
    fontFamily: F.bold,
    fontSize: 12,
    color: C.inkMid,
    letterSpacing: 2,
    marginHorizontal: 12,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
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
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: C.surface,
  },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardSender: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  cardTime: { fontFamily: F.medium, fontSize: 12, color: C.inkMid },
  cardTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink, marginBottom: 8 },
  cardDesc: { fontFamily: F.medium, fontSize: 13, color: C.inkMid, lineHeight: 18 },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: { flex: 1, height: 1, backgroundColor: C.border },
});
