import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { LayoutDashboard, MessageSquare, Settings, BookOpen } from 'lucide-react-native';

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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator screenOptions={{
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.mutedForeground,
      tabBarStyle: { borderTopColor: theme.colors.border },
    }}>
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: TabIcons.Home,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Study"
        component={StudyMaterialsScreen}
        options={{
          tabBarIcon: TabIcons.Study,
          title: 'Courses',
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarIcon: TabIcons.Messages,
          title: 'Direct Messages',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: TabIcons.Settings,
        }}
      />
    </Tab.Navigator>
  );
};

const TabIcons = {
  Home: ({ color, size }: { color: string; size: number }) => <LayoutDashboard size={size} color={color} />,
  Study: ({ color, size }: { color: string; size: number }) => <BookOpen size={size} color={color} />,
  Messages: ({ color, size }: { color: string; size: number }) => <MessageSquare size={size} color={color} />,
  Settings: ({ color, size }: { color: string; size: number }) => <Settings size={size} color={color} />,
};

const Navigation = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}>
        {!user ? (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="CourseNotes" component={CourseNotesScreen} options={{ headerShown: true, title: 'Notes' }} />
            <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ headerShown: true, title: 'Reading' }} />
            <Stack.Screen name="CBT" component={CBTScreen} options={{ headerShown: true, title: 'CBT Practice' }} />
            <Stack.Screen name="CBTQuiz" component={CBTQuizScreen} options={{ headerShown: true, title: 'CBT Quiz' }} />
            <Stack.Screen name="CBTResults" component={CBTResultsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DirectChat" component={DirectChatScreen} options={({ route }: any) => ({ headerShown: true, title: route.params.name })} />
            <Stack.Screen name="CourseDiscussion" component={CourseDiscussionScreen} options={{ headerShown: true, title: 'Study Group' }} />
            <Stack.Screen name="PastQuestions" component={StudyMaterialsScreen} />
            <Stack.Screen name="Punch" component={StudyMaterialsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export const RootNavigator = () => (
  <AuthProvider>
    <Navigation />
  </AuthProvider>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
