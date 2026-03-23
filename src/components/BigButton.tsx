import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function BigButton({ title, onPress, color = Colors.primary, disabled, style }: BigButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color, opacity: pressed ? 0.85 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: Typography.minSeniorTouch,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  text: {
    fontSize: Typography.seniorButton,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
