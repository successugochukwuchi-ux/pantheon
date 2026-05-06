import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { QuestionSheet } from '../types';
import { ChevronRight, ClipboardList } from 'lucide-react-native';
import { OfflineService } from '../services/offlineService';

export const CBTScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const [sheets, setSheets] = useState<QuestionSheet[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const fetchSheets = async () => {
      if (!user || !profile) return;

      // 1. Initial Load from Local Cache (Immediate)
      const loadOffline = async () => {
        try {
          const cachedResults = await OfflineService.getCachedCBTResults(user.uid);
          setResults(cachedResults);

          const downloaded = await OfflineService.getDownloadedCourses(user.uid);
          const offlineSheets: any[] = [];
          for (const course of downloaded) {
            const content = await OfflineService.getCourseContent(user.uid, course.id);
            if (content && content.sheets) {
              content.sheets.forEach(s => offlineSheets.push({ ...s, isOffline: true }));
            }
          }
          
          if (offlineSheets.length > 0) {
            setSheets(prev => {
              const combined = [...prev, ...offlineSheets];
              return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            });
            setLoading(false); // Show offline sheets immediately
          }
        } catch (e) {
          console.log('Error loading initial offline CBT data');
        }
      };
      
      await loadOffline();
      
      // 2. Online Update
      try {
        const q = query(collection(db, 'questionSheets'), where('isAvailable', '==', true));
        const querySnapshot = await getDocs(q);
        let liveSheets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet));

        if (profile?.academicLevel) {
          const uLevel = String(profile.academicLevel).replace(/\D/g, '');
          if (uLevel) {
            liveSheets = liveSheets.filter(s => {
              const sLevel = String(s.academicLevel || '').replace(/\D/g, '');
              return !sLevel || sLevel === uLevel;
            });
          }
        }

        // Get offline content to merge
        const downloaded = await OfflineService.getDownloadedCourses(user.uid);
        const offlineSheets: any[] = [];
        for (const course of downloaded) {
          const content = await OfflineService.getCourseContent(user.uid, course.id);
          if (content && content.sheets) {
            content.sheets.forEach(s => {
              if (!liveSheets.find(ls => ls.id === s.id)) {
                offlineSheets.push({ ...s, isOffline: true });
              }
            });
          }
        }

        if (liveSheets.length > 0) {
          setSheets([...liveSheets, ...offlineSheets]);
        }
      } catch (error) {
        console.log('Online CBT fetch failed, using offline data');
      } finally {
        setLoading(false);
      }
    };
    fetchSheets();
  }, [user, profile]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          results.length > 0 ? (
            <View style={styles.resultsSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Results</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultsScroll}>
                {results.map((res, index) => (
                  <View key={index} style={[styles.resultCard, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.resultScore, { color: colors.primary }]}>{res.score}/{res.totalQuestions}</Text>
                    <Text style={[styles.resultDate, { color: colors.mutedForeground }]}>
                      {new Date(res.completedAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>Practice Sheets</Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            style={[
              styles.sheetItem, 
              { 
                backgroundColor: colors.card, 
                borderColor: item.isOffline ? '#22c55e' : colors.border 
              }
            ]}
            onPress={() => navigation.navigate('CBTQuiz', { sheetId: item.id, title: `${item.academicLevel}L ${item.year}` })}
          >
            <View style={styles.sheetInfo}>
              <View style={[styles.iconContainer, { backgroundColor: colors.muted }]}>
                <ClipboardList size={24} color={colors.primary} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{item.academicLevel} Level - {item.year}</Text>
                  {item.isOffline && (
                    <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 6, borderRadius: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>OFFLINE</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>{item.semester} Semester</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No CBT practice sessions available.</Text>}
        contentContainerStyle={styles.list}
      />
    </View>
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
  list: {
    padding: 16,
  },
  resultsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultsScroll: {
    gap: 12,
  },
  resultCard: {
    padding: 12,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  resultScore: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  resultDate: {
    fontSize: 10,
    marginTop: 4,
  },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  sheetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sheetSubtitle: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
});
