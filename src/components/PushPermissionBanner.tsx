import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { usePushPermission } from '../hooks/usePushPermission';
import { haptics } from '../utils/haptics';

interface Props {
  /** Optional role-aware copy. Defaults are neutral. */
  role?: 'signaler' | 'recipient' | 'trusted';
}

/**
 * Warm, non-alarming banner shown when notifications are off. Without it the
 * app silently fails to deliver check-ins / urgent signals, and users have no
 * way to know. Styled to match the cream + teal palette (not alarm red).
 */
export function PushPermissionBanner({ role }: Props) {
  const { status, openSettings } = usePushPermission();

  if (status === 'granted' || status === 'unsupported' || status === 'undetermined') {
    return null;
  }

  const line = role === 'recipient'
    ? 'Bez powiadomień nie damy Ci znać, gdy bliska osoba da znak.'
    : role === 'trusted'
      ? 'Bez powiadomień nie damy Ci znać, gdy krąg będzie potrzebował pomocy.'
      : 'Bez powiadomień nie damy znać bliskim, że u Ciebie wszystko w porządku.';

  return (
    <Pressable
      onPress={() => { haptics.light(); openSettings(); }}
      style={({ pressed }) => [s.wrap, pressed && { opacity: 0.88 }]}
      accessibilityRole="button"
      accessibilityLabel="Otwórz ustawienia żeby włączyć powiadomienia"
    >
      <View style={s.dot} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Powiadomienia są wyłączone</Text>
        <Text style={s.body}>{line}</Text>
      </View>
      <Text style={s.cta}>Włącz</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.highlight,
  },
  title: {
    fontSize: 14,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.text,
  },
  body: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  cta: {
    fontSize: 13,
    fontFamily: Typography.headingFamilySemiBold,
    color: Colors.accent,
  },
});
