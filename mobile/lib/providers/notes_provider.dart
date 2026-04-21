import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pantheon_mobile/services/firestore_service.dart';
import 'package:pantheon_mobile/models/note.dart';

final firestoreServiceProvider = Provider((ref) => FirestoreService());

final notesProvider = StreamProvider<List<Note>>((ref) {
  final firestore = ref.watch(firestoreServiceProvider);
  return firestore.getNotes().map((list) => 
    list.map((m) => Note.fromMap(m['id'], m)).toList()
  );
});

final courseNotesProvider = StreamProvider.family<List<Note>, String>((ref, courseId) {
  final firestore = ref.watch(firestoreServiceProvider);
  return firestore.getCourseNotes(courseId).map((list) => 
    list.map((m) => Note.fromMap(m['id'], m)).toList()
  );
});
