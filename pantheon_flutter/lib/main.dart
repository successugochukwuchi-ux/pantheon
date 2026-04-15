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
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
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
      // If profile exists but is not activated, show activation screen
      if (profile != null && profile['isActivated'] == false && profile['email'] != 'successugochukwuchi@gmail.com') {
        return const ActivateScreen();
      }
      return const DashboardScreen();
    }

    return const LoginScreen();
  }
}
