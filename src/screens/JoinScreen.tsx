import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { supabase } from '../services/supabase';

interface JoinScreenProps {
  onJoined: () => void;
}

export function JoinScreen({ onJoined }: JoinScreenProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = code.replace(/\D/g, '').length === 6;

  const handleJoin = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Brak sesji');

      // Szukaj aktywnego zaproszenia
      const { data: pairs, error: selectError } = await supabase
        .from('care_pairs')
        .select('*')
        .eq('invite_code', code.replace(/\D/g, ''))
        .eq('status', 'pending')
        .gt('invite_expires_at', new Date().toISOString())
        .limit(1);

      if (selectError) throw selectError;
      if (!pairs || pairs.length === 0) {
        setError('Nieprawidłowy lub wygasły kod. Poproś bliskiego o nowy.');
        return;
      }

      const pair = pairs[0];

      // Aktualizuj care_pair — podłącz seniora
      const { error: updateError } = await supabase
        .from('care_pairs')
        .update({
          senior_id: session.user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
          invite_code: null, // wyczyść kod po użyciu
        })
        .eq('id', pair.id);

      if (updateError) throw updateError;

      onJoined();
    } catch (err: any) {
      if (!error) {
        Alert.alert('Błąd', err.message || 'Nie udało się połączyć.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Wpisz kod od bliskiego</Text>
        <Text style={styles.subtitle}>
          Poproś syna lub córkę o 6-cyfrowy kod
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setError('');
          }}
          keyboardType="number-pad"
          autoFocus
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={Colors.disabled}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <BigButton
            title="Połącz"
            onPress={handleJoin}
            color={Colors.primary}
            disabled={!isValid}
            style={[styles.joinBtn, !isValid && { opacity: 0.4 }]}
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
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 40,
    alignSelf: 'flex-start',
  },
  codeInput: {
    width: '100%',
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingVertical: 12,
    marginBottom: 16,
  },
  error: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 8,
  },
  joinBtn: {
    width: '100%',
    marginTop: 24,
  },
});
