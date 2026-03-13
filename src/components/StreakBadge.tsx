import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (streak > 0) {
      // Entry bounce
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 15,
      }).start();

      // Continuous gentle bounce
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: -4, duration: 1000, useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak, scale, bounce]);

  if (streak < 1) return null;

  const daysLabel = streak === 1 ? 'dzień' : 'dni';
  const isGold = streak > 7;
  const isCrown = streak > 30;

  const emoji = isCrown ? '👑' : isGold ? '🔥' : '✨';
  const bgColor = isCrown ? '#FFF8E1' : isGold ? '#FFF3E0' : '#F5EEFF';
  const textColor = isCrown ? '#F9A825' : isGold ? '#FF6D00' : '#7F5BA6';
  const borderColor = isCrown ? '#FFD54F' : isGold ? '#FFAB40' : 'transparent';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: isGold ? 2 : 0,
          transform: [{ scale }, { translateY: bounce }],
        },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.text, { color: textColor }]}>
        {streak} {daysLabel} z rzędu!
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
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emoji: {
    fontSize: 18,
  },
  text: {
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },
});
