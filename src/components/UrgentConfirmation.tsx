import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Emoji } from './Emoji';

interface UrgentConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  circleCount?: number;
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <Emoji style={s.infoIconEmoji}>{icon}</Emoji>
      </View>
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

export function UrgentConfirmation({ visible, onConfirm, onCancel, circleCount = 0 }: UrgentConfirmationProps) {
  const peopleText = circleCount > 1 ? `${circleCount} osób z kręgu` : circleCount === 1 ? '1 osoba z kręgu' : 'Krąg bliskich';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Heart icon */}
          <View style={s.heroIcon}>
            <Emoji style={s.heroIconEmoji}>{'\u{1F49A}'}</Emoji>
          </View>

          <Text style={s.title} maxFontSizeMultiplier={1.3}>
            Potrzebujesz pomocy?
          </Text>

          <Text style={s.subtitle}>
            Damy znać bliskim, że coś się dzieje
          </Text>

          <View style={s.infoList}>
            <InfoRow icon={'\u{1F514}'} text={`${peopleText} dostanie powiadomienie`} />
            <InfoRow icon={'\u{1F4CD}'} text="Twoja lokalizacja zostanie dołączona" />
            <InfoRow icon={'\u{1F91D}'} text="Ktoś z kręgu potwierdzi, że się zajmuje" />
          </View>

          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [s.confirmBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Wyślij sygnał do kręgu bliskich"
          >
            <Text style={s.confirmText}>Wyślij sygnał</Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Anuluj, wszystko w porządku"
          >
            <Text style={s.cancelText}>Nie, wszystko OK</Text>
          </Pressable>

          <View style={s.disclaimerBox}>
            <Text style={s.disclaimer}>
              cmok nie zastępuje numeru 112. W sytuacji zagrożenia życia skontaktuj się ze służbami ratunkowymi.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    backgroundColor: Colors.background, borderRadius: 28, padding: 24,
    alignItems: 'center', width: '100%', maxWidth: 360,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 10,
  },

  /* hero */
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.safeLight,
    justifyContent: 'center' as const, alignItems: 'center' as const,
    marginBottom: 16,
  },
  heroIconEmoji: { fontSize: 32 },

  title: {
    fontSize: 24, fontFamily: Typography.headingFamily, color: Colors.text,
    textAlign: 'center', marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    marginBottom: 20,
  },

  /* info list */
  infoList: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  infoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  infoIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.cardStrong,
    justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  infoIconEmoji: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.text, fontFamily: Typography.fontFamilyMedium },

  /* buttons */
  confirmBtn: {
    backgroundColor: Colors.accent, borderRadius: 18, height: 56,
    alignSelf: 'stretch',
    justifyContent: 'center' as const, alignItems: 'center' as const,
    marginBottom: 8,
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  confirmText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  cancelBtn: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 32 },
  cancelText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },

  /* disclaimer */
  disclaimerBox: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    alignSelf: 'stretch',
  },
  disclaimer: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center' as const,
    lineHeight: 16,
  },
});
