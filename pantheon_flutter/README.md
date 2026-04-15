# Pantheon Mobile (Flutter)

This is the mobile version of the Pantheon Study App, built with Flutter.

## Getting Started

1.  **Install Flutter**: Follow the instructions at [flutter.dev](https://docs.flutter.dev/get-started/install).
2.  **Navigate to this directory**: `cd pantheon_flutter`
3.  **Install dependencies**: `flutter pub get`
4.  **Run the app**: `flutter run`

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
