import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PlayCircle, GraduationCap, ChevronRight, BookOpen, CheckCircle2 } from 'lucide-react-native';
import { Note, Course, VideoQuestion } from '../types';
import { MathView } from '../components/MathView';
import { MathText } from '../components/MathText';

export const VideoLibraryScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
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

  useEffect(() => {
    if (!selectedNote) {
      setQuestions([]);
      return;
    }
    const q = query(collection(db, `notes/${selectedNote.id}/videoQuestions`));
    const unsub = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoQuestion)));
    });
    return () => unsub();
  }, [selectedNote]);

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    setUserAnswers({});
    setShowResults(false);
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const renderTextWithMath = (text: string) => {
    return <MathText text={text} color={colors.foreground} fontSize={16} />;
  };

  const renderVideo = () => {
    if (!selectedNote || !selectedNote.videoUrl) return null;
    const videoId = getYouTubeId(selectedNote.videoUrl);

    return (
      <View style={[styles.videoContainer, { height: (width - 32) * (9/16) }]}>
        <WebView
          source={{ uri: `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&showinfo=0&controls=1&fs=1` }}
          style={styles.webview}
          allowsFullscreenVideo={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
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

                {questions.length > 0 && (
                  <View style={styles.quizSection}>
                    <Text style={[styles.quizTitle, { color: colors.foreground }]}>Concept Check Quiz</Text>
                    {questions.map((q, idx) => {
                      const options = [...q.incorrectAnswers, q.correctAnswer].sort();
                      return (
                        <View key={q.id} style={[styles.quizCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.questionNumber, { color: colors.primary }]}>Question {idx + 1}</Text>
                          <View style={{ marginBottom: 16 }}>{renderTextWithMath(q.text)}</View>

                          {options.map((opt, i) => {
                            const isSelected = userAnswers[q.id] === opt;
                            const isCorrect = opt === q.correctAnswer;

                            let optionStyle: any = [styles.optionBtn, { borderColor: colors.border }];
                            if (showResults) {
                                if (isCorrect) optionStyle.push({ backgroundColor: '#10B98122', borderColor: '#10B981' });
                                else if (isSelected) optionStyle.push({ backgroundColor: '#EF444422', borderColor: '#EF4444' });
                            } else if (isSelected) {
                                optionStyle.push({ backgroundColor: colors.primary + '11', borderColor: colors.primary });
                            }

                            return (
                              <TouchableOpacity
                                key={i}
                                disabled={showResults}
                                style={optionStyle}
                                onPress={() => setUserAnswers(prev => ({ ...prev, [q.id]: opt }))}
                              >
                                <View style={{ flex: 1 }}>{renderTextWithMath(opt)}</View>
                                {showResults && isCorrect && <CheckCircle2 size={18} color="#10B981" />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}

                    {!showResults ? (
                      <TouchableOpacity
                        style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                        onPress={() => setShowResults(true)}
                      >
                        <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Submit Quiz</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.resultsBox, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.resultsText, { color: colors.primaryForeground }]}>
                          Score: {questions.filter(q => userAnswers[q.id] === q.correctAnswer).length} / {questions.length}
                        </Text>
                        <TouchableOpacity onPress={() => { setShowResults(false); setUserAnswers({}); }}>
                          <Text style={{ color: colors.primaryForeground, textDecorationLine: 'underline', marginTop: 8 }}>Try Again</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {selectedCourseId && <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available Lessons</Text>}
          </View>
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.noteItem, { backgroundColor: colors.card, borderColor: colors.border }, selectedNote?.id === item.id && { borderColor: colors.primary }]}
            onPress={() => handleNoteSelect(item)}
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
    marginBottom: 16,
  },
  quizSection: {
    marginTop: 24,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quizCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsBox: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resultsText: {
    fontSize: 18,
    fontWeight: 'bold',
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
