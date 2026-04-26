import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'config/firebase_config.dart';
import 'models/note.dart';
import 'models/question.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/activate_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/notes_screen.dart';
import 'screens/note_viewer_screen.dart';
import 'screens/cbt_practice_screen.dart';
import 'screens/exam_player_screen.dart';
import 'screens/cbt_results_screen.dart';
import 'screens/news_screen.dart';
import 'screens/video_library_screen.dart';
import 'screens/discussion_screen.dart';
import 'screens/chat_screen.dart';
import 'services/theme_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: FirebaseConfig.apiKey,
        authDomain: FirebaseConfig.authDomain,
        projectId: FirebaseConfig.projectId,
        storageBucket: FirebaseConfig.storageBucket,
        messagingSenderId: FirebaseConfig.messagingSenderId,
        appId: FirebaseConfig.appId,
      ),
    );

    FirebaseFirestore.instance.settings = const Settings(
      persistenceEnabled: true,
      cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
    );
  } catch (e) {
    debugPrint("Firebase initialization failed: $e");
  }

  runApp(const ProviderScope(child: PantheonApp()));
}

final _router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) {
    final user = FirebaseAuth.instance.currentUser;
    final isLoggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/register';

    if (user == null && !isLoggingIn) return '/login';
    if (user != null && isLoggingIn) return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (context, state) => const Scaffold(body: Center(child: CircularProgressIndicator()))),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
    GoRoute(path: '/activate', builder: (context, state) => const ActivateScreen()),
    GoRoute(path: '/dashboard', builder: (context, state) => const DashboardScreen()),
    GoRoute(path: '/news', builder: (context, state) => const NewsScreen()),
    GoRoute(path: '/notes', builder: (context, state) => const NotesScreen(type: 'lecture')),
    GoRoute(path: '/past-questions', builder: (context, state) => const NotesScreen(type: 'past_question')),
    GoRoute(path: '/punch', builder: (context, state) => const NotesScreen(type: 'punch')),
    GoRoute(path: '/note-viewer', builder: (context, state) => NoteViewerScreen(note: state.extra as Note)),
    GoRoute(path: '/cbt', builder: (context, state) => const CBTPracticeScreen()),
    GoRoute(path: '/exam-player', builder: (context, state) {
      final extra = state.extra as Map<String, dynamic>;
      return ExamPlayerScreen(
        questions: extra['questions'] as List<Question>,
        isTimed: extra['isTimed'] as bool,
        duration: extra['duration'] as int,
        courseId: extra['courseId'] as String,
      );
    }),
    GoRoute(path: '/cbt-results', builder: (context, state) {
      final extra = state.extra as Map<String, dynamic>;
      return CBTResultsScreen(
        questions: extra['questions'] as List<Question>,
        answers: extra['answers'] as Map<String, String>,
        courseId: extra['courseId'] as String,
        timeSpent: extra['timeSpent'] as int,
      );
    }),
    GoRoute(path: '/videos', builder: (context, state) => const VideoLibraryScreen()),
    GoRoute(path: '/chat', builder: (context, state) => const ChatScreen()),
    GoRoute(path: '/discussions/:courseId', builder: (context, state) => DiscussionScreen(courseId: state.pathParameters['courseId']!)),
  ],
);

class PantheonApp extends ConsumerWidget {
  const PantheonApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider).value;

    // Determine theme from profile
    PantheonTheme currentTheme = PantheonTheme.light;
    if (profile?.theme == 'dark') currentTheme = PantheonTheme.dark;
    if (profile?.theme == 'sepia') currentTheme = PantheonTheme.sepia;
    if (profile?.theme == 'midnight') currentTheme = PantheonTheme.midnight;

    return MaterialApp.router(
      title: 'Pantheon',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: ThemeService.getTheme(currentTheme),
    );
  }
}
