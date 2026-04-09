import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

type ButtonVariant = 'solid' | 'outline' | 'soft';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  size?: 'large' | 'medium';
  variant?: ButtonVariant;
  elevation?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
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
}: BigButtonProps) {
  const isLarge = size === 'large';

  // Resolve colors by variant
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
    bgColor = color + '1F'; // ~12% opacity hex
    resolvedTextColor = textColor || color;
  } else {
    // solid
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
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isLarge ? styles.large : styles.medium,
        {
          backgroundColor: bgColor,
          borderWidth,
          borderColor,
        },
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
        ]}
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
  largeText: {
    fontSize: Typography.heading,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: 0,
  },
});
