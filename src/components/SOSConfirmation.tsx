import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';

interface SOSConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SOSConfirmation({ visible, onConfirm, onCancel }: SOSConfirmationProps) {
  const [count, setCount] = useState(3);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setCount(3);
      intervalRef.current = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            setTimeout(() => onConfirm(), 0);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCount(3);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, onConfirm]);

  const handleCancel = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCount(3);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Text style={styles.title}>Wysyłamy pilny sygnał</Text>

        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{count}</Text>
        </View>

        <Pressable onPress={handleCancel} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}>
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
    marginBottom: 40,
  },
  countdownCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  countdownNumber: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    minWidth: 72,
    minHeight: 72,
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
