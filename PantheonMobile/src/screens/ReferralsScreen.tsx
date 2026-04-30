import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Gift, Award, Users, Copy, Share2, AlertCircle } from 'lucide-react-native';
import { UserProfile } from '../types';

export const ReferralsScreen = () => {
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setReferredUsers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const referralLink = `https://www.pantheon.com.ng/register?ref=${user?.uid}`;
  const isRestricted = profile?.level && ['1+', '2', '3', '4'].includes(profile.level);

  const handleCopy = () => {
    if (isRestricted) {
      Alert.alert('Restricted', 'Referrals are currently limited to standard level students.');
      return;
    }
    Clipboard.setString(referralLink);
    Alert.alert('Copied', 'Referral link copied to clipboard!');
  };

  const handleShare = async () => {
    if (isRestricted) {
      Alert.alert('Restricted', 'Referrals are currently limited to standard level students.');
      return;
    }
    try {
      await Share.share({
        message: `Join me on Pantheon to access lecture notes, past questions, and CBT practice! ${referralLink}`,
        url: referralLink,
        title: 'Join Pantheon Student Portal'
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Referral Program</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Invite your friends to Pantheon and earn rewards.</Text>
      </View>

      {isRestricted && (
        <View style={[styles.alert, { backgroundColor: colors.destructive + '1A', borderColor: colors.destructive + '33' }]}>
            <AlertCircle size={20} color={colors.destructive} />
            <Text style={[styles.alertText, { color: colors.destructive }]}>
                Level 1+ and Admin accounts are not eligible to participate in the referral program.
            </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.primary + '0D', borderColor: colors.primary + '1A', opacity: isRestricted ? 0.6 : 1 }]}>
        <View style={styles.cardHeader}>
            <Gift size={24} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Your Referral Link</Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>Share this link with your classmates to earn referrals.</Text>

        <View style={[styles.linkBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={[styles.linkText, { color: colors.foreground }]}>{referralLink}</Text>
            <TouchableOpacity onPress={handleCopy}>
                <Copy size={20} color={colors.primary} />
            </TouchableOpacity>
        </View>

        <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
            disabled={isRestricted}
        >
            <Share2 size={20} color={colors.primaryForeground} />
            <Text style={[styles.shareBtnText, { color: colors.primaryForeground }]}>Share Link</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Award size={24} color="#F97316" />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Referrals</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{profile?.referralCount || 0}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Users size={24} color="#10B981" />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Activated</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{referredUsers.filter(u => u.isActivated).length}</Text>
          </View>
      </View>

      <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Referred Students</Text>
          {referredUsers.length > 0 ? (
              referredUsers.map(u => (
                <View key={u.uid} style={[styles.userItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.userInfo}>
                        <View style={[styles.userAvatar, { backgroundColor: colors.muted }]}>
                            <Text style={{ fontWeight: 'bold', color: colors.primary }}>{u.username?.[0].toUpperCase() || 'U'}</Text>
                        </View>
                        <View>
                            <Text style={[styles.userName, { color: colors.foreground }]}>{u.username || 'Anonymous'}</Text>
                            <Text style={[styles.userJoined, { color: colors.mutedForeground }]}>Joined {new Date(u.createdAt).toLocaleDateString()}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: u.isActivated ? '#10B9811A' : colors.muted }]}>
                        <Text style={{ color: u.isActivated ? '#10B981' : colors.mutedForeground, fontSize: 10, fontWeight: 'bold' }}>
                            {u.isActivated ? 'ACTIVATED' : 'PENDING'}
                        </Text>
                    </View>
                </View>
              ))
          ) : (
              <View style={styles.emptyBox}>
                  <Users size={48} color={colors.mutedForeground} opacity={0.2} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>You haven't referred anyone yet.</Text>
              </View>
          )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  alert: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 14,
    marginBottom: 20,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    gap: 12,
  },
  shareBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 12,
      marginBottom: 32,
  },
  statBox: {
      flex: 1,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      gap: 8,
  },
  statLabel: {
      fontSize: 12,
      fontWeight: '600',
  },
  statValue: {
      fontSize: 28,
      fontWeight: 'bold',
  },
  section: {
      paddingHorizontal: 16,
      paddingBottom: 40,
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 16,
  },
  userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
  },
  userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
  },
  userName: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  userJoined: {
      fontSize: 12,
  },
  statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
  },
  emptyBox: {
      alignItems: 'center',
      padding: 40,
      gap: 12,
  },
  emptyText: {
      fontSize: 14,
      textAlign: 'center',
  }
});
