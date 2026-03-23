import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

type SeniorStatus = 'ok' | 'missing' | 'sos';

// Hardcoded 7-day history: 'ok' | 'missing' | 'future'
const WEEK_DATA: Array<{ day: string; status: 'ok' | 'missing' | 'future' }> = [
  { day: 'Pn', status: 'ok' },
  { day: 'Wt', status: 'ok' },
  { day: 'Śr', status: 'ok' },
  { day: 'Cz', status: 'ok' },
  { day: 'Pt', status: 'ok' },
  { day: 'So', status: 'missing' },
  { day: 'Nd', status: 'future' },
];

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
  // SOS — pulsujące
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

function WeekDots() {
  return (
    <View style={styles.weekRow}>
      {WEEK_DATA.map((item, i) => {
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
  onAcknowledge,
  onCall,
}: {
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
          <Text style={styles.sosTitle}>🚨 MAMA POTRZEBUJE POMOCY!</Text>
          <Text style={styles.sosTime}>SOS o 14:32</Text>
          <Text style={styles.sosLocation}>📍 Lokalizacja została wysłana</Text>
        </View>

        <View style={styles.sosActions}>
          <Pressable
            onPress={onAcknowledge}
            style={({ pressed }) => [
              styles.acknowledgeButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.acknowledgeText}>Już działam!</Text>
          </Pressable>

          <Pressable onPress={onCall} style={styles.sosCallLink}>
            <Text style={styles.sosCallText}>Zadzwoń do Mamy</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

export function CaregiverDashboardScreen() {
  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('ok');

  const cycleStatus = () => {
    setSeniorStatus((prev) => {
      if (prev === 'ok') return 'missing';
      if (prev === 'missing') return 'sos';
      return 'ok';
    });
  };

  const handleCall = () => {
    Linking.openURL('tel:+48000000000');
  };

  // ── SOS overlay ──
  if (seniorStatus === 'sos') {
    return (
      <SOSOverlay
        onAcknowledge={() => setSeniorStatus('ok')}
        onCall={handleCall}
      />
    );
  }

  // ── Normalny dashboard ──
  return (
    <SafeAreaView style={styles.container}>
      {/* Nagłówek */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cmok</Text>
        <Text style={styles.headerSubtitle}>Twoi bliscy</Text>
      </View>

      {/* Karta seniora */}
      <View style={styles.card}>
        {/* Górna część — imię + status */}
        <View style={styles.cardTop}>
          <Text style={styles.seniorName}>Mama</Text>
          <StatusBadge status={seniorStatus} />
        </View>
        <Text style={styles.lastCheckin}>Ostatni znak: dziś, 8:32</Text>

        {/* Historia 7 dni */}
        <View style={styles.weekSection}>
          <WeekDots />
        </View>

        {/* Przycisk dzwoń */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            styles.callButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.callButtonText}>📞 Zadzwoń do Mamy</Text>
        </Pressable>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* DEV: przełącznik statusu */}
      <Pressable onPress={cycleStatus} style={styles.devButton}>
        <Text style={styles.devText}>
          [DEV] Przełącz status: {seniorStatus} → {seniorStatus === 'ok' ? 'missing' : seniorStatus === 'missing' ? 'sos' : 'ok'}
        </Text>
      </Pressable>
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
  devButton: {
    minHeight: Typography.minCaregiverTouch,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  devText: {
    fontSize: 12,
    color: Colors.disabled,
    textAlign: 'center',
  },
});
