import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { isInviteCodeCollision, logInviteEvent, pickUniqueInviteCode } from '../utils/invite';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface SetupScreenProps {
  onDone: () => void;
  onBack: () => void;
  /**
   * 'initial' (default): first care-pair for this account. If one already exists,
   *   we skip to home (protects against accidental duplicate during onboarding).
   * 'additional': user explicitly wants to invite another signaler. We allow
   *   creating a second/third pending pair alongside existing active ones.
   */
  mode?: 'initial' | 'additional';
}

export function SetupScreen({ onDone, onBack, mode = 'initial' }: SetupScreenProps) {
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = label.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Brak sesji');

      // In 'initial' mode, skip setup if user already has an active pair (first-onboarding guard).
      // In 'additional' mode we explicitly allow creating a new pair alongside existing ones.
      if (mode === 'initial') {
        const { data: activePair } = await supabase
          .from('care_pairs')
          .select('id')
          .eq('caregiver_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (activePair) {
          onDone();
          return;
        }
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Retry on rare invite_code unique_violation. The UNIQUE partial index
      // (migration 020) is the authoritative guard; pickUniqueInviteCode is
      // an optimistic pre-check. We also re-check the pending row each
      // iteration because it can disappear between pre-check and write
      // (e.g. another device cleaning up), which would otherwise yield a
      // silent 0-row update that looks like success.
      let code = await pickUniqueInviteCode();
      let success = false;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        // In 'additional' mode we always create a NEW pending row (allow multiple
        // concurrent pending invites — e.g. one waiting for Mama, one for Babcia).
        // In 'initial' mode we may recycle an existing pending row to avoid dupes.
        const { data: currentPending } = mode === 'additional'
          ? { data: null }
          : await supabase
              .from('care_pairs')
              .select('id')
              .eq('caregiver_id', user.id)
              .eq('status', 'pending')
              .limit(1)
              .maybeSingle();

        if (currentPending?.id) {
          const { data: updated, error } = await supabase
            .from('care_pairs')
            .update({
              invite_code: code,
              invite_expires_at: expiresAt,
              signaler_label: label.trim(),
              senior_name: label.trim(),
            })
            .eq('id', currentPending.id)
            .select('id');
          if (!error && (updated?.length ?? 0) === 0) {
            // Row disappeared between select and update — retry (will insert).
            continue;
          }
          if (!error) { success = true; break; }
          lastError = error;
          if (!isInviteCodeCollision(error)) throw error;
          code = await pickUniqueInviteCode();
          continue;
        }

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

      logInviteEvent('invite_created', { label: label.trim() });
      onDone();
    } catch (err) {
      console.warn('[SETUP] error:', err);
      Alert.alert('Coś poszło nie tak', 'Nie udało się utworzyć połączenia. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.miniLogo}>cmok</Text>
        {mode === 'initial' ? <Text style={styles.stepHint}>krok 2 z 2</Text> : null}
      </View>

      <View style={styles.formContent}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>
          {mode === 'additional'
            ? 'Jak nazwać kolejną bliską osobę?'
            : 'Jak nazwać osobę, która będzie dawać Ci znak?'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'additional'
            ? 'Za chwilę zobaczysz kod. Pokaż go tej osobie, żeby dołączyła.'
            : 'Za chwilę zobaczysz kod, pokaż go tej osobie.'}
        </Text>

        <View style={styles.formCard}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="np. Mama, Syn, Wnuczka"
              placeholderTextColor={Colors.textSoft}
              autoCorrect={false}
              spellCheck={false}
              autoFocus
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={() => { if (isValid && !loading) handleSubmit(); }}
            />
          </View>

          <Text style={styles.helperText}>Tak będzie widoczna ta osoba w aplikacji.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.primaryBtn,
              isValid ? styles.btnActive : styles.btnDisabled,
              pressed && isValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.primaryBtnText}>Dalej</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16 },
  stepHint: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
  miniLogo: {
    fontSize: 16,
    fontFamily: Typography.headingFamily,
    color: Colors.accent,
  },
  formContent: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },
  eyebrow: {
    fontSize: Typography.caption,
    fontFamily: Typography.headingFamily,
    color: Colors.accentStrong,
    marginBottom: 10,
  },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, marginBottom: 24, lineHeight: 23, maxWidth: 320 },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  label: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  input: { flex: 1, fontSize: 18, color: Colors.text },
  helperText: { fontSize: 13, color: Colors.textMuted, marginTop: 12 },
  primaryBtn: { minHeight: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnActive: { backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 5 },
  btnDisabled: { backgroundColor: Colors.accent, opacity: 0.4 },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
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
