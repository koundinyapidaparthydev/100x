import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors } from './ui';

const MARK = require('../assets/brand/aai-mark.png');

type BrandLogoProps = {
  /** Icon size in px (square). */
  size?: number;
  /** Show “100x” wordmark beside or below the mark. */
  withWordmark?: boolean;
  /** Stack mark above wordmark (splash/login heroes). */
  stacked?: boolean;
  wordmarkStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

/** Official 100x logo: AAI company mark (+ optional wordmark). */
export function BrandLogo({
  size = 32,
  withWordmark = false,
  stacked = false,
  wordmarkStyle,
  style,
}: BrandLogoProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="100x"
      style={[stacked ? styles.stacked : styles.row, style]}
    >
      <Image
        source={MARK}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
      />
      {withWordmark ? (
        <Text style={[stacked ? styles.wordmarkHero : styles.wordmarkInline, wordmarkStyle]}>
          100x
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { alignItems: 'center', gap: 12 },
  wordmarkInline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  wordmarkHero: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
