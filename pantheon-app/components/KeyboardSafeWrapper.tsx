import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';

/**
 * Tracks real-time software keyboard height across Android & iOS.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKeyboardHeight(h > 0 ? h : 0);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 0,
  };
}

interface KeyboardSafeContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  extraBottomPadding?: number;
}

/**
 * Reliable cross-platform keyboard container for full screens.
 * - iOS: uses KeyboardAvoidingView behavior="padding".
 * - Android: detects whether OS adjustResize actually shrank this container;
 *   only applies the remaining keyboardHeight delta as paddingBottom so inputs
 *   are never covered on edge-to-edge devices AND never double-padded when
 *   adjustResize already resized the window.
 */
export function KeyboardSafeContainer({
  children,
  style,
  keyboardVerticalOffset = 0,
  extraBottomPadding = 0,
}: KeyboardSafeContainerProps) {
  const { keyboardHeight } = useKeyboardHeight();
  const baseHeightRef = useRef<number>(0);
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (keyboardHeight === 0 && h > 0) {
        baseHeightRef.current = h;
      }
      setMeasuredHeight(h);
    },
    [keyboardHeight]
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, style]}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  if (Platform.OS === 'web') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  let androidPadding = 0;
  if (keyboardHeight > 0) {
    const base = baseHeightRef.current;
    const osShrunk = base > 0 && measuredHeight > 0 ? Math.max(0, base - measuredHeight) : 0;
    // If OS didn't shrink (or only partially shrank due to edge-to-edge/statusbar), pad the deficit
    androidPadding = Math.max(0, keyboardHeight - osShrunk + extraBottomPadding);
  }

  return (
    <View
      onLayout={handleLayout}
      style={[{ flex: 1, paddingBottom: androidPadding }, style]}
    >
      {children}
    </View>
  );
}

interface KeyboardSafeModalViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

/**
 * Reliable keyboard avoidance inside React Native <Modal> windows.
 * Android <Modal> runs in a separate Dialog window that ignores activity
 * softwareKeyboardLayoutMode="resize", so paddingBottom: keyboardHeight is
 * required to lift modal inputs above the software keyboard.
 */
export function KeyboardSafeModalView({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardSafeModalViewProps) {
  const { keyboardHeight } = useKeyboardHeight();

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={style}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[style, Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null]}>
      {children}
    </View>
  );
}
