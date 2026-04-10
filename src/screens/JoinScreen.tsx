import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius } from '../constants/tokens';
import { BigButton } from '../components/BigButton';
import { supabase } from '../services/supabase';
import { logInviteEvent } from '../utils/invite';

interface JoinScreenProps {
  onBack: () => void;
  onDone: () => void;
  relationLabel?: string;
  initialCode?: string;
  /** If true, shows auth-required message instead of join */
  needsAuth?: boolean;
}

function CodeBoxes({ code, focusedIndex }: { code: string; focusedIndex: number }) {
  const digits = code.padEnd(6, ' ').split('').slice(0, 6);
  return (
    <View style={styles.boxRow}>
      {digits.map((digit, i) => (
        <View key={i} style={[styles.box, i === focusedIndex && styles.boxFocused]}>
          {digit.trim().length > 0 && <Text style={styles.boxDigit}>{digit}</Text>}
        </View>
      ))}
    </View>
  );
}

export function JoinScreen({
  onBack,
  onDone,
  relationLabel = 'bliską osobą',
  initialCode = '',
  needsAuth = false,
}: JoinScreenProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const cleanCode = code.replace(/\D/g, '');
  const isValid = cleanCode.length === 6;
  const hasPrefill = initialCode.length === 6;

  // Auto-join when arriving with a valid prefilled code
  useEffect(() => {
    if (hasPrefill && !needsAuth && !autoJoining) {
      setAutoJoining(true);
      handleJoin(initialCode);
    }
  }, []);

  const handleJoin = async (joinCode?: string) => {
    const finalCode = (joinCode || code).replace(/\D/g, '');
    if (finalCode.length !== 6) return;

    logInviteEvent('join_attempted', { code: finalCode });
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('accept_relationship_invite', {
        p_invite_code: finalCode,
      });

      if (rpcError) {
        logInviteEvent('invite_resume_failed', { code: finalCode, reason: 'rpc_error' });
        setError('Ten kod wygasł lub jest nieprawidłowy.\nPoproś o nowy kod.');
        setAutoJoining(false);
        return;
      }

      onDone();
    } catch (err: any) {
      logInviteEvent('invite_resume_failed', { code: finalCode, reason: 'exception' });
      setError('Nie udało się dołączyć. Spróbuj ponownie.');
      setAutoJoining(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    setCode(text.replace(/\D/g, '').slice(0, 6));
    setError('');
  };

  // Auto-joining state — just show loading
  if (autoJoining && loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.joiningTitle}>Dołączasz do kręgu</Text>
        <ActivityIndicator size="large" color={Colors.safe} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  // Needs auth state
  if (needsAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.miniLogo}>Cmok</Text>
        <View style={styles.content}>
          <Text style={styles.title}>Dołączasz do kręgu</Text>
          <Text style={styles.subtitle}>
            Żeby dołączyć, najpierw utwórz konto. Kod połączenia jest już gotowy.
          </Text>
          {hasPrefill ? (
            <View style={styles.prefillBadge}>
              <Text style={styles.prefillText}>Kod: {initialCode}</Text>
            </View>
          ) : null}
          <BigButton
            title="Utwórz konto"
            onPress={onBack}
            color={Colors.accent}
            style={styles.authBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.miniLogo}>Cmok</Text>

      <View style={styles.content}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>
          {hasPrefill ? 'Dołączasz do kręgu' : 'Wpisz kod połączenia'}
        </Text>
        <Text style={styles.subtitle}>
          {hasPrefill
            ? 'Kod jest gotowy. Stuknij „Dołącz" żeby się połączyć.'
            : `Kod połączy ten telefon z ${relationLabel}.`}
        </Text>

        <View style={styles.codeCard}>
          <Pressable onPress={() => inputRef.current?.focus()}>
            <CodeBoxes code={code} focusedIndex={code.length < 6 ? code.length : -1} />
          </Pressable>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={handleCodeChange}
          keyboardType="number-pad"
          autoFocus={!hasPrefill}
          maxLength={6}
          caretHidden
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color={Colors.safe} style={{ marginTop: 24 }} />
        ) : (
          <BigButton
            title="Dołącz"
            onPress={() => handleJoin()}
            color={Colors.safe}
            disabled={!isValid}
            style={isValid ? styles.joinBtn : [styles.joinBtn, styles.joinBtnDisabled]}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  miniLogo: { fontSize: 18, fontFamily: Typography.fontFamilyBold, color: Colors.accent, paddingHorizontal: 32, paddingTop: 16 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 38 },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, marginBottom: 24, lineHeight: 23 },
  joiningTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  codeCard: {
    width: '100%', backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  boxRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: {
    flex: 1, minHeight: 58, backgroundColor: Colors.surface,
    borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  boxFocused: { borderColor: Colors.accent },
  boxDigit: { fontSize: 24, fontFamily: Typography.fontFamilyBold, color: Colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  joinBtn: { width: '100%', marginTop: 24 },
  joinBtnDisabled: { opacity: 0.4 },
  prefillBadge: {
    backgroundColor: Colors.safeLight, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.sm, alignSelf: 'flex-start', marginBottom: 20,
  },
  prefillText: { fontSize: 16, fontWeight: '700', color: Colors.safeStrong, letterSpacing: 2 },
  authBtn: { width: '100%' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4, minHeight: 44, marginBottom: 16 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
});
