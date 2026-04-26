import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/system_config.dart';

final systemConfigProvider = StreamProvider<SystemConfig>((ref) {
  return FirebaseFirestore.instance
      .collection('system')
      .doc('config')
      .snapshots()
      .map((snapshot) {
    if (snapshot.exists) {
      return SystemConfig.fromMap(snapshot.data()!);
    }
    return SystemConfig(
      currentSemester: 'none',
      maintenanceMode: false,
      updatedBy: 'system',
      updatedAt: '',
    );
  });
});

final promoConfigProvider = StreamProvider<PromoConfig>((ref) {
  return FirebaseFirestore.instance
      .collection('system')
      .doc('promo')
      .snapshots()
      .map((snapshot) {
    if (snapshot.exists) {
      return PromoConfig.fromMap(snapshot.data()!);
    }
    return PromoConfig(
      isActive: false,
      quota: 0,
      count: 0,
      updatedAt: '',
      updatedBy: 'system',
    );
  });
});
