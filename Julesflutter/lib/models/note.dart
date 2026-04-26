class Note {
  final String id;
  final String courseId;
  final String title;
  final String content;
  final String type;
  final String authorId;
  final String? videoUrl;
  final String createdAt;
  final String? updatedAt;

  Note({
    required this.id,
    required this.courseId,
    required this.title,
    required this.content,
    required this.type,
    required this.authorId,
    this.videoUrl,
    required this.createdAt,
    this.updatedAt,
  });

  factory Note.fromMap(Map<String, dynamic> map, String id) {
    return Note(
      id: id,
      courseId: map['courseId'] ?? '',
      title: map['title'] ?? '',
      content: map['content'] ?? '',
      type: map['type'] ?? 'lecture',
      authorId: map['authorId'] ?? '',
      videoUrl: map['videoUrl'],
      createdAt: map['createdAt'] ?? '',
      updatedAt: map['updatedAt'],
    );
  }
}
