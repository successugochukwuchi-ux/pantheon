import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { theme } from '../theme';
import { Note } from '../types';
import { ChevronRight, FileText } from 'lucide-react-native';

export const CourseNotesScreen = ({ route, navigation }: any) => {
  const { courseId, courseCode } = route.params;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const q = query(collection(db, 'notes'), where('courseId', '==', courseId));
        const querySnapshot = await getDocs(q);
        const noteItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
        setNotes(noteItems);
      } catch (error) {
        console.error("Error fetching notes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [courseId]);

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
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.noteItem}
            onPress={() => navigation.navigate('NoteDetail', { note: item })}
          >
            <View style={styles.noteInfo}>
              <FileText size={20} color={theme.colors.primary} />
              <Text style={styles.noteTitle}>{item.title}</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes found for this course.</Text>}
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
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  noteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  noteTitle: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xl,
  },
});
