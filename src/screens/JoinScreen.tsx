import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { supabase } from '../services/supabase';

interface JoinScreenProps {
  onBack: () => void;
  onDone: () => void;
  relationLabel?: string;
}

function CodeBoxes({
  code,
  focusedIndex,
}: {
  code: string;
  focusedIndex: number;
}) {
  const digits = code.padEnd(6, ' ').split('').slice(0, 6);

  return (
    <View style={styles.boxRow}>
      {digits.map((digit, i) => {
        const isFocused = i === focusedIndex;
        const isFilled = digit.trim().length > 0;
        return (
          <View
            key={i}
            style={[
              styles.box,
              isFocused && styles.boxFocused,
            ]}
          >
            {isFilled && <Text style={styles.boxDigit}>{digit}</Text>}
          </View>
        );
      })}
    </View>
  );
}

export function JoinScreen({ onBack, onDone, relationLabel = 'bliską osobą' }: JoinScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const isValid = code.replace(/\D/g, '').length === 6;

  const handleJoin = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('accept_relationship_invite', {
        p_invite_code: code.replace(/\D/g, ''),
      });

      if (rpcError) {
        setError('Ten kod nie działa albo już wygasł.\nPoproś o nowy.');
        return;
      }

      onDone();
    } catch (err: any) {
      if (!error) {
        Alert.alert('Błąd', err.message || 'Nie udało się połączyć.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.miniLogo}>Cmok</Text>

      <View style={styles.content}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Wasza relacja</Text>
        <Text style={styles.title}>Wpisz kod połączenia</Text>
        <Text style={styles.subtitle}>
          Ten kod połączy ten telefon z {relationLabel}. Poproś o 6 cyfr i wpisz je tutaj.
        </Text>

        <View style={styles.codeCard}>
          <Pressable onPress={() => inputRef.current?.focus()}>
            <CodeBoxes code={code} focusedIndex={code.length < 6 ? code.length : -1} />
          </Pressable>
          <Text style={styles.helperText}>Kod działa tylko dla tej jednej relacji i po czasie wygasa.</Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={handleCodeChange}
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          caretHidden
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color={Colors.safe} style={{ marginTop: 24 }} />
        ) : (
          <BigButton
            title="Połącz"
            onPress={handleJoin}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  miniLogo: {
    fontSize: 18,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accent,
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 38,
  },
  eyebrow: {
    fontSize: Typography.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accentStrong,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: Typography.title,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: Typography.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  codeCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  boxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  box: {
    width: 46,
    height: 58,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxFocused: {
    borderColor: Colors.accent,
  },
  boxDigit: {
    fontSize: 24,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  helperText: {
    fontSize: Typography.caption,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  error: {
    fontSize: Typography.body,
    fontFamily: Typography.fontFamily,
    color: Colors.alert,
    textAlign: 'center',
    marginBottom: 8,
  },
  joinBtn: {
    width: '100%',
    marginTop: 24,
  },
  joinBtnDisabled: {
    opacity: 0.4,
  },
  backButton: {
    alignSelf: 'flex-start' as const,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 44,
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.accent,
  },
});
