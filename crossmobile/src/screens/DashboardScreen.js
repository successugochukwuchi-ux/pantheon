import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { BookOpen, Newspaper, Calculator, History, LogOut, User } from 'lucide-react-native';

export default function DashboardScreen() {
  const { profile } = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  const stats = [
    { label: 'Level', value: profile?.level || '1', icon: User },
    { label: 'Referrals', value: profile?.referralCount || '0', icon: Calculator },
  ];

  const menuItems = [
    { name: 'Lecture Notes', icon: BookOpen, color: '#3b82f6' },
    { name: 'Past Questions', icon: History, color: '#8b5cf6' },
    { name: 'Punch Notes', icon: Calculator, color: '#10b981' },
    { name: 'News Board', icon: Newspaper, color: '#f59e0b' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Hello,</Text>
            <Text style={styles.username}>{profile?.username || 'Student'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <stat.icon size={20} color="#666" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Learning Center</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} style={styles.menuCard}>
              <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <item.icon size={24} color={item.color} />
              </View>
              <Text style={styles.menuText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!profile?.isActivated && (
          <View style={styles.activationCard}>
            <Text style={styles.activationTitle}>Account Not Activated</Text>
            <Text style={styles.activationText}>
              Please activate your account to access all features.
            </Text>
            <TouchableOpacity style={styles.activationBtn}>
              <Text style={styles.activationBtnText}>Activate Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  welcome: {
    fontSize: 16,
    color: '#666',
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  activationCard: {
    marginTop: 32,
    backgroundColor: '#000',
    padding: 24,
    borderRadius: 24,
  },
  activationTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  activationText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  activationBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  activationBtnText: {
    color: '#000',
    fontWeight: '700',
  },
});
