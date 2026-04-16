/**
 * MonthGrid — 30-day mini calendar grid showing daily check-in rhythm.
 * Toggles open/closed with a simple height animation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { supabase } from '../services/supabase';
import { todayDateKey } from '../utils/today';
import { Colors } from '../constants/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MonthGridProps {
  signalerId: string;
}

interface DayCell {
  date: string; // YYYY-MM-DD
  status: 'ok' | 'missing' | 'today' | 'future';
  isToday: boolean;
}

function buildGrid(checkinDates: Set<string>): DayCell[] {
  const today = new Date();
  const todayStr = todayDateKey(today);
  const cells: DayCell[] = [];

  // Go back 29 days (30 days total including today)
  const start = new Date(today);
  start.setDate(today.getDate() - 29);

  // Align start to Monday (weekday 1)
  const startDay = start.getDay(); // 0=Sun
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  start.setDate(start.getDate() + mondayOffset);

  // Fill grid rows until we pass today
  const cursor = new Date(start);
  while (cursor <= today || cursor.getDay() !== 1) {
    const ds = todayDateKey(cursor);
    const isToday = ds === todayStr;
    const isFuture = cursor > today;

    // Days before our 30-day window are padding
    const thirtyAgo = new Date(today);
    thirtyAgo.setDate(today.getDate() - 29);
    const isPadding = cursor < thirtyAgo;

    let status: DayCell['status'];
    if (isFuture) break; // stop at today
    else if (isToday) status = checkinDates.has(ds) ? 'ok' : 'today';
    else if (isPadding) status = 'missing'; // alignment padding
    else status = checkinDates.has(ds) ? 'ok' : 'missing';

    cells.push({ date: ds, status, isToday });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

export function MonthGrid({ signalerId }: MonthGridProps) {
  const [expanded, setExpanded] = useState(false);
  const [cells, setCells] = useState<DayCell[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchMonth = useCallback(async () => {
    const today = new Date();
    const ago = new Date(today);
    ago.setDate(today.getDate() - 34); // extra days for Monday alignment

    const { data } = await supabase
      .from('daily_checkins')
      .select('local_date')
      .eq('senior_id', signalerId)
      .gte('local_date', todayDateKey(ago))
      .lte('local_date', todayDateKey(today));

    const dates = new Set((data || []).map((r: { local_date: string }) => r.local_date));
    setCells(buildGrid(dates));
    setLoaded(true);
  }, [signalerId]);

  const handleToggle = () => {
    if (!loaded) fetchMonth();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  // Refresh when expanding
  useEffect(() => {
    if (expanded && loaded) fetchMonth();
  }, [expanded]);

  // Group cells into rows of 7
  const rows: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={s.container}>
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [s.toggleBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Zwiń widok miesiąca' : 'Pokaż pełny widok miesiąca'}
        accessibilityState={{ expanded }}
      >
        <Text style={s.toggleText}>{expanded ? 'Zwiń' : 'Pokaż więcej'}</Text>
      </Pressable>

      {expanded ? (
        <View style={s.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={s.row}>
              {row.map((cell) => (
                <View
                  key={cell.date}
                  style={[
                    s.dot,
                    cell.status === 'ok' && s.dotOk,
                    cell.status === 'missing' && s.dotMissing,
                    cell.status === 'today' && s.dotToday,
                    cell.isToday && s.dotTodayBorder,
                  ]}
                />
              ))}
              {/* Pad incomplete last row */}
              {row.length < 7
                ? Array.from({ length: 7 - row.length }).map((_, i) => (
                    <View key={`pad-${i}`} style={[s.dot, s.dotPad]} />
                  ))
                : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const DOT = 9;

const s = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 8 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  toggleText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  grid: { marginTop: 8, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: Colors.border },
  dotOk: { backgroundColor: Colors.safe },
  dotMissing: { backgroundColor: Colors.borderStrong },
  dotToday: { backgroundColor: Colors.border },
  dotTodayBorder: { borderWidth: 1.5, borderColor: Colors.accent },
  dotPad: { opacity: 0 },
});
