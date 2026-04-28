import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { CheckCircle2, Clock, Trophy } from 'lucide-react-native';

export const CBTResultsScreen = ({ route, navigation }: any) => {
  const { score, total, timeSpent } = route.params;
  const percentage = Math.round((score / total) * 100);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Trophy size={80} color={theme.colors.primary} style={styles.icon} />
        <Text style={styles.title}>CBT Completed!</Text>
        <Text style={styles.subtitle}>Great job on finishing your practice session.</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={styles.statLabel}>Score</Text>
            </View>
            <Text style={styles.statValue}>{score} / {total}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Trophy size={20} color="#F59E0B" />
              <Text style={styles.statLabel}>Percentage</Text>
            </View>
            <Text style={styles.statValue}>{percentage}%</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statInfo}>
              <Clock size={20} color="#3B82F6" />
              <Text style={styles.statLabel}>Time Spent</Text>
            </View>
            <Text style={styles.statValue}>{formatTime(timeSpent)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    marginBottom: theme.spacing.xl * 2,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: theme.colors.muted,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl * 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statLabel: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
