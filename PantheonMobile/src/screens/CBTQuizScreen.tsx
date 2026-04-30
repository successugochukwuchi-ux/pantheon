import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { collection, query, getDocs, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Question } from '../types';

export const CBTQuizScreen = ({ route, navigation }: any) => {
  const { sheetId } = route.params;
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
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

    try {
      if (user) {
        await addDoc(collection(db, 'cbt_sessions'), {
          userId: user.uid,
          sheetId: sheetId,
          score: score,
          totalQuestions: questions.length,
          timeSpent: timeSpent,
          completedAt: new Date().toISOString(),
        });
      }
      navigation.replace('CBTResults', { score, total: questions.length, timeSpent });
    } catch (error) {
      console.error('Error saving session:', error);
      navigation.replace('CBTResults', { score, total: questions.length, timeSpent });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No questions found.</Text>
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  // Memoised per-question so options don't re-sort on every state update
  const allOptions = useMemo(() => {
    if (!currentQuestion) {return [];}
    return [currentQuestion.correctAnswer, ...currentQuestion.incorrectAnswers].sort();
  }, [currentQuestion]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>Question {currentIndex + 1} of {questions.length}</Text>
      </View>

      <ScrollView style={styles.questionContainer}>
        <Text style={styles.questionText}>{currentQuestion.text}</Text>

        {allOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              selectedAnswers[currentIndex] === option && styles.selectedOption,
            ]}
            onPress={() => handleSelect(option)}
          >
            <Text style={[
              styles.optionText,
              selectedAnswers[currentIndex] === option && styles.selectedOptionText,
            ]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.disabledButton]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        {currentIndex === questions.length - 1 ? (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.navButton} onPress={handleNext}>
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
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
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  progress: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    fontWeight: '600',
  },
  questionContainer: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xl,
  },
  option: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  selectedOption: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  selectedOptionText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  navButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
  },
  navButtonText: {
    color: theme.colors.secondaryForeground,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    color: theme.colors.primaryForeground,
    fontWeight: 'bold',
  },
});
