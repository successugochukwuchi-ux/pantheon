import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../components/Theme';
import { BottomNav } from '../components/BottomNav';
import {
  getLevel2ReferralThreshold,
  getReferralLink,
  shareReferralNative,
  shareReferralToFacebook,
  shareReferralToWhatsApp,
} from '../lib/referrals';

interface ReferredUser {
  uid: string;
  username?: string;
  isActivated?: boolean;
  level?: string;
  createdAt?: string;
}

function BackIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View
        style={{
          position: 'absolute',
          left: 4,
          width: 10,
          height: 10,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export default function ReferralsScreen() {
  const router = useRouter();
  const { user, profile, systemConfig, isOffline } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const level2Threshold = getLevel2ReferralThreshold(systemConfig);
  const isRestricted =
    profile?.level === '2' ||
    profile?.level === '3' ||
    profile?.level === '4' ||
    profile?.level === '5';

  const referralCode = profile?.studentId || user?.uid || '';
  const referralLink = getReferralLink(user?.uid);

  const activatedCount = useMemo(
    () => referredUsers.filter((u) => !!u.isActivated).length,
    [referredUsers]
  );
  const totalCount = Math.max(profile?.referralCount || 0, referredUsers.length);
  const progressPct = Math.min(100, Math.round((activatedCount / level2Threshold) * 100));
  const remainingForLevel2 = Math.max(0, level2Threshold - activatedCount);

  const loadReferrals = useCallback(
    async (isRefresh = false) => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      const cacheKey = `colearn_referrals_${user.uid}`;
      if (!isRefresh) {
        try {
          const cachedRaw = await AsyncStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cachedList = JSON.parse(cachedRaw);
            if (Array.isArray(cachedList)) {
              setReferredUsers(cachedList);
              setLoading(false);
            }
          }
        } catch {}
      }

      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('referredBy', '==', user.uid))
        );
        const list: ReferredUser[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              username: data.username || 'CoLearn Student',
              isActivated: !!data.isActivated,
              level: data.level || '1',
              createdAt:
                typeof data.createdAt === 'string'
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString() || '',
            };
          })
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });

        setReferredUsers(list);
        AsyncStorage.setItem(cacheKey, JSON.stringify(list)).catch(() => {});

        const activated = list.filter((u) => u.isActivated).length;
        const updates: Record<string, any> = {};
        if (list.length !== (profile?.referralCount || 0)) {
          updates.referralCount = list.length;
        }
        if (profile?.level === '1' && activated >= level2Threshold) {
          updates.level = '2';
        }
        if (Object.keys(updates).length > 0) {
          try {
            await updateDoc(doc(db, 'users', user.uid), updates);
            if (updates.level === '2') {
              Alert.alert(
                'Level 2 Unlocked!',
                `Congratulations! You reached ${level2Threshold} activated referrals and your account has been upgraded to Level 2.`
              );
            }
          } catch (syncErr) {
            console.warn('Could not sync referral stats:', syncErr);
          }
        }
      } catch (err) {
        console.warn('Error loading referrals:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.uid, profile?.level, profile?.referralCount, level2Threshold]
  );

  useEffect(() => {
    loadReferrals(false);
  }, [loadReferrals]);

  const handleRefresh = useCallback(() => {
    if (isOffline) {
      setRefreshing(false);
      Alert.alert('Offline', 'Connect to the internet to refresh your referral status.');
      return;
    }
    setRefreshing(true);
    loadReferrals(true);
  }, [isOffline, loadReferrals]);

  const guardRestricted = () => {
    if (isRestricted) {
      Alert.alert(
        'Referrals Restricted',
        'Level 2 and Administrative accounts are not permitted to make referrals.'
      );
      return true;
    }
    return false;
  };

  const handleCopy = (type: 'code' | 'link', value: string) => {
    if (guardRestricted()) return;
    Clipboard.setString(value);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleQuickWhatsApp = () => {
    if (guardRestricted()) return;
    shareReferralToWhatsApp(referralCode, referralLink);
  };

  const handleQuickFacebook = () => {
    if (guardRestricted()) return;
    shareReferralToFacebook(referralCode, referralLink);
  };

  const handleNativeShare = () => {
    if (guardRestricted()) return;
    shareReferralNative(referralCode, referralLink);
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any))}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <BackIcon color={C.ink} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.ink }]}>Referrals</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.ink} />
        }
      >
        {/* Hero / Policy Banner */}
        {isRestricted ? (
          <View style={[s.restrictedCard, { borderColor: C.error }]}>
            <Text style={[s.restrictedTitle, { color: C.error }]}>
              {profile?.level === '2' ? 'Level 2 Reached — Referrals Closed' : 'Referrals Restricted'}
            </Text>
            <Text style={[s.restrictedSub, { color: C.inkMid }]}>
              Level 2 and Administrative accounts are not eligible to make new referrals to ensure fair rewards for standard Level 1 students.
            </Text>
          </View>
        ) : (
          <View style={[s.heroCard, { backgroundColor: C.surfaceDark }]}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>EARN LEVEL 2 ACCESS</Text>
            </View>
            <Text style={s.heroTitle}>Invite Classmates, Unlock Level 2</Text>
            <Text style={s.heroSubtitle}>
              Share your code or link. Once {level2Threshold} invited{' '}
              {level2Threshold === 1 ? 'friend activates their account' : 'friends activate their accounts'}, your account automatically upgrades to Level 2.
            </Text>
          </View>
        )}

        {/* Stats & Level 2 Progress */}
        <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.cardHeading, { color: C.ink }]}>Your Referral Progress</Text>

          <View style={s.statsRow}>
            <View style={[s.statBox, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
              <Text style={[s.statNumber, { color: C.ink }]}>{totalCount}</Text>
              <Text style={[s.statLabel, { color: C.inkLight }]}>TOTAL INVITED</Text>
            </View>
            <View style={[s.statBox, { backgroundColor: C.activeBg, borderColor: C.border }]}>
              <Text style={[s.statNumber, { color: C.activeText }]}>{activatedCount}</Text>
              <Text style={[s.statLabel, { color: C.activeText }]}>ACTIVATED</Text>
            </View>
          </View>

          <View style={s.progressSection}>
            <View style={s.progressHeader}>
              <Text style={[s.progressTitle, { color: C.inkMid }]}>Level 2 Target</Text>
              <Text style={[s.progressCount, { color: C.ink }]}>
                {activatedCount} / {level2Threshold} Activated
              </Text>
            </View>
            <View style={[s.progressTrack, { backgroundColor: C.bgAlt }]}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: '#27AE60',
                  },
                ]}
              />
            </View>
            <Text style={[s.progressHint, { color: C.inkLight }]}>
              {remainingForLevel2 === 0
                ? 'Target reached! Your account qualifies for Level 2.'
                : `${remainingForLevel2} more activated ${
                    remainingForLevel2 === 1 ? 'referral' : 'referrals'
                  } needed to unlock Level 2.`}
            </Text>
          </View>
        </View>

        {/* Share Card & Quick Share Buttons */}
        <View
          style={[
            s.card,
            { backgroundColor: C.surface, borderColor: C.border },
            isRestricted && { opacity: 0.55 },
          ]}
        >
          <Text style={[s.cardHeading, { color: C.ink }]}>Share &amp; Invite</Text>
          <Text style={[s.cardDesc, { color: C.inkLight }]}>
            Friends can enter your referral code when signing up on the app or open your invite link directly.
          </Text>

          {/* Mobile Referral Code */}
          <Text style={[s.fieldLabel, { color: C.inkLight }]}>YOUR REFERRAL CODE</Text>
          <View style={[s.copyBox, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
            <Text style={[s.codeValue, { color: C.ink }]} numberOfLines={1} selectable>
              {referralCode || 'N/A'}
            </Text>
            <TouchableOpacity
              style={[s.copyBtn, { backgroundColor: C.selectedBg }]}
              onPress={() => handleCopy('code', referralCode)}
              activeOpacity={0.8}
            >
              <Text style={[s.copyBtnText, { color: C.selectedBg === '#FFFFFF' ? '#0A0A0A' : '#FFFFFF' }]}>
                {copiedType === 'code' ? 'Copied ✓' : 'Copy Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Web Referral Link */}
          <Text style={[s.fieldLabel, { color: C.inkLight, marginTop: 14 }]}>YOUR INVITE LINK</Text>
          <View style={[s.copyBox, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
            <Text style={[s.linkValue, { color: C.inkMid }]} numberOfLines={1} ellipsizeMode="middle">
              {referralLink}
            </Text>
            <TouchableOpacity
              style={[s.copyBtn, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]}
              onPress={() => handleCopy('link', referralLink)}
              activeOpacity={0.8}
            >
              <Text style={[s.copyBtnText, { color: C.ink }]}>
                {copiedType === 'link' ? 'Copied ✓' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Share directly to WhatsApp or Facebook */}
          <Text style={[s.fieldLabel, { color: C.inkLight, marginTop: 18 }]}>QUICK SHARE</Text>
          <View style={s.quickShareRow}>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: '#25D366' }]}
              onPress={handleQuickWhatsApp}
              activeOpacity={0.85}
            >
              <Text style={s.quickBtnBadge}>WA</Text>
              <Text style={s.quickBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: '#1877F2' }]}
              onPress={handleQuickFacebook}
              activeOpacity={0.85}
            >
              <Text style={s.quickBtnBadge}>f</Text>
              <Text style={s.quickBtnText}>Facebook</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.moreShareBtn, { borderColor: C.border, backgroundColor: C.bgAlt }]}
            onPress={handleNativeShare}
            activeOpacity={0.8}
          >
            <Text style={[s.moreShareText, { color: C.ink }]}>Share via Other Apps</Text>
          </TouchableOpacity>
        </View>

        {/* Referred Students List */}
        <View style={s.listHeaderRow}>
          <Text style={[s.sectionHeading, { color: C.ink }]}>Referred Students</Text>
          <Text style={[s.listCount, { color: C.inkLight }]}>{referredUsers.length} total</Text>
        </View>

        {loading ? (
          <View style={[s.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <ActivityIndicator size="small" color={C.ink} />
            <Text style={[s.emptySub, { color: C.inkLight, marginTop: 10 }]}>
              Loading your referrals...
            </Text>
          </View>
        ) : referredUsers.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.emptyTitle, { color: C.ink }]}>No referrals yet</Text>
            <Text style={[s.emptySub, { color: C.inkLight }]}>
              Tap WhatsApp or Facebook above to invite your classmates. Activated friends will show up here.
            </Text>
          </View>
        ) : (
          referredUsers.map((item) => (
            <View
              key={item.uid}
              style={[s.userRow, { backgroundColor: C.surface, borderColor: C.border }]}
            >
              <View style={[s.userAvatar, { backgroundColor: C.tagBg }]}>
                <Text style={[s.userAvatarText, { color: C.ink }]}>
                  {(item.username?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={[s.userName, { color: C.ink }]} numberOfLines={1}>
                  {item.username || 'CoLearn Student'}
                </Text>
                <Text style={[s.userDate, { color: C.inkLight }]}>
                  {item.createdAt
                    ? `Joined ${new Date(item.createdAt).toLocaleDateString()}`
                    : 'CoLearn Member'}
                </Text>
              </View>
              <View style={s.userBadges}>
                <View
                  style={[
                    s.statusPill,
                    { backgroundColor: item.isActivated ? C.activeBg : C.tagBg },
                  ]}
                >
                  <Text
                    style={[
                      s.statusPillText,
                      { color: item.isActivated ? C.activeText : C.inkMid },
                    ]}
                  >
                    {item.isActivated ? 'Activated' : 'Pending'}
                  </Text>
                </View>
                <Text style={[s.levelMini, { color: C.inkLight }]}>Lvl {item.level || '1'}</Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const createStyles = (C: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontFamily: F.bold, fontSize: 22 },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16 },

    heroCard: {
      borderRadius: 22,
      padding: 22,
      gap: 10,
    },
    heroBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(39, 174, 96, 0.22)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    heroBadgeText: {
      fontFamily: F.bold,
      fontSize: 10,
      letterSpacing: 1.2,
      color: '#4ADE80',
    },
    heroTitle: {
      fontFamily: F.display,
      fontSize: 24,
      color: '#FFFFFF',
      lineHeight: 30,
    },
    heroSubtitle: {
      fontFamily: F.body,
      fontSize: 13,
      color: 'rgba(255,255,255,0.78)',
      lineHeight: 20,
    },

    restrictedCard: {
      borderRadius: 18,
      borderWidth: 1,
      backgroundColor: 'rgba(192, 57, 43, 0.08)',
      padding: 16,
      gap: 6,
    },
    restrictedTitle: { fontFamily: F.bold, fontSize: 15 },
    restrictedSub: { fontFamily: F.body, fontSize: 13, lineHeight: 19 },

    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
    },
    cardHeading: { fontFamily: F.bold, fontSize: 17, marginBottom: 6 },
    cardDesc: { fontFamily: F.body, fontSize: 13, lineHeight: 19, marginBottom: 14 },

    statsRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 16 },
    statBox: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 14,
      alignItems: 'center',
      gap: 4,
    },
    statNumber: { fontFamily: F.bold, fontSize: 28 },
    statLabel: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1 },

    progressSection: { gap: 8 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressTitle: { fontFamily: F.medium, fontSize: 13 },
    progressCount: { fontFamily: F.bold, fontSize: 13 },
    progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999 },
    progressHint: { fontFamily: F.body, fontSize: 12, lineHeight: 17 },

    fieldLabel: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: 6 },
    copyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
      gap: 8,
    },
    codeValue: { flex: 1, fontFamily: F.bold, fontSize: 15, letterSpacing: 0.6 },
    linkValue: { flex: 1, fontFamily: F.body, fontSize: 12 },
    copyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    copyBtnText: { fontFamily: F.bold, fontSize: 12 },

    quickShareRow: { flexDirection: 'row', gap: 10 },
    quickBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
    },
    quickBtnBadge: {
      fontFamily: F.bold,
      fontSize: 13,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.18)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
    },
    quickBtnText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },

    moreShareBtn: {
      marginTop: 10,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    moreShareText: { fontFamily: F.bold, fontSize: 13 },

    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    sectionHeading: { fontFamily: F.display, fontSize: 20 },
    listCount: { fontFamily: F.medium, fontSize: 12 },

    emptyCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 24,
      alignItems: 'center',
    },
    emptyTitle: { fontFamily: F.bold, fontSize: 15, marginBottom: 6 },
    emptySub: { fontFamily: F.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },

    userRow: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    userAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: { fontFamily: F.bold, fontSize: 16 },
    userInfo: { flex: 1, gap: 2 },
    userName: { fontFamily: F.bold, fontSize: 14 },
    userDate: { fontFamily: F.body, fontSize: 12 },
    userBadges: { alignItems: 'flex-end', gap: 4 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusPillText: { fontFamily: F.bold, fontSize: 11 },
    levelMini: { fontFamily: F.medium, fontSize: 11 },
  });
