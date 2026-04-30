import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ChevronRight, MessageCircle } from 'lucide-react-native';

export const LandingScreen = ({ navigation }: any) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.brand, { color: colors.primary }]}>PANTHEON</Text>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>Master Your Courses with PANTHEON</Text>
        <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
          The ultimate study companion for students. Lecture notes, past questions, CBT practice, and more.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Get Started Now</Text>
          <ChevronRight size={20} color={colors.primaryForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.supportButton, { borderColor: colors.border }]}>
          <MessageCircle size={20} color="#25D366" />
          <Text style={[styles.supportText, { color: colors.foreground }]}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -1,
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 64,
    lineHeight: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  secondaryButton: {
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  supportText: {
    fontWeight: '500',
  },
});
