import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../src/store/useAppStore';
import { usePushToken } from '../src/notifications/usePushToken';
import { createFamily, joinFamily } from '../src/api/family';
import { PressableScale } from '../src/components/PressableScale';

type Step = 'welcome' | 'name' | 'choice' | 'create' | 'join' | 'code-display';

function PulsingHeart() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]).start(() => pulse());
    };
    pulse();
  }, [scale]);

  return (
    <Animated.Text style={[styles.bigHeart, { transform: [{ scale }] }]}>
      ❤️
    </Animated.Text>
  );
}

function StaggeredCode({ code }: { code: string }) {
  const letters = code.split('');
  const anims = useRef(letters.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(15),
    scale: new Animated.Value(0.6),
  }))).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, { toValue: 1, duration: 300, delay: i * 100, useNativeDriver: true }),
        Animated.spring(a.translateY, { toValue: 0, delay: i * 100, useNativeDriver: true, speed: 12, bounciness: 12 }),
        Animated.spring(a.scale, { toValue: 1, delay: i * 100, useNativeDriver: true, speed: 12, bounciness: 12 }),
      ])
    );
    Animated.stagger(50, animations).start();
  }, [anims]);

  return (
    <View style={styles.staggeredRow}>
      {letters.map((letter, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.staggeredLetter,
            {
              opacity: anims[i].opacity,
              transform: [{ translateY: anims[i].translateY }, { scale: anims[i].scale }],
            },
          ]}
        >
          {letter}
        </Animated.Text>
      ))}
    </View>
  );
}

function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

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
        <FadeInView>
          <PulsingHeart />
        </FadeInView>
        <FadeInView delay={200}>
          <Text style={styles.logo}>Cmok</Text>
        </FadeInView>
        <FadeInView delay={400}>
          <Text style={styles.subtitle}>
            Wyślij buziaczka{'\n'}komuś bliskiemu
          </Text>
        </FadeInView>
        <FadeInView delay={500}>
          <Text style={styles.tagline}>Dla tych, którzy kochają z daleka</Text>
        </FadeInView>
        <FadeInView delay={700}>
          <PressableScale onPress={() => setStep('name')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Zaczynamy!</Text>
          </PressableScale>
        </FadeInView>
      </View>
    );
  }

  if (step === 'name') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FadeInView>
          <View style={styles.card}>
            <Text style={styles.question}>Jak masz na imię?</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="np. Mama, Tomek, Kasia..."
              placeholderTextColor="#C4B5A5"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && setStep('choice')}
            />
          </View>
        </FadeInView>
        <FadeInView delay={200}>
          <PressableScale
            onPress={() => setStep('choice')}
            disabled={!name.trim()}
            style={[styles.primaryButton, !name.trim() && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Dalej</Text>
          </PressableScale>
        </FadeInView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'choice') {
    return (
      <View style={styles.container}>
        <FadeInView>
          <Text style={styles.greeting}>Cześć, {name}! 👋</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <PressableScale onPress={() => setStep('create')} style={styles.choiceCard}>
            <Text style={styles.choiceEmoji}>🏠</Text>
            <Text style={styles.choiceTitle}>Stwórz rodzinę</Text>
            <Text style={styles.choiceSub}>Dostaniesz kod dla bliskich</Text>
          </PressableScale>
        </FadeInView>
        <FadeInView delay={350}>
          <PressableScale onPress={() => setStep('join')} style={styles.choiceCard}>
            <Text style={styles.choiceEmoji}>🔗</Text>
            <Text style={styles.choiceTitle}>Dołącz do rodziny</Text>
            <Text style={styles.choiceSub}>Masz kod od kogoś bliskiego?</Text>
          </PressableScale>
        </FadeInView>
        <PressableScale onPress={() => setStep('name')}>
          <Text style={styles.backLink}>← Wstecz</Text>
        </PressableScale>
      </View>
    );
  }

  if (step === 'create') {
    return (
      <View style={styles.container}>
        <FadeInView>
          <Text style={styles.question}>Tworzymy Twoją rodzinę! 🏠</Text>
        </FadeInView>
        <FadeInView delay={100}>
          <Text style={styles.hint}>Dostaniesz kod, który wyślij bliskim</Text>
        </FadeInView>
        {loading ? (
          <ActivityIndicator size="large" color="#E07A5F" style={{ marginVertical: 20 }} />
        ) : (
          <FadeInView delay={200}>
            <PressableScale onPress={handleCreateFamily} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Stwórz!</Text>
            </PressableScale>
          </FadeInView>
        )}
        <PressableScale onPress={() => setStep('choice')}>
          <Text style={styles.backLink}>← Wstecz</Text>
        </PressableScale>
      </View>
    );
  }

  if (step === 'join') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FadeInView>
          <Text style={styles.question}>Wpisz kod rodziny</Text>
        </FadeInView>
        <FadeInView delay={100}>
          <Text style={styles.hint}>Dostałeś go od bliskiej osoby 💌</Text>
        </FadeInView>
        <View style={styles.card}>
          <TextInput
            style={styles.codeInput}
            value={familyCode}
            onChangeText={setFamilyCode}
            placeholder="ABC123"
            placeholderTextColor="#C4B5A5"
            autoCapitalize="characters"
            autoFocus
            maxLength={6}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#E07A5F" style={{ marginVertical: 20 }} />
        ) : (
          <PressableScale
            onPress={handleJoinFamily}
            disabled={familyCode.trim().length < 4}
            style={[styles.primaryButton, familyCode.trim().length < 4 && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Dołącz!</Text>
          </PressableScale>
        )}
        <PressableScale onPress={() => setStep('choice')}>
          <Text style={styles.backLink}>← Wstecz</Text>
        </PressableScale>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'code-display') {
    return (
      <View style={styles.container}>
        <FadeInView>
          <Text style={styles.question}>Twoja rodzina gotowa! 🎉</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <Text style={styles.hint}>Wyślij ten kod bliskim:</Text>
        </FadeInView>
        <View style={styles.codeBox}>
          <StaggeredCode code={displayCode} />
        </View>
        <FadeInView delay={800}>
          <PressableScale
            onPress={async () => {
              try {
                await Share.share({
                  message: `Dołącz do mojej rodziny w Cmok! ❤️ Kod: ${displayCode}`,
                });
              } catch {}
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Udostępnij kod</Text>
          </PressableScale>
        </FadeInView>
        <FadeInView delay={1000}>
          <PressableScale onPress={() => router.replace('/home')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Przejdź do apki →</Text>
          </PressableScale>
        </FadeInView>
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
    backgroundColor: '#FDF6F0',
    padding: 32,
  },
  bigHeart: {
    fontSize: 60,
    marginBottom: 8,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#3D2C2C',
    marginBottom: 8,
    fontFamily: 'Nunito_800ExtraBold',
  },
  subtitle: {
    fontSize: 22,
    color: '#E07A5F',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
    fontFamily: 'Nunito_600SemiBold',
  },
  tagline: {
    fontSize: 15,
    color: '#8B7E7E',
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
    fontFamily: 'Nunito_400Regular',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3D2C2C',
    marginBottom: 24,
    fontFamily: 'Nunito_700Bold',
  },
  question: {
    fontSize: 26,
    fontWeight: '700',
    color: '#3D2C2C',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Nunito_700Bold',
  },
  hint: {
    fontSize: 16,
    color: '#8B7E7E',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Nunito_400Regular',
  },
  // Cards
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  choiceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  choiceEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D2C2C',
    marginBottom: 4,
    fontFamily: 'Nunito_700Bold',
  },
  choiceSub: {
    fontSize: 14,
    color: '#8B7E7E',
    fontFamily: 'Nunito_400Regular',
  },
  // Inputs
  input: {
    fontSize: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#E07A5F',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#3D2C2C',
    fontFamily: 'Nunito_400Regular',
  },
  codeInput: {
    fontSize: 32,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: '#E07A5F',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#3D2C2C',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Code display
  codeBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  staggeredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  staggeredLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: '#3D2C2C',
    marginHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#E07A5F',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 14,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  secondaryButton: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E07A5F',
  },
  secondaryButtonText: {
    color: '#E07A5F',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
  disabledButton: {
    opacity: 0.4,
  },
  backLink: {
    color: '#8B7E7E',
    fontSize: 16,
    marginTop: 12,
    fontFamily: 'Nunito_500Medium',
  },
});
