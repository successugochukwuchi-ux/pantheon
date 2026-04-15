import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pantheon_flutter/providers/theme_provider.dart';
import 'package:pantheon_flutter/providers/auth_provider.dart';
import 'package:flutter_colorpicker/flutter_colorpicker.dart';
import 'package:lucide_icons/lucide_icons.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _buildSectionHeader(theme, 'Appearance'),
          const SizedBox(height: 16),
          _buildThemeGrid(themeProvider),
          if (themeProvider.theme == AppTheme.custom) ...[
            const SizedBox(height: 24),
            _buildCustomThemeBuilder(context, themeProvider),
          ],
          const SizedBox(height: 32),
          _buildSectionHeader(theme, 'Account'),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(LucideIcons.user),
            title: const Text('Profile'),
            subtitle: Text(authProvider.profile?['username'] ?? 'Student'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(LucideIcons.logOut, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: () {
              authProvider.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(ThemeData theme, String title) {
    return Text(
      title,
      style: theme.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.bold,
        color: theme.colorScheme.primary,
      ),
    );
  }

  Widget _buildThemeGrid(ThemeProvider themeProvider) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 3,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.5,
      children: AppTheme.values.map((theme) {
        final isSelected = themeProvider.theme == theme;
        return GestureDetector(
          onTap: () => themeProvider.setTheme(theme),
          child: Container(
            decoration: BoxDecoration(
              color: isSelected ? Colors.black : Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isSelected ? Colors.black : Colors.grey[300]!,
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              theme.name[0].toUpperCase() + theme.name.substring(1),
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.black,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 12,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCustomThemeBuilder(BuildContext context, ThemeProvider themeProvider) {
    final colors = themeProvider.customColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Theme Builder', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        _buildColorTile(context, 'Primary Color', colors['primary']!, (color) {
          final newColors = Map<String, Color>.from(colors);
          newColors['primary'] = color;
          themeProvider.setCustomColors(newColors);
        }),
        _buildColorTile(context, 'Background', colors['background']!, (color) {
          final newColors = Map<String, Color>.from(colors);
          newColors['background'] = color;
          themeProvider.setCustomColors(newColors);
        }),
        _buildColorTile(context, 'Text Color', colors['foreground']!, (color) {
          final newColors = Map<String, Color>.from(colors);
          newColors['foreground'] = color;
          themeProvider.setCustomColors(newColors);
        }),
        _buildColorTile(context, 'Accent Color', colors['accent']!, (color) {
          final newColors = Map<String, Color>.from(colors);
          newColors['accent'] = color;
          themeProvider.setCustomColors(newColors);
        }),
      ],
    );
  }

  Widget _buildColorTile(BuildContext context, String label, Color color, Function(Color) onColorChanged) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label, style: const TextStyle(fontSize: 14)),
      trailing: GestureDetector(
        onTap: () {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: Text('Pick $label'),
              content: SingleChildScrollView(
                child: ColorPicker(
                  pickerColor: color,
                  onColorChanged: onColorChanged,
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Done'),
                ),
              ],
            ),
          );
        },
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.grey[300]!),
          ),
        ),
      ),
    );
  }
}
