import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { logInviteEvent } from '../utils/invite';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface SetupScreenProps {
  onDone: () => void;
  onBack: () => void;
}

function generateInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function SetupScreen({ onDone, onBack }: SetupScreenProps) {
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

      const code = generateInviteCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: existingPending } = await supabase
        .from('care_pairs')
        .select('id')
        .eq('caregiver_id', user.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();

      if (existingPending?.id) {
        const { error } = await supabase
          .from('care_pairs')
          .update({
            invite_code: code,
            invite_expires_at: expiresAt,
            signaler_label: label.trim(),
            senior_name: label.trim(),
          })
          .eq('id', existingPending.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('care_pairs').insert({
          caregiver_id: user.id,
          invite_code: code,
          invite_expires_at: expiresAt,
          status: 'pending',
          signaler_label: label.trim(),
          senior_name: label.trim(),
        });

        if (error) throw error;
      }

      logInviteEvent('invite_created', { label: label.trim() });
      onDone();
    } catch (err) {
      console.error('[SETUP] error:', err);
      Alert.alert('Coś poszło nie tak', 'Nie udało się utworzyć połączenia. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.miniLogo}>Cmok</Text>

      <View style={styles.formContent}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Jak nazwać osobę, która będzie dawać Ci znak?</Text>
        <Text style={styles.subtitle}>Za chwilę zobaczysz kod — pokaż go tej osobie.</Text>

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
            <Text style={[styles.primaryBtnText, !isValid && { color: '#A39E98' }]}>Dalej</Text>
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
    fontFamily: Typography.headingFamily,
    color: Colors.accent,
    paddingHorizontal: 28,
    paddingTop: 16,
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
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  label: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    minHeight: 58,
  },
  input: { flex: 1, fontSize: 18, color: Colors.text },
  helperText: { fontSize: 13, color: Colors.textMuted, marginTop: 12 },
  primaryBtn: { minHeight: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnActive: { backgroundColor: Colors.accent },
  btnDisabled: { backgroundColor: Colors.disabled },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamilySemiBold, color: '#FFFFFF', letterSpacing: 0.1 },
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
