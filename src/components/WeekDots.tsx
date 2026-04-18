import { useEffect, useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

type DayStatus = 'ok' | 'missing' | 'future';

/** Fixed Mon→Sun order matching useWeekRhythm's calendar week. */
const DAY_LABELS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'] as const;
const DAY_LABELS_FULL_PL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'] as const;

function a11yLabelFor(fullDay: string, status: DayStatus, isToday: boolean, todayCheckedIn: boolean): string {
  if (isToday) return todayCheckedIn ? 'Dzisiaj, znak wysłany' : 'Dzisiaj, czekamy na znak';
  if (status === 'future') return `${fullDay}, jeszcze nie nadszedł`;
  if (status === 'ok') return `${fullDay}, znak był`;
  return `${fullDay}, brak znaku`;
}

interface WeekDotsProps {
  days: DayStatus[];
  showLabel?: boolean;
}

function getStreakInfo(days: DayStatus[]) {
  const okCount = days.filter((d) => d === 'ok').length;
  if (okCount === 0) return { label: null, streak: 0 };
  if (okCount === 1) return { label: 'Pierwszy dzień', streak: 1 };

  // Count consecutive 'ok' backwards from today (not from array end)
  const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
  let streak = 0;
  for (let i = todayIndex; i >= 0; i--) {
    if (days[i] === 'ok') streak++;
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
function CascadeDots({ days, dayLabels }: { days: DayStatus[]; dayLabels: string[] }) {
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
    <View style={styles.row} accessibilityLabel="Pełny tydzień, wszystkie znaki wysłane">
      {days.map((_, i) => (
        <View key={i} style={styles.dayColumn}>
          <Text style={styles.dayLabel}>{dayLabels[i]}</Text>
          <Animated.View
            style={[styles.dot, styles.dotOk, { transform: [{ scale: scales[i] }] }]}
          />
        </View>
      ))}
    </View>
  );
}

/* ─── Main ─── */
function WeekDotsImpl({ days, showLabel = false }: WeekDotsProps) {
  const { label } = showLabel ? getStreakInfo(days) : { label: null };
  const fullWeek = days.length === 7 && days.every((d) => d === 'ok');

  // Labels are fixed Pn→Nd, matching useWeekRhythm calendar week
  const dayLabels = useMemo(() => {
    return days.map((_, i) => DAY_LABELS_PL[i] ?? '');
  }, [days.length]);

  return (
    <View style={styles.container}>
      {fullWeek ? (
        <CascadeDots days={days} dayLabels={dayLabels} />
      ) : (
        <View style={styles.row}>
          {days.map((status, i) => {
            // Today = the index matching current day-of-week in Mon→Sun array
            const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0, Sun=6
            const isToday = i === todayIndex;
            // Show checked-in today as teal+gold, pending today as gold pulse
            const todayCheckedIn = isToday && status === 'ok';

            const fullDay = DAY_LABELS_FULL_PL[i] ?? dayLabels[i];
            const a11y = a11yLabelFor(fullDay, status, isToday, todayCheckedIn);
            return (
              <View
                key={i}
                style={styles.dayColumn}
                accessible
                accessibilityLabel={a11y}
              >
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {dayLabels[i]}
                </Text>
                {isToday ? (
                  <TodayDot checkedIn={todayCheckedIn} />
                ) : status === 'future' ? (
                  <View style={[styles.dot, styles.dotFuture]} />
                ) : (
                  <View
                    style={[
                      styles.dot,
                      status === 'ok' && styles.dotOk,
                      status === 'missing' && styles.dotMissing,
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {fullWeek ? (
        <Text style={styles.fullWeekLabel}>Pełny tydzień!</Text>
      ) : label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}
    </View>
  );
}

/**
 * Memoised — days array is often a stable reference from useWeekRhythm
 * so re-renders of the parent home screen (e.g. on every reaction tap)
 * don't re-render 7 day columns + a pulsing today-dot animation.
 * Custom comparator: shallow-compare the days array element-by-element.
 */
export const WeekDots = memo(WeekDotsImpl, (prev, next) => {
  if (prev.showLabel !== next.showLabel) return false;
  if (prev.days.length !== next.days.length) return false;
  for (let i = 0; i < prev.days.length; i++) {
    if (prev.days[i] !== next.days[i]) return false;
  }
  return true;
});

const DOT = 12;
const COL_WIDTH = 28;

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dayColumn: { width: COL_WIDTH, alignItems: 'center' },
  dayLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  dayLabelToday: { color: Colors.text },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotOk: { backgroundColor: Colors.safe },
  dotMissing: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.borderStrong },
  dotFuture: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border, opacity: 0.4 },
  dotToday: { backgroundColor: Colors.highlight },
  dotTodayChecked: { borderWidth: 2, borderColor: Colors.highlight },
  fullWeekLabel: {
    fontSize: 13,
    fontFamily: Typography.headingFamilySemiBold,
    color: Colors.safe,
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.headingFamilySemiBold,
    color: Colors.safe,
    marginTop: 6,
  },
});
