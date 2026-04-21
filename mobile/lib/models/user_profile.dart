class UserProfile {
  final String uid;
  final String fullName;
  final String studentId;
  final String academicLevel;
  final String email;

  UserProfile({
    required this.uid,
    required this.fullName,
    required this.studentId,
    required this.academicLevel,
    required this.email,
  });

  factory UserProfile.fromMap(Map<String, dynamic> data, String uid) {
    return UserProfile(
      uid: uid,
      fullName: data['fullName'] ?? '',
      studentId: data['studentId'] ?? '',
      academicLevel: data['academicLevel'] ?? '',
      email: data['email'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'fullName': fullName,
      'studentId': studentId,
      'academicLevel': academicLevel,
      'email': email,
    };
  }
}
