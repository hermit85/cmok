import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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

interface VerifyCodeScreenProps {
  onBack: () => void;
  phone: string;
  relationLabel?: string;
  onVerified: (result: VerifyResult) => void;
}

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

export function VerifyCodeScreen({ onBack, phone, relationLabel = 'bliskiej osoby', onVerified }: VerifyCodeScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  const displayPhone = phone.replace(/(\+48)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

      const user = data.user;
      if (!user?.id) throw new Error('Brak ID użytkownika');

      const { data: profile } = await supabase
        .from('users')
        .select('id, role, name')
        .eq('id', user.id)
        .maybeSingle();

      let relationshipStatus: RelationshipStatus = 'none';

      if (profile) {
        const role = normalizeAppRole(profile.role);
        if (!role) throw new Error('Nieznana rola użytkownika');
        const relationshipColumn = role === 'recipient' ? 'caregiver_id' : 'senior_id';
        const allowedStatuses = role === 'recipient' ? ['active', 'pending'] : ['active'];

        const { data: relationships } = await supabase
          .from('care_pairs')
          .select('id, status')
          .eq(relationshipColumn, user.id)
          .in('status', allowedStatuses)
          .limit(5);

        const preferredRelationship = (relationships || []).sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'active' ? -1 : 1;
        })[0];

        if (preferredRelationship) {
          relationshipStatus = preferredRelationship.status as Exclude<RelationshipStatus, 'none'>;
        }
      }

      onVerified({
        profile: profile ? { id: profile.id, role: normalizeAppRole(profile.role) as AppRole, name: profile.name } : null,
        relationshipStatus,
      });
    } catch (err) {
      console.warn('[VERIFY] error:', err);
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
      Alert.alert('Coś poszło nie tak', 'Nie udało się wysłać nowego kodu.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text style={styles.miniLogo}>cmok</Text>

          <View style={styles.content}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
              <Text style={styles.backText}>← Wróć</Text>
            </Pressable>

            <Text style={styles.title}>Wpisz kod z SMS</Text>
            <Text style={styles.subtitle}>Wysłaliśmy go na {displayPhone}</Text>

            <View style={styles.codeCard}>
              <Pressable onPress={() => inputRef.current?.focus()}>
                <CodeBoxes code={code} />
              </Pressable>
              <TextInput
                ref={inputRef}
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

            {loading && (
              <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 16 }} />
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={handleResend}
              disabled={resendCooldown > 0}
              style={({ pressed }) => [styles.resendLink, pressed && resendCooldown <= 0 && { opacity: 0.6 }]}
            >
              <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textSoft }]}>
                {resendCooldown > 0
                  ? `Wyślij ponownie za ${resendCooldown}s`
                  : 'Wyślij kod ponownie'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  miniLogo: {
    fontSize: 16,
    fontFamily: Typography.headingFamily,
    color: Colors.accent,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38, alignItems: 'center' },
  eyebrow: {
    fontSize: Typography.caption,
    fontFamily: Typography.headingFamily,
    color: Colors.accentStrong,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 8, alignSelf: 'flex-start' },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, marginBottom: 24, alignSelf: 'flex-start' },
  codeCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  codeWrapper: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 18,
    minHeight: 60, justifyContent: 'center',
  },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderColor: Colors.accent,
  },
  boxDigit: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  helper: {
    fontSize: Typography.caption,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: 12,
  },
  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  resendLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  resendText: { fontSize: 15, color: Colors.accent, textDecorationLine: 'underline' },
  backButton: {
    alignSelf: 'flex-start' as const,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    marginBottom: 18,
    marginLeft: -8,
  },
  backText: { fontSize: 16, fontWeight: '500', color: Colors.accent },
});
