import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthProvider with ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  User? _user;
  Map<String, dynamic>? _profile;
  bool _isLoading = true;

  User? get user => _user;
  Map<String, dynamic>? get profile => _profile;
  bool get isLoading => _isLoading;

  AuthProvider() {
    _auth.authStateChanges().listen((User? user) {
      _user = user;
      if (user != null) {
        _listenToProfile(user.uid);
      } else {
        _profile = null;
        _isLoading = false;
        notifyListeners();
      }
    });
  }

  void _listenToProfile(String uid) {
    _db.collection('users').doc(uid).snapshots().listen((snapshot) {
      if (snapshot.exists) {
        _profile = snapshot.data();
      } else {
        _profile = null;
      }
      _isLoading = false;
      notifyListeners();
    });
  }

  Future<void> login(String email, String password) async {
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    await _auth.signOut();
    _user = null;
    _profile = null;
    notifyListeners();
  }
}
