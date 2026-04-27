import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameController = TextEditingController();
  final _mobileController = TextEditingController();

  String? _selectedDepartment;
  String _selectedLevel = '100';
  bool _isLoading = false;

  final List<String> _departments = [
    "Agribusiness", "Agricultural and Bio resources Engineering", "Agricultural Economics",
    "Agricultural Extension", "Animal Science and Technology", "Architecture", "Biochemistry",
    "Biomedical Engineering", "Biology", "Biotechnology", "Building Technology", "Chemical Engineering",
    "Chemistry", "Civil Engineering", "Computer Engineering", "Computer Science", "Crop Science and Technology",
    "Cyber Security", "Dental Technology", "Electrical (Power Systems) Engineering", "Electronics Engineering",
    "Entrepreneurship and Innovation", "Environmental Health Science", "Environmental Management",
    "Environmental Management and Evaluation", "Environmental Management and Evaluation.",
    "Fisheries and Aquaculture Technology", "Food Science and technology", "Forensic Science",
    "Forestry and Wildlife Technology", "Geology", "Human Anatomy", "Human Physiology",
    "Information Technology", "Logistics and Transport Technology", "Maritime Technology and Logistics",
    "Material and Metallurgical Engineering", "Mathematics", "Mechanical Engineering",
    "Mechatronics Engineering", "Microbiology", "Optometry", "Petroleum Engineering", "Physics",
    "Polymer and Textile Engineering", "Project Management Technology", "Prosthetics and Orthotics",
    "Public Health Technology", "Quantity Surveying", "Science Laboratory Technology",
    "Software Engineering", "Soil Science and Technology", "Statistics", "Supply Chain Management",
    "Surveying and Geoinformatics", "Telecommunications Engineering", "Urban and Regional Planning"
  ]..sort();

  String _formatError(String e) {
    if (e.contains('email-already-in-use')) return "Email is already in use.";
    if (e.contains('weak-password')) return "Password is too weak.";
    if (e.contains('invalid-email')) return "Invalid email format.";
    return e;
  }

  Future<void> _register() async {
    if (_usernameController.text.isEmpty || _selectedDepartment == null || _mobileController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref.read(authServiceProvider).signUp(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
        username: _usernameController.text.trim(),
        department: _selectedDepartment!,
        level: _selectedLevel,
        mobileNumber: _mobileController.text.trim(),
      );
      if (mounted) context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_formatError(e.toString()))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _usernameController,
              decoration: const InputDecoration(labelText: 'Username', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedDepartment,
              decoration: const InputDecoration(labelText: 'Department', border: OutlineInputBorder()),
              items: _departments.map((d) => DropdownMenuItem(value: d, child: Text(d, style: const TextStyle(fontSize: 12)))).toList(),
              onChanged: (val) => setState(() => _selectedDepartment = val),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _selectedLevel,
              decoration: const InputDecoration(labelText: 'Academic Level', border: OutlineInputBorder()),
              items: ['100', '200'].map((l) => DropdownMenuItem(value: l, child: Text('$l Level'))).toList(),
              onChanged: (val) => setState(() => _selectedLevel = val!),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _mobileController,
              decoration: const InputDecoration(labelText: 'Phone Number', border: OutlineInputBorder()),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder()),
              obscureText: true,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isLoading ? null : _register,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: const Color(0xFF0F172A),
                foregroundColor: Colors.white,
              ),
              child: _isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Register'),
            ),
          ],
        ),
      ),
    );
  }
}
