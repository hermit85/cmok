import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type DayStatus = 'ok' | 'missing' | 'future';

interface MonthGridProps {
  days: DayStatus[];
}

export function MonthGrid({ days }: MonthGridProps) {
  if (days.length === 0) return null;

  // Build rows of 7
  const rows: DayStatus[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  const isToday = (index: number) => index === days.length - 1;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Ostatni miesiąc</Text>
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((status, ci) => {
              const flatIndex = ri * 7 + ci;
              return (
                <View
                  key={ci}
                  style={[
                    styles.dot,
                    status === 'ok' && styles.dotOk,
                    status === 'missing' && styles.dotMissing,
                    isToday(flatIndex) && styles.dotToday,
                  ]}
                />
              );
            })}
            {/* Pad last row with empty spaces */}
            {row.length < 7
              ? Array.from({ length: 7 - row.length }).map((_, pi) => (
                  <View key={`pad-${pi}`} style={styles.dotEmpty} />
                ))
              : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
  },
  header: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 10,
  },
  grid: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: '#E6DDD4',
  },
  dotOk: {
    backgroundColor: Colors.safe,
  },
  dotMissing: {
    backgroundColor: '#DDD5CC',
  },
  dotToday: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  dotEmpty: {
    width: DOT,
    height: DOT,
  },
});
