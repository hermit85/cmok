import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface SOSOverlayProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SOSOverlay({ visible, onCancel, onConfirm }: SOSOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Wezwać pomoc?</Text>
          <Text style={styles.body}>
            Twoi bliscy zostaną natychmiast powiadomieni o Twojej lokalizacji.
          </Text>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.confirmText}>TAK, WEZWIJ POMOC</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.cancelButton}>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.seniorTitle,
    fontWeight: '800',
    color: Colors.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: Typography.seniorBody,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 28,
  },
  confirmButton: {
    width: '100%',
    minHeight: Typography.minSeniorTouch,
    backgroundColor: Colors.danger,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmText: {
    fontSize: Typography.seniorButton,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: Typography.seniorBody,
    color: Colors.textSecondary,
  },
});
