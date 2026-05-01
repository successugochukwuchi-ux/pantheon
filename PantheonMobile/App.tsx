/**
 * @format
 */

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation';

function App(): React.JSX.Element {
  useEffect(() => {
    const requestStoragePermission = async () => {
      if (Platform.OS === 'android') {
        try {
          if (Platform.Version >= 33) {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
              PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            ]);
          } else {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            ]);
          }
        } catch (err) {
          console.warn(err);
        }
      }
    };
    requestStoragePermission();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
