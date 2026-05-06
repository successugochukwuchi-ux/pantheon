import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { CheckCircle2, Clock, Trophy, XCircle, HelpCircle } from 'lucide-react-native';
import { MathView } from '../components/MathView';
import { MathText } from '../components/MathText';

export const CBTResultsScreen = ({ route, navigation }: any) => {
  const { colors } = useTheme();
  const { score = 0, total = 1, timeSpent = 0, questions = [], selectedAnswers = {}, diagrams = {} } = route.params || {};
  const percentage = Math.round((score / Math.max(1, total)) * 100);

  const renderTextWithMath = (text: string) => {
    return <MathText text={text} color={colors.foreground} fontSize={16} />;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Trophy size={60} color={colors.primary} style={styles.icon} />
        <Text style={[styles.title, { color: colors.foreground }]}>CBT Completed!</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Great job on finishing your practice session.</Text>

        <View style={[styles.statsContainer, { backgroundColor: colors.muted }]}>
          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={[styles.statLabel, { color: colors.foreground }]}>Score</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.primary }]}>{score} / {total}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Trophy size={20} color="#F59E0B" />
              <Text style={[styles.statLabel, { color: colors.foreground }]}>Percentage</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.primary }]}>{percentage}%</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Clock size={20} color="#3B82F6" />
              <Text style={[styles.statLabel, { color: colors.foreground }]}>Time Spent</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.primary }]}>{formatTime(timeSpent)}</Text>
          </View>
        </View>

        {questions.length > 0 && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <HelpCircle size={24} color={colors.foreground} />
              <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Detailed Review</Text>
            </View>

            {questions.map((q: any, i: number) => {
              const isCorrect = selectedAnswers[i] === q.correctAnswer;
              return (
                <View key={i} style={[styles.questionCard, { backgroundColor: colors.card, borderColor: isCorrect ? '#10B98133' : '#EF444433' }]}>
                  <View style={styles.questionHeader}>
                    <Text style={[styles.questionIndex, { color: colors.mutedForeground }]}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>{renderTextWithMath(q.text)}</View>
                    {isCorrect ? (
                      <CheckCircle2 size={20} color="#10B981" />
                    ) : (
                      <XCircle size={20} color="#EF4444" />
                    )}
                  </View>

                  {q.imageUrl && (
                    <Image 
                      source={{ uri: diagrams[q.imageUrl] || q.imageUrl }} 
                      style={styles.questionImage}
                      resizeMode="contain"
                    />
                  )}

                  <View style={styles.answerRow}>
                    <Text style={[styles.answerLabel, { color: colors.mutedForeground }]}>Your Choice:</Text>
                    <View style={{ flex: 1 }}>{renderTextWithMath(selectedAnswers[i] || 'Not answered')}</View>
                  </View>

                  {!isCorrect && (
                    <View style={styles.answerRow}>
                      <Text style={[styles.answerLabel, { color: colors.mutedForeground }]}>Correct:</Text>
                      <View style={{ flex: 1 }}>{renderTextWithMath(q.correctAnswer)}</View>
                    </View>
                  )}

                  {q.explanation && (
                    <View style={[styles.explanationBox, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.explanationText, { color: colors.foreground }]}>
                        <Text style={{ fontWeight: 'bold' }}>Explanation: </Text>
                        <MathText text={q.explanation} color={colors.foreground} fontSize={14} style={{ fontStyle: 'italic' }} />
                      </Text>
                      {q.explanationImageUrl && (
                        <Image 
                          source={{ uri: diagrams[q.explanationImageUrl] || q.explanationImageUrl }} 
                          style={styles.explanationImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  statsContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  reviewSection: {
    width: '100%',
    marginBottom: 32,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  questionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  questionIndex: {
    fontWeight: 'bold',
  },
  answerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 24,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 90,
  },
  explanationBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  explanationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  questionImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginVertical: 12,
  },
  explanationImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statLabel: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
