import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pantheon_flutter/providers/auth_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ActivateScreen extends StatefulWidget {
  const ActivateScreen({super.key});

  @override
  State<ActivateScreen> createState() => _ActivateScreenState();
}

class _ActivateScreenState extends State<ActivateScreen> {
  final _pinController = TextEditingController();
  bool _isVerifying = false;

  Future<void> _launchWhatsApp() async {
    final whatsappUrl = Uri.parse("https://wa.me/2348118429150?text=Hello, I want to activate my Pantheon account.");
    if (await canLaunchUrl(whatsappUrl)) {
      await launchUrl(whatsappUrl, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch WhatsApp')),
        );
      }
    }
  }

  Future<void> _verifyPin() async {
    if (_pinController.text.isEmpty) return;

    setState(() => _isVerifying = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final uid = authProvider.user?.uid;
      
      if (uid == null) return;

      // Check if PIN exists in an 'activation_pins' collection
      final pinDoc = await FirebaseFirestore.instance
          .collection('activation_pins')
          .doc(_pinController.text.trim())
          .get();

      if (pinDoc.exists && pinDoc.data()?['isUsed'] == false) {
        // Mark PIN as used and activate user
        await FirebaseFirestore.instance.runTransaction((transaction) async {
          transaction.update(pinDoc.reference, {'isUsed': true, 'usedBy': uid});
          transaction.update(FirebaseFirestore.instance.collection('users').doc(uid), {
            'isActivated': true,
          });
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Account activated successfully!')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invalid or already used PIN')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.shieldAlert, size: 64, color: Colors.blue),
              ),
              const SizedBox(height: 32),
              const Text(
                'Activation Required',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 16),
              Text(
                'Your account is currently inactive. Please enter your activation PIN or contact support.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: theme.colorScheme.onSurface.withOpacity(0.6), height: 1.5),
              ),
              const SizedBox(height: 40),
              
              TextField(
                controller: _pinController,
                decoration: InputDecoration(
                  hintText: 'Enter Activation PIN',
                  filled: true,
                  fillColor: theme.colorScheme.secondary.withOpacity(0.3),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                  prefixIcon: const Icon(LucideIcons.key),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isVerifying ? null : _verifyPin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isVerifying 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Verify PIN', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              
              const SizedBox(height: 40),
              const Text('Need a PIN?', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _buildActionTile(
                LucideIcons.messageCircle, 
                'Contact Support on WhatsApp', 
                _launchWhatsApp,
                Colors.green,
              ),
              const SizedBox(height: 16),
              _buildActionTile(
                LucideIcons.creditCard, 
                'Pay for Activation Online', 
                () {},
                Colors.blue,
              ),
              
              const SizedBox(height: 40),
              TextButton(
                onPressed: () => authProvider.logout(),
                child: const Text('Logout and try again later', style: TextStyle(color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionTile(IconData icon, String text, VoidCallback onTap, Color color) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: color.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 16),
            Expanded(child: Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
            Icon(Icons.chevron_right, size: 20, color: color),
          ],
        ),
      ),
    );
  }
}
