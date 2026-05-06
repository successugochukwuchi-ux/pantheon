import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Note } from '../types';
import { ChevronRight, FileText, MessageSquare } from 'lucide-react-native';
import { OfflineService } from '../services/offlineService';

export const CourseNotesScreen = ({ route, navigation }: any) => {
  const { courseId, courseCode, type } = route.params;
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [diagrams, setDiagrams] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchNotes = async () => {
      if (!user || !profile) return;
      try {
        // Try offline first
        const offlineContent = await OfflineService.getCourseContent(user.uid, courseId);
        if (offlineContent) {
          setDiagrams(offlineContent.diagrams || {});
          
          if (offlineContent.notes.length > 0) {
            const requestedType = (type || 'lecture').toLowerCase();
            const filtered = offlineContent.notes.filter((n: any) => 
              (n.type || 'lecture').toLowerCase() === requestedType
            );
            if (filtered.length > 0) {
              setNotes(filtered);
              setIsOffline(true);
              setLoading(false);
              return;
            }
          }
        }

        // Online fetch - fetch all notes for course and filter client side for better matching
        const notesQuery = query(collection(db, 'notes'));
        const querySnapshot = await getDocs(notesQuery);
        const normalizedCourseCode = (courseCode || '').replace(/\s+/g, '').toUpperCase();
        
        const noteItems = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Note))
          .filter(n => {
            const nCode = (n.courseCode || '').replace(/\s+/g, '').toUpperCase();
            const matchesCourse = n.courseId === courseId || (normalizedCourseCode && nCode === normalizedCourseCode);
            const matchesType = (n.type || 'lecture').toLowerCase() === (type || 'lecture').toLowerCase();
            return matchesCourse && matchesType;
          });

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
    <View style={[styles.container, { backgroundColor: colors.background }]} onStartShouldSetResponder={() => true}>
      {isOffline && (
        <View style={{ backgroundColor: '#22c55e', padding: 4, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>OFFLINE MODE - Using Downloaded Content</Text>
        </View>
      )}

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
            onPress={() => navigation.navigate('NoteDetail', { note: item, diagrams })}
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
    /* Disable text selection */
    userSelect: 'none',
  } as any,
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
});
