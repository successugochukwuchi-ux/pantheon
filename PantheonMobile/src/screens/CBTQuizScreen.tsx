import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { collection, query, getDocs, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Question } from '../types';
import { MathView } from '../components/MathView';
import { MathText } from '../components/MathText';
import { OfflineService } from '../services/offlineService';
import { Alert } from 'react-native';

export const CBTQuizScreen = ({ route, navigation }: any) => {
  const { sheetId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());
  const [isOffline, setIsOffline] = useState(false);
  const [diagrams, setDiagrams] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!user) return;
      try {
        // Try offline first
        const downloaded = await OfflineService.getDownloadedCourses(user.uid);
        for (const course of downloaded) {
            const content = await OfflineService.getCourseContent(user.uid, course.id);
            if (content && content.sheets) {
                const sheet = content.sheets.find(s => s.id === sheetId);
                if (sheet && content.questions) {
                    const sheetQuestions = content.questions
                        .filter(q => q.sheetId === sheetId)
                        .sort((a, b) => (a.order || 0) - (b.order || 0));
                    
                    if (sheetQuestions.length > 0) {
                        setDiagrams(content.diagrams || {});
                        setQuestions(sheetQuestions);
                        setIsOffline(true);
                        setLoading(false);
                        return;
                    }
                }
            }
        }

        const q = query(collection(db, 'questions'), where('sheetId', '==', sheetId), orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        const questionItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        setQuestions(questionItems);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [sheetId]);

  const handleSelect = (answer: string) => {
    setSelectedAnswers({ ...selectedAnswers, [currentIndex]: answer });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    let score = 0;
    questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctAnswer) {
        score++;
      }
    });

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const sessionData = {
      userId: user?.uid,
      sheetId: sheetId,
      score: score,
      totalQuestions: questions.length,
      timeSpent: timeSpent,
      completedAt: new Date().toISOString(),
    };

    try {
      if (user) {
        // Cache locally first
        const existingResults = await OfflineService.getCachedCBTResults(user.uid);
        await OfflineService.cacheCBTResults(user.uid, [sessionData, ...existingResults].slice(0, 50));

        // Then try to upload
        await addDoc(collection(db, 'cbt_sessions'), sessionData);
      }
      navigation.replace('CBTResults', {
        score,
        total: questions.length,
        timeSpent,
        questions,
        selectedAnswers,
        diagrams
      });
    } catch (error: any) {
      console.error('[CBT_SAVE_ERR]', error);
      const errorCode = error.code || 'UNKNOWN';
      Alert.alert('Notice', `Score not saved to cloud. (Code: ${errorCode})\nChecking local results instead.`);
      navigation.replace('CBTResults', {
        score,
        total: questions.length,
        timeSpent,
        questions,
        selectedAnswers,
        diagrams
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>No questions found.</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  const allOptions = useMemo(() => {
    if (!currentQuestion) return [];
    return [currentQuestion.correctAnswer, ...currentQuestion.incorrectAnswers].sort();
  }, [currentQuestion]);

  const renderTextWithMath = (text: string) => {
    return <MathText text={text} color={colors.foreground} fontSize={18} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isOffline && (
        <View style={{ backgroundColor: '#22c55e', padding: 4, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>OFFLINE MODE - Using Downloaded content</Text>
        </View>
      )}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.progress, { color: colors.mutedForeground }]}>Question {currentIndex + 1} of {questions.length}</Text>
      </View>

      <ScrollView style={styles.questionContainer}>
        {renderTextWithMath(currentQuestion.text)}

        {currentQuestion.imageUrl && (
          <View style={styles.imageWrapper}>
            <Image 
              source={{ uri: diagrams[currentQuestion.imageUrl] || currentQuestion.imageUrl }} 
              style={styles.questionImage}
              resizeMode="contain"
            />
          </View>
        )}

        {allOptions.map((option, index) => {
          const hasMath = option.includes('$') || option.includes('\\(') || option.includes('\\[');
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.option,
                { borderColor: colors.border, backgroundColor: colors.card },
                selectedAnswers[currentIndex] === option && { borderColor: colors.primary, backgroundColor: colors.primary + '1A' },
              ]}
              onPress={() => handleSelect(option)}
            >
               {hasMath ? (
                   <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <MathText 
                        text={option} 
                        color={selectedAnswers[currentIndex] === option ? colors.primary : colors.foreground} 
                        fontSize={16} 
                      />
                   </View>
               ) : (
                  <Text style={[
                  styles.optionText,
                  { color: colors.foreground },
                  selectedAnswers[currentIndex] === option && { color: colors.primary, fontWeight: 'bold' },
                  ]}>{option}</Text>
               )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.muted }, currentIndex === 0 && styles.disabledButton]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Text style={[styles.navButtonText, { color: colors.foreground }]}>Previous</Text>
        </TouchableOpacity>

        {currentIndex === questions.length - 1 ? (
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
            <Text style={[styles.submitButtonText, { color: colors.primaryForeground }]}>Submit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.navButton, { backgroundColor: colors.muted }]} onPress={handleNext}>
            <Text style={[styles.navButtonText, { color: colors.foreground }]}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  questionContainer: {
    flex: 1,
    padding: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 16,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  option: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionText: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  navButtonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitButtonText: {
    fontWeight: 'bold',
  },
});
