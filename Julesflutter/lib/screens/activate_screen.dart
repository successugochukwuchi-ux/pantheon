import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/system_provider.dart';

class ActivateScreen extends ConsumerStatefulWidget {
  const ActivateScreen({super.key});

  @override
  ConsumerState<ActivateScreen> createState() => _ActivateScreenState();
}

class _ActivateScreenState extends ConsumerState<ActivateScreen> {
  final _pinController = TextEditingController();
  bool _isLoading = false;
  bool _usePinMode = false;

  Future<void> _activateWithPromo() async {
    final user = ref.read(authStateProvider).value;
    final promo = ref.read(promoConfigProvider).value;

    if (user == null || promo == null || !promo.isActive) return;

    setState(() => _isLoading = true);
    try {
      final db = FirebaseFirestore.instance;
      final promoRef = db.collection('system').doc('promo');

      await db.runTransaction((transaction) async {
        final promoSnap = await transaction.get(promoRef);
        final currentCount = promoSnap.data()?['count'] ?? 0;
        final quota = promoSnap.data()?['quota'] ?? 0;

        if (currentCount >= quota) {
          throw Exception("Promo quota reached");
        }

        transaction.update(promoRef, {
          'count': currentCount + 1,
          'isActive': (currentCount + 1) < quota,
        });

        transaction.update(db.collection('users').doc(user.uid), {
          'isActivated': true,
          'activatedViaPromo': true,
        });
      });

      if (mounted) context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _activateWithPin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 12) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pin must be 12 digits')),
      );
      return;
    }

    final user = ref.read(authStateProvider).value;
    final profile = ref.read(userProfileProvider).value;
    if (user == null || profile == null) return;

    setState(() => _isLoading = true);
    try {
      final db = FirebaseFirestore.instance;
      final pinRef = db.collection('activationCodes').doc(pin);
      final pinSnap = await pinRef.get();

      if (!pinSnap.exists) {
        throw Exception("Invalid activation pin");
      }

      final pinData = pinSnap.data()!;
      if (pinData['isUsed'] == true) {
        throw Exception("This pin has already been used");
      }

      final batch = db.batch();
      batch.update(pinRef, {
        'isUsed': true,
        'usedBy': user.uid,
        'usedByStudentId': profile.studentId,
        'usedAt': DateTime.now().toIso8601String(),
      });

      batch.update(db.collection('users').doc(user.uid), {
        'isActivated': true,
        if (pinData['type'] == 'plus') 'level': '1+',
      });

      await batch.commit();

      if (mounted) context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final promo = ref.watch(promoConfigProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Activate Account')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (promo?.isActive == true && !_usePinMode) ...[
                const Icon(Icons.card_giftcard, size: 64, color: Colors.amber),
                const SizedBox(height: 16),
                const Text(
                  'FREE PROMO ACTIVE',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.amber),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tokens Remaining: ${promo!.quota - promo.count}',
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _isLoading ? null : _activateWithPromo,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                    backgroundColor: Colors.amber,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Activate Free Now'),
                ),
                TextButton(
                  onPressed: () => setState(() => _usePinMode = true),
                  child: const Text('Or use physical pin'),
                ),
              ] else ...[
                const Text(
                  'Enter Activation Pin',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _pinController,
                  decoration: const InputDecoration(
                    labelText: '12-Digit Pin',
                    border: OutlineInputBorder(),
                    hintText: '000000000000',
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 12,
                  textAlign: TextAlign.center,
                  style: const TextStyle(letterSpacing: 8, fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _activateWithPin,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Activate Now'),
                ),
                if (promo?.isActive == true)
                  TextButton(
                    onPressed: () => setState(() => _usePinMode = false),
                    child: const Text('Use Free Promo'),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
