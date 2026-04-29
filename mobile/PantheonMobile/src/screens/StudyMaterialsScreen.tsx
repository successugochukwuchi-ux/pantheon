import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { theme } from '../theme';
import { Course } from '../types';
import { ChevronRight } from 'lucide-react-native';

export const StudyMaterialsScreen = ({ navigation }: any) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'));
        const querySnapshot = await getDocs(q);
        const courseItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
        setCourses(courseItems);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.courseItemContainer}>
            <TouchableOpacity
              style={styles.courseItem}
              onPress={() => navigation.navigate('CourseNotes', { courseId: item.id, courseCode: item.code })}
            >
              <View>
                <Text style={styles.courseCode}>{item.code}</Text>
                <Text style={styles.courseTitle}>{item.title}</Text>
              </View>
              <ChevronRight size={20} color={theme.colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discussionButton}
              onPress={() => navigation.navigate('CourseDiscussion', { courseId: item.id, courseCode: item.code })}
            >
              <Text style={styles.discussionButtonText}>Join Discussion</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No courses found.</Text>}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: theme.spacing.lg,
  },
  courseItemContainer: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  courseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  courseCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  courseTitle: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },
  discussionButton: {
    backgroundColor: theme.colors.muted,
    padding: theme.spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  discussionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xl,
  },
});
