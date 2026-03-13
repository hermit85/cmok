import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, View, Alert } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const shownMilestone = useRef(false);

  useEffect(() => {
    if (streak > 0) {
      // Entry: spring from bottom
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 15,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 10,
        }),
      ]).start();

      // Continuous gentle bounce
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: -3, duration: 1200, useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();

      // Streak >= 7: wiggle once
      if (streak >= 7 && streak < 30) {
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(wiggle, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.timing(wiggle, { toValue: -1, duration: 60, useNativeDriver: true }),
            Animated.timing(wiggle, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.timing(wiggle, { toValue: -1, duration: 60, useNativeDriver: true }),
            Animated.timing(wiggle, { toValue: 0, duration: 60, useNativeDriver: true }),
          ]).start();
        }, 800);
      }

      // Streak >= 30: golden glow pulse loop
      if (streak >= 30) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
            Animated.timing(glowPulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
          ])
        ).start();
      }

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
  }, [streak, scale, translateY, bounce, wiggle, glowPulse]);

  if (streak < 1) return null;

  const daysLabel = streak === 1 ? 'dzień' : 'dni';
  const isGold = streak >= 7;
  const isCrown = streak >= 30;

  const emoji = isCrown ? '👑' : isGold ? '🔥' : '✨';

  const wiggleRotate = wiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-3deg', '0deg', '3deg'],
  });

  const glowShadowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        isGold && styles.containerGold,
        isCrown && styles.containerCrown,
        {
          transform: [
            { scale },
            { translateY: Animated.add(translateY, bounce) },
            { rotate: wiggleRotate },
          ],
        },
      ]}
    >
      {/* Crown glow effect */}
      {isCrown && (
        <Animated.View style={[styles.crownGlow, { opacity: glowShadowOpacity }]} />
      )}
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.text, isCrown && styles.textCrown]}>
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
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.25)',
  },
  containerGold: {
    backgroundColor: 'rgba(212,165,116,0.12)',
    borderColor: '#D4A574',
    borderWidth: 1.5,
  },
  containerCrown: {
    backgroundColor: 'rgba(212,165,116,0.15)',
    borderColor: '#D4A574',
    borderWidth: 2,
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 6,
  },
  crownGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: 'rgba(212,165,116,0.1)',
  },
  emoji: {
    fontSize: 18,
  },
  text: {
    fontSize: 17,
    fontWeight: '700',
    color: '#D4A574',
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },
  textCrown: {
    color: '#F0E6D3',
  },
});
