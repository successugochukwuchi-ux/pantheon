import 'package:flutter/material.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pantheon_flutter/providers/auth_provider.dart';
import 'package:pantheon_flutter/providers/theme_provider.dart';
import 'package:pantheon_flutter/screens/login_screen.dart';
import 'package:pantheon_flutter/screens/dashboard_screen.dart';
import 'package:pantheon_flutter/screens/register_screen.dart';
import 'package:pantheon_flutter/screens/settings_screen.dart';
import 'package:pantheon_flutter/screens/lecture_notes_screen.dart';
import 'package:pantheon_flutter/screens/cbt_practice_screen.dart';
import 'package:pantheon_flutter/screens/search_results_screen.dart';
import 'package:pantheon_flutter/screens/activate_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Prevent screenshots and screen recordings
  await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);

  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: "AIzaSyDUG_Wkvbt_HntxQ9zDSo6eTjkUFMH_mRM",
      authDomain: "pantheon-study.firebaseapp.com",
      projectId: "pantheon-study",
      storageBucket: "pantheon-study.firebasestorage.app",
      messagingSenderId: "956262652054",
      appId: "1:956262652054:web:0b55eee49ede84ecddcab7",
    ),
  );
  runApp(const PantheonApp());
}

class PantheonApp extends StatelessWidget {
  const PantheonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'Pantheon',
            debugShowCheckedModeBanner: false,
            theme: themeProvider.getThemeData().copyWith(
              textTheme: GoogleFonts.interTextTheme(
                themeProvider.getThemeData().textTheme,
              ),
            ),
            home: const AuthWrapper(),
            routes: {
              '/login': (context) => const LoginScreen(),
              '/register': (context) => const RegisterScreen(),
              '/dashboard': (context) => const DashboardScreen(),
              '/settings': (context) => const SettingsScreen(),
              '/lecture-notes': (context) => const LectureNotesScreen(),
              '/cbt': (context) => const CBTPracticeScreen(),
              '/search': (context) => const SearchResultsScreen(),
              '/activate': (context) => const ActivateScreen(),
            },
          );
        },
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    if (authProvider.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (authProvider.user != null) {
      final profile = authProvider.profile;
      
      // If profile is still loading, show loading
      if (authProvider.isLoading) {
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      }

      // If profile is null after loading, it means the user document doesn't exist
      if (profile == null) {
        return const LoginScreen(); // Or a "Profile Not Found" screen
      }

      // If profile exists but is not activated, show activation screen
      // We removed the hardcoded email bypass so the user can test the activation flow
      if (profile['isActivated'] == false) {
        return const ActivateScreen();
      }
      return const DashboardScreen();
    }

    return const LoginScreen();
  }
}
