import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pantheon_mobile/providers/auth_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final profile = authState.profile;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Welcome,', style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
                      Text(profile?.fullName ?? 'Student', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                    ],
                  ),
                  Container(
                    width: 48, height: 48,
                    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: const Icon(Icons.person_outline, size: 24, color: Color(0xFF3B82F6)),
                  ),
                ],
              ),
              const SizedBox(height: 32),
              // Main Features Grid
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                children: [
                  _FeatureCard(
                    title: 'CBT Practice',
                    subtitle: 'Simulate Exams',
                    icon: Icons.assignment_outlined,
                    color: const Color(0xFF3B82F6),
                    onTap: () => context.push('/cbt-practice'), // Using .push for Back Button
                  ),
                  _FeatureCard(
                    title: 'Past Questions',
                    subtitle: 'Study Archive',
                    icon: Icons.history_edu_outlined,
                    color: const Color(0xFF8B5CF6),
                    onTap: () => context.push('/past-questions'),
                  ),
                  _FeatureCard(
                    title: 'Lecture Notes',
                    subtitle: 'Summaries',
                    icon: Icons.description_outlined,
                    color: const Color(0xFFF59E0B),
                    onTap: () => context.push('/notes'),
                  ),
                  _FeatureCard(
                    title: 'Video Library',
                    subtitle: 'visual Learning',
                    icon: Icons.video_library_outlined,
                    color: const Color(0xFFEF4444),
                    onTap: () => context.push('/videos'),
                  ),
                ],
              ),
              const SizedBox(height: 48),
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    ref.read(authProvider.notifier).signOut();
                    context.go('/login');
                  },
                  icon: const Icon(Icons.logout, color: Color(0xFFEF4444), size: 20),
                  label: const Text('Sign Out', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _FeatureCard({required this.title, required this.subtitle, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 24),
            ),
            const Spacer(),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          ],
        ),
      ),
    );
  }
}
