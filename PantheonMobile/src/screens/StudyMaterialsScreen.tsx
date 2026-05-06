import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Course } from '../types';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
import { OfflineService, OfflineCourse } from '../services/offlineService';

export const StudyMaterialsScreen = ({ route, navigation }: any) => {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const type = route.params?.type || 'lecture';
  const [courses, setCourses] = useState<Course[]>([]);
  const [downloadedMetadata, setDownloadedMetadata] = useState<OfflineCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user || !profile) return;

      // 1. Initial Load from Cache (Immediate)
      try {
        const offline = await OfflineService.getDownloadedCourses(user.uid);
        const cachedSem = await OfflineService.getCachedSemester(user.uid);
        
        if (offline.length > 0) {
          const offlineData = offline.map(o => ({
            id: o.id,
            code: o.code,
            title: o.title,
            department: 'Offline',
            level: profile?.academicLevel || '100L',
            semester: cachedSem || 'Unknown'
          } as any));
          setCourses(offlineData);
          setLoading(false); // Stop waiting if we have some data
        }
        setDownloadedMetadata(offline);
      } catch (e) {
        console.log('Error loading initial offline state');
      }

      // 2. Try Online Update
      try {
        const q = query(collection(db, 'courses'));
        const querySnapshot = await getDocs(q);
        let liveCourseItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        
        // Filter by department if available
        if (profile?.department) {
          const userDept = profile.department.toLowerCase().trim();
          liveCourseItems = liveCourseItems.filter(c => 
            !c.department || c.department.toLowerCase().trim() === userDept || c.department === 'All'
          );
        }

        // Filter by level if available
        if (profile?.academicLevel) {
          const userLevel = String(profile.academicLevel).replace(/\D/g, '');
          if (userLevel) {
            liveCourseItems = liveCourseItems.filter(c => {
              const cLevel = String(c.level || '').replace(/\D/g, '');
              return !cLevel || cLevel === userLevel;
            });
          }
        }

        setCourses(liveCourseItems.length > 0 ? liveCourseItems : prev => prev);
        const updatedOffline = await OfflineService.checkForUpdates(user.uid, liveCourseItems);
        setDownloadedMetadata(updatedOffline);
      } catch (error) {
        console.log('Online course fetch failed, staying with offline data');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
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
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const offlineInfo = downloadedMetadata.find(d => d.id === item.id);
          const hasUpdate = offlineInfo?.hasUpdate;

          return (
            <View style={[
              styles.courseItemContainer, 
              { 
                backgroundColor: hasUpdate ? '#FFFF00' : colors.card, 
                borderColor: colors.border 
              }
            ]}>
              <TouchableOpacity
                style={styles.courseItem}
                onPress={() => navigation.navigate('CourseNotes', { courseId: item.id, courseCode: item.code, type })}
              >
                <View>
                  <Text style={[styles.courseCode, { color: hasUpdate ? '#000' : colors.primary }]}>{item.code}</Text>
                  <Text style={[styles.courseTitle, { color: hasUpdate ? '#333' : colors.mutedForeground }]}>{item.title}</Text>
                </View>
                <ChevronRight size={20} color={hasUpdate ? '#000' : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.discussionButton, 
                  { 
                    backgroundColor: hasUpdate ? 'rgba(0,0,0,0.05)' : colors.muted, 
                    borderTopColor: hasUpdate ? 'rgba(0,0,0,0.1)' : colors.border 
                  }
                ]}
                onPress={() => navigation.navigate('CourseDiscussion', { courseId: item.id, courseCode: item.code })}
              >
                <MessageSquare size={16} color={hasUpdate ? '#000' : colors.primary} />
                <Text style={[styles.discussionButtonText, { color: hasUpdate ? '#000' : colors.primary }]}>Join Discussion</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No courses found.</Text>}
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
  courseItemContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  courseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  courseCode: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  courseTitle: {
    fontSize: 14,
  },
  discussionButton: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  discussionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
});
