import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radii } from '@/src/theme';

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = radii.md,
  style,
}: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton that resembles a typical card. */
export function SkeletonCard() {
  return (
    <View style={skeletonCardStyles.card}>
      <SkeletonBox width="45%" height={12} />
      <SkeletonBox width="100%" height={18} />
      <SkeletonBox width="72%" height={14} />
    </View>
  );
}

const skeletonCardStyles = StyleSheet.create({
  card: {
    borderRadius: radii.xxxl,
    backgroundColor: colors.cardBg,
    padding: 20,
    gap: 14,
  },
});
