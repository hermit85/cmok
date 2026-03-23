import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Typography } from '../constants/typography';

interface SOSConfirmationProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SOSConfirmation({ visible, onConfirm, onCancel }: SOSConfirmationProps) {
  const [count, setCount] = useState(3);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and start countdown when modal becomes visible
  useEffect(() => {
    if (visible) {
      setCount(3);

      intervalRef.current = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            // Reached 0 — confirm on next tick to avoid state update during render
            setTimeout(() => onConfirm(), 0);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Modal closed — clean up
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
        <Text style={styles.title}>Wzywasz pomoc!</Text>

        <View style={styles.countdownCircle}>
          <Text style={styles.countdownNumber}>{count}</Text>
        </View>

        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Anuluj</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  countdownCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelButton: {
    minWidth: Typography.minSeniorTouch,
    minHeight: Typography.minSeniorTouch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cancelText: {
    fontSize: Typography.seniorBody,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
