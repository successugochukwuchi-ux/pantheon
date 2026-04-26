class SystemConfig {
  final String currentSemester;
  final bool maintenanceMode;
  final String updatedBy;
  final String updatedAt;

  SystemConfig({
    required this.currentSemester,
    required this.maintenanceMode,
    required this.updatedBy,
    required this.updatedAt,
  });

  factory SystemConfig.fromMap(Map<String, dynamic> map) {
    return SystemConfig(
      currentSemester: map['currentSemester'] ?? 'none',
      maintenanceMode: map['maintenanceMode'] ?? false,
      updatedBy: map['updatedBy'] ?? 'system',
      updatedAt: map['updatedAt'] ?? '',
    );
  }
}

class PromoConfig {
  final bool isActive;
  final int quota;
  final int count;
  final String updatedAt;
  final String updatedBy;

  PromoConfig({
    required this.isActive,
    required this.quota,
    required this.count,
    required this.updatedAt,
    required this.updatedBy,
  });

  factory PromoConfig.fromMap(Map<String, dynamic> map) {
    return PromoConfig(
      isActive: map['isActive'] ?? false,
      quota: map['quota'] ?? 0,
      count: map['count'] ?? 0,
      updatedAt: map['updatedAt'] ?? '',
      updatedBy: map['updatedBy'] ?? 'system',
    );
  }
}
