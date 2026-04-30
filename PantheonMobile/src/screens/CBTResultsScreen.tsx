import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { CheckCircle2, Clock, Trophy } from 'lucide-react-native';

export const CBTResultsScreen = ({ route, navigation }: any) => {
  const { colors } = useTheme();
  const { score, total, timeSpent } = route.params;
  const percentage = Math.round((score / total) * 100);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Trophy size={80} color={colors.primary} style={styles.icon} />
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

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 64,
  },
  statsContainer: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    marginBottom: 64,
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
