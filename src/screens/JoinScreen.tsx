import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius } from '../constants/tokens';
import { BigButton } from '../components/BigButton';
import { supabase } from '../services/supabase';
import { logInviteEvent } from '../utils/invite';
import { lookupInviter } from '../utils/inviteLookup';
import { haptics } from '../utils/haptics';

interface JoinScreenProps {
  onBack: () => void;
  onDone: () => void;
  relationLabel?: string;
  initialCode?: string;
  needsAuth?: boolean;
}

function CodeBoxes({ code, focusedIndex }: { code: string; focusedIndex: number }) {
  const digits = code.padEnd(6, ' ').split('').slice(0, 6);
  return (
    <View style={s.boxRow}>
      {digits.map((digit, i) => (
        <View key={i} style={[s.box, i === focusedIndex && s.boxFocused, digit.trim().length > 0 && s.boxFilled]}>
          {digit.trim().length > 0 && <Text style={[s.boxDigit, s.boxDigitFilled]}>{digit}</Text>}
        </View>
      ))}
    </View>
  );
}

export function JoinScreen({
  onBack, onDone, relationLabel = 'bliską osobą',
  initialCode = '', needsAuth = false,
}: JoinScreenProps) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const successScale = useRef(new Animated.Value(0.8)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const cleanCode = code.replace(/\D/g, '');
  const isValid = cleanCode.length === 6;
  const hasPrefill = initialCode.length === 6;

  // Look up inviter name from code
  useEffect(() => {
    const codeToLookup = hasPrefill ? initialCode : cleanCode;
    if (codeToLookup.length === 6) {
      lookupInviter(codeToLookup).then((result) => {
        if (result) setInviterName(result.label);
      });
    }
  }, [hasPrefill ? initialCode : cleanCode.length === 6 ? cleanCode : '']);

  // Auto-join when arriving with a valid prefilled code
  useEffect(() => {
    if (hasPrefill && !needsAuth && !autoJoining && !joined) {
      setAutoJoining(true);
      handleJoin(initialCode);
    }
  }, []);

  const playSuccessAnimation = useCallback(() => {
    haptics.success();
    successScale.setValue(0.8);
    successOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [successScale, successOpacity]);

  const handleJoin = async (joinCode?: string) => {
    const finalCode = (joinCode || code).replace(/\D/g, '');
    if (finalCode.length !== 6) return;

    logInviteEvent('invite_code_submitted', { code: finalCode });
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('accept_relationship_invite', {
        p_invite_code: finalCode,
      });

      if (rpcError) {
        console.warn('[JOIN] RPC error:', rpcError.message || rpcError.code);
        logInviteEvent('invite_resume_failed', { code: finalCode, reason: rpcError.message || 'rpc_error' });
        setError('Ten kod wygasł lub jest nieprawidłowy.\nPoproś o nowy kod.');
        setAutoJoining(false);
        return;
      }

      logInviteEvent('invite_join_success', { code: finalCode });
      setJoined(true);
      playSuccessAnimation();
    } catch {
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

  /* ─── SUCCESS STATE ─── */
  if (joined) {
    logInviteEvent('first_sign_cta_seen');
    return (
      <SafeAreaView style={[s.container, s.centered, { backgroundColor: Colors.background }]}>
        <Animated.View style={{ opacity: successOpacity, transform: [{ scale: successScale }], alignItems: 'center' }}>
          <View style={s.successCheck}>
            <Text style={s.successCheckText}><Text style={{ fontFamily: undefined, fontSize: 36 }}>✓</Text></Text>
          </View>
          <Text style={s.successTitle}>Gotowe, jesteście razem</Text>
          <Text style={s.successSub}>
            {inviterName
              ? `Od teraz ${inviterName} będzie widzieć, że u Ciebie jest OK. Codziennie, jednym gestem.`
              : 'Wasz codzienny rytuał bliskości właśnie się zaczął.'}
          </Text>
          <BigButton
            title="Wyślij pierwszy znak"
            onPress={onDone}
            color={Colors.safe}
            style={s.successBtn}
          />
        </Animated.View>
      </SafeAreaView>
    );
  }

  /* ─── AUTO-JOINING ─── */
  if (autoJoining && loading) {
    return (
      <SafeAreaView style={[s.container, s.centered]}>
        <Text style={s.joiningTitle}>
          {inviterName ? `Dołączasz do ${inviterName}` : 'Dołączasz do kręgu'}
        </Text>
        <ActivityIndicator size="large" color={Colors.safe} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  /* ─── NEEDS AUTH ─── */
  if (needsAuth) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.miniLogo}>cmok</Text>
        <View style={s.content}>
          <Text style={s.title}>
            {inviterName ? `${inviterName} Cię zaprasza` : 'Dołącz do kręgu'}
          </Text>
          <Text style={s.subtitle}>
            Żeby dołączyć, najpierw utwórz konto. Kod jest gotowy.
          </Text>
          <BigButton title="Utwórz konto" onPress={onBack} color={Colors.accent} style={s.authBtn} />
        </View>
      </SafeAreaView>
    );
  }

  /* ─── MAIN JOIN ─── */
  const contextTitle = inviterName
    ? `${inviterName} czeka na Ciebie`
    : hasPrefill ? 'Prawie gotowe' : 'Wpisz kod zaproszenia';
  const contextSub = inviterName
    ? `Wpisz kod i za chwilę będziecie w kontakcie. Codziennie, bez wysiłku.`
    : hasPrefill
      ? 'Kod jest gotowy. Jedno stuknięcie i jesteście połączeni.'
      : 'Bliska osoba wysłała Ci kod. Wpisz go, żeby się połączyć.';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topRow}>
        <Text style={s.miniLogo}>cmok</Text>
        <Text style={s.stepHint}>krok 2 z 2</Text>
      </View>
      <View style={s.content}>
        <Pressable onPress={onBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={s.backText}>← Wróć</Text>
        </Pressable>

        <Text style={s.title}>{contextTitle}</Text>
        <Text style={s.subtitle}>{contextSub}</Text>

        <View style={s.codeCard}>
          <Pressable onPress={() => inputRef.current?.focus()}>
            <CodeBoxes code={code} focusedIndex={code.length < 6 ? code.length : -1} />
          </Pressable>
        </View>

        <TextInput
          ref={inputRef} style={s.hiddenInput} value={code}
          onChangeText={handleCodeChange} keyboardType="number-pad"
          autoFocus={!hasPrefill} maxLength={6} caretHidden
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color={Colors.safe} style={{ marginTop: 24 }} />
        ) : (
          <BigButton
            title="Dołącz"
            onPress={() => handleJoin()}
            color={Colors.safe}
            disabled={!isValid}
            style={isValid ? s.joinBtn : [s.joinBtn, s.joinBtnDisabled]}
          />
        )}

        <View style={s.noCodeBox}>
          <Text style={s.noCodeTitle}>Nie masz kodu?</Text>
          <Text style={s.noCodeBody}>Poproś bliską osobę, żeby zainstalowała cmok i wybrała "Chcę zaprosić". Dostaniesz od niej kod do wpisania tutaj.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 16 },
  stepHint: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },
  miniLogo: { fontSize: 18, fontFamily: Typography.headingFamily, color: Colors.accent },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 38 },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, marginBottom: 24, lineHeight: 23 },
  joiningTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  codeCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: 20, padding: 16 },
  boxRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: { flex: 1, minHeight: 58, borderRadius: 14, backgroundColor: Colors.cardStrong, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
  boxFocused: { borderColor: Colors.safe },
  boxFilled: { backgroundColor: Colors.safe },
  boxDigit: { fontSize: 24, fontFamily: Typography.headingFamily, color: Colors.text },
  boxDigitFilled: { color: '#FFFFFF' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  error: { fontSize: 15, color: Colors.alert, textAlign: 'center', marginTop: 12 },
  joinBtn: { width: '100%', marginTop: 24 },
  joinBtnDisabled: { opacity: 0.4 },
  noCodeBox: { marginTop: 28, backgroundColor: Colors.surface, borderRadius: 16, padding: 18 },
  noCodeTitle: { fontSize: 15, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  noCodeBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  authBtn: { width: '100%' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4, minHeight: 44, marginBottom: 16 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },

  /* success */
  successCheck: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.safeLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  successCheckText: { fontSize: 36, color: Colors.safe, fontWeight: '700' },
  successTitle: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, textAlign: 'center', marginBottom: 8 },
  successSub: { fontSize: Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 23, marginBottom: 32, maxWidth: 280 },
  successBtn: { width: '100%' },
});
