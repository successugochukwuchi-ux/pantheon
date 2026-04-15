# Pantheon Mobile (Flutter)

This is the mobile version of the Pantheon Study App, built with Flutter.

## Features
- **Full Parity with Web**: All student-side features are now available on mobile.
- **Theme System**: 9 built-in themes + a Custom Theme Builder with a live color picker.
- **CBT Practice**: Interactive quiz mode for practicing past questions.
- **Search**: Global search for lecture notes and questions.
- **Stylized UI**: Modern, high-contrast design matching the web's aesthetic.
- **Real-time Sync**: All data is synchronized via Firebase Firestore.

## Getting Started

1.  **Install Flutter**: Follow the instructions at [flutter.dev](https://docs.flutter.dev/get-started/install).
2.  **Navigate to this directory**: `cd pantheon_flutter`
3.  **Generate platform files**: 
    Because this project was created manually, you need to generate the Android/iOS folders by running:
    ```bash
    flutter create . --platforms android,ios
    ```
4.  **Install dependencies**: `flutter pub get`
5.  **Run the app**: `flutter run`

## How to Compile to APK (Android)

Flutter makes it very easy to generate an APK directly from your machine.

### Prerequisites
- Flutter SDK installed.
- Android Studio (for Android SDK) installed.

### Steps

1.  **Navigate to the project folder**:
    ```bash
    cd pantheon_flutter
    ```

2.  **Clean the project** (optional but recommended):
    ```bash
    flutter clean
    ```

3.  **Get dependencies**:
    ```bash
    flutter pub get
    ```

4.  **Build the APK**:
    Run the following command to generate a release APK:
    ```bash
    flutter build apk --release
    ```
    *If you want to support multiple architectures (fat APK), use:*
    ```bash
    flutter build apk --split-per-abi
    ```

5.  **Locate the APK**:
    Once the build is complete, you can find the APK file at:
    `build/app/outputs/flutter-apk/app-release.apk`

6.  **Install on Device**:
    You can transfer this file to your Android device and install it directly.

## Firebase Configuration
Before running, you must replace the placeholder values in `lib/main.dart` with your actual Firebase configuration from the Firebase Console (Project Settings > General > Your Apps > Flutter).
