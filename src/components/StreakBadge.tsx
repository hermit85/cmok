import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak, scale]);

  if (streak < 1) return null;

  const daysLabel = streak === 1 ? 'dzien' : 'dni';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <Text style={styles.text}>
        Seria: {streak} {daysLabel} z rzedu
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5EEFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 16,
  },
  text: {
    fontSize: 17,
    color: '#7F5BA6',
    fontWeight: '700',
  },
});
