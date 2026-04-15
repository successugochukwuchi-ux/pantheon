# Pantheon Mobile (React Native)

This is the mobile version of the Pantheon Study App, built with React Native and Expo.

## Getting Started

1. Navigate to this directory: `cd crossmobile`
2. Install dependencies: `npm install`
3. Start the development server: `npm start`

## How to Compile to APK (Android)

We use **EAS Build** to generate APKs. It's the most reliable way to build React Native apps.

### Prerequisites
- An Expo account (create one at [expo.dev](https://expo.dev))
- Node.js installed on your machine

### Steps

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to your Expo account**:
   ```bash
   eas login
   ```

3. **Configure the project**:
   ```bash
   eas build:configure
   ```
   *Follow the prompts. Choose "Android" when asked.*

4. **Update `eas.json`**:
   Ensure your `eas.json` has a `preview` profile configured to produce an APK. It should look like this:
   ```json
   {
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         }
       },
       "production": {}
     }
   }
   ```

5. **Run the Build**:
   ```bash
   eas build -p android --profile preview
   ```

6. **Download the APK**:
   Once the build is complete (it runs in the cloud), EAS will provide a link to download your `.apk` file. You can then install this directly on any Android device.

## Project Structure
- `src/contexts`: Authentication state management.
- `src/navigation`: App routing (Auth vs Dashboard).
- `src/screens`: Individual app pages (Login, Dashboard, etc.).
- `src/firebase.js`: Firebase SDK initialization.
