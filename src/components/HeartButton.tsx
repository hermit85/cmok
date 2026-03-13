import { Pressable, Text, StyleSheet } from 'react-native';

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.heart}>{sent ? '💜' : '🤍'}</Text>
      <Text style={styles.label}>
        {sent ? 'Cmok wysłany!' : 'Kliknij aby wysłać cmoka'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  disabled: {
    opacity: 0.6,
  },
  heart: {
    fontSize: 72,
  },
  label: {
    fontSize: 14,
    color: '#7F5BA6',
    marginTop: 8,
    textAlign: 'center',
  },
});
