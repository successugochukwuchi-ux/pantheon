import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pantheon_mobile/providers/auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _studentIdController = TextEditingController();
  String _academicLevel = '100';
  bool _loading = false;
  String? _error;

  Future<void> _handleRegister() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty || _fullNameController.text.isEmpty || _studentIdController.text.isEmpty) {
      setState(() => _error = 'Please fill in all fields');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authProvider.notifier).register(_emailController.text, _passwordController.text, {
        'fullName': _fullNameController.text,
        'studentId': _studentIdController.text,
        'academicLevel': _academicLevel,
        'email': _emailController.text,
        'createdAt': DateTime.now().toIso8601String(),
      });
      if (mounted) context.go('/dashboard');
    } catch (e) { setState(() => _error = e.toString()); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(title: const Text('Create Account')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              if (_error != null) ...[
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red, fontSize: 14)),
                const SizedBox(height: 16),
              ],
              _InputField(controller: _fullNameController, hintText: 'Full Name', icon: Icons.person_outline),
              const SizedBox(height: 16),
              _InputField(controller: _emailController, hintText: 'Email Address', icon: Icons.mail_outline, keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 16),
              _InputField(controller: _studentIdController, hintText: 'Student ID', icon: Icons.school_outlined),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _academicLevel,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.leaderboard_outlined, size: 20),
                  filled: true, fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                ),
                items: ['100', '200', '300', '400'].map((level) => DropdownMenuItem(value: level, child: Text('$level Level'))).toList(),
                onChanged: (val) => setState(() => _academicLevel = val!),
              ),
              const SizedBox(height: 16),
              _InputField(controller: _passwordController, hintText: 'Password', icon: Icons.lock_outline, obscureText: true),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _loading ? null : _handleRegister,
                child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Create Account'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  const _InputField({required this.controller, required this.hintText, required this.icon, this.obscureText = false, this.keyboardType});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller, obscureText: obscureText, keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hintText, prefixIcon: Icon(icon, size: 20),
        filled: true, fillColor: const Color(0xFFF8FAFC),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      ),
    );
  }
}
