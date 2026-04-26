import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_profile.dart';

final authStateProvider = StreamProvider<User?>((ref) {
  return FirebaseAuth.instance.authStateChanges();
});

final userProfileProvider = StreamProvider<UserProfile?>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return Stream.value(null);

  return FirebaseFirestore.instance
      .collection('users')
      .doc(user.uid)
      .snapshots()
      .map((snapshot) {
    if (snapshot.exists) {
      return UserProfile.fromMap(snapshot.data()!, snapshot.id);
    }
    return null;
  });
});

final authServiceProvider = Provider((ref) => AuthService());

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Future<UserCredential> signIn(String email, String password) async {
    return await _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<UserCredential> signUp(String email, String password, String studentId, String username) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);

    await _db.collection('users').doc(cred.user!.uid).set({
      'uid': cred.user!.uid,
      'studentId': studentId,
      'email': email,
      'username': username,
      'level': '1',
      'isActivated': false,
      'referralCount': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });

    return cred;
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
