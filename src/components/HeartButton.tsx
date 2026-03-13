import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Pulse animation
    scale.value = withSequence(
      withSpring(1.2, { damping: 4, stiffness: 300 }),
      withSpring(0.9, { damping: 4, stiffness: 300 }),
      withSpring(1.05, { damping: 6, stiffness: 200 }),
      withSpring(1, { damping: 8, stiffness: 200 })
    );

    opacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withTiming(1, { duration: 200 })
    );

    onPress();
  };

  return (
    <AnimatedPressable
      style={[styles.button, disabled && styles.disabled, animatedStyle]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Text style={styles.heart}>{sent ? '💜' : '🤍'}</Text>
      <Text style={styles.label}>
        {sent ? 'Cmok wyslany!' : 'Kliknij aby wyslac cmoka'}
      </Text>
    </AnimatedPressable>
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
