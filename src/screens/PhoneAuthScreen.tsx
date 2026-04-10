import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator, Alert,
  Pressable, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import type { AppRole, RelationshipStatus } from '../types';
import { normalizeAppRole } from '../utils/roles';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

export interface VerifyResult {
  profile: { id: string; role: AppRole; name: string } | null;
  relationshipStatus: RelationshipStatus;
}

interface PhoneAuthScreenProps {
  onBack: () => void;
  onVerified: (result: VerifyResult) => void;
}

/* ─── CodeBoxes ─── */

function CodeBoxes({ code }: { code: string }) {
  const digits = code.padEnd(6, ' ').split('').slice(0, 6);
  return (
    <View style={styles.boxRow}>
      {digits.map((digit, index) => {
        const isFocused = index === code.length && code.length < 6;
        const isFilled = digit.trim().length > 0;
        return (
          <View key={index} style={[styles.box, isFocused && styles.boxFocused]}>
            {isFilled ? <Text style={styles.boxDigit}>{digit}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/* ─── Main component ─── */

export function PhoneAuthScreen({ onBack, onVerified }: PhoneAuthScreenProps) {
  const [phase, setPhase] = useState<'phone' | 'verify'>('phone');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const formattedPhone = '+48' + number;
  const isPhoneValid = number.replace(/\D/g, '').length === 9;
  const displayNumber = number.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const displayPhone = formattedPhone.replace(/(\+48)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

  const helperText = number.length === 0
    ? 'Używamy numeru tylko do wejścia do Cmok.'
    : isPhoneValid
      ? 'To wygląda dobrze. Za chwilę wyślemy kod SMS.'
      : `Jeszcze ${9 - number.length} cyfr.`;

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (phase === 'verify' && code.length === 6) {
      handleVerify(code);
    }
  }, [code, phase]);

  const transitionToVerify = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setPhase('verify');
      setCode('');
      setError('');
      setResendCooldown(60);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
        codeInputRef.current?.focus();
      });
    });
  }, [fadeAnim]);

  const transitionToPhone = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setPhase('phone');
      setCode('');
      setError('');
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
        phoneInputRef.current?.focus();
      });
    });
  }, [fadeAnim]);

  const handleSendOTP = async () => {
    if (!isPhoneValid) return;
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (otpError) throw otpError;
      transitionToVerify();
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać kodu SMS. Sprawdź numer i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (otp: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone, token: otp, type: 'sms',
      });
      if (verifyError) throw verifyError;

      const user = data.user;
      if (!user?.id) throw new Error('Brak ID użytkownika');

      const { data: profile } = await supabase
        .from('users').select('id, role, name').eq('id', user.id).maybeSingle();

      let relationshipStatus: RelationshipStatus = 'none';
      if (profile) {
        const role = normalizeAppRole(profile.role);
        if (!role) throw new Error('Nieznana rola');
        const col = role === 'recipient' ? 'caregiver_id' : 'senior_id';
        const statuses = role === 'recipient' ? ['active', 'pending'] : ['active'];
        const { data: rels } = await supabase
          .from('care_pairs').select('id, status').eq(col, user.id).in('status', statuses).limit(5);
        const best = (rels || []).sort((a, b) => a.status === b.status ? 0 : a.status === 'active' ? -1 : 1)[0];
        if (best) relationshipStatus = best.status as Exclude<RelationshipStatus, 'none'>;
      }

      onVerified({
        profile: profile ? { id: profile.id, role: normalizeAppRole(profile.role) as AppRole, name: profile.name } : null,
        relationshipStatus,
      });
    } catch {
      setError('Nieprawidłowy kod. Spróbuj ponownie.');
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await supabase.auth.signInWithOtp({ phone: formattedPhone });
      setResendCooldown(60);
      Alert.alert('Wysłano', 'Nowy kod SMS został wysłany.');
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać nowego kodu.');
    }
  };

  const handleBack = () => {
    if (phase === 'verify') {
      transitionToPhone();
    } else {
      onBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text style={styles.miniLogo}>Cmok</Text>

          <View style={styles.content}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
              <Text style={styles.backText}>← Wróć</Text>
            </Pressable>

            <Animated.View style={{ opacity: fadeAnim }}>
              {phase === 'phone' ? (
                <>
                  <Text style={styles.title}>Podaj numer telefonu</Text>
                  <Text style={styles.subtitle}>Użyjemy go tylko do wejścia do Cmok.</Text>

                  <View style={styles.inputCard}>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.prefix}>+48</Text>
                      <TextInput
                        ref={phoneInputRef}
                        style={styles.phoneInput}
                        value={displayNumber}
                        onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 9))}
                        keyboardType="phone-pad"
                        autoFocus
                        placeholder="600 100 200"
                        placeholderTextColor="#D1CBC4"
                        maxLength={11}
                        onSubmitEditing={handleSendOTP}
                      />
                    </View>
                    <Text style={[styles.helper, isPhoneValid && styles.helperReady]}>{helperText}</Text>
                  </View>

                  {loading ? (
                    <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
                  ) : (
                    <Pressable
                      onPress={handleSendOTP}
                      disabled={!isPhoneValid}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        isPhoneValid ? styles.actionBtnActive : styles.actionBtnDisabled,
                        pressed && isPhoneValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <Text style={[styles.actionBtnText, !isPhoneValid && { color: Colors.textMuted }]}>Wyślij kod</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.title}>Wpisz kod z SMS</Text>
                  <Text style={styles.subtitle}>Wysłaliśmy go na {displayPhone}</Text>

                  <View style={styles.inputCard}>
                    <Pressable onPress={() => codeInputRef.current?.focus()}>
                      <CodeBoxes code={code} />
                    </Pressable>
                    <TextInput
                      ref={codeInputRef}
                      style={styles.hiddenInput}
                      value={code}
                      onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      autoFocus
                      maxLength={6}
                      textContentType="oneTimeCode"
                    />
                  </View>
                  <Text style={styles.helper}>Kod wygaśnie za kilka minut.</Text>

                  {loading && <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 16 }} />}
                  {!!error && <Text style={styles.error}>{error}</Text>}

                  <Pressable
                    onPress={handleResend}
                    disabled={resendCooldown > 0}
                    style={({ pressed }) => [styles.resendLink, pressed && resendCooldown <= 0 && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textSoft }]}>
                      {resendCooldown > 0 ? `Wyślij ponownie za ${resendCooldown}s` : 'Wyślij kod ponownie'}
                    </Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  miniLogo: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.accent, paddingHorizontal: 28, paddingTop: 16 },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 23, marginBottom: 24, maxWidth: 320 },
  inputCard: {
    backgroundColor: Colors.card, borderRadius: 24, borderWidth: 1, borderColor: Colors.border,
    padding: 16, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 2,
  },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 18, paddingHorizontal: 18, minHeight: 58 },
  prefix: { fontSize: 20, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 20, color: Colors.text, letterSpacing: 1.5 },
  helper: { fontSize: Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: 12 },
  helperReady: { color: Colors.safeStrong },
  actionBtn: { minHeight: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  actionBtnActive: { backgroundColor: Colors.accent },
  actionBtnDisabled: { backgroundColor: Colors.disabled, borderWidth: 1, borderColor: Colors.borderStrong },
  actionBtnText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyBold, color: '#FFFFFF' },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, minHeight: 58, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  boxFocused: { borderColor: Colors.accent },
  boxDigit: { fontSize: 26, fontWeight: '700', color: Colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  resendLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  resendText: { fontSize: 15, color: Colors.accent, textDecorationLine: 'underline' },
  backButton: { alignSelf: 'flex-start' as const, paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, marginBottom: 18, marginLeft: -8 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
});
