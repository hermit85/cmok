/**
 * PhoneVerifyScreen — combined phone + SMS code entry.
 * Visually one step: after sending OTP the screen transitions
 * in-place from phone input to code input.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Alert, Pressable, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { normalizeAppRole } from '../utils/roles';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import type { AppRole, RelationshipStatus } from '../types';

export interface VerifyResult {
  profile: { id: string; role: AppRole; name: string } | null;
  relationshipStatus: RelationshipStatus;
}

interface Props {
  onBack: () => void;
  onVerified: (result: VerifyResult) => void;
  selectedRole: AppRole | null;
  relationLabel: string;
}

/* ── code boxes (from VerifyCodeScreen) ── */

function CodeBoxes({ code }: { code: string }) {
  const digits = code.padEnd(6, ' ').split('').slice(0, 6);
  return (
    <View style={s.boxRow}>
      {digits.map((digit, index) => {
        const isFocused = index === code.length && code.length < 6;
        const isFilled = digit.trim().length > 0;
        return (
          <View key={index} style={[s.box, isFocused && s.boxFocused, isFilled && s.boxFilled]}>
            {isFilled ? <Text style={[s.boxDigit, s.boxDigitFilled]}>{digit}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/* ── main ── */

export function PhoneVerifyScreen({ onBack, onVerified, selectedRole, relationLabel }: Props) {
  const [phase, setPhase] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Code phase state
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

  // Transition animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const formattedPhone = '+48' + phone;
  const isValid = phone.replace(/\D/g, '').length === 9;
  const displayNumber = phone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const displayPhone = fullPhone.replace(/(\+48)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

  const helperText = phone.length === 0
    ? 'Używamy numeru tylko do wejścia do Cmok.'
    : isValid
      ? 'To wygląda dobrze. Za chwilę wyślemy kod SMS.'
      : `Jeszcze ${9 - phone.length} cyfr.`;

  // Focus phone input on mount (autoFocus can be unreliable in switch/case renders)
  useEffect(() => {
    if (phase === 'phone') {
      const timer = setTimeout(() => phoneInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === 6) handleVerify(code);
  }, [code]);

  const transitionToCode = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setPhase('code');
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        codeInputRef.current?.focus();
      });
    });
  }, [fadeAnim]);

  const transitionToPhone = useCallback(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setCode('');
      setCodeError('');
      setPhase('phone');
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  /* ── Send OTP ── */

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setFullPhone(formattedPhone);
      setResendCooldown(60);
      transitionToCode();
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać kodu SMS. Sprawdź numer i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Verify OTP ── */

  const handleVerify = async (otp: string) => {
    setLoading(true);
    setCodeError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      const user = data.user;
      if (!user?.id) throw new Error('Brak ID użytkownika');

      const { data: profile } = await supabase
        .from('users').select('id, role, name').eq('id', user.id).maybeSingle();

      let relationshipStatus: RelationshipStatus = 'none';
      if (profile) {
        const role = normalizeAppRole(profile.role);
        if (!role) throw new Error('Nieznana rola użytkownika');
        const col = role === 'recipient' ? 'caregiver_id' : 'senior_id';
        const statuses = role === 'recipient' ? ['active', 'pending'] : ['active'];
        const { data: rels } = await supabase
          .from('care_pairs').select('id, status').eq(col, user.id).in('status', statuses).limit(5);
        const best = (rels || []).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))[0];
        if (best) relationshipStatus = best.status as Exclude<RelationshipStatus, 'none'>;
      }

      onVerified({
        profile: profile ? { id: profile.id, role: normalizeAppRole(profile.role) as AppRole, name: profile.name } : null,
        relationshipStatus,
      });
    } catch {
      setCodeError('Nieprawidłowy kod. Spróbuj ponownie.');
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend ── */

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await supabase.auth.signInWithOtp({ phone: fullPhone });
      setResendCooldown(60);
      Alert.alert('Wysłano', 'Nowy kod SMS został wysłany.');
    } catch {
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać nowego kodu.');
    }
  };

  /* ── Back handler ── */

  const handleBack = () => {
    if (phase === 'code') {
      transitionToPhone();
    } else {
      onBack();
    }
  };

  /* ── Render ── */

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text style={s.miniLogo}>Cmok</Text>

          <Animated.View style={[s.content, { opacity: fadeAnim }]}>
            <Pressable onPress={handleBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
              <Text style={s.backText}>← Wróć</Text>
            </Pressable>

            {phase === 'phone' ? (
              <>
                <Text style={s.title}>Podaj numer telefonu</Text>
                <Text style={s.subtitle}>Użyjemy go tylko do wejścia do Cmok.</Text>

                <Pressable style={s.inputCard} onPress={() => phoneInputRef.current?.focus()}>
                  <View style={s.inputWrapper}>
                    <Text style={s.prefix}>+48</Text>
                    <TextInput
                      ref={phoneInputRef}
                      style={s.input}
                      value={displayNumber}
                      onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 9))}
                      keyboardType="phone-pad"
                      autoFocus
                      placeholder="600 100 200"
                      placeholderTextColor="#D1CBC4"
                      maxLength={11}
                    />
                  </View>
                  <Text style={[s.helper, isValid && s.helperReady]}>{helperText}</Text>
                </Pressable>

                {loading ? (
                  <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
                ) : (
                  <Pressable
                    onPress={handleSend}
                    disabled={!isValid}
                    style={({ pressed }) => [
                      s.sendBtn,
                      isValid ? s.sendBtnActive : s.sendBtnDisabled,
                      pressed && isValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={s.sendBtnText}>Wyślij kod</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text style={s.title}>Wpisz kod z SMS</Text>
                <Text style={s.subtitle}>Wysłaliśmy go na {displayPhone}</Text>

                <View style={s.codeCard}>
                  <Pressable onPress={() => codeInputRef.current?.focus()}>
                    <CodeBoxes code={code} />
                  </Pressable>
                  <TextInput
                    ref={codeInputRef}
                    style={s.hiddenInput}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                    textContentType="oneTimeCode"
                  />
                </View>
                <Text style={s.helper}>Kod wygaśnie za kilka minut.</Text>

                {loading && <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 16 }} />}
                {!!codeError && <Text style={s.error}>{codeError}</Text>}

                <Pressable
                  onPress={handleResend}
                  disabled={resendCooldown > 0}
                  style={({ pressed }) => [s.resendLink, pressed && resendCooldown <= 0 && { opacity: 0.6 }]}
                >
                  <Text style={[s.resendText, resendCooldown > 0 && { color: Colors.textSoft }]}>
                    {resendCooldown > 0 ? `Wyślij ponownie za ${resendCooldown}s` : 'Wyślij kod ponownie'}
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── styles ── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  miniLogo: { fontSize: 16, fontFamily: Typography.headingFamily, color: Colors.accent, paddingHorizontal: 28, paddingTop: 16 },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },

  backButton: { alignSelf: 'flex-start' as const, paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, marginBottom: 18, marginLeft: -8 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 12 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 23, marginBottom: 24, maxWidth: 320 },

  /* phone input */
  inputCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
  },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 18, minHeight: 56 },
  prefix: { fontSize: 20, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginRight: 8 },
  input: { flex: 1, fontSize: 20, color: Colors.text, letterSpacing: 1.5 },

  helper: { fontSize: Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: 12 },
  helperReady: { color: Colors.safeStrong },

  sendBtn: { minHeight: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  sendBtnActive: { backgroundColor: Colors.accent, shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 5 },
  sendBtnDisabled: { backgroundColor: Colors.accent, opacity: 0.4 },
  sendBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  /* code input */
  codeCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: 20, padding: 16 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, minHeight: 58, borderRadius: 14, backgroundColor: Colors.cardStrong, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  boxFocused: { borderColor: Colors.safe },
  boxDigit: { fontSize: 26, fontWeight: '700', color: Colors.text },
  boxFilled: { backgroundColor: Colors.safe },
  boxDigitFilled: { color: '#FFFFFF' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },

  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  resendLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  resendText: { fontSize: 15, color: Colors.accent, textDecorationLine: 'underline' },
});
