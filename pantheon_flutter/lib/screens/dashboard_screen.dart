import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pantheon_flutter/providers/auth_provider.dart';
import 'package:pantheon_flutter/providers/theme_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _searchController = TextEditingController();

  void _handleSearch() {
    if (_searchController.text.isNotEmpty) {
      Navigator.pushNamed(context, '/search', arguments: _searchController.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final theme = Theme.of(context);
    final profile = authProvider.profile;

    return Scaffold(
      appBar: AppBar(
        title: const Text('PANTHEON', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -1)),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      drawer: _buildDrawer(context, authProvider),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Bar
            Container(
              decoration: BoxDecoration(
                color: theme.colorScheme.secondary.withOpacity(0.5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search lecture notes, questions...',
                  prefixIcon: const Icon(LucideIcons.search, size: 20),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onSubmitted: (_) => _handleSearch(),
              ),
            ),
            const SizedBox(height: 32),
            
            // Welcome Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hello,',
                      style: TextStyle(color: theme.colorScheme.onSurface.withOpacity(0.6), fontSize: 16),
                    ),
                    Text(
                      profile?['username'] ?? 'Student',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                _buildAvatar(profile?['username'] ?? 'S'),
              ],
            ),
            const SizedBox(height: 32),

            // Stats Grid
            Row(
              children: [
                _buildStatCard(
                  context,
                  'Level',
                  profile?['level'] ?? '1',
                  LucideIcons.user,
                  Colors.blue,
                ),
                const SizedBox(width: 12),
                _buildStatCard(
                  context,
                  'Referrals',
                  profile?['referralCount']?.toString() ?? '0',
                  LucideIcons.users,
                  Colors.purple,
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Learning Center
            const Text(
              'Learning Center',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.1,
              children: [
                _buildMenuCard(context, 'Lecture Notes', LucideIcons.bookOpen, Colors.blue, '/lecture-notes'),
                _buildMenuCard(context, 'CBT Practice', LucideIcons.cpu, Colors.purple, '/cbt'),
                _buildMenuCard(context, 'Punch Notes', LucideIcons.calculator, Colors.green, '/lecture-notes'),
                _buildMenuCard(context, 'News Board', LucideIcons.newspaper, Colors.orange, '/lecture-notes'),
              ],
            ),

            if (profile?['isActivated'] == false) ...[
              const SizedBox(height: 32),
              _buildActivationBanner(context),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawer(BuildContext context, AuthProvider authProvider) {
    final theme = Theme.of(context);
    return Drawer(
      child: Column(
        children: [
          DrawerHeader(
            decoration: BoxDecoration(color: theme.colorScheme.primary),
            child: Center(
              child: Text(
                'PANTHEON',
                style: TextStyle(
                  color: theme.colorScheme.onPrimary,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -2,
                ),
              ),
            ),
          ),
          _buildDrawerItem(context, 'Dashboard', LucideIcons.layoutDashboard, '/dashboard'),
          _buildDrawerItem(context, 'Lecture Notes', LucideIcons.bookOpen, '/lecture-notes'),
          _buildDrawerItem(context, 'CBT Practice', LucideIcons.cpu, '/cbt'),
          _buildDrawerItem(context, 'Settings', LucideIcons.settings, '/settings'),
          const Spacer(),
          ListTile(
            leading: const Icon(LucideIcons.logOut, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: () {
              authProvider.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context, String title, IconData icon, String route) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      onTap: () {
        Navigator.pop(context);
        if (ModalRoute.of(context)?.settings.name != route) {
          Navigator.pushNamed(context, route);
        }
      },
    );
  }

  Widget _buildAvatar(String name) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: Colors.blue.withOpacity(0.1),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.blue.withOpacity(0.2), width: 2),
      ),
      child: Center(
        child: Text(
          name[0].toUpperCase(),
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.blue),
        ),
      ),
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, IconData icon, Color color) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: theme.colorScheme.secondary.withOpacity(0.3),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: color),
            ),
            const SizedBox(height: 16),
            Text(
              value,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
            ),
            Text(
              label,
              style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface.withOpacity(0.6)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuCard(BuildContext context, String title, IconData icon, Color color, String route) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, route),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivationBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Account Not Activated',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Unlock full access to lecture notes, past questions, and CBT practice.',
            style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, '/activate'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: const Text('Activate Now', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }
}
