import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/data_provider.dart';
import '../providers/system_provider.dart';
import '../widgets/app_sidebar.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider).value;
    final news = ref.watch(newsProvider).value ?? [];
    final systemConfig = ref.watch(systemConfigProvider).value;

    if (profile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isUnactivated = !profile.isActivated;
    final isHoliday = systemConfig?.currentSemester == 'none';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: const AppSidebar(),
      appBar: AppBar(
        title: const Text('PANTHEON', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(userProfileProvider);
          ref.invalidate(newsProvider);
          ref.invalidate(coursesProvider);
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome back, ${profile.username ?? 'Student'}!',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const Text('Access your study materials and stay updated.', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 24),

              if (isUnactivated) _buildActivationAlert(context),

              const Text(
                'QUICK LINKS',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 1.2),
              ),
              const SizedBox(height: 12),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  _buildQuickLink(context, 'Lecture Notes', Icons.book, Colors.blue, '/notes', isHoliday),
                  _buildQuickLink(context, 'Past Questions', Icons.history, Colors.purple, '/past-questions', isHoliday),
                  _buildQuickLink(context, 'CBT Practice', Icons.help_outline, Colors.green, '/cbt', isHoliday),
                  _buildQuickLink(context, 'Punch Notes', Icons.calculate, Colors.orange, '/punch', isHoliday),
                ],
              ),

              const SizedBox(height: 32),
              const Text(
                'RECENT NEWS',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 1.2),
              ),
              const SizedBox(height: 12),
              if (news.isEmpty)
                const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No news yet.')))
              else
                ...news.map((item) => _buildNewsCard(item)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActivationAlert(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange),
              SizedBox(width: 8),
              Text('Account Not Activated', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
            ],
          ),
          const SizedBox(height: 8),
          const Text('Your account is currently inactive. Activate to access all materials.'),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: () => context.push('/activate'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange, foregroundColor: Colors.white),
            child: const Text('Activate Now'),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickLink(BuildContext context, String title, IconData icon, Color color, String path, bool disabled) {
    return InkWell(
      onTap: disabled ? null : () => context.push(path),
      child: Opacity(
        opacity: disabled ? 0.5 : 1.0,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(height: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNewsCard(dynamic item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            Text(item.createdAt.toString(), style: const TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 8),
            Text(item.content, maxLines: 3, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
