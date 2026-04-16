import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface Props {
  /** Who gave the sign (display name) — shown in the safe copy. */
  signalerName?: string | null;
  /** HH:MM of today's check-in. */
  signedAt?: string | null;
  /** Whether the signaler has checked in today. */
  isSafe: boolean;
  /** Timestamp (ms) of the most recent successful sync with Supabase. */
  lastSyncedAt: number | null;
  /** Whether the device is offline. */
  isOffline?: boolean;
}

function formatAgo(ms: number): string {
  const seconds = Math.max(1, Math.floor(ms / 1000));
  if (seconds < 60) return 'przed chwilą';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz temu`;
  return 'dawno';
}

/**
 * Passive reassurance + sync freshness indicator. Shown on the recipient home
 * under the status circle. Teal when safe + synced, neutral when pending,
 * amber-ish when offline/stale.
 *
 * Why this exists: elderly-facing audience reads "green circle" as ambient, but
 * caregivers want confirmation the app is actively watching. One tiny line of
 * text closes the trust loop at zero cognitive cost.
 */
export function SafetyStatus({ signalerName, signedAt, isSafe, lastSyncedAt, isOffline }: Props) {
  const [, tick] = useState(0);

  // Re-render every 30s so "przed chwilą" / "3 min temu" stays accurate.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const safeLine = isSafe
    ? signalerName && signedAt
      ? `Bezpiecznie \u00B7 ${signalerName} dał${signalerName.endsWith('a') ? 'a' : ''} znak o ${signedAt}`
      : 'Bezpiecznie \u00B7 znak dotarł dziś'
    : 'Czekamy na dzisiejszy znak';

  const syncLine = isOffline
    ? 'Offline, zsynchronizujemy gdy wrócisz'
    : lastSyncedAt != null
      ? `Zaktualizowano ${formatAgo(Date.now() - lastSyncedAt)}`
      : 'Łączymy…';

  return (
    <View style={s.wrap}>
      <Text style={[s.safeLine, isSafe ? s.safeOk : s.safePending]} numberOfLines={2}>
        {safeLine}
      </Text>
      <Text style={s.syncLine} numberOfLines={1}>{syncLine}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 8, gap: 2 },
  safeLine: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyMedium,
    textAlign: 'center',
  },
  safeOk: { color: Colors.safeStrong },
  safePending: { color: Colors.textSecondary },
  syncLine: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
