import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { supabase } from '../services/supabase';

interface VerifyCodeScreenProps {
  phone: string;
  role: 'senior' | 'caregiver';
  onVerified: () => void;
}

export function VerifyCodeScreen({ phone, role, onVerified }: VerifyCodeScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  // Format phone for display: +48 XXX XXX XXX
  const displayPhone = phone.replace(/(\+48)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

  // Resend countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === 6) {
      handleVerify(code);
    }
  }, [code]);

  const handleVerify = async (otp: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (verifyError) throw verifyError;

      const userId = data.user?.id;
      if (!userId) throw new Error('Brak ID użytkownika');

      // Sprawdź czy user istnieje w public.users
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existing) {
        // Nowy użytkownik — utwórz profil
        const { error: insertError } = await supabase.from('users').insert({
          id: userId,
          phone,
          name: role === 'senior' ? 'Senior' : 'Bliski',
          role,
        });
        if (insertError && !insertError.message.includes('duplicate')) {
          throw insertError;
        }
      }

      onVerified();
    } catch (err: any) {
      setError('Nieprawidłowy kod. Spróbuj ponownie.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await supabase.auth.signInWithOtp({ phone });
      setResendCooldown(60);
      Alert.alert('Wysłano', 'Nowy kod SMS został wysłany.');
    } catch {
      Alert.alert('Błąd', 'Nie udało się wysłać nowego kodu.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Wpisz kod z SMS</Text>
        <Text style={styles.subtitle}>Wysłaliśmy kod na {displayPhone}</Text>

        <TextInput
          ref={inputRef}
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          textContentType="oneTimeCode"
        />

        {loading && (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 16 }} />
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={styles.resendLink}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.disabled }]}>
            {resendCooldown > 0
              ? `Wyślij ponownie za ${resendCooldown}s`
              : 'Wyślij kod ponownie'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  codeInput: {
    width: '100%',
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 16,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 12,
    marginBottom: 16,
  },
  error: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  resendLink: {
    minHeight: Typography.minSeniorTouch,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 16,
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
});
