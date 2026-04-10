import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type DayStatus = 'ok' | 'missing' | 'future';

interface WeekDotsProps {
  days: DayStatus[];
  /** Show a warm label below the dots: streak count, "Pierwszy dzień", etc. */
  showLabel?: boolean;
}

function getStreakLabel(days: DayStatus[]): string | null {
  if (days.length === 0) return null;

  const okCount = days.filter((d) => d === 'ok').length;
  if (okCount === 0) return null;
  if (okCount === 1) return 'Pierwszy dzień';

  // Count consecutive ok from the end (most recent)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i] === 'ok') streak++;
    else if (days[i] === 'future') continue;
    else break;
  }

  if (streak >= 7) return 'Cały tydzień';
  if (streak >= 2) return `${streak} dni z rzędu`;
  if (okCount <= 3) return `${okCount}. dzień`;
  return null;
}

export function WeekDots({ days, showLabel = false }: WeekDotsProps) {
  const label = showLabel ? getStreakLabel(days) : null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.map((status, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              status === 'ok' && styles.dotOk,
              status === 'missing' && styles.dotMissing,
            ]}
          />
        ))}
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
