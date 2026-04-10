import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors } from '../constants/colors';

interface UrgentConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UrgentConfirmation({ visible, onConfirm, onCancel }: UrgentConfirmationProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          Daj znać bliskim
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          Twoja bliska osoba dostanie powiadomienie, że prosisz o kontakt
        </Text>

        <Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.8 }]}>
          <Text style={styles.confirmText}>Tak, wyślij</Text>
        </Pressable>

        <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}>
          <Text style={styles.cancelText}>Anuluj</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 36, 48, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    minWidth: 72,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cancelText: {
    fontSize: 17,
    color: '#FFFFFF',
    opacity: 0.6,
  },
});
