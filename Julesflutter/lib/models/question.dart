class Question {
  final String id;
  final String sheetId;
  final String courseId;
  final String text;
  final String correctAnswer;
  final List<String> incorrectAnswers;
  final String? explanation;
  final int order;
  final String authorId;
  final String createdAt;

  Question({
    required this.id,
    required this.sheetId,
    required this.courseId,
    required this.text,
    required this.correctAnswer,
    required this.incorrectAnswers,
    this.explanation,
    required this.order,
    required this.authorId,
    required this.createdAt,
  });

  factory Question.fromMap(Map<String, dynamic> map, String id) {
    return Question(
      id: id,
      sheetId: map['sheetId'] ?? '',
      courseId: map['courseId'] ?? '',
      text: map['text'] ?? '',
      correctAnswer: map['correctAnswer'] ?? '',
      incorrectAnswers: List<String>.from(map['incorrectAnswers'] ?? []),
      explanation: map['explanation'],
      order: map['order'] ?? 0,
      authorId: map['authorId'] ?? '',
      createdAt: map['createdAt'] ?? '',
    );
  }
}

class QuestionSheet {
  final String id;
  final String courseId;
  final String semester;
  final String academicLevel;
  final String year;
  final bool isAvailable;
  final String createdAt;
  final String authorId;

  QuestionSheet({
    required this.id,
    required this.courseId,
    required this.semester,
    required this.academicLevel,
    required this.year,
    required this.isAvailable,
    required this.createdAt,
    required this.authorId,
  });

  factory QuestionSheet.fromMap(Map<String, dynamic> map, String id) {
    return QuestionSheet(
      id: id,
      courseId: map['courseId'] ?? '',
      semester: map['semester'] ?? '1st',
      academicLevel: map['academicLevel']?.toString() ?? '100',
      year: map['year'] ?? '',
      isAvailable: map['isAvailable'] ?? true,
      createdAt: map['createdAt'] ?? '',
      authorId: map['authorId'] ?? '',
    );
  }
}
