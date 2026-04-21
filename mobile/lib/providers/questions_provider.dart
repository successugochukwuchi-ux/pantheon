import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Course {
  final String id;
  final String title;
  final String code;
  final int questionCount;

  Course({required this.id, required this.title, required this.code, required this.questionCount});

  factory Course.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Course(
      id: doc.id,
      title: data['title'] ?? '',
      code: data['code'] ?? '',
      questionCount: data['questionCount'] ?? 0,
    );
  }
}

class Question {
  final String text;
  final String correctAnswer;
  final List<String> incorrectAnswers;

  Question({required this.text, required this.correctAnswer, required this.incorrectAnswers});

  factory Question.fromMap(Map<String, dynamic> data) {
    return Question(
      text: data['text'] ?? '',
      correctAnswer: data['correctAnswer'] ?? '',
      incorrectAnswers: List<String>.from(data['incorrectAnswers'] ?? []),
    );
  }
}

final coursesProvider = StreamProvider<List<Course>>((ref) {
  return FirebaseFirestore.instance
      .collection('courses')
      .snapshots()
      .map((snapshot) => snapshot.docs.map((doc) => Course.fromFirestore(doc)).toList());
});

final questionsProvider = FutureProvider.family<List<Question>, String>((ref, courseId) async {
  final snapshot = await FirebaseFirestore.instance
      .collection('courses')
      .doc(courseId)
      .collection('questions')
      .get();
  
  return snapshot.docs.map((doc) => Question.fromMap(doc.data())).toList();
});
