import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:pantheon_mobile/models/user_profile.dart';

class AuthState {
  final User? user;
  final UserProfile? profile;
  final bool loading;

  AuthState({this.user, this.profile, this.loading = true});

  AuthState copyWith({User? user, UserProfile? profile, bool? loading}) {
    return AuthState(
      user: user ?? this.user,
      profile: profile ?? this.profile,
      loading: loading ?? this.loading,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  AuthNotifier() : super(AuthState()) {
    _auth.authStateChanges().listen((user) async {
      if (user != null) {
        _db.collection('users').doc(user.uid).snapshots().listen((snap) {
          if (snap.exists) {
            state = state.copyWith(
              user: user,
              profile: UserProfile.fromMap(snap.data()!, snap.id),
              loading: false,
            );
          } else {
            state = state.copyWith(user: user, loading: false);
          }
        });
      } else {
        state = AuthState(loading: false);
      }
    });
  }

  Future<void> signIn(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> register(String email, String password, Map<String, dynamic> profileData) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    await _db.collection('users').doc(cred.user!.uid).set(profileData);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());
