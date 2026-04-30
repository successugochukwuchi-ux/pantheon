import 'react-native';
import React from 'react';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('react-native-gesture-handler', () => {
  return {
    GestureHandlerRootView: ({ children }: any) => children,
    Swipeable: ({ children }: any) => children,
    DrawerLayout: ({ children }: any) => children,
    State: {},
    PanGestureHandler: ({ children }: any) => children,
    BaseButton: ({ children }: any) => children,
    RectButton: ({ children }: any) => children,
    BorderlessButton: ({ children }: any) => children,
    NativeViewGestureHandler: ({ children }: any) => children,
    TapGestureHandler: ({ children }: any) => children,
    FlingGestureHandler: ({ children }: any) => children,
    ForceTouchGestureHandler: ({ children }: any) => children,
    LongPressGestureHandler: ({ children }: any) => children,
    PinchGestureHandler: ({ children }: any) => children,
    RotationGestureHandler: ({ children }: any) => children,
    RawButton: ({ children }: any) => children,
    ScrollView: ({ children }: any) => children,
    FlatList: ({ children }: any) => children,
    SectionList: ({ children }: any) => children,
    TextInput: ({ children }: any) => children,
    ToolbarAndroid: ({ children }: any) => children,
    DrawerLayoutAndroid: ({ children }: any) => children,
    Switch: ({ children }: any) => children,
    RefreshControl: ({ children }: any) => children,
    WebView: ({ children }: any) => children,
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@react-navigation/native', () => {
  return {
    NavigationContainer: ({ children }: any) => children,
  };
});

jest.mock('@react-navigation/stack', () => {
  return {
    createStackNavigator: () => {
      return {
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
      };
    },
  };
});

jest.mock('@react-navigation/drawer', () => {
  return {
    createDrawerNavigator: () => {
      return {
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
      };
    },
    DrawerContentScrollView: ({ children }: any) => children,
    DrawerItemList: ({ children }: any) => children,
  };
});

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

it('renders correctly', () => {
  renderer.create(<App />);
});
