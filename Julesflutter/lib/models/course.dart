class Course {
  final String id;
  final String code;
  final String title;
  final String semester;
  final String level;
  final String? department;
  final String createdAt;

  Course({
    required this.id,
    required this.code,
    required this.title,
    required this.semester,
    required this.level,
    this.department,
    required this.createdAt,
  });

  factory Course.fromMap(Map<String, dynamic> map, String id) {
    return Course(
      id: id,
      code: map['code'] ?? '',
      title: map['title'] ?? '',
      semester: map['semester'] ?? '1st',
      level: map['level']?.toString() ?? '100',
      department: map['department'],
      createdAt: map['createdAt'] ?? '',
    );
  }
}
