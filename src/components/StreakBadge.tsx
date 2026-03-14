import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Alert } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const shownMilestone = useRef(false);

  useEffect(() => {
    if (streak > 0) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 12,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
      ]).start();

      // Easter egg milestones
      if (!shownMilestone.current) {
        if (streak === 7) {
          shownMilestone.current = true;
          setTimeout(() => Alert.alert('🔥', 'Tydzień miłości! Tak trzymać! 💪'), 500);
        } else if (streak === 30) {
          shownMilestone.current = true;
          setTimeout(() => Alert.alert('👑', 'Mistrz rodzinnych cmoków!'), 500);
        }
      }
    }
  }, [streak, scale, translateY]);

  if (streak < 1) return null;

  const daysLabel = streak === 1 ? 'dzień' : 'dni';
  const emoji = streak >= 30 ? '👑' : streak >= 7 ? '🔥' : '✨';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale }, { translateY }] },
      ]}
    >
      <Text style={styles.text}>
        {emoji} {streak} {daysLabel} z rzędu! {emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4A373',
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
  },
});
