import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

enum AppTheme { light, dark, sepia, ocean, forest, midnight, sunset, lavender, custom }

class ThemeProvider with ChangeNotifier {
  AppTheme _theme = AppTheme.light;
  Map<String, Color> _customColors = {
    'primary': Colors.black,
    'background': Colors.white,
    'foreground': Colors.black,
    'accent': const Color(0xFFF1F5F9),
  };

  AppTheme get theme => _theme;
  Map<String, Color> get customColors => _customColors;

  ThemeProvider() {
    _loadTheme();
  }

  void _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final savedTheme = prefs.getString('pantheon-theme');
    if (savedTheme != null) {
      _theme = AppTheme.values.firstWhere((e) => e.name == savedTheme, orElse: () => AppTheme.light);
    }
    final savedColors = prefs.getString('pantheon-custom-colors');
    if (savedColors != null) {
      final Map<String, dynamic> decoded = json.decode(savedColors);
      _customColors = decoded.map((key, value) => MapEntry(key, Color(int.parse(value.toString()))));
    }
    notifyListeners();
  }

  void setTheme(AppTheme theme) async {
    _theme = theme;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pantheon-theme', theme.name);
    notifyListeners();
  }

  void setCustomColors(Map<String, Color> colors) async {
    _customColors = colors;
    final prefs = await SharedPreferences.getInstance();
    final Map<String, String> encoded = colors.map((key, value) => MapEntry(key, value.value.toString()));
    await prefs.setString('pantheon-custom-colors', json.encode(encoded));
    notifyListeners();
  }

  ThemeData getThemeData() {
    switch (_theme) {
      case AppTheme.dark:
        return _buildTheme(
          background: const Color(0xFF09090B),
          foreground: const Color(0xFFFAFAFA),
          primary: const Color(0xFFFAFAFA),
          accent: const Color(0xFF27272A),
          isDark: true,
        );
      case AppTheme.sepia:
        return _buildTheme(
          background: const Color(0xFFF4EBD0),
          foreground: const Color(0xFF403020),
          primary: const Color(0xFF5A4632),
          accent: const Color(0xFFE2D1A8),
          isDark: false,
        );
      case AppTheme.ocean:
        return _buildTheme(
          background: const Color(0xFFF0F4F8),
          foreground: const Color(0xFF1A2B4B),
          primary: const Color(0xFF3B82F6),
          accent: const Color(0xFFD1E3F8),
          isDark: false,
        );
      case AppTheme.forest:
        return _buildTheme(
          background: const Color(0xFFF0F4F0),
          foreground: const Color(0xFF1A2B1A),
          primary: const Color(0xFF10B981),
          accent: const Color(0xFFD1F8E3),
          isDark: false,
        );
      case AppTheme.midnight:
        return _buildTheme(
          background: const Color(0xFF0B0E14),
          foreground: const Color(0xFFF1F5F9),
          primary: const Color(0xFF6366F1),
          accent: const Color(0xFF1E293B),
          isDark: true,
        );
      case AppTheme.sunset:
        return _buildTheme(
          background: const Color(0xFFFFF7ED),
          foreground: const Color(0xFF431407),
          primary: const Color(0xFFF97316),
          accent: const Color(0xFFFFEDD5),
          isDark: false,
        );
      case AppTheme.lavender:
        return _buildTheme(
          background: const Color(0xFFF5F3FF),
          foreground: const Color(0xFF1E1B4B),
          primary: const Color(0xFF8B5CF6),
          accent: const Color(0xFFEDE9FE),
          isDark: false,
        );
      case AppTheme.custom:
        return _buildTheme(
          background: _customColors['background']!,
          foreground: _customColors['foreground']!,
          primary: _customColors['primary']!,
          accent: _customColors['accent']!,
          isDark: _customColors['background']!.computeLuminance() < 0.5,
        );
      case AppTheme.light:
      default:
        return _buildTheme(
          background: Colors.white,
          foreground: const Color(0xFF09090B),
          primary: const Color(0xFF09090B),
          accent: const Color(0xFFF1F5F9),
          isDark: false,
        );
    }
  }

  ThemeData _buildTheme({
    required Color background,
    required Color foreground,
    required Color primary,
    required Color accent,
    required bool isDark,
  }) {
    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: isDark ? Brightness.dark : Brightness.light,
        primary: primary,
        onPrimary: isDark ? background : Colors.white,
        surface: background,
        onSurface: foreground,
        secondary: accent,
        onSecondary: foreground,
      ),
      cardTheme: CardThemeData(
        color: background,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: foreground.withOpacity(0.1)),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        centerTitle: true,
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor: background,
      ),
    );
  }
}
