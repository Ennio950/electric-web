import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, StyleSheet } from 'react-native';

import { colors } from '@/src/theme';

type KeyboardSafeScrollViewProps = PropsWithChildren<ScrollViewProps>;

/**
 * ScrollView wrapped in KeyboardAvoidingView so the keyboard
 * doesn't cover inputs on iOS. On Android this is handled by
 * android:windowSoftInputMode in the manifest.
 */
export function KeyboardSafeScrollView({ children, style, contentContainerStyle, ...rest }: KeyboardSafeScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={[styles.scroll, style]}
        contentContainerStyle={contentContainerStyle}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: {
    flex: 1,
  },
});
