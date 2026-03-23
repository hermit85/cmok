import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { supabase } from '../services/supabase';

interface PhoneAuthScreenProps {
  onCodeSent: (phone: string) => void;
}

export function PhoneAuthScreen({ onCodeSent }: PhoneAuthScreenProps) {
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const formattedPhone = '+48' + number;
  const isValid = number.replace(/\D/g, '').length === 9;

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      onCodeSent(formattedPhone);
    } catch (err: any) {
      Alert.alert('Błąd', err.message || 'Nie udało się wysłać kodu SMS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Podaj numer telefonu</Text>

        <View style={styles.inputRow}>
          <Text style={styles.prefix}>+48</Text>
          <TextInput
            style={styles.input}
            value={number}
            onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 9))}
            keyboardType="phone-pad"
            autoFocus
            placeholder="600 100 200"
            placeholderTextColor={Colors.disabled}
            maxLength={9}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <BigButton
            title="Wyślij kod SMS"
            onPress={handleSend}
            color={Colors.accent}
            disabled={!isValid}
            style={[styles.sendBtn, !isValid && { opacity: 0.4 }]}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingBottom: 8,
    marginBottom: 32,
  },
  prefix: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 2,
  },
  sendBtn: {
    width: '100%',
  },
});
