import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class AppSidebar extends ConsumerWidget {
  const AppSidebar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider).value;

    return Drawer(
      child: Column(
        children: [
          UserAccountsDrawerHeader(
            accountName: Text(profile?.username ?? 'Student', style: const TextStyle(fontWeight: FontWeight.bold)),
            accountEmail: Text(profile?.email ?? ''),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text(
                (profile?.username ?? 'S').substring(0, 1).toUpperCase(),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).primaryColor,
            ),
          ),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildNavItem(context, Icons.dashboard, 'Dashboard', '/dashboard'),
                _buildNavItem(context, Icons.book, 'Lecture Notes', '/notes'),
                _buildNavItem(context, Icons.history, 'Past Questions', '/past-questions'),
                _buildNavItem(context, Icons.calculate, 'Punch Notes', '/punch'),
                _buildNavItem(context, Icons.help_outline, 'CBT Practice', '/cbt'),
                _buildNavItem(context, Icons.video_library, 'Video Library', '/videos'),
                const Divider(),
                _buildNavItem(context, Icons.search, 'Find Students', '/search'),
                _buildNavItem(context, Icons.chat, 'Global Chat', '/chat'),
                _buildNavItem(context, Icons.newspaper, 'News Board', '/news'),
                const Divider(),
                _buildNavItem(context, Icons.settings, 'Settings', '/settings'),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: () {
              ref.read(authServiceProvider).signOut();
              context.go('/login');
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, IconData icon, String title, String path) {
    final location = GoRouterState.of(context).matchedLocation;
    final isSelected = location == path;

    return ListTile(
      leading: Icon(icon, color: isSelected ? Theme.of(context).primaryColor : null),
      title: Text(title, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : null)),
      selected: isSelected,
      onTap: () {
        Navigator.pop(context); // Close drawer
        context.go(path);
      },
    );
  }
}
