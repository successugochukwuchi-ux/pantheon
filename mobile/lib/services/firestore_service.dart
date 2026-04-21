import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Stream<List<Map<String, dynamic>>> getCourses() {
    return _db.collection('courses').snapshots().map((snap) =>
        snap.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList());
  }

  Stream<List<Map<String, dynamic>>> getQuestionSheets(String courseId) {
    return _db
        .collection('questionSheets')
        .where('courseId', isEqualTo: courseId)
        .where('isAvailable', isEqualTo: true)
        .snapshots()
        .map((snap) =>
            snap.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList());
  }

  Future<List<Map<String, dynamic>>> getQuestions(String sheetId) async {
    final snap = await _db
        .collection('questions')
        .where('sheetId', isEqualTo: sheetId)
        .orderBy('order')
        .get();
    return snap.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
  }

  Stream<List<Map<String, dynamic>>> getNotes() {
    return _db.collection('notes').snapshots().map((snap) =>
        snap.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList());
  }

  Stream<List<Map<String, dynamic>>> getCourseNotes(String courseId) {
    return _db
        .collection('notes')
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snap) =>
            snap.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList());
  }

  Future<void> saveCBTSession(Map<String, dynamic> sessionData) async {
    await _db.collection('cbt_sessions').add({
      ...sessionData,
      'completedAt': DateTime.now().toIso8601String(),
    });
  }
}
