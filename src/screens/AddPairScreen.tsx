import { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable, Animated, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { isInviteCodeCollision, logInviteEvent, pickUniqueInviteCode, shareInvite } from '../utils/invite';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { haptics } from '../utils/haptics';
import { analytics } from '../services/analytics';

type Step = 'name' | 'code';

/**
 * AddPairScreen — standalone flow for inviting an additional signaler
 * beyond your first care-pair. Distinct from the onboarding SetupScreen
 * because we never want to route away to home while still showing the
 * new invite code, and useRelationship's "prefer active" sort would
 * otherwise hide the freshly-created pending row.
 */
export function AddPairScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('name');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);
  const copyScale = useRef(new Animated.Value(1)).current;

  const isValid = label.trim().length > 0;

  const handleCreate = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Brak sesji');

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      let code = await pickUniqueInviteCode();
      let success = false;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await supabase.from('care_pairs').insert({
          caregiver_id: user.id,
          invite_code: code,
          invite_expires_at: expiresAt,
          status: 'pending',
          signaler_label: label.trim(),
          senior_name: label.trim(),
        });
        if (!error) { success = true; break; }
        lastError = error;
        if (!isInviteCodeCollision(error)) throw error;
        code = await pickUniqueInviteCode();
      }
      if (!success) throw lastError ?? new Error('Nie udało się utworzyć zaproszenia');

      logInviteEvent('additional_pair_created', { label: label.trim() });
      setInviteCode(code);
      setStep('code');
    } catch (err) {
      console.warn('[ADD_PAIR] error:', err);
      Alert.alert('Coś poszło nie tak', 'Nie udało się utworzyć zaproszenia. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      haptics.success();
      setJustCopied(true);
      copyScale.setValue(0.94);
      Animated.spring(copyScale, { toValue: 1, tension: 140, friction: 6, useNativeDriver: true }).start();
      setTimeout(() => setJustCopied(false), 1800);
    } catch {
      haptics.warning();
    }
  };

  const handleShare = async () => {
    if (!inviteCode) return;
    const { data: { user } } = await supabase.auth.getUser();
    await shareInvite({
      code: inviteCode,
      signalerLabel: label.trim(),
      srcUserId: user?.id ?? null,
    });
    analytics.inviteShared('main');
  };

  const handleDone = () => {
    router.back();
  };

  if (step === 'code' && inviteCode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Pressable onPress={handleDone} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
            <Text style={styles.backText}>← Wróć</Text>
          </Pressable>

          <Text style={styles.title}>Pokaż ten kod {label.trim()}</Text>
          <Text style={styles.subtitle}>
            Osoba wpisze go w aplikacji cmok. Gdy to zrobi, zobaczysz jej znak codziennie.
          </Text>

          <Animated.View style={[styles.codeFrame, { transform: [{ scale: copyScale }] }]}>
            <Text style={styles.codeValue}>{inviteCode}</Text>
            <Text style={styles.codeHint}>{justCopied ? 'Skopiowane!' : 'Dotknij, żeby skopiować'}</Text>
          </Animated.View>

          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Skopiuj kod"
          >
            <Text style={styles.secondaryBtnText}>Skopiuj kod</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Wyślij zaproszenie"
          >
            <Text style={styles.primaryBtnText}>Wyślij zaproszenie</Text>
          </Pressable>

          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Gotowe, wróć"
          >
            <Text style={styles.dismissBtnText}>Gotowe</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Zaproś kolejną bliską osobę</Text>
        <Text style={styles.subtitle}>
          Druga córka, wnuczka, brat, każda bliska osoba może dzielić z Tobą codzienny znak. Jak ją nazwać?
        </Text>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="np. Babcia, Kasia, Brat"
            placeholderTextColor={Colors.textSoft}
            autoCorrect={false}
            spellCheck={false}
            autoFocus
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={() => { if (isValid && !loading) handleCreate(); }}
          />
          <Text style={styles.helperText}>Tak będzie widoczna ta osoba w aplikacji.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <Pressable
            onPress={handleCreate}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              !isValid && styles.primaryBtnDisabled,
              pressed && isValid && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Stwórz zaproszenie"
          >
            <Text style={styles.primaryBtnText}>Stwórz zaproszenie</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { alignSelf: 'flex-start' as const, minHeight: 44, justifyContent: 'center' as const, paddingHorizontal: 4, marginBottom: 12 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: 28, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 24 },

  formCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 18,
    marginBottom: 20,
  },
  input: {
    fontSize: 20, color: Colors.text, fontFamily: Typography.headingFamilySemiBold,
    paddingVertical: 4,
  },
  helperText: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },

  primaryBtn: {
    height: 56, borderRadius: 18, backgroundColor: Colors.accent,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
    marginTop: 8, marginBottom: 12,
  },
  primaryBtnDisabled: { backgroundColor: Colors.disabled, shadowOpacity: 0, elevation: 0 },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  secondaryBtn: {
    minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },

  codeFrame: {
    backgroundColor: Colors.cardStrong, borderRadius: 20,
    paddingVertical: 32, paddingHorizontal: 32,
    marginVertical: 24, alignItems: 'center' as const,
    borderWidth: 2, borderColor: Colors.safe + '33',
  },
  codeValue: { fontSize: 44, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 8 },
  codeHint: { fontSize: 12, color: Colors.textMuted, marginTop: 10 },

  dismissBtn: { minHeight: 44, justifyContent: 'center' as const, alignItems: 'center' as const, marginTop: 4 },
  dismissBtnText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
});
