import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Emoji } from './Emoji';

type DayStatus = 'ok' | 'missing' | 'future';

interface WeekDotsProps {
  days: DayStatus[];
  showLabel?: boolean;
}

function getStreakInfo(days: DayStatus[]) {
  const okCount = days.filter((d) => d === 'ok').length;
  if (okCount === 0) return { label: null, streak: 0 };
  if (okCount === 1) return { label: 'Pierwszy dzień', streak: 1 };

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i] === 'ok') streak++;
    else if (days[i] === 'future') continue;
    else break;
  }

  if (streak >= 2) return { label: `${streak} dni z rzędu`, streak };
  return { label: null, streak: 0 };
}

/* ─── Pulsing "today" dot ─── */
function TodayDot({ checkedIn }: { checkedIn: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (checkedIn) return; // no pulse if already checked in
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [checkedIn, pulse]);

  if (checkedIn) {
    // Teal filled + gold ring
    return <View style={[styles.dot, styles.dotOk, styles.dotTodayChecked]} />;
  }

  // Gold pulsing
  return (
    <Animated.View style={[styles.dot, styles.dotToday, { transform: [{ scale: pulse }] }]} />
  );
}

/* ─── Cascade bounce for full week ─── */
function CascadeDots({ days }: { days: DayStatus[] }) {
  const scales = useRef(days.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const animations = scales.map((s, i) =>
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.spring(s, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }),
      ]),
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={styles.row}>
      {days.map((status, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, styles.dotOk, { transform: [{ scale: scales[i] }] }]}
        />
      ))}
    </View>
  );
}

/* ─── Main ─── */
export function WeekDots({ days, showLabel = false }: WeekDotsProps) {
  const { label, streak } = showLabel ? getStreakInfo(days) : { label: null, streak: 0 };
  const fullWeek = days.length === 7 && days.every((d) => d === 'ok');

  return (
    <View style={styles.container}>
      {fullWeek ? (
        <CascadeDots days={days} />
      ) : (
        <View style={styles.row}>
          {days.map((status, i) => {
            const isLast = i === days.length - 1;
            const isToday = status === 'future' || (status === 'ok' && isLast);

            if (isToday) {
              return <TodayDot key={i} checkedIn={status === 'ok'} />;
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
      )}

      {fullWeek ? (
        <Text style={styles.fullWeekLabel}>Pełny tydzień! <Emoji>🎉</Emoji></Text>
      ) : label ? (
        <Text style={styles.label}>{label} <Emoji>🔥</Emoji></Text>
      ) : null}
    </View>
  );
}

const DOT = 12;

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotOk: { backgroundColor: Colors.safe },
  dotMissing: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.border },
  dotToday: { backgroundColor: Colors.highlight },
  dotTodayChecked: { borderWidth: 2, borderColor: Colors.highlight },
  fullWeekLabel: {
    fontSize: 13,
    fontFamily: Typography.headingFamily,
    color: Colors.highlight,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.headingFamilySemiBold,
    color: Colors.safe,
    marginTop: 8,
  },
});
