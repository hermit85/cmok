import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../constants/colors';

type DayStatus = 'ok' | 'missing' | 'future';

interface WeekDotsProps {
  days: DayStatus[];
  /** Show a warm label below the dots when checked in today. */
  showLabel?: boolean;
}

function getLabel(days: DayStatus[]): string | null {
  if (days.length === 0) return null;

  const okCount = days.filter((d) => d === 'ok').length;
  if (okCount === 0) return null;

  if (okCount === 7) return 'Pełny tydzień 💚';

  // Consecutive streak from the end
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i] === 'ok') streak++;
    else if (days[i] === 'future') continue;
    else break;
  }

  if (streak >= 2) return `${streak} dni z rzędu`;
  if (okCount === 1) return 'Pierwszy dzień';
  return null;
}

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scale]);

  return (
    <Animated.View style={[styles.dot, styles.dotOk, { transform: [{ scale }] }]} />
  );
}

export function WeekDots({ days, showLabel = false }: WeekDotsProps) {
  const label = showLabel ? getLabel(days) : null;
  const isPerfectWeek = days.length === 7 && days.every((d) => d === 'ok');

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.map((status, i) => {
          // Pulse the last dot on a perfect week
          if (isPerfectWeek && i === days.length - 1) {
            return <PulseDot key={i} />;
          }
          return (
            <View
              key={i}
              style={[
                styles.dot,
                status === 'ok' && styles.dotOk,
                status === 'missing' && styles.dotMissing,
              ]}
            />
          );
        })}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const DOT_SIZE = 8;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#E6DDD4',
  },
  dotOk: {
    backgroundColor: Colors.safe,
  },
  dotMissing: {
    backgroundColor: '#DDD5CC',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 6,
  },
});
