import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:math';
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
      .snapshots(includeMetadataChanges: true)
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

  Future<UserCredential> signUp({
    required String email,
    required String password,
    required String username,
    required String department,
    required String level,
    required String mobileNumber,
  }) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);

    // Generate random 11-digit student ID
    final random = Random();
    String studentId = '';
    bool unique = false;

    while (!unique) {
      studentId = (10000000000 + random.nextInt(90000000000 - 10000000000)).toString();
      final existing = await _db.collection('users').where('studentId', isEqualTo: studentId).limit(1).get();
      if (existing.docs.isEmpty) unique = true;
    }

    await _db.collection('users').doc(cred.user!.uid).set({
      'uid': cred.user!.uid,
      'studentId': studentId,
      'email': email,
      'username': username,
      'department': department,
      'level': email == 'successugochukwuchi@gmail.com' ? '4' : '1',
      'academicLevel': level,
      'mobileNumber': mobileNumber,
      'isActivated': email == 'successugochukwuchi@gmail.com',
      'referralCount': 0,
      'theme': 'light',
      'createdAt': DateTime.now().toIso8601String(),
    });

    return cred;
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}
