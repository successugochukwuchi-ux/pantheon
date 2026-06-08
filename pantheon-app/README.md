# CoLearn App

React Native (Expo) mobile app for the CoLearn study platform — built for FUTO students.

---

## Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`
- An [Expo account](https://expo.dev/signup) (free)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Log in to your Expo account
eas login

# 3. Link the project to EAS (one-time setup)
eas init
```

After running `eas init`, copy the generated `projectId` into `app.json` under `expo.extra.eas.projectId`.

---

## Running Locally

```bash
# Start the Metro dev server
npx expo start

# Open on Android emulator
npx expo start --android

# Open on iOS simulator
npx expo start --ios
```

---

## Building with EAS Cloud

### Preview APK (Android — for testing)
```bash
eas build --profile preview --platform android
```
This produces a `.apk` file you can install directly on any Android device.

### Production Build (AAB — for Play Store)
```bash
eas build --profile production --platform android
```

### Check build status
```bash
eas build:list
```

---

## Project Structure

```
colearn-app/
├── app/
│   ├── _layout.tsx        # Root layout (fonts, navigation shell)
│   └── index.tsx          # Landing screen
├── assets/                # Icons, splash images
├── app.json               # Expo config
├── eas.json               # EAS build profiles
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── package.json
```

---

## EAS Build Profiles (`eas.json`)

| Profile    | Platform | Output | Use Case              |
|------------|----------|--------|-----------------------|
| `preview`  | Android  | APK    | Testers / internal QA |
| `production` | Android | AAB  | Google Play Store     |

---

## Assets

Replace the placeholder files in `/assets/` with your real assets:
- `icon.png` — 1024×1024 app icon
- `splash.png` — 1284×2778 splash screen
- `adaptive-icon.png` — 1024×1024 Android adaptive icon foreground
- `favicon.png` — 48×48 web favicon

---

## Tech Stack

- **Expo SDK 52** with `expo-router` (file-based routing)
- **React Native 0.76**
- **TypeScript**
- **expo-linear-gradient** for gradient backgrounds
- **DM Serif Display + DM Sans** — Google Fonts via `@expo-google-fonts`
- **EAS Build** for cloud compilation
