import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PlayCircle, GraduationCap, ChevronRight, BookOpen } from 'lucide-react-native';
import { Note, Course } from '../types';

export const VideoLibraryScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setNotes([]);
      return;
    }
    const q = query(collection(db, 'notes'), where('courseId', '==', selectedCourseId));
    const unsub = onSnapshot(q, (snapshot) => {
      const allNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(allNotes.filter(n => n.videoUrl));
    });
    return () => unsub();
  }, [selectedCourseId]);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderVideo = () => {
    if (!selectedNote || !selectedNote.videoUrl) return null;
    const videoId = getYouTubeId(selectedNote.videoUrl);

    return (
      <View style={[styles.videoContainer, { height: (width - 32) * (9/16) }]}>
        <WebView
          source={{ uri: `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&showinfo=0` }}
          style={styles.webview}
          allowsFullscreenVideo={true}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={notes}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Video Library</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Select a course to view lessons</Text>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={courses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.courseBadge,
                    { backgroundColor: selectedCourseId === item.id ? colors.primary : colors.muted }
                  ]}
                  onPress={() => setSelectedCourseId(item.id)}
                >
                  <Text style={[
                    styles.courseBadgeText,
                    { color: selectedCourseId === item.id ? colors.primaryForeground : colors.foreground }
                  ]}>
                    {item.code}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.courseList}
            />

            {selectedNote && (
              <View style={styles.selectedNoteContainer}>
                {renderVideo()}
                <View style={styles.noteInfo}>
                  <Text style={[styles.noteTitle, { color: colors.foreground }]}>{selectedNote.title}</Text>
                  <Text style={[styles.noteCourse, { color: colors.mutedForeground }]}>
                    {courses.find(c => c.id === selectedNote.courseId)?.code}
                  </Text>
                </View>
              </View>
            )}

            {selectedCourseId && <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available Lessons</Text>}
          </View>
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.noteItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setSelectedNote(item)}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.muted }]}>
              <PlayCircle size={24} color={colors.primary} />
            </View>
            <View style={styles.noteContent}>
              <Text style={[styles.noteItemTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.noteItemType, { color: colors.mutedForeground }]}>{item.type.toUpperCase()}</Text>
            </View>
            <ChevronRight size={20} color={colors.border} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          selectedCourseId ? (
            <View style={styles.emptyContainer}>
              <BookOpen size={48} color={colors.mutedForeground} opacity={0.3} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No video lessons for this course.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  courseList: {
    marginBottom: 24,
  },
  courseBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  courseBadgeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  selectedNoteContainer: {
    marginBottom: 24,
  },
  videoContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  noteInfo: {
    marginTop: 12,
  },
  noteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  noteCourse: {
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  noteContent: {
    flex: 1,
  },
  noteItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteItemType: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
  },
});
