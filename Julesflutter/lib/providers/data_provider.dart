import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/course.dart';
import '../models/note.dart';
import '../models/news_item.dart';
import 'auth_provider.dart';
import 'system_provider.dart';

final coursesProvider = StreamProvider<List<Course>>((ref) {
  final userProfile = ref.watch(userProfileProvider).value;
  final systemConfig = ref.watch(systemConfigProvider).value;

  if (userProfile == null || systemConfig == null) return Stream.value([]);

  final isAdmin = userProfile.level == '3' || userProfile.level == '4';

  Query query = FirebaseFirestore.instance.collection('courses');

  if (!isAdmin && systemConfig.currentSemester != 'none') {
    query = query.where('semester', isEqualTo: systemConfig.currentSemester);
  }

  // Optimize: Use source selection if possible, but standard snapshots for offline
  return query.snapshots().map((snapshot) {
    var courses = snapshot.docs.map((doc) => Course.fromMap(doc.data() as Map<String, dynamic>, doc.id)).toList();

    if (!isAdmin) {
      courses = courses.where((course) {
        final userLevel = userProfile.academicLevel ?? userProfile.level;
        final isCorrectLevel = course.level == userLevel;
        final isCorrectDept = course.department == null || course.department == 'general' || course.department == userProfile.department;
        return isCorrectLevel && isCorrectDept;
      }).toList();
    }

    return courses;
  });
});

final newsProvider = StreamProvider<List<NewsItem>>((ref) {
  return FirebaseFirestore.instance
      .collection('news')
      .orderBy('createdAt', descending: true)
      .limit(10)
      .snapshots(includeMetadataChanges: true) // Optimize for immediate cache return
      .map((snapshot) {
    return snapshot.docs.map((doc) => NewsItem.fromMap(doc.data(), doc.id)).toList();
  });
});

final notesProvider = StreamProviderFamily<List<Note>, String>((ref, courseId) {
  return FirebaseFirestore.instance
      .collection('notes')
      .where('courseId', isEqualTo: courseId)
      .snapshots(includeMetadataChanges: true)
      .map((snapshot) {
    return snapshot.docs.map((doc) => Note.fromMap(doc.data(), doc.id)).toList();
  });
});
