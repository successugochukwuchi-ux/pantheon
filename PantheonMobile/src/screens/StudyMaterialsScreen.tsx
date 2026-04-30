import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { Course } from '../types';
import { ChevronRight, MessageSquare } from 'lucide-react-native';

export const StudyMaterialsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
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
        renderItem={({ item }) => (
          <View style={[styles.courseItemContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.courseItem}
              onPress={() => navigation.navigate('CourseNotes', { courseId: item.id, courseCode: item.code })}
            >
              <View>
                <Text style={[styles.courseCode, { color: colors.primary }]}>{item.code}</Text>
                <Text style={[styles.courseTitle, { color: colors.mutedForeground }]}>{item.title}</Text>
              </View>
              <ChevronRight size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discussionButton, { backgroundColor: colors.muted, borderTopColor: colors.border }]}
              onPress={() => navigation.navigate('CourseDiscussion', { courseId: item.id, courseCode: item.code })}
            >
              <MessageSquare size={16} color={colors.primary} />
              <Text style={[styles.discussionButtonText, { color: colors.primary }]}>Join Discussion</Text>
            </TouchableOpacity>
          </View>
        )}
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
