import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { ChevronRight, MessageCircle } from 'lucide-react-native';

export const LandingScreen = ({ navigation }: any) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>PANTHEON</Text>
        <Text style={styles.heroTitle}>Master Your Courses with PANTHEON</Text>
        <Text style={styles.heroSubtitle}>
          The ultimate study companion for FUTO students. Lecture notes, past questions, CBT practice, and more.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.primaryButtonText}>Get Started Now</Text>
          <ChevronRight size={20} color={theme.colors.primaryForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.supportButton}>
          <MessageCircle size={20} color="#25D366" />
          <Text style={styles.supportText}>Contact Admin</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    letterSpacing: -1,
    marginBottom: theme.spacing.xl,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    textAlign: 'center',
    color: theme.colors.foreground,
    lineHeight: 48,
    marginBottom: theme.spacing.md,
  },
  heroSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.xl * 2,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 100,
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: theme.spacing.sm,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  supportText: {
    color: theme.colors.foreground,
    fontWeight: '500',
  },
});
