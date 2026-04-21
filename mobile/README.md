# Pantheon Mobile (Flutter)

This is the Flutter version of the Pantheon Student Portal. It replaces the previous React Native implementation to provide a more stable build environment on Windows.

## 🚀 Getting Started

1.  **Install Flutter**: Follow the [official Flutter installation guide](https://docs.flutter.dev/get-started/install/windows).
2.  **Plugin Setup**: Ensure you have the Flutter and Dart plugins installed in VS Code or Android Studio.
3.  **Dependencies**: Run `flutter pub get` in this directory.

## 📱 Building the APK (For Android)

Flutter makes it easy to generate a standalone APK for testing on your phone:

### 1. Build the debug APK (Easiest)
Run this command in the `mobile` directory:
```bash
flutter build apk --debug
```
Your APK will be located at:
`build/app/outputs/flutter-apk/app-debug.apk`

### 2. Build the release APK (Optimized)
```bash
flutter build apk --release
```
Your APK will be located at:
`build/app/outputs/flutter-apk/app-release.apk`

## 🔗 Firebase Integration

The project is structured to work with your existing Firebase project. To finalize the connection:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Add an **Android App** to your project.
3. Download the `google-services.json` file.
4. Place it in `android/app/google-services.json`.

## 🛠️ Project Structure
- `lib/main.dart`: Entry point & Routing.
- `lib/providers/`: State management (Riverpod).
- `lib/screens/`: UI Screens (Login, Dashboard, Exams).
- `lib/services/`: Firebase & Firestore logic.
- `lib/models/`: Data models for Profiles and Questions.
