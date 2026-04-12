import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface UrgentConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UrgentConfirmation({ visible, onConfirm, onCancel }: UrgentConfirmationProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            Daj znać bliskim
          </Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
            Twoja bliska osoba dostanie powiadomienie, że prosisz o kontakt
          </Text>

          <Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
            <Text style={styles.confirmText}>Tak, wyślij</Text>
          </Pressable>

          <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}>
            <Text style={styles.cancelText}>Anuluj</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 41, 38, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: 24,
    fontFamily: Typography.headingFamily,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  confirmButton: {
    backgroundColor: Colors.accent,
    borderRadius: 18,
    minHeight: 56,
    paddingHorizontal: 48,
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#E85D3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  confirmText: {
    fontSize: 17,
    fontFamily: Typography.headingFamily,
    color: '#FFFFFF',
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
