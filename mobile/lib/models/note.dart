class Note {
  final String id;
  final String courseId;
  final String title;
  final String content;
  final String type;
  final String authorId;
  final String createdAt;
  final String? videoUrl;

  Note({
    required this.id,
    required this.courseId,
    required this.title,
    required this.content,
    required this.type,
    required this.authorId,
    required this.createdAt,
    this.videoUrl,
  });

  factory Note.fromMap(String id, Map<String, dynamic> data) {
    return Note(
      id: id,
      courseId: data['courseId'] ?? '',
      title: data['title'] ?? '',
      content: data['content'] ?? '',
      type: data['type'] ?? 'lecture',
      authorId: data['authorId'] ?? '',
      createdAt: data['createdAt'] ?? '',
      videoUrl: data['videoUrl'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'courseId': courseId,
      'title': title,
      'content': content,
      'type': type,
      'authorId': authorId,
      'createdAt': createdAt,
      'videoUrl': videoUrl,
    };
  }
}
