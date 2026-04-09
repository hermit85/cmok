import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type DayStatus = 'ok' | 'missing' | 'future';

interface WeekDotsProps {
  days: DayStatus[];
}

export function WeekDots({ days }: WeekDotsProps) {
  return (
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
  );
}

const DOT_SIZE = 8;

const styles = StyleSheet.create({
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
});
