import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import type { AppRole } from '../types';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { relationDisplay, relationFrom } from '../utils/relationCopy';

interface PhoneAuthScreenProps {
  onBack: () => void;
  onCodeSent: (phone: string) => void;
  selectedRole: AppRole | null;
  relationLabel: string;
}

export function PhoneAuthScreen({ onBack, onCodeSent, selectedRole, relationLabel }: PhoneAuthScreenProps) {
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const formattedPhone = '+48' + number;
  const isValid = number.replace(/\D/g, '').length === 9;
  const displayNumber = number.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const helperText = number.length === 0
    ? 'Używamy numeru tylko do wejścia do Cmok.'
    : isValid
      ? 'To wygląda dobrze. Za chwilę wyślemy kod SMS.'
      : `Jeszcze ${9 - number.length} cyfr.`;

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      onCodeSent(formattedPhone);
    } catch (err: any) {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać kodu SMS. Sprawdź numer i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.miniLogo}>Cmok</Text>

      <View style={styles.content}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Wejście do konta</Text>
        <Text style={styles.title}>Podaj swój numer</Text>
        <Text style={styles.subtitle}>
          {selectedRole === 'recipient'
            ? `Na tym telefonie będziesz widzieć znak ${relationFrom(relationLabel)}.`
            : selectedRole === 'signaler'
              ? `To będzie telefon ${relationDisplay(relationLabel)}. Tutaj raz dziennie pojawi się prosty gest „u mnie dobrze”.`
              : 'Numer potrzebny jest do wejścia do Cmok.'}
        </Text>

        <View style={styles.inputCard}>
          <View style={styles.inputWrapper}>
          <Text style={styles.prefix}>+48</Text>
          <TextInput
            style={styles.input}
            value={displayNumber}
            onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="phone-pad"
            autoFocus
            placeholder="600 100 200"
            placeholderTextColor="#D1CBC4"
            maxLength={11}
          />
          </View>
          <Text style={[styles.helper, isValid && styles.helperReady]}>{helperText}</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#D86C5B" style={{ marginTop: 24 }} />
        ) : (
          <Pressable
            onPress={handleSend}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.sendBtn,
              isValid ? styles.sendBtnActive : styles.sendBtnDisabled,
              pressed && isValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[styles.sendBtnText, !isValid && { color: '#A39E98' }]}>Wyślij kod</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  miniLogo: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accent,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },
  eyebrow: {
    fontSize: Typography.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accentStrong,
    marginBottom: 10,
  },
  title: {
    fontSize: Typography.title,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 23,
    marginBottom: 24,
    maxWidth: 320,
  },
  inputCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 18,
    paddingHorizontal: 18, minHeight: 58,
  },
  helper: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 12,
  },
  helperReady: {
    color: Colors.safeStrong,
  },
  prefix: {
    fontSize: 20,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  input: { flex: 1, fontSize: 20, color: Colors.text, letterSpacing: 1.5 },
  sendBtn: { minHeight: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  sendBtnActive: { backgroundColor: Colors.accent },
  sendBtnDisabled: { backgroundColor: Colors.disabled, borderWidth: 1, borderColor: Colors.borderStrong },
  sendBtnText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  backButton: {
    alignSelf: 'flex-start' as const,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    marginBottom: 18,
    marginLeft: -8,
  },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
});
