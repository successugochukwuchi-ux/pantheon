import React, { useState, useEffect, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../components/Theme';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

function BackIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function getContrastColor(hexColor: string) {
  if (!hexColor) return '#FFFFFF';
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0A0A0A' : '#FFFFFF';
}

export default function StudentProfileView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uid: string }>();
  const { profile: currentUserProfile } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const inkContrast = useMemo(() => getContrastColor(C.ink), [C.ink]);

  const [student, setStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const targetUid = params.uid;

  // 1. Fetch Student Profile and check Friendship
  useEffect(() => {
    if (!targetUid || !currentUserProfile) return;

    // Load student profile details
    setLoading(true);
    const userRef = doc(db, 'users', targetUid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setStudent({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert('Not Found', 'The requested student profile could not be retrieved.');
        router.back();
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching student profile:', error);
      setLoading(false);
    });

    // Check friendship and requests status in real-time
    const qFriends = query(collection(db, 'friendships'), where('uids', 'array-contains', currentUserProfile.uid));
    const unsubFriends = onSnapshot(qFriends, async (snapshot) => {
      const friendship = snapshot.docs.find(d => d.data().uids.includes(targetUid));
      if (friendship) {
        setFriendStatus('friends');
        setFriendshipId(friendship.id);
        setRequestId(null);
      } else {
        setFriendshipId(null);

        // Check if there is an inbound or outbound pending friend request
        const qReqSent = query(
          collection(db, 'friend_requests'),
          where('fromUid', '==', currentUserProfile.uid),
          where('toUid', '==', targetUid),
          where('status', '==', 'pending')
        );
        const snapSent = await getDocs(qReqSent);
        if (!snapSent.empty) {
          setFriendStatus('pending_sent');
          setRequestId(snapSent.docs[0].id);
        } else {
          const qReqRecv = query(
            collection(db, 'friend_requests'),
            where('fromUid', '==', targetUid),
            where('toUid', '==', currentUserProfile.uid),
            where('status', '==', 'pending')
          );
          const snapRecv = await getDocs(qReqRecv);
          if (!snapRecv.empty) {
            setFriendStatus('pending_received');
            setRequestId(snapRecv.docs[0].id);
          } else {
            setFriendStatus('none');
            setRequestId(null);
          }
        }
      }
    });

    return () => {
      unsubUser();
      unsubFriends();
    };
  }, [targetUid, currentUserProfile]);

  const handleAddFriend = async () => {
    if (!currentUserProfile || !targetUid) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'friend_requests'), {
        fromUid: currentUserProfile.uid,
        fromName: currentUserProfile.username || 'Student',
        fromPhoto: currentUserProfile.photoURL || '',
        toUid: targetUid,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      Alert.alert('Request Sent', 'Your friend request has been sent successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send friend request. Please check your connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
      Alert.alert('Request Cancelled', 'Friend request cancelled.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to cancel request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!requestId || !currentUserProfile || !targetUid) return;
    setActionLoading(true);
    try {
      await addDoc(collection(db, 'friendships'), {
        uids: [currentUserProfile.uid, targetUid],
        createdAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, 'friend_requests', requestId));
      Alert.alert('Accepted', 'Friend request accepted! You can now start chatting.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to accept request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
      Alert.alert('Rejected', 'Friend request dismissed.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to ignore request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!friendshipId) return;
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await deleteDoc(doc(db, 'friendships', friendshipId));
              Alert.alert('Removed', 'Friend removed.');
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to unfriend.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStartDM = () => {
    if (!student) return;
    router.push({
      pathname: '/chat-room',
      params: {
        chatId: '',
        otherUid: student.id,
        name: student.username || student.name || 'Student',
        isGroup: 'false',
      }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.centerScreen]}>
        <ActivityIndicator size="large" color={C.activeText} />
        <Text style={[s.centerText, { color: C.inkLight }]}>Retrieving student profile index...</Text>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={[s.root, s.centerScreen]}>
        <Text style={[s.centerText, { color: C.ink }]}>Student profile not found.</Text>
      </SafeAreaView>
    );
  }

  const isSelf = currentUserProfile?.uid === targetUid;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon color={C.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.ink }]}>Student Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card Banner Decoration */}
        <View style={[s.profileBanner, { backgroundColor: C.border }]} />

        {/* Profile Info Details */}
        <View style={[s.avatarCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.avatarWrapper}>
            {student.photoURL && !imgError ? (
              <Image 
                source={{ uri: student.photoURL.replace('/svg', '/png') }} 
                style={s.avatar} 
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: C.tagBg, borderColor: C.border }]}>
                <Text style={s.placeholderSign}>👤</Text>
              </View>
            )}
          </View>

          <Text style={[s.username, { color: C.ink }]}>{student.username || 'CoLearn Student'}</Text>
          <Text style={[s.tagText, { color: C.inkMid }]}>{student.department || 'General Science'}</Text>
          
          <View style={[s.levelBadge, { backgroundColor: C.tagBg }]}>
            <Text style={[s.levelText, { color: C.tagText }]}>{student.academicLevel ? `${student.academicLevel} Level` : '100 Level'}</Text>
          </View>
        </View>

        {/* Dynamic Friendship Action Section */}
        {!isSelf && (
          <View style={[s.actionCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.activeText} style={{ marginVertical: 10 }} />
            ) : friendStatus === 'friends' ? (
              <View style={s.friendActionRow}>
                <TouchableOpacity style={[s.btn, s.chatButton, { backgroundColor: C.ink }]} activeOpacity={0.8} onPress={handleStartDM}>
                  <Text style={[s.btnText, { color: inkContrast }]}>Send Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.unfriendButton, { borderColor: C.border }]} activeOpacity={0.8} onPress={handleUnfriend}>
                  <Text style={[s.btnText, { color: C.error }]}>Unfriend</Text>
                </TouchableOpacity>
              </View>
            ) : friendStatus === 'pending_sent' ? (
              <View style={s.actionCol}>
                <Text style={[s.statusTip, { color: C.inkMid }]}>Friend request sent. Waiting for response...</Text>
                <TouchableOpacity style={[s.btn, s.cancelButton, { borderColor: C.border }]} activeOpacity={0.8} onPress={handleCancelRequest}>
                  <Text style={[s.btnText, { color: C.inkLight }]}>Cancel Request</Text>
                </TouchableOpacity>
              </View>
            ) : friendStatus === 'pending_received' ? (
              <View style={s.actionCol}>
                <Text style={[s.statusTip, { color: C.inkMid }]}>This student sent you a friend request!</Text>
                <View style={s.buttonRow}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: C.ink, flex: 1, marginRight: 8 }]} activeOpacity={0.8} onPress={handleAcceptRequest}>
                    <Text style={[s.btnText, { color: inkContrast }]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, s.cancelButton, { borderColor: C.border, flex: 1 }]} activeOpacity={0.8} onPress={handleRejectRequest}>
                    <Text style={[s.btnText, { color: C.inkMid }]}>Ignore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={[s.btn, { backgroundColor: C.ink }]} activeOpacity={0.8} onPress={handleAddFriend}>
                <Text style={[s.btnText, { color: inkContrast }]}>+ Add Friend</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Academic Details Section */}
        <View style={[s.detailsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.detailsCardTitle, { color: C.ink }]}>Academic Identity</Text>
          
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: C.inkLight }]}>STUDENT ID</Text>
            <Text style={[s.detailValue, { color: C.ink }]}>{student.studentId || 'N/A'}</Text>
          </View>

          <View style={[s.minorDivider, { backgroundColor: C.border }]} />

          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: C.inkLight }]}>DEPARTMENT</Text>
            <Text style={[s.detailValue, { color: C.ink }]}>{student.department || 'General Studies'}</Text>
          </View>

          <View style={[s.minorDivider, { backgroundColor: C.border }]} />

          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: C.inkLight }]}>REGISTRATION STATUS</Text>
            <Text style={[s.detailValue, { color: student.isActivated ? C.activeText : C.error }]}>
              {student.isActivated ? 'Activated Member' : 'Inactive Account'}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centerScreen: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { fontFamily: F.bold, fontSize: 16, marginTop: 12, textAlign: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 18, letterSpacing: 0.5 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  scrollContent: { padding: 16, paddingTop: 10 },
  
  profileBanner: {
    height: 80,
    borderRadius: 16,
    marginBottom: -50,
    opacity: 0.8,
  },

  avatarCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  avatarWrapper: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  placeholderSign: { fontSize: 36, opacity: 0.5 },

  username: { fontFamily: F.display, fontSize: 26, marginBottom: 4 },
  tagText: { fontFamily: F.bold, fontSize: 13, marginBottom: 12 },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: { fontFamily: F.bold, fontSize: 11 },

  // Action card
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  friendActionRow: { flexDirection: 'row', gap: 12 },
  actionCol: { alignItems: 'center', width: '100%' },
  buttonRow: { flexDirection: 'row', width: '100%' },
  statusTip: { fontFamily: F.medium, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  
  btn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  chatButton: { backgroundColor: '#000', flex: 2 },
  unfriendButton: { borderWidth: 1, flex: 1, backgroundColor: 'transparent' },
  cancelButton: { borderWidth: 1, width: '100%', backgroundColor: 'transparent' },
  
  btnText: { fontFamily: F.bold, fontSize: 14 },
  btnTextWhite: { fontFamily: F.bold, fontSize: 14, color: '#fff' },

  // Details detailsCard
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  detailsCardTitle: { fontFamily: F.bold, fontSize: 16, marginBottom: 18 },
  detailRow: { paddingVertical: 4 },
  detailLabel: { fontFamily: F.bold, fontSize: 10, letterSpacing: 0.7, marginBottom: 4 },
  detailValue: { fontFamily: F.medium, fontSize: 14 },
  minorDivider: { height: 1, marginVertical: 12 },
});
