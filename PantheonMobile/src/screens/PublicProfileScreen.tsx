import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { DicebearAvatar } from '../components/DicebearAvatar';
import { Award, Copy } from 'lucide-react-native';
import { UserProfile, CBTSession } from '../types';

export const PublicProfileScreen = ({ route, navigation }: any) => {
  const { userId } = route.params;
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cbtResults, setCbtResults] = useState<CBTSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }

        const q = query(collection(db, 'cbtResults'), where('userId', '==', userId));
        const cbtSnap = await getDocs(q);
        setCbtResults(cbtSnap.docs.map(d => d.data() as CBTSession));
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const copyToClipboard = (text: string) => {
    Alert.alert('Copied', 'ID copied to clipboard');
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.muted }]}>
        <DicebearAvatar seed={profile.username || userId} size={100} />
        <Text style={[styles.username, { color: colors.foreground }]}>{profile.username}</Text>
        <Text style={[styles.academicLevel, { color: colors.mutedForeground }]}>
          {profile.academicLevel || profile.level} Level • {profile.department || 'General'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{cbtResults.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>CBTs</Text>
        </View>
        <View style={[styles.statBox, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{profile.referralCount || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Referrals</Text>
        </View>
        <View style={[styles.statBox, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {cbtResults.length > 0 ? Math.round(cbtResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / cbtResults.length * 100) : 0}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Avg Score</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Identification</Text>
        <TouchableOpacity
          style={[styles.idCard, { backgroundColor: colors.muted }]}
          onPress={() => copyToClipboard(profile.studentId)}
        >
          <View>
            <Text style={[styles.idLabel, { color: colors.mutedForeground }]}>STUDENT ID</Text>
            <Text selectable style={[styles.idValue, { color: colors.foreground }]}>{profile.studentId}</Text>
          </View>
          <Copy size={20} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.idCard, { backgroundColor: colors.muted, marginTop: 12 }]}
          onPress={() => copyToClipboard(profile.uid)}
        >
          <View>
            <Text style={[styles.idLabel, { color: colors.mutedForeground }]}>FIREBASE ID</Text>
            <Text selectable style={[styles.idValue, { color: colors.foreground, fontSize: 12 }]}>{profile.uid}</Text>
          </View>
          <Copy size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>CBT Achievements</Text>
        {cbtResults.length > 0 ? (
          cbtResults.map((result, idx) => (
            <View key={idx} style={[styles.achievementItem, { borderBottomColor: colors.border }]}>
              <Award size={24} color={colors.primary} />
              <View style={styles.achievementInfo}>
                <Text style={[styles.achievementTitle, { color: colors.foreground }]}>Course Quiz</Text>
                <Text style={[styles.achievementDate, { color: colors.mutedForeground }]}>
                  {new Date(result.completedAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.achievementScore, { color: colors.primary }]}>
                {result.score}/{result.totalQuestions}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No achievements yet.</Text>
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
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  academicLevel: {
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  idLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  idValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 16,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  achievementDate: {
    fontSize: 12,
  },
  achievementScore: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
