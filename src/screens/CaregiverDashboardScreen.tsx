import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useCarePair } from '../hooks/useCarePair';
import { supabase } from '../services/supabase';
import type { DailyCheckin, AlertCase } from '../types';

type SeniorStatus = 'ok' | 'missing' | 'sos';
type DayStatus = 'ok' | 'missing' | 'future';

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

function getLocalDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatCheckinTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Sub-components ──

function StatusBadge({ status }: { status: SeniorStatus }) {
  if (status === 'ok') {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.statusOkBg }]}>
        <Text style={[styles.badgeText, { color: Colors.statusOkText }]}>✔ OK dziś</Text>
      </View>
    );
  }
  if (status === 'missing') {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.statusMissingBg }]}>
        <Text style={[styles.badgeText, { color: Colors.statusMissingText }]}>⚠ Brak znaku</Text>
      </View>
    );
  }
  return <PulsingSOSBadge />;
}

function PulsingSOSBadge() {
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.8, duration: 500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.badge, { backgroundColor: Colors.danger, opacity }]}>
      <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>🚨 SOS ALARM</Text>
    </Animated.View>
  );
}

function WeekDots({ weekData }: { weekData: Array<{ day: string; status: DayStatus }> }) {
  return (
    <View style={styles.weekRow}>
      {weekData.map((item, i) => {
        let bg = Colors.disabled;
        if (item.status === 'ok') bg = Colors.primary;
        if (item.status === 'missing') bg = Colors.danger;

        return (
          <View key={i} style={styles.dayColumn}>
            <View style={[styles.dayDot, { backgroundColor: bg }]} />
            <Text style={styles.dayLabel}>{item.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SOSOverlay({
  seniorName,
  sosTime,
  onAcknowledge,
  onCall,
}: {
  seniorName: string;
  sosTime: string;
  onAcknowledge: () => void;
  onCall: () => void;
}) {
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.sosOverlay, { opacity }]}>
      <SafeAreaView style={styles.sosOverlayInner}>
        <View style={styles.sosContent}>
          <Text style={styles.sosTitle}>🚨 {seniorName.toUpperCase()} POTRZEBUJE POMOCY!</Text>
          <Text style={styles.sosTime}>SOS o {sosTime}</Text>
          <Text style={styles.sosLocation}>📍 Lokalizacja została wysłana</Text>
        </View>

        <View style={styles.sosActions}>
          <Pressable
            onPress={onAcknowledge}
            style={({ pressed }) => [styles.acknowledgeButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.acknowledgeText}>Już działam!</Text>
          </Pressable>

          <Pressable onPress={onCall} style={styles.sosCallLink}>
            <Text style={styles.sosCallText}>Zadzwoń do {seniorName}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Main component ──

export function CaregiverDashboardScreen() {
  const { carePair, seniorName, seniorId, callPhone, loading: pairLoading } = useCarePair();

  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('ok');
  const [weekData, setWeekData] = useState<Array<{ day: string; status: DayStatus }>>([]);
  const [lastCheckinTime, setLastCheckinTime] = useState<string | null>(null);
  const [sosAlert, setSosAlert] = useState<AlertCase | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const targetSeniorId = seniorId || carePair?.senior_id;

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!targetSeniorId) return;

    try {
      // Pobierz check-iny z ostatnich 7 dni
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);

      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('senior_id', targetSeniorId)
        .gte('local_date', getLocalDate(sevenDaysAgo))
        .lte('local_date', getLocalDate(today))
        .order('local_date', { ascending: true });

      // Pobierz otwarte alerty
      const { data: alerts } = await supabase
        .from('alert_cases')
        .select('*')
        .eq('senior_id', targetSeniorId)
        .eq('state', 'open')
        .order('triggered_at', { ascending: false })
        .limit(1);

      // Zbuduj historię tygodnia
      const checkinDates = new Set((checkins || []).map((c: DailyCheckin) => c.local_date));
      const todayStr = getLocalDate(today);
      const week: Array<{ day: string; status: DayStatus }> = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = getLocalDate(d);
        const dayLabel = DAY_LABELS[d.getDay()];

        if (dateStr > todayStr) {
          week.push({ day: dayLabel, status: 'future' });
        } else if (checkinDates.has(dateStr)) {
          week.push({ day: dayLabel, status: 'ok' });
        } else if (dateStr === todayStr) {
          // Dziś — jeszcze nie wiemy (szary)
          week.push({ day: dayLabel, status: 'future' });
        } else {
          week.push({ day: dayLabel, status: 'missing' });
        }
      }

      setWeekData(week);

      // Ostatni check-in
      const todayCheckin = (checkins || []).find((c: DailyCheckin) => c.local_date === todayStr);
      if (todayCheckin) {
        setLastCheckinTime(formatCheckinTime(todayCheckin.checked_at));
      } else if (checkins && checkins.length > 0) {
        const last = checkins[checkins.length - 1];
        setLastCheckinTime(null); // nie dziś
      } else {
        setLastCheckinTime(null);
      }

      // Ustal status
      const hasOpenSOS = alerts && alerts.length > 0 && alerts[0].type === 'sos';
      if (hasOpenSOS) {
        setSeniorStatus('sos');
        setSosAlert(alerts![0]);
      } else if (todayCheckin) {
        setSeniorStatus('ok');
        setSosAlert(null);
      } else {
        setSeniorStatus('missing');
        setSosAlert(null);
      }

      // Jeśli dziś jest check-in, zaktualizuj czas
      if (todayCheckin) {
        setLastCheckinTime(formatCheckinTime(todayCheckin.checked_at));
      }
    } catch (err) {
      console.error('CaregiverDashboard fetchData error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [targetSeniorId]);

  // ── Initial fetch ──
  useEffect(() => {
    if (targetSeniorId) {
      fetchData();
    }
  }, [targetSeniorId, fetchData]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    if (!targetSeniorId) return;

    const checkinChannel = supabase
      .channel('checkins-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_checkins',
          filter: `senior_id=eq.${targetSeniorId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const alertChannel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alert_cases',
          filter: `senior_id=eq.${targetSeniorId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checkinChannel);
      supabase.removeChannel(alertChannel);
    };
  }, [targetSeniorId, fetchData]);

  const handleCall = () => {
    Linking.openURL(`tel:${callPhone || '+48000000000'}`);
  };

  const handleAcknowledgeSOS = async () => {
    if (!sosAlert) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('alert_cases')
        .update({
          state: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', sosAlert.id);

      setSeniorStatus('ok');
      setSosAlert(null);
    } catch (err) {
      console.error('Acknowledge SOS error:', err);
    }
  };

  // ── Loading ──
  if (pairLoading || dataLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.headerSubtitle, { marginTop: 12 }]}>Ładowanie...</Text>
      </SafeAreaView>
    );
  }

  // ── SOS overlay ──
  if (seniorStatus === 'sos' && sosAlert) {
    return (
      <SOSOverlay
        seniorName={seniorName}
        sosTime={formatCheckinTime(sosAlert.triggered_at)}
        onAcknowledge={handleAcknowledgeSOS}
        onCall={handleCall}
      />
    );
  }

  // ── Normalny dashboard ──
  const lastCheckinLabel = lastCheckinTime
    ? `Ostatni znak: dziś, ${lastCheckinTime}`
    : seniorStatus === 'missing'
      ? 'Brak znaku życia dziś'
      : 'Brak danych';

  return (
    <SafeAreaView style={styles.container}>
      {/* Nagłówek */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cmok</Text>
        <Text style={styles.headerSubtitle}>Twoi bliscy</Text>
      </View>

      {/* Karta seniora */}
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.seniorName}>{seniorName}</Text>
          <StatusBadge status={seniorStatus} />
        </View>
        <Text style={styles.lastCheckin}>{lastCheckinLabel}</Text>

        <View style={styles.weekSection}>
          <WeekDots weekData={weekData} />
        </View>

        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [styles.callButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.callButtonText}>📞 Zadzwoń do {seniorName}</Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },

  // ── Nagłówek ──
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: Typography.caregiverTitle,
    fontWeight: '700',
    color: Colors.accent,
  },
  headerSubtitle: {
    fontSize: Typography.caregiverBody,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ── Karta seniora ──
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  seniorName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  lastCheckin: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },

  // ── Historia tygodnia ──
  weekSection: {
    marginBottom: 20,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
  },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ── Przycisk dzwoń ──
  callButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── SOS Overlay ──
  sosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.danger,
    zIndex: 100,
  },
  sosOverlayInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sosContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sosTitle: {
    fontSize: Typography.seniorTitle,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  sosTime: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sosLocation: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  sosActions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  acknowledgeButton: {
    backgroundColor: Colors.dangerDark,
    borderRadius: 16,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  acknowledgeText: {
    fontSize: Typography.seniorButton,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sosCallLink: {
    minHeight: Typography.minCaregiverTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosCallText: {
    fontSize: 18,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },

  // ── Misc ──
  spacer: {
    flex: 1,
  },
});
