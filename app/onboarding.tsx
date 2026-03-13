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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { usePushToken } from '../src/notifications/usePushToken';
import { createFamily, joinFamily } from '../src/api/family';
import { PressableScale } from '../src/components/PressableScale';

const CONFETTI = ['💜', '💗', '💕', '🩷', '💖', '✨', '🎉', '💝'];

type Step = 'welcome' | 'name' | 'choice' | 'create' | 'join' | 'code-display';

function PulsingHeart() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);

  return (
    <Animated.Text style={[styles.bigHeart, { transform: [{ scale }] }]}>
      💜
    </Animated.Text>
  );
}

function ConfettiOverlay() {
  const particles = useRef(
    Array.from({ length: 16 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = particles.map((p, i) => {
      const angle = (i / particles.length) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 100 + Math.random() * 80;

      return Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 1200, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance - 50, duration: 1200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1.5, duration: 300, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.stagger(50, animations).start();
  }, [particles]);

  return (
    <View style={styles.confettiContainer}>
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.confettiParticle,
            {
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              opacity: p.opacity,
            },
          ]}
        >
          {CONFETTI[i % CONFETTI.length]}
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
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
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
        <FadeInView delay={600}>
          <PressableScale onPress={() => setStep('name')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Zaczynamy! 🎉</Text>
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
          <Text style={styles.question}>Jak masz na imię?</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <Text style={styles.warmHint}>
            Twoi bliscy będą wiedzieć, że myślisz o nich 💜
          </Text>
        </FadeInView>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="np. Mama, Tomek, Kasia..."
          placeholderTextColor="#D4A0B0"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => name.trim() && setStep('choice')}
        />
        <PressableScale
          onPress={() => setStep('choice')}
          disabled={!name.trim()}
          style={[styles.primaryButton, !name.trim() && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>Dalej</Text>
        </PressableScale>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'choice') {
    return (
      <View style={styles.container}>
        <FadeInView>
          <Text style={styles.greeting}>Cześć, {name}! 👋</Text>
        </FadeInView>
        <FadeInView delay={100}>
          <Text style={styles.question}>Co chcesz zrobić?</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <PressableScale onPress={() => setStep('create')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>🏠 Stwórz rodzinę</Text>
          </PressableScale>
        </FadeInView>
        <FadeInView delay={300}>
          <PressableScale onPress={() => setStep('join')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>🤝 Dołącz do rodziny</Text>
          </PressableScale>
        </FadeInView>
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
          <Text style={styles.hint}>
            Dostaniesz kod, który wyślij bliskim
          </Text>
        </FadeInView>
        {loading ? (
          <ActivityIndicator size="large" color="#E8578B" style={{ marginVertical: 20 }} />
        ) : (
          <FadeInView delay={200}>
            <PressableScale onPress={handleCreateFamily} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Stwórz! ✨</Text>
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
          <Text style={styles.hint}>
            Dostałeś go od bliskiej osoby 💌
          </Text>
        </FadeInView>
        <TextInput
          style={styles.codeInput}
          value={familyCode}
          onChangeText={setFamilyCode}
          placeholder="np. ABC123"
          placeholderTextColor="#D4A0B0"
          autoCapitalize="characters"
          autoFocus
          maxLength={6}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#E8578B" style={{ marginVertical: 20 }} />
        ) : (
          <PressableScale
            onPress={handleJoinFamily}
            disabled={familyCode.trim().length < 4}
            style={[styles.primaryButton, familyCode.trim().length < 4 && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Dołącz! 🎉</Text>
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
        <ConfettiOverlay />
        <FadeInView>
          <Text style={styles.question}>Twoja rodzina gotowa! 🎉</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <Text style={styles.hint}>Wyślij ten kod bliskim:</Text>
        </FadeInView>
        <FadeInView delay={400}>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{displayCode}</Text>
          </View>
        </FadeInView>
        <FadeInView delay={600}>
          <Text style={styles.warmHint}>
            Bliscy wpiszą ten kod w aplikacji Cmok 💜
          </Text>
        </FadeInView>
        <FadeInView delay={800}>
          <PressableScale onPress={() => router.replace('/home')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Przejdź do aplikacji →</Text>
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
    backgroundColor: '#FFF5F7',
    padding: 32,
  },
  bigHeart: {
    fontSize: 80,
    marginBottom: 8,
  },
  confettiContainer: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    fontSize: 28,
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
  warmHint: {
    fontSize: 16,
    color: '#C48FA3',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
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
    paddingHorizontal: 36,
    paddingVertical: 22,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FDDDE6',
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
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#C48FA3',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
});
