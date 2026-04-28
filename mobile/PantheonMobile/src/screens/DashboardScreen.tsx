import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { BookOpen, History, Zap, GraduationCap, LogOut } from 'lucide-react-native';
import { auth } from '../services/firebase';
import { NewsItem } from '../types';

export const DashboardScreen = ({ navigation }: any) => {
  const { profile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = async () => {
    try {
      const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(3));
      const querySnapshot = await getDocs(q);
      const newsItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
      setNews(newsItems);
    } catch (error) {
      console.error("Error fetching news:", error);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchNews().then(() => setRefreshing(false));
  }, []);

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.username}>{profile?.username || 'Student'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <LogOut size={24} color={theme.colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.level || '1'}</Text>
          <Text style={styles.statLabel}>Level</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.referralCount || 0}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>
        <View style={styles.statCardLast}>
          <Text style={styles.statValue}>{profile?.isActivated ? 'Active' : 'Free'}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Study Companion</Text>
        <View style={styles.grid}>
          <MenuCard
            icon={<BookOpen size={24} color="#3B82F6" />}
            title="Notes"
            onPress={() => navigation.navigate('Study')}
          />
          <MenuCard
            icon={<History size={24} color="#A855F7" />}
            title="Past Questions"
            onPress={() => navigation.navigate('PastQuestions')}
          />
          <MenuCard
            icon={<Zap size={24} color="#F97316" />}
            title="Punch"
            onPress={() => navigation.navigate('Punch')}
          />
          <MenuCard
            icon={<GraduationCap size={24} color="#6366F1" />}
            title="CBT"
            onPress={() => navigation.navigate('CBT')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest News</Text>
        {news.length > 0 ? (
          news.map((item) => (
            <View key={item.id} style={styles.newsCard}>
              <Text style={styles.newsTitle}>{item.title}</Text>
              <Text style={styles.newsContent} numberOfLines={2}>{item.content}</Text>
              <Text style={styles.newsDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No news at the moment.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const MenuCard = ({ icon, title, onPress }: any) => (
  <TouchableOpacity style={styles.menuCard} onPress={onPress}>
    <View style={styles.iconContainer}>{icon}</View>
    <Text style={styles.menuTitle}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  welcome: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.muted,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  statCardLast: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    color: theme.colors.foreground,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '47%',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.sm,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  newsCard: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  newsContent: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginBottom: 8,
  },
  newsDate: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.md,
  },
});
