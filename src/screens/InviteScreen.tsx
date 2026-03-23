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

interface InviteScreenProps {
  onDone: () => void;
}

function generateInviteCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function InviteScreen({ onDone }: InviteScreenProps) {
  const [seniorName, setSeniorName] = useState('');
  const [seniorPhone, setSeniorPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const isValid = seniorName.trim().length > 0 && seniorPhone.replace(/\D/g, '').length === 9;

  const handleGenerate = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Brak sesji');

      const code = generateInviteCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('care_pairs').insert({
        caregiver_id: session.user.id,
        senior_id: session.user.id, // placeholder — senior zaktualizuje po dołączeniu
        sms_fallback_phone: '+48' + seniorPhone.replace(/\D/g, ''),
        invite_code: code,
        invite_expires_at: expiresAt,
        status: 'pending',
      });

      if (error) throw error;
      setInviteCode(code);
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się wygenerować kodu.');
    } finally {
      setLoading(false);
    }
  };

  // ── Kod wygenerowany — pokaż go ──
  if (inviteCode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.codeDisplay}>
          <Text style={styles.codeLabel}>Kod dla {seniorName || 'seniora'}:</Text>
          <Text style={styles.codeValue}>{inviteCode}</Text>
          <Text style={styles.codeHint}>
            Podyktuj ten kod {seniorName ? seniorName + 'ie' : 'mamie'} przez telefon.{'\n'}
            Kod ważny 24 godziny.
          </Text>

          <BigButton
            title="Gotowe"
            onPress={onDone}
            color={Colors.accent}
            style={styles.doneBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Formularz ──
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dodaj swojego bliskiego</Text>

        <Text style={styles.label}>Imię seniora</Text>
        <TextInput
          style={styles.input}
          value={seniorName}
          onChangeText={setSeniorName}
          placeholder="np. Mama, Tata, Babcia"
          placeholderTextColor={Colors.disabled}
          autoFocus
        />

        <Text style={styles.label}>Numer telefonu seniora</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+48</Text>
          <TextInput
            style={styles.phoneInput}
            value={seniorPhone}
            onChangeText={(t) => setSeniorPhone(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="phone-pad"
            placeholder="600 100 200"
            placeholderTextColor={Colors.disabled}
            maxLength={9}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 32 }} />
        ) : (
          <BigButton
            title="Wygeneruj kod zaproszenia"
            onPress={handleGenerate}
            color={Colors.accent}
            disabled={!isValid}
            style={[styles.generateBtn, !isValid && { opacity: 0.4 }]}
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    fontSize: 20,
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingVertical: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingBottom: 8,
  },
  prefix: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 2,
  },
  generateBtn: {
    width: '100%',
    marginTop: 32,
  },
  // ── Kod wyświetlony ──
  codeDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  codeLabel: {
    fontSize: 20,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  codeValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1B4F72',
    letterSpacing: 8,
    marginBottom: 24,
  },
  codeHint: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  doneBtn: {
    width: '100%',
  },
});
