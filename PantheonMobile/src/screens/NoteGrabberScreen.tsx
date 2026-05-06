import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OfflineService, OfflineCourse } from '../services/offlineService';
import { Download, Trash2, RefreshCcw, Info, Bug } from 'lucide-react-native';

export const NoteGrabberScreen = () => {
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const [courses, setCourses] = useState<any[]>([]);
  const [downloaded, setDownloaded] = useState<OfflineCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeSemester, setActiveSemester] = useState<'1st' | '2nd' | null>(null);
  const [showDebug, setShowDebug] = useState(false);

    const fetchData = async () => {
    if (!user || !profile) {
      setCourses([]);
      setActiveSemester(null);
      setLoading(false);
      return;
    }

    const userId = user.uid;
    setLoading(true);

    try {
      // 1. Initial Load from Local Storage (Fast Response)
      const offlineCourses = await OfflineService.getDownloadedCourses(userId);
      setDownloaded(offlineCourses);
      
      let bestKnownSem = await OfflineService.getCachedSemester(userId);
      if (bestKnownSem) {
        setActiveSemester(bestKnownSem as '1st' | '2nd');
      }

      if (offlineCourses.length > 0) {
        setCourses(offlineCourses.map(o => ({
          id: o.id,
          code: o.code,
          title: o.title,
          isOfflineOnly: true
        } as any)));
      }

      // 2. Try Online Update
      try {
        let currentSem = bestKnownSem || '1st';
        let configDoc = await getDoc(doc(db, 'system', 'config'));
        if (!configDoc.exists()) {
          configDoc = await getDoc(doc(db, 'system', 'globals'));
          if (!configDoc.exists()) {
            configDoc = await getDoc(doc(db, 'system_config', 'globals'));
          }
        }
        
        if (configDoc.exists()) {
          const data = configDoc.data() || {};
          const liveSem = data.currentSemester || data.activeSemester || '1st';
          if (liveSem !== bestKnownSem) {
            currentSem = liveSem;
            setActiveSemester(currentSem as '1st' | '2nd');
            const wiped = await OfflineService.syncSemester(userId, currentSem);
            if (wiped) {
              Alert.alert('Notice', 'A new semester has started. Your previously downloaded notes have been cleared.');
            }
          }
        }

        const dept = profile?.department || '';
        const academicLevel = profile?.academicLevel || '100L';
        const userLevelMatch = String(academicLevel).match(/\d+/);
        const userLevelDigits = userLevelMatch ? userLevelMatch[0] : null;

        const deptList = [dept, 'general', 'General', 'University General', 'Core', 'UNIGEN']
          .filter(d => Boolean(d) && d !== 'NOT SET' && d !== '');

        const q = query(
          collection(db, 'courses'),
          where('department', 'in', deptList),
          where('semester', '==', currentSem)
        );
        
        const snapshot = await getDocs(q);
        let liveCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (userLevelDigits) {
          liveCourses = liveCourses.filter((c: any) => {
            const courseLevelMatch = String(c.level || '').match(/\d+/);
            const cLevelDigits = courseLevelMatch ? courseLevelMatch[0] : null;
            return cLevelDigits === userLevelDigits;
          });
        }
        
        setCourses(liveCourses);
        const updatedOffline = await OfflineService.checkForUpdates(userId, liveCourses);
        setDownloaded(updatedOffline);
      } catch (e) {
        console.log('Online fetch failed in NoteGrabber');
      }
    } catch (error: any) {
      console.error('Critical Error in NoteGrabber:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, profile]);

  const showDebugInfo = () => {
    const dept = profile?.department || 'NOT SET (Offline)';
    const academicLevel = profile?.academicLevel || 'NOT SET (Offline)';
    const permLevel = profile?.level || 'NOT SET (Offline)';
    const semester = activeSemester || 'FETCHING/CACHED';

    Alert.alert('System Diagnostics', 
      `Profile Data:\n• Level: ${academicLevel}\n• Dept: ${dept}\n\nApp State:\n• Active Sem: ${semester}\n• Storage: ${downloaded.length} offline courses\n\nTips:\n1. If data is "NOT SET", sync while online first.\n2. Only downloaded courses appear when offline.`
    );
  };

  const handleDownload = async (course: any) => {
    if (!user) return;
    setDownloadingId(course.id);
    try {
      await OfflineService.downloadCourse(user.uid, course.id);
      Alert.alert('Success', `${course.code} downloaded successfully for offline use.`);
      await fetchData();
    } catch (error: any) {
      Alert.alert('Error', `Failed to download: ${error.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!user) return;
    Alert.alert(
      'Delete Download',
      'Are you sure you want to remove this course from offline storage?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await OfflineService.deleteCourse(user.uid, courseId);
            await fetchData();
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const offlineInfo = downloaded.find(d => d.id === item.id);
    const isDownloaded = !!offlineInfo;
    const hasUpdate = offlineInfo?.hasUpdate;

    return (
      <View style={[
        styles.courseItem, 
        { 
          backgroundColor: hasUpdate ? '#FFFF00' : colors.card, 
          borderColor: colors.border 
        }
      ]}>
        <View style={styles.courseInfo}>
          <Text style={[styles.courseCode, { color: hasUpdate ? '#000' : colors.foreground }]}>{item.code}</Text>
          <Text style={[styles.courseTitle, { color: hasUpdate ? '#333' : colors.mutedForeground }]} numberOfLines={1}>
            {item.title}
          </Text>
          {isDownloaded && (
            <View style={styles.downloadInfo}>
              <Text style={[styles.sizeText, { color: hasUpdate ? '#555' : colors.mutedForeground }]}>
                Size: {OfflineService.formatSize(offlineInfo.size)}
              </Text>
              {hasUpdate && (
                <View style={styles.updateBadge}>
                  <RefreshCcw size={10} color="#000" />
                  <Text style={styles.updateBadgeText}>Update Available</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {downloadingId === item.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isDownloaded ? (
            <View style={styles.downloadedActions}>
              {hasUpdate && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleDownload(item)}
                >
                  <RefreshCcw size={18} color={colors.primaryForeground} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleDownload(item)}
            >
              <Download size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && courses.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <View style={styles.semesterIndicator}>
          <Text style={[styles.filterBtnText, { color: colors.foreground }]}>
            Active Semester: {activeSemester || 'Loading...'}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.debugBtn, { borderColor: colors.border }]}
          onPress={showDebugInfo}
        >
          <Bug size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Info size={16} color={colors.mutedForeground} />
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>
          Downloaded courses are available even when you're offline.
        </Text>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.mutedForeground }}>No courses found for your profile.</Text>
          </View>
        }
        onRefresh={fetchData}
        refreshing={loading}
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
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  semesterIndicator: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  debugBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerText: {
    fontSize: 12,
    flex: 1,
  },
  list: {
    padding: 16,
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  courseInfo: {
    flex: 1,
    marginRight: 12,
  },
  courseCode: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  courseTitle: {
    fontSize: 13,
    marginTop: 2,
  },
  downloadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  sizeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  updateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
});
