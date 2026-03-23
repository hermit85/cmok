import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  size?: 'large' | 'medium';
  disabled?: boolean;
  style?: ViewStyle;
}

export function BigButton({
  title,
  onPress,
  color = Colors.primary,
  textColor = '#FFFFFF',
  size = 'medium',
  disabled,
  style,
}: BigButtonProps) {
  const isLarge = size === 'large';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isLarge ? styles.large : styles.medium,
        {
          backgroundColor: color,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  medium: {
    minHeight: Typography.minSeniorTouch,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  large: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  text: {
    fontSize: Typography.seniorButton,
    fontWeight: '700',
    textAlign: 'center',
  },
  largeText: {
    fontSize: Typography.seniorButton,
    fontWeight: '800',
  },
});
