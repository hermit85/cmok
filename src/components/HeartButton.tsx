import { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Pulse animation
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();

    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    onPress();
  };

  return (
    <Animated.View style={[styles.button, disabled && styles.disabled, { transform: [{ scale }], opacity }]}>
      <Pressable onPress={handlePress} disabled={disabled} style={styles.inner}>
        <Text style={styles.heart}>{sent ? '\uD83D\uDC9C' : '\uD83E\uDD0D'}</Text>
        <Text style={styles.label}>
          {sent ? 'Cmok wyslany!' : 'Kliknij aby wyslac cmoka'}
        </Text>
      </Pressable>
    </Animated.View>
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
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heart: {
    fontSize: 80,
  },
  label: {
    fontSize: 14,
    color: '#7F5BA6',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
});
