import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useCarePair } from '../hooks/useCarePair';
import { useSOS } from '../hooks/useSOS';
import { supabase } from '../services/supabase';
import type { DailyCheckin, AlertCase } from '../types';

type SeniorStatus = 'ok' | 'missing' | 'sos';
type DayStatus = 'ok' | 'missing' | 'future';

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

function getLocalDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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

// ── SOS Overlay — dwuetapowy: open → acknowledged → resolve ──

function SOSOverlayView({
  alert,
  seniorName,
  callPhone,
  onAcknowledge,
  onResolve,
  onCall,
}: {
  alert: AlertCase;
  seniorName: string;
  callPhone: string;
  onAcknowledge: () => void;
  onResolve: () => void;
  onCall: () => void;
}) {
  const opacity = useRef(new Animated.Value(0.8)).current;
  const isAcknowledged = alert.state === 'acknowledged';

  useEffect(() => {
    if (!isAcknowledged) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      opacity.setValue(1);
    }
  }, [isAcknowledged, opacity]);

  const hasLocation = alert.latitude != null && alert.longitude != null;

  // ── Stan: acknowledged → pokaż potwierdzenie ──
  if (isAcknowledged) {
    return (
      <View style={[styles.sosOverlay, { backgroundColor: Colors.dangerDark }]}>
        <SafeAreaView style={styles.sosOverlayInner}>
          <View style={styles.sosContentCenter}>
            <Text style={styles.sosTitle}>Alarm potwierdzony.</Text>
            <Text style={styles.sosSubInfo}>Skontaktuj się z {seniorName}.</Text>

            {hasLocation && (
              <Text style={styles.sosCoords}>
                📍 Lokalizacja: {alert.latitude!.toFixed(4)}, {alert.longitude!.toFixed(4)}
              </Text>
            )}
          </View>

          <View style={styles.sosActions}>
            <Pressable
              onPress={onCall}
              style={({ pressed }) => [styles.acknowledgeButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.acknowledgeText}>📞 Zadzwoń do {seniorName}</Text>
            </Pressable>

            <Pressable
              onPress={onResolve}
              style={({ pressed }) => [styles.resolveButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.resolveText}>Zamknij alarm</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Stan: open → pulsujący alarm ──
  return (
    <Animated.View style={[styles.sosOverlay, { opacity }]}>
      <SafeAreaView style={styles.sosOverlayInner}>
        <View style={styles.sosContentCenter}>
          <Text style={styles.sosTitle}>🚨 {seniorName.toUpperCase()} POTRZEBUJE POMOCY!</Text>
          <Text style={styles.sosTime}>SOS o {formatTime(alert.triggered_at)}</Text>
          {hasLocation ? (
            <Text style={styles.sosCoords}>
              📍 Lokalizacja: {alert.latitude!.toFixed(4)}, {alert.longitude!.toFixed(4)}
            </Text>
          ) : (
            <Text style={styles.sosCoords}>📍 Lokalizacja niedostępna</Text>
          )}
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
  const { acknowledgeSOS, resolveSOS } = useSOS();

  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('ok');
  const [weekData, setWeekData] = useState<Array<{ day: string; status: DayStatus }>>([]);
  const [lastCheckinTime, setLastCheckinTime] = useState<string | null>(null);
  const [sosAlert, setSosAlert] = useState<AlertCase | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const targetSeniorId = seniorId || carePair?.senior_id;

  const fetchData = useCallback(async () => {
    if (!targetSeniorId) return;
    try {
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

      const { data: alerts } = await supabase
        .from('alert_cases')
        .select('*')
        .eq('senior_id', targetSeniorId)
        .in('state', ['open', 'acknowledged'])
        .order('triggered_at', { ascending: false })
        .limit(1);

      // Build week
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
          week.push({ day: dayLabel, status: 'future' });
        } else {
          week.push({ day: dayLabel, status: 'missing' });
        }
      }
      setWeekData(week);

      // Last checkin time
      const todayCheckin = (checkins || []).find((c: DailyCheckin) => c.local_date === todayStr);
      setLastCheckinTime(todayCheckin ? formatTime(todayCheckin.checked_at) : null);

      // Status
      const openSOS = alerts && alerts.length > 0 && alerts[0].type === 'sos';
      if (openSOS) {
        setSeniorStatus('sos');
        setSosAlert(alerts![0]);
      } else if (todayCheckin) {
        setSeniorStatus('ok');
        setSosAlert(null);
      } else {
        setSeniorStatus('missing');
        setSosAlert(null);
      }
    } catch (err) {
      console.error('fetchData error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [targetSeniorId]);

  useEffect(() => {
    if (targetSeniorId) fetchData();
  }, [targetSeniorId, fetchData]);

  // Realtime
  useEffect(() => {
    if (!targetSeniorId) return;

    const checkinCh = supabase
      .channel('cg-checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_checkins', filter: `senior_id=eq.${targetSeniorId}` }, () => fetchData())
      .subscribe();

    const alertCh = supabase
      .channel('cg-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_cases', filter: `senior_id=eq.${targetSeniorId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(checkinCh);
      supabase.removeChannel(alertCh);
    };
  }, [targetSeniorId, fetchData]);

  const handleCall = () => Linking.openURL(`tel:${callPhone || '+48000000000'}`);

  const handleAcknowledge = async () => {
    if (!sosAlert) return;
    try {
      await acknowledgeSOS(sosAlert.id);
      // Odśwież dane — zmieni state na acknowledged
      fetchData();
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  const handleResolve = async () => {
    if (!sosAlert) return;
    try {
      await resolveSOS(sosAlert.id);
      setSosAlert(null);
      setSeniorStatus('ok');
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  // Loading
  if (pairLoading || dataLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={[styles.headerSubtitle, { marginTop: 12 }]}>Ładowanie...</Text>
      </SafeAreaView>
    );
  }

  // SOS overlay
  if (seniorStatus === 'sos' && sosAlert) {
    return (
      <SOSOverlayView
        alert={sosAlert}
        seniorName={seniorName}
        callPhone={callPhone}
        onAcknowledge={handleAcknowledge}
        onResolve={handleResolve}
        onCall={handleCall}
      />
    );
  }

  // Normal dashboard
  const lastCheckinLabel = lastCheckinTime
    ? `Ostatni znak: dziś, ${lastCheckinTime}`
    : seniorStatus === 'missing'
      ? 'Brak znaku życia dziś'
      : 'Brak danych';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cmok</Text>
        <Text style={styles.headerSubtitle}>Twoi bliscy</Text>
      </View>

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
  container: { flex: 1, backgroundColor: Colors.screenBg },

  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: Typography.caregiverTitle, fontWeight: '700', color: Colors.accent },
  headerSubtitle: { fontSize: Typography.caregiverBody, color: Colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg, borderRadius: 16, marginHorizontal: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  seniorName: { fontSize: 24, fontWeight: '700', color: Colors.text, marginRight: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 14, fontWeight: '700' },
  lastCheckin: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  weekSection: { marginBottom: 20 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center' },
  dayDot: { width: 32, height: 32, borderRadius: 16, marginBottom: 4 },
  dayLabel: { fontSize: 12, color: Colors.textSecondary },

  callButton: { backgroundColor: Colors.accent, borderRadius: 12, minHeight: 56, justifyContent: 'center', alignItems: 'center' },
  callButtonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  // SOS Overlay
  sosOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.danger, zIndex: 100 },
  sosOverlayInner: { flex: 1, justifyContent: 'space-between' },
  sosContentCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  sosTitle: { fontSize: Typography.seniorTitle, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  sosSubInfo: { fontSize: Typography.seniorBody, color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  sosTime: { fontSize: 18, color: '#FFFFFF', marginBottom: 12 },
  sosCoords: { fontSize: 16, color: '#FFFFFF', opacity: 0.85, marginBottom: 8 },
  sosActions: { paddingHorizontal: 24, paddingBottom: 32 },
  acknowledgeButton: { backgroundColor: Colors.dangerDark, borderRadius: 16, minHeight: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  acknowledgeText: { fontSize: Typography.seniorButton, fontWeight: '800', color: '#FFFFFF' },
  resolveButton: { borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16, minHeight: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  resolveText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  sosCallLink: { minHeight: Typography.minCaregiverTouch, justifyContent: 'center', alignItems: 'center' },
  sosCallText: { fontSize: 18, color: '#FFFFFF', textDecorationLine: 'underline' },

  spacer: { flex: 1 },
});
