import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Radius, Spacing } from '../constants/tokens';
import type { SupportParticipant } from '../types';

interface SupportParticipantsProps {
  participants: SupportParticipant[];
}

function deliveryLabel(status: SupportParticipant['deliveryStatus']): string {
  if (status === 'sent') return 'dostał/a';
  if (status === 'failed') return 'nie dotarło';
  return 'czeka';
}

function deliveryColor(status: SupportParticipant['deliveryStatus']): string {
  if (status === 'sent') return Colors.statusOkText;
  if (status === 'failed') return Colors.statusMissingText;
  return Colors.textMuted;
}

export function SupportParticipants({ participants }: SupportParticipantsProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Kto wie</Text>
      {participants.map((p) => (
        <View key={p.userId} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.name}>{p.name}</Text>
          </View>
          <Text style={[styles.status, { color: deliveryColor(p.deliveryStatus) }]}>
            {deliveryLabel(p.deliveryStatus)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.card,
    marginBottom: Spacing.sectionGap,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 14,
  },
  meta: {
    flex: 1,
    paddingRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  status: {
    fontSize: 13,
    textAlign: 'right',
  },
});
