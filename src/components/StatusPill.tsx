import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/tokens';

type PillVariant = 'ok' | 'waiting' | 'missing' | 'alert' | 'done';

interface StatusPillProps {
  variant: PillVariant;
  label: string;
}

const VARIANT_STYLES: Record<PillVariant, { bg: string; text: string }> = {
  ok: { bg: Colors.safeLight, text: Colors.statusOkText },
  done: { bg: Colors.safeLight, text: Colors.statusOkText },
  waiting: { bg: Colors.surfaceWarm, text: Colors.textSecondary },
  missing: { bg: Colors.statusMissingBg, text: Colors.statusMissingText },
  alert: { bg: Colors.accentLight, text: Colors.accentStrong },
};

export function StatusPill({ variant, label }: StatusPillProps) {
  const vs = VARIANT_STYLES[variant];

  return (
    <View style={[styles.pill, { backgroundColor: vs.bg }]}>
      <Text style={[styles.text, { color: vs.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
