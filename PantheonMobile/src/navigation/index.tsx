import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Linking } from 'react-native';
import { LayoutDashboard, MessageSquare, Settings, BookOpen, Bell, PlayCircle, History, HelpCircle, Award, Calculator, Newspaper, UserPlus, Users, Shield, LogOut } from 'lucide-react-native';
import { auth } from '../services/firebase';

import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { StudyMaterialsScreen } from '../screens/StudyMaterialsScreen';
import { CourseNotesScreen } from '../screens/CourseNotesScreen';
import { NoteDetailScreen } from '../screens/NoteDetailScreen';
import { CBTScreen } from '../screens/CBTScreen';
import { CBTQuizScreen } from '../screens/CBTQuizScreen';
import { CBTResultsScreen } from '../screens/CBTResultsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { DirectChatScreen } from '../screens/DirectChatScreen';
import { CourseDiscussionScreen } from '../screens/CourseDiscussionScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VideoLibraryScreen } from '../screens/VideoLibraryScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { UserSearchScreen } from '../screens/UserSearchScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: any) => {
  const { colors } = useTheme();
  const { profile } = useAuth();

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.sidebar }}>
      <View style={styles.drawerHeader}>
        <Text style={[styles.brandText, { color: colors.sidebarPrimary }]}>PANTHEON</Text>
        <Text style={[styles.portalText, { color: colors.mutedForeground }]}>STUDENT PORTAL</Text>
      </View>

      <DrawerItemList {...props} />

      {profile?.level && parseInt(profile.level) >= 2 && (
        <View style={[styles.adminSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>PRIVILEGED ACCESS</Text>
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '33' }]}
            onPress={() => Linking.openURL('https://pantheon-edu.web.app/administrator')}
          >
            <Shield size={18} color={colors.primary} />
            <Text style={[styles.adminButtonText, { color: colors.primary }]}>Admin Control Panel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.drawerFooter, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.footerItem}
          onPress={() => props.navigation.navigate('Settings')}
        >
          <Settings size={18} color={colors.foreground} />
          <Text style={[styles.footerText, { color: colors.foreground }]}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerItem}
          onPress={handleLogout}
        >
          <LogOut size={18} color={colors.destructive} />
          <Text style={[styles.footerText, { color: colors.destructive }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
};

const DrawerNavigator = () => {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.foreground,
        drawerActiveBackgroundColor: colors.sidebarPrimary,
        drawerActiveTintColor: colors.primaryForeground,
        drawerInactiveTintColor: colors.foreground,
        drawerLabelStyle: { marginLeft: -16, fontWeight: '500' },
        drawerItemStyle: { borderRadius: 8, marginVertical: 2 },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          drawerIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name="Video Library"
        component={VideoLibraryScreen}
        options={{
          drawerIcon: ({ color, size }) => <PlayCircle size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Lecture Notes"
        component={StudyMaterialsScreen}
        initialParams={{ type: 'lecture' }}
        options={{
          drawerIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
          title: 'Lecture Notes',
        }}
      />
      <Drawer.Screen
        name="Past Questions"
        component={StudyMaterialsScreen}
        initialParams={{ type: 'past_question' }}
        options={{
          drawerIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="CBT Practice"
        component={CBTScreen}
        options={{
          drawerIcon: ({ color, size }) => <HelpCircle size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="CBT Results"
        component={CBTResultsScreen}
        options={{
          drawerIcon: ({ color, size }) => <Award size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Punch Notes"
        component={StudyMaterialsScreen}
        initialParams={{ type: 'punch' }}
        options={{
          drawerIcon: ({ color, size }) => <Calculator size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Chat"
        component={MessagesScreen}
        options={{
          drawerIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          drawerIcon: ({ color, size }) => <UserPlus size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerItemStyle: { display: 'none' }
        }}
      />
    </Drawer.Navigator>
  );
};

const Navigation = () => {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}>
        {!user ? (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={DrawerNavigator} />
            <Stack.Screen name="CourseNotes" component={CourseNotesScreen} options={{ headerShown: true, title: 'Notes', headerTintColor: colors.foreground }} />
            <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ headerShown: true, title: 'Reading', headerTintColor: colors.foreground }} />
            <Stack.Screen name="CBTQuiz" component={CBTQuizScreen} options={{ headerShown: true, title: 'CBT Quiz', headerTintColor: colors.foreground }} />
            <Stack.Screen name="CBTResults" component={CBTResultsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DirectChat" component={DirectChatScreen} options={({ route }: any) => ({ headerShown: true, title: route.params.name, headerTintColor: colors.foreground })} />
            <Stack.Screen name="CourseDiscussion" component={CourseDiscussionScreen} options={{ headerShown: true, title: 'Study Group', headerTintColor: colors.foreground }} />
            <Stack.Screen name="UserSearch" component={UserSearchScreen} options={{ headerShown: true, title: 'Search Users', headerTintColor: colors.foreground }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: true, title: 'Profile', headerTintColor: colors.foreground }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export const RootNavigator = () => (
  <ThemeProvider>
    <AuthProvider>
      <Navigation />
    </AuthProvider>
  </ThemeProvider>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerHeader: {
    padding: 24,
  },
  brandText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  portalText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 1,
  },
  adminSection: {
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  drawerFooter: {
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    paddingBottom: 24,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
