import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pantheon_flutter/providers/auth_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ActivateScreen extends StatelessWidget {
  const ActivateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
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
                'Your account is currently inactive. Please activate your account to access all features of Pantheon.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: theme.colorScheme.onSurface.withOpacity(0.6), lineHeight: 1.5),
              ),
              const SizedBox(height: 48),
              _buildInstruction(LucideIcons.scan, 'Scan a Pantheon QR code at any of our partner locations.'),
              const SizedBox(height: 16),
              _buildInstruction(LucideIcons.creditCard, 'Or pay for activation directly within the app.'),
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Pay for Activation', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 16),
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

  Widget _buildInstruction(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.blue),
        const SizedBox(width: 16),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
      ],
    );
  }
}
