import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum PantheonTheme { light, dark, sepia, midnight }

class ThemeService {
  static ThemeData getTheme(PantheonTheme theme) {
    switch (theme) {
      case PantheonTheme.dark:
        return _buildTheme(Brightness.dark, const Color(0xFF0F172A), Colors.white);
      case PantheonTheme.sepia:
        return _buildTheme(Brightness.light, const Color(0xFF704214), const Color(0xFFF4ECD8));
      case PantheonTheme.midnight:
        return _buildTheme(Brightness.dark, Colors.indigo.shade900, const Color(0xFF020617));
      case PantheonTheme.light:
      default:
        return _buildTheme(Brightness.light, const Color(0xFF0F172A), Colors.white);
    }
  }

  static ThemeData _buildTheme(Brightness brightness, Color primary, Color background) {
    final baseTheme = ThemeData(
      brightness: brightness,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      primaryColor: primary,
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        brightness: brightness,
        primary: primary,
        surface: background,
      ),
      textTheme: GoogleFonts.interTextTheme(baseTheme.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.inter(
          color: brightness == Brightness.light ? Colors.black : Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
        iconTheme: IconThemeData(
          color: brightness == Brightness.light ? Colors.black : Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.grey.withValues(alpha: 0.2)),
        ),
      ),
    );
  }
}
