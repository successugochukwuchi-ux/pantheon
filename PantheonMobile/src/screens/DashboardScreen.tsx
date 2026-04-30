import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BookOpen, History, Zap, GraduationCap, Menu } from 'lucide-react-native';
import { NewsItem } from '../types';

export const DashboardScreen = ({ navigation }: any) => {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(3));
      const querySnapshot = await getDocs(q);
      const newsItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
      setNews(newsItems);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews().then(() => setRefreshing(false));
  }, [fetchNews]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.welcome, { color: colors.mutedForeground }]}>Welcome back,</Text>
          <Text style={[styles.username, { color: colors.foreground }]}>{profile?.username || 'Student'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Menu size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: colors.muted }]}>
        <View style={[styles.statCard, { borderRightColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{profile?.level || '1'}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Level</Text>
        </View>
        <View style={[styles.statCard, { borderRightColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{profile?.referralCount || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Referrals</Text>
        </View>
        <View style={styles.statCardLast}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{profile?.isActivated ? 'Active' : 'Free'}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Status</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Study Companion</Text>
        <View style={styles.grid}>
          <MenuCard
            icon={<BookOpen size={24} color="#3B82F6" />}
            title="Notes"
            onPress={() => navigation.navigate('Lecture Notes')}
            colors={colors}
          />
          <MenuCard
            icon={<History size={24} color="#A855F7" />}
            title="Past Questions"
            onPress={() => navigation.navigate('Past Questions')}
            colors={colors}
          />
          <MenuCard
            icon={<Zap size={24} color="#F97316" />}
            title="Punch"
            onPress={() => navigation.navigate('Punch Notes')}
            colors={colors}
          />
          <MenuCard
            icon={<GraduationCap size={24} color="#6366F1" />}
            title="CBT"
            onPress={() => navigation.navigate('CBT Practice')}
            colors={colors}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest News</Text>
        {news.length > 0 ? (
          news.map((item) => (
            <View key={item.id} style={[styles.newsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.newsTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.newsContent, { color: colors.mutedForeground }]} numberOfLines={2}>{item.content}</Text>
              <Text style={[styles.newsDate, { color: colors.mutedForeground }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No news at the moment.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const MenuCard = ({ icon, title, onPress, colors }: any) => (
  <TouchableOpacity style={[styles.menuCard, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={onPress}>
    <View style={styles.iconContainer}>{icon}</View>
    <Text style={[styles.menuTitle, { color: colors.foreground }]}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  welcome: {
    fontSize: 14,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 24,
    borderRadius: 16,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  statCardLast: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  newsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  newsContent: {
    fontSize: 14,
    marginBottom: 8,
  },
  newsDate: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
  },
});
