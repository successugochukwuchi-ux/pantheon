import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:pantheon_mobile/screens/login_screen.dart';
import 'package:pantheon_mobile/screens/register_screen.dart';
import 'package:pantheon_mobile/screens/dashboard_screen.dart';
import 'package:pantheon_mobile/screens/past_questions_screen.dart';
import 'package:pantheon_mobile/screens/cbt_practice_screen.dart';
import 'package:pantheon_mobile/screens/notes_screen.dart';
import 'package:pantheon_mobile/screens/video_library_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: "AIzaSyDUG_Wkvbt_HntxQ9zDSo6eTjkUFMH_mRM",
        appId: "1:956262652054:android:0b55eee49ede84ecddcab7", 
        messagingSenderId: "956262652054",
        projectId: "pantheon-study",
        storageBucket: "pantheon-study.firebasestorage.app",
      ),
    );

    // 🚀 OFFLINE PERSISTENCE: This ensures app works without internet
    FirebaseFirestore.instance.settings = const Settings(
      persistenceEnabled: true,
      cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
    );
  } catch (e) {
    debugPrint("Firebase init error: $e");
  }

  runApp(const ProviderScope(child: PantheonApp()));
}

final _router = GoRouter(
  initialLocation: FirebaseAuth.instance.currentUser != null ? '/dashboard' : '/login',
  routes: [
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
    GoRoute(path: '/dashboard', builder: (context, state) => const DashboardScreen()),
    GoRoute(path: '/past-questions', builder: (context, state) => const PastQuestionsScreen()),
    GoRoute(path: '/cbt-practice', builder: (context, state) => const CBTPracticeScreen()),
    GoRoute(path: '/notes', builder: (context, state) => const NotesScreen()),
    GoRoute(path: '/videos', builder: (context, state) => const VideoLibraryScreen()),
  ],
);

class PantheonApp extends StatelessWidget {
  const PantheonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Pantheon',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF3B82F6),
          primary: const Color(0xFF3B82F6),
          secondary: const Color(0xFF22C55E),
          surface: Colors.white,
          background: const Color(0xFFF8FAFC),
        ),
        textTheme: GoogleFonts.interTextTheme(),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          elevation: 0,
          centerTitle: true,
          titleTextStyle: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.bold),
          iconTheme: IconThemeData(color: Color(0xFF0F172A)),
        ),
      ),
    );
  }
}
