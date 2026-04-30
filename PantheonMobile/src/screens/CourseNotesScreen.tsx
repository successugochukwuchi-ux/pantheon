import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { Note } from '../types';
import { ChevronRight, FileText, MessageSquare } from 'lucide-react-native';

export const CourseNotesScreen = ({ route, navigation }: any) => {
  const { courseId, courseCode } = route.params;
  const { colors } = useTheme();
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
        console.error('Error fetching notes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [courseId]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.discussionBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CourseDiscussion', { courseId, courseCode })}
      >
        <MessageSquare size={20} color={colors.primaryForeground} />
        <Text style={[styles.discussionBtnText, { color: colors.primaryForeground }]}>Join Course Discussion</Text>
      </TouchableOpacity>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.noteItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('NoteDetail', { note: item })}
          >
            <View style={styles.noteInfo}>
              <FileText size={20} color={colors.primary} />
              <Text style={[styles.noteTitle, { color: colors.foreground }]}>{item.title}</Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notes found for this course.</Text>}
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
  discussionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  discussionBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  noteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
});
