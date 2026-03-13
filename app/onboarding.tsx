import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { usePushToken } from '../src/notifications/usePushToken';
import { createFamily, joinFamily } from '../src/api/family';

type Step = 'welcome' | 'name' | 'choice' | 'create' | 'join' | 'code-display';

export default function OnboardingScreen() {
  const router = useRouter();
  const { expoPushToken, deviceId } = usePushToken();
  const setMember = useAppStore((s) => s.setMember);
  const setFamily = useAppStore((s) => s.setFamily);

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateFamily = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await createFamily({
        name: 'Moja rodzina',
        memberName: name.trim(),
        deviceId: deviceId || `device-${Date.now()}`,
        expoPushToken: expoPushToken || '',
      });
      setMember(result.member_id, name.trim(), deviceId);
      setFamily(result.family_id, result.family_code);
      setDisplayCode(result.family_code);
      setStep('code-display');
    } catch (error: any) {
      Alert.alert('Błąd', error.message || 'Nie udało się stworzyć rodziny');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!name.trim() || !familyCode.trim()) return;
    setLoading(true);
    try {
      const result = await joinFamily({
        code: familyCode.trim().toUpperCase(),
        memberName: name.trim(),
        deviceId: deviceId || `device-${Date.now()}`,
        expoPushToken: expoPushToken || '',
      });
      setMember(result.member_id, name.trim(), deviceId);
      setFamily(result.family_id, '');
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Błąd', error.message || 'Nie znaleziono rodziny z tym kodem');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>Cmok</Text>
        <Text style={styles.subtitle}>
          Wyślij buziaczka{'\n'}komuś bliskiemu
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => setStep('name')}>
          <Text style={styles.primaryButtonText}>Zaczynamy!</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'name') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.question}>Jak masz na imię?</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="np. Mama, Tomek, Kasia..."
          placeholderTextColor="#CCC"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => name.trim() && setStep('choice')}
        />
        <Pressable
          style={[styles.primaryButton, !name.trim() && styles.disabledButton]}
          onPress={() => setStep('choice')}
          disabled={!name.trim()}
        >
          <Text style={styles.primaryButtonText}>Dalej</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'choice') {
    return (
      <View style={styles.container}>
        <Text style={styles.greeting}>Cześć, {name}!</Text>
        <Text style={styles.question}>Co chcesz zrobić?</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => setStep('create')}
        >
          <Text style={styles.primaryButtonText}>Stwórz rodzinę</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setStep('join')}
        >
          <Text style={styles.secondaryButtonText}>Dołącz do rodziny</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'create') {
    return (
      <View style={styles.container}>
        <Text style={styles.question}>Tworzymy Twoją rodzinę!</Text>
        <Text style={styles.hint}>
          Dostaniesz kod, który wyślij bliskim
        </Text>
        {loading ? (
          <ActivityIndicator size="large" color="#E8578B" />
        ) : (
          <Pressable style={styles.primaryButton} onPress={handleCreateFamily}>
            <Text style={styles.primaryButtonText}>Stwórz!</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setStep('choice')}>
          <Text style={styles.backLink}>Wstecz</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'join') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.question}>Wpisz kod rodziny</Text>
        <Text style={styles.hint}>
          Dostałeś go od bliskiej osoby
        </Text>
        <TextInput
          style={styles.codeInput}
          value={familyCode}
          onChangeText={setFamilyCode}
          placeholder="np. ABC123"
          placeholderTextColor="#CCC"
          autoCapitalize="characters"
          autoFocus
          maxLength={6}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#E8578B" />
        ) : (
          <Pressable
            style={[
              styles.primaryButton,
              familyCode.trim().length < 4 && styles.disabledButton,
            ]}
            onPress={handleJoinFamily}
            disabled={familyCode.trim().length < 4}
          >
            <Text style={styles.primaryButtonText}>Dołącz!</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setStep('choice')}>
          <Text style={styles.backLink}>Wstecz</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'code-display') {
    return (
      <View style={styles.container}>
        <Text style={styles.question}>Twoja rodzina gotowa!</Text>
        <Text style={styles.hint}>Wyślij ten kod bliskim:</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{displayCode}</Text>
        </View>
        <Text style={styles.hint}>
          Bliscy wpiszą ten kod w aplikacji Cmok
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.primaryButtonText}>Przejdź do aplikacji</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    padding: 32,
  },
  logo: {
    fontSize: 64,
    fontWeight: '800',
    color: '#E8578B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 22,
    color: '#7F5BA6',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E8578B',
    marginBottom: 8,
  },
  question: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    fontSize: 22,
    borderBottomWidth: 3,
    borderBottomColor: '#E8578B',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#333',
    marginBottom: 32,
  },
  codeInput: {
    width: '80%',
    fontSize: 32,
    fontWeight: '700',
    borderBottomWidth: 3,
    borderBottomColor: '#E8578B',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#333',
    marginBottom: 32,
    letterSpacing: 8,
  },
  codeBox: {
    backgroundColor: '#FFF',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#E8578B',
    letterSpacing: 8,
  },
  primaryButton: {
    backgroundColor: '#E8578B',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#7F5BA6',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#7F5BA6',
    fontSize: 20,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.4,
  },
  backLink: {
    color: '#999',
    fontSize: 16,
    marginTop: 8,
  },
});
