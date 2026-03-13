import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, View, Alert } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const shownMilestone = useRef(false);

  useEffect(() => {
    if (streak > 0) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 15,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: -3, duration: 1200, useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();

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
  }, [streak, scale, bounce]);

  if (streak < 1) return null;

  const daysLabel = streak === 1 ? 'dzień' : 'dni';
  const isGold = streak > 7;
  const isCrown = streak > 30;

  const emoji = isCrown ? '👑' : isGold ? '🔥' : '✦';

  return (
    <Animated.View
      style={[
        styles.container,
        isGold && styles.containerGold,
        isCrown && styles.containerCrown,
        { transform: [{ scale }, { translateY: bounce }] },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.text}>
        {streak} {daysLabel} z rzędu
      </Text>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 16,
    backgroundColor: 'rgba(212,165,116,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.3)',
  },
  containerGold: {
    backgroundColor: 'rgba(212,165,116,0.15)',
    borderColor: '#D4A574',
    borderWidth: 1.5,
  },
  containerCrown: {
    backgroundColor: 'rgba(212,165,116,0.2)',
    borderColor: '#D4A574',
    borderWidth: 2,
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  emoji: {
    fontSize: 16,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D4A574',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
});
