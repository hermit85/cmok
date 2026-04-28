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
import { analytics } from '../services/analytics';
import { openExternalUrl } from '../utils/linking';
import { normalizeAppRole } from '../utils/roles';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { haptics } from '../utils/haptics';
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
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [fullPhone, setFullPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Code phase state
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

  // Transition animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const formattedPhone = '+48' + phone;
  const digitsOnly = phone.replace(/\D/g, '');
  const isComplete = digitsOnly.length === 9;
  const isValid = isComplete && /^[4-8]\d{8}$/.test(digitsOnly);
  const displayNumber = phone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  const displayPhone = fullPhone.replace(/(\+48)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

  const helperText = phone.length === 0
    ? 'Używamy numeru tylko do wejścia do cmok.'
    : isValid
      ? 'To wygląda dobrze. Za chwilę wyślemy kod SMS.'
      : isComplete
        ? 'To nie wygląda na numer komórkowy. Sprawdź jeszcze raz.'
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
    setPhase('code');
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
      codeInputRef.current?.focus();
    });
  }, [fadeAnim]);

  const transitionToPhone = useCallback(() => {
    setCode('');
    setCodeError('');
    setPhase('phone');
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  /* ── Send OTP ── */

  const handleSend = async () => {
    if (!isValid) return;
    haptics.medium();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      analytics.onboardingPhoneSent();
      setFullPhone(formattedPhone);
      setResendCooldown(60);
      haptics.success();
      transitionToCode();
    } catch (err: any) {
      haptics.error();
      const errMsg = err?.message || '';
      Alert.alert('Coś poszło nie tak',
        errMsg.includes('sms_send_failed') ? 'Usługa SMS jest tymczasowo niedostępna. Spróbuj za chwilę.'
        : errMsg.includes('rate_limit') ? 'Za dużo prób. Poczekaj chwilę.'
        : 'Nie udało się wysłać kodu SMS. Sprawdź numer i spróbuj ponownie.'
      );
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
      if (!user?.id) throw new Error('Nie udało się zweryfikować konta');

      // Record terms acceptance with versioning — must succeed before proceeding
      if (termsAccepted) {
        const { error: consentError } = await supabase.from('users').upsert(
          {
            id: user.id,
            phone: user.phone || '',
            terms_accepted_at: new Date().toISOString(),
            terms_version: '1.0',
            privacy_version: '1.0',
          },
          { onConflict: 'id' },
        );
        if (consentError) {
          console.warn('[consent] Failed to save acceptance:', consentError.message);
          // Retry once
          await supabase.from('users').upsert(
            {
              id: user.id,
              phone: user.phone || '',
              terms_accepted_at: new Date().toISOString(),
              terms_version: '1.0',
              privacy_version: '1.0',
            },
            { onConflict: 'id' },
          );
        }
      }

      const { data: profile } = await supabase
        .from('users').select('id, role, name').eq('id', user.id).maybeSingle();

      let relationshipStatus: RelationshipStatus = 'none';
      if (profile) {
        const role = normalizeAppRole(profile.role);
        if (!role) throw new Error('Coś poszło nie tak, spróbuj ponownie');
        const col = role === 'recipient' ? 'caregiver_id' : 'senior_id';
        const statuses = ['active', 'pending'];
        const { data: rels } = await supabase
          .from('care_pairs').select('id, status').eq(col, user.id).in('status', statuses).limit(5);
        const best = (rels || []).sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))[0];
        if (best) relationshipStatus = best.status as Exclude<RelationshipStatus, 'none'>;
      }

      haptics.success();
      onVerified({
        profile: profile ? { id: profile.id, role: normalizeAppRole(profile.role) as AppRole, name: profile.name } : null,
        relationshipStatus,
      });
    } catch (err: any) {
      haptics.error();
      const msg = err?.message || '';
      if (msg.includes('invalid') || msg.includes('expired') || msg.includes('otp')) {
        setCodeError('Ten kod nie pasuje. Sprawdź cyfry i wpisz jeszcze raz.');
      } else {
        setCodeError('Coś nas tu odcięło. Sprawdź internet i spróbuj za chwilę.');
      }
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend ── */

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    haptics.light();
    try {
      await supabase.auth.signInWithOtp({ phone: fullPhone });
      setResendCooldown(60);
      haptics.success();
      Alert.alert('Wysłano', 'Nowy kod SMS został wysłany.');
    } catch {
      haptics.error();
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
          <View style={s.topRow}>
            <Text style={s.miniLogo}>cmok</Text>
            <Text style={s.stepHint}>krok 1 z 2</Text>
          </View>

          <Animated.View style={[s.content, { opacity: fadeAnim }]}>
            <Pressable onPress={handleBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
              <Text style={s.backText}>← Wróć</Text>
            </Pressable>

            {phase === 'phone' ? (
              <>
                <Text style={s.title}>Podaj numer Twojego telefonu</Text>
                <Text style={s.subtitle}>Użyjemy go tylko do wejścia do cmok.</Text>

                <Pressable style={[s.inputCard, phoneFocused && s.inputCardFocused]} onPress={() => phoneInputRef.current?.focus()}>
                  <View style={s.inputWrapper}>
                    <Text style={s.prefix}>+48</Text>
                    <TextInput
                      ref={phoneInputRef}
                      style={s.input}
                      value={displayNumber}
                      onChangeText={(t) => {
                        const next = t.replace(/\D/g, '').slice(0, 9);
                        if (next.length !== phone.length) haptics.selection();
                        setPhone(next);
                      }}
                      keyboardType="phone-pad"
                      autoFocus
                      placeholder="600 100 200"
                      placeholderTextColor={Colors.textSoft}
                      maxLength={11}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                    />
                  </View>
                  <Text style={[s.helper, isValid && s.helperReady]}>{helperText}</Text>
                </Pressable>

                {/* Terms acceptance */}
                <Pressable
                  onPress={() => { haptics.light(); setTermsAccepted(!termsAccepted); }}
                  style={s.termsRow}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                  accessibilityLabel="Akceptuję regulamin i politykę prywatności"
                >
                  <View style={[s.checkbox, termsAccepted && s.checkboxChecked]}>
                    {termsAccepted ? <Text style={s.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={s.termsText}>
                    Akceptuję{' '}
                    <Text style={s.termsLink} onPress={() => openExternalUrl('https://cmok.app/regulamin')}>Regulamin</Text>
                    {' '}i potwierdzam zapoznanie się z{' '}
                    <Text style={s.termsLink} onPress={() => openExternalUrl('https://cmok.app/polityka-prywatnosci')}>Polityką prywatności</Text>.
                  </Text>
                </Pressable>
                <Text style={s.termsDisclaimer}>cmok nie zastępuje numeru 112 ani służb ratunkowych.</Text>

                {loading ? (
                  <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
                ) : (
                  <Pressable
                    onPress={handleSend}
                    disabled={!isValid || !termsAccepted}
                    accessibilityRole="button"
                    accessibilityLabel="Wyślij kod SMS"
                    accessibilityState={{ disabled: !isValid || !termsAccepted }}
                    style={({ pressed }) => [
                      s.sendBtn,
                      isValid && termsAccepted ? s.sendBtnActive : s.sendBtnDisabled,
                      pressed && isValid && termsAccepted && { opacity: 0.85, transform: [{ scale: 0.98 }] },
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
                  <Pressable
                    onPress={() => codeInputRef.current?.focus()}
                    accessibilityRole="button"
                    accessibilityLabel={`Pole kodu SMS, ${code.length} z 6 cyfr wpisanych`}
                    accessibilityHint="Stuknij, żeby otworzyć klawiaturę"
                  >
                    <CodeBoxes code={code} />
                  </Pressable>
                  <TextInput
                    ref={codeInputRef}
                    style={s.hiddenInput}
                    value={code}
                    onChangeText={(t) => {
                      const next = t.replace(/\D/g, '').slice(0, 6);
                      if (next.length !== code.length) haptics.selection();
                      setCode(next);
                    }}
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
                  accessibilityRole="button"
                  accessibilityLabel={resendCooldown > 0 ? `Wyślij kod ponownie za ${resendCooldown} sekund` : 'Wyślij kod ponownie'}
                  accessibilityState={{ disabled: resendCooldown > 0 }}
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16 },
  miniLogo: { fontSize: 16, fontFamily: Typography.headingFamily, color: Colors.accent },
  stepHint: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },

  backButton: { alignSelf: 'flex-start' as const, paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, marginBottom: 18, marginLeft: -8 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 12 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 23, marginBottom: 24, maxWidth: 320 },

  /* phone input */
  inputCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  inputCardFocused: { borderColor: Colors.safe, backgroundColor: Colors.cardStrong },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 18, minHeight: 56 },
  prefix: { fontSize: 20, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginRight: 8 },
  input: { flex: 1, fontSize: 20, color: Colors.text, letterSpacing: 1.5 },

  helper: { fontSize: Typography.caption, color: Colors.textMuted, lineHeight: 18, marginTop: 12 },
  helperReady: { color: Colors.safeStrong },

  /* terms checkbox */
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, gap: 10, paddingRight: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.cardStrong, justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.safe, borderColor: Colors.safe },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: -1 },
  termsText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  termsLink: { color: Colors.accent, textDecorationLine: 'underline' as const },
  termsDisclaimer: { fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: 'center' as const },

  sendBtn: { minHeight: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  sendBtnActive: { backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 5 },
  sendBtnDisabled: { backgroundColor: Colors.accent, opacity: 0.4 },
  sendBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  /* code input */
  codeCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: 20, padding: 16 },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, minHeight: 58, borderRadius: 14, backgroundColor: Colors.cardStrong, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  boxFocused: { borderColor: Colors.safe },
  boxDigit: { fontSize: 26, fontWeight: '700', color: Colors.text },
  boxFilled: { backgroundColor: Colors.safe, borderColor: Colors.safe },
  boxDigitFilled: { color: '#FFFFFF' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },

  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  resendLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  resendText: { fontSize: 15, color: Colors.accent, textDecorationLine: 'underline' },
});
