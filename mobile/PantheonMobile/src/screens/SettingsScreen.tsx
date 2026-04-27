import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { User, Bell, Shield, Moon, LogOut } from 'lucide-react-native';
import { auth } from '../services/firebase';

export const SettingsScreen = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => auth.signOut() }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.username?.charAt(0) || 'S'}</Text>
        </View>
        <Text style={styles.profileName}>{profile?.username || 'Student'}</Text>
        <Text style={styles.profileEmail}>{profile?.email}</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <SettingItem
          icon={<User size={20} color={theme.colors.mutedForeground} />}
          label="Student ID"
          value={profile?.studentId}
        />
        <SettingItem
          icon={<Shield size={20} color={theme.colors.mutedForeground} />}
          label="Account Level"
          value={profile?.level}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Bell size={20} color={theme.colors.mutedForeground} />
            <Text style={styles.settingLabel}>Notifications</Text>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Moon size={20} color={theme.colors.mutedForeground} />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={theme.colors.destructive} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
};

const SettingItem = ({ icon, label, value }: any) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLabelContainer}>
      {icon}
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    <Text style={styles.settingValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  profileSection: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.primaryForeground,
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    marginBottom: theme.spacing.md,
  },
  editButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  section: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.mutedForeground,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  settingValue: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  logoutText: {
    fontSize: 16,
    color: theme.colors.destructive,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    padding: theme.spacing.xl,
    fontSize: 12,
  },
});
