import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius } from '../constants/tokens';
import { haptics } from '../utils/haptics';

type ButtonVariant = 'solid' | 'outline' | 'soft';
type ButtonSize = 'small' | 'medium' | 'large';
type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'none';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  elevation?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  /** Haptic played on press. Defaults to 'light'. Pass 'none' to opt out. */
  haptic?: HapticKind;
}

export function BigButton({
  title,
  onPress,
  color = Colors.accent,
  textColor,
  size = 'medium',
  variant = 'solid',
  elevation = false,
  disabled,
  style,
  haptic = 'light',
}: BigButtonProps) {
  const handlePress = () => {
    if (disabled) return;
    if (haptic !== 'none') haptics[haptic]();
    onPress();
  };

  const isLarge = size === 'large';
  const isSmall = size === 'small';

  let bgColor: string;
  let resolvedTextColor: string;
  let borderWidth = 0;
  let borderColor = 'transparent';

  if (disabled) {
    bgColor = Colors.surface;
    resolvedTextColor = Colors.textMuted;
    borderWidth = 1;
    borderColor = Colors.border;
  } else if (variant === 'outline') {
    bgColor = 'transparent';
    resolvedTextColor = textColor || color;
    borderWidth = 1.5;
    borderColor = color;
  } else if (variant === 'soft') {
    bgColor = color + '1F';
    resolvedTextColor = textColor || color;
  } else {
    bgColor = color;
    resolvedTextColor = textColor || '#FFFFFF';
  }

  const elevationStyle = elevation ? {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  } : {};

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isLarge ? styles.large : isSmall ? styles.small : styles.medium,
        { backgroundColor: bgColor, borderWidth, borderColor },
        elevationStyle,
        style as ViewStyle,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: resolvedTextColor },
          isLarge && styles.largeText,
          isSmall && styles.smallText,
        ]}
        maxFontSizeMultiplier={1.3}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  small: {
    minHeight: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: 20,
  },
  medium: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 28,
  },
  large: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  text: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  smallText: {
    fontSize: 14,
    fontFamily: Typography.fontFamilyMedium,
  },
  largeText: {
    fontSize: Typography.heading,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: 0,
  },
});
