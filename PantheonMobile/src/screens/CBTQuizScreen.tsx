import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { collection, query, getDocs, where, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Question } from '../types';
import { MathView } from '../components/MathView';

export const CBTQuizScreen = ({ route, navigation }: any) => {
  const { sheetId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
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
        await addDoc(collection(db, 'cbtResults'), {
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
    const parts = text.split(/(\$.*?\$)/g);
    return (
      <Text style={[styles.questionText, { color: colors.foreground }]}>
        {parts.map((part: string, index: number) => {
          if (part.startsWith('$') && part.endsWith('$')) {
            return <MathView key={index} math={part.slice(1, -1)} inline color={colors.foreground} />;
          }
          return part;
        })}
      </Text>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.progress, { color: colors.mutedForeground }]}>Question {currentIndex + 1} of {questions.length}</Text>
      </View>

      <ScrollView style={styles.questionContainer}>
        {renderTextWithMath(currentQuestion.text)}

        {allOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              { borderColor: colors.border, backgroundColor: colors.card },
              selectedAnswers[currentIndex] === option && { borderColor: colors.primary, backgroundColor: colors.primary + '1A' },
            ]}
            onPress={() => handleSelect(option)}
          >
             {option.includes('$') ? (
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {option.split(/(\$.*?\$)/g).map((part, i) => {
                        if (part.startsWith('$') && part.endsWith('$')) {
                            return <MathView key={i} math={part.slice(1, -1)} inline color={colors.foreground} />;
                        }
                        return <Text key={i} style={[styles.optionText, { color: colors.foreground }]}>{part}</Text>;
                    })}
                 </View>
             ) : (
                <Text style={[
                styles.optionText,
                { color: colors.foreground },
                selectedAnswers[currentIndex] === option && { color: colors.primary, fontWeight: 'bold' },
                ]}>{option}</Text>
             )}
          </TouchableOpacity>
        ))}
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
