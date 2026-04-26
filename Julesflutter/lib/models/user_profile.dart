class UserProfile {
  final String uid;
  final String studentId;
  final String email;
  final String? username;
  final String? department;
  final String? mobileNumber;
  final String level;
  final String? academicLevel;
  final bool isActivated;
  final bool? activatedViaPromo;
  final int referralCount;
  final String? referredBy;
  final bool? isBanned;
  final String? banReason;
  final String? theme;
  final String? photoURL;
  final String createdAt;

  UserProfile({
    required this.uid,
    required this.studentId,
    required this.email,
    this.username,
    this.department,
    this.mobileNumber,
    required this.level,
    this.academicLevel,
    required this.isActivated,
    this.activatedViaPromo,
    required this.referralCount,
    this.referredBy,
    this.isBanned,
    this.banReason,
    this.theme,
    this.photoURL,
    required this.createdAt,
  });

  factory UserProfile.fromMap(Map<String, dynamic> map, String id) {
    return UserProfile(
      uid: id,
      studentId: map['studentId'] ?? '',
      email: map['email'] ?? '',
      username: map['username'],
      department: map['department'],
      mobileNumber: map['mobileNumber'],
      level: map['level'] ?? '1',
      academicLevel: map['academicLevel'],
      isActivated: map['isActivated'] ?? false,
      activatedViaPromo: map['activatedViaPromo'],
      referralCount: map['referralCount'] ?? 0,
      referredBy: map['referredBy'],
      isBanned: map['isBanned'],
      banReason: map['banReason'],
      theme: map['theme'],
      photoURL: map['photoURL'],
      createdAt: map['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'studentId': studentId,
      'email': email,
      'username': username,
      'department': department,
      'mobileNumber': mobileNumber,
      'level': level,
      'academicLevel': academicLevel,
      'isActivated': isActivated,
      'activatedViaPromo': activatedViaPromo,
      'referralCount': referralCount,
      'referredBy': referredBy,
      'isBanned': isBanned,
      'banReason': banReason,
      'theme': theme,
      'photoURL': photoURL,
      'createdAt': createdAt,
    };
  }
}
