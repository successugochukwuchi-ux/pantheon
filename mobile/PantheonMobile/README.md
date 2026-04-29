# Pantheon Mobile App

This is the React Native version of the Pantheon Study App.

## Prerequisites

- Node.js (v18 or newer)
- Java Development Kit (JDK) 17
- Android SDK & Build Tools

## Setup Instructions

1.  Navigate to the mobile directory:
    ```bash
    cd mobile/PantheonMobile
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Building the Android APK with Java 17

To build the APK, follow these steps ensuring your environment is set to **Java 17**:

1.  **Set JAVA_HOME to Java 17:**
    - On Windows (PowerShell):
      ```powershell
      \$env:JAVA_HOME = "C:\Path\To\Jdk-17"
      ```
    - On macOS/Linux:
      ```bash
      export JAVA_HOME=/path/to/jdk-17
      ```

2.  **Navigate to the android directory:**
    ```bash
    cd android
    ```

3.  **Clean the build (optional but recommended):**
    ```bash
    ./gradlew clean
    ```

4.  **Assemble the Debug APK:**
    ```bash
    ./gradlew assembleDebug
    ```
    The generated APK will be located at:
    `android/app/build/outputs/apk/debug/app-debug.apk`

5.  **Assemble the Release APK (requires keystore):**
    ```bash
    ./gradlew assembleRelease
    ```
    The generated APK will be located at:
    `android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

- **Java Version Mismatch:** If you see `Inconsistent JVM-target compatibility` errors, ensure that your `JAVA_HOME` is strictly set to Java 17 and that no other Java versions are being picked up by Gradle.
- **Java Heap Space:** If the build fails with "Java heap space" during the `JetifyTransform` or `checkDebugAarMetadata` tasks, ensure `org.gradle.jvmargs` in `gradle.properties` is set to at least `-Xmx4096m`.
- **Jetifier:** Jetifier is disabled by default in this project (`android.enableJetifier=false`) to improve build performance and memory usage. If you use very old libraries that require it, you may need to re-enable it.
- **NDK Issues:** The build system expects NDK version `27.1.12297006`. Ensure this is installed via Android Studio or configured in `local.properties`.
