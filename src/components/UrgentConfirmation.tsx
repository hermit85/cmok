import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface UrgentConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  circleCount?: number;
}

export function UrgentConfirmation({ visible, onConfirm, onCancel, circleCount = 0 }: UrgentConfirmationProps) {
  const peopleText = circleCount > 1 ? `${circleCount} osób` : circleCount === 1 ? '1 osoba' : 'Twoi bliscy';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title} maxFontSizeMultiplier={1.3}>
            Potrzebujesz pomocy?
          </Text>

          <View style={s.infoList}>
            <Text style={s.infoItem}>
              {peopleText} z Twojego kręgu dostanie powiadomienie
            </Text>
            <Text style={s.infoItem}>
              Twoja lokalizacja zostanie dołączona
            </Text>
            <Text style={s.infoItem}>
              Ktoś z kręgu potwierdzi, że się zajmuje
            </Text>
          </View>

          <Pressable onPress={onConfirm} style={({ pressed }) => [s.confirmBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
            <Text style={s.confirmText}>Wyślij sygnał</Text>
          </Pressable>

          <Pressable onPress={onCancel} style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.6 }]}>
            <Text style={s.cancelText}>Nie, wszystko OK</Text>
          </Pressable>

          <Text style={s.disclaimer}>cmok nie zastępuje numeru 112 ani służb ratunkowych. W sytuacji zagrożenia życia lub zdrowia skontaktuj się z odpowiednimi służbami.</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(45, 41, 38, 0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%', maxWidth: 340,
  },
  title: {
    fontSize: 22, fontFamily: Typography.headingFamily, color: Colors.text,
    textAlign: 'center', marginBottom: 20,
  },
  infoList: { alignSelf: 'stretch', marginBottom: 24 },
  infoItem: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 22,
    paddingLeft: 12, marginBottom: 8,
  },
  confirmBtn: {
    backgroundColor: Colors.accent, borderRadius: 18, minHeight: 56,
    paddingHorizontal: 48, minWidth: 200, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 20,
  },
  confirmText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  cancelBtn: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  cancelText: { fontSize: 16, color: Colors.textSecondary },
  disclaimer: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 16, lineHeight: 14, paddingHorizontal: 8 },
});
