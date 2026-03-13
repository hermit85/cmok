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

const FOLK_SHAPES = ['✦', '✧', '❋', '✿', '✻', '❊', '✾', '✽', '❁', '✺', '◆', '◇', '⬡', '⬢', '✦', '✧'];

type Step = 'welcome' | 'name' | 'choice' | 'create' | 'join' | 'code-display';

function PulsingHeart() {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [scale, glow]);

  return (
    <View style={styles.heartWrapper}>
      <Animated.View style={[styles.heartGlow, { opacity: glow }]} />
      <Animated.View style={[styles.heartContainer, { transform: [{ scale }] }]}>
        {/* Geometric folk heart */}
        <View style={styles.heartShape}>
          <View style={[styles.heartLobe, styles.heartLeft]} />
          <View style={[styles.heartLobe, styles.heartRight]} />
        </View>
        <View style={styles.innerDiamond} />
        <View style={styles.centerDot} />
      </Animated.View>
    </View>
  );
}

function ConfettiOverlay() {
  const particles = useRef(
    Array.from({ length: 16 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = particles.map((p, i) => {
      const angle = (i / particles.length) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 100 + Math.random() * 80;

      return Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 1200, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance - 50, duration: 1200, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 1, duration: 1200, useNativeDriver: true }),
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
      {particles.map((p, i) => {
        const rotation = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.confettiParticle,
              {
                transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }, { rotate: rotation }],
                opacity: p.opacity,
              },
            ]}
          >
            {FOLK_SHAPES[i % FOLK_SHAPES.length]}
          </Animated.Text>
        );
      })}
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
        {/* Decorative corner elements */}
        <View style={styles.cornerTL}><Text style={styles.cornerText}>✦</Text></View>
        <View style={styles.cornerTR}><Text style={styles.cornerText}>✦</Text></View>
        <View style={styles.cornerBL}><Text style={styles.cornerText}>✧</Text></View>
        <View style={styles.cornerBR}><Text style={styles.cornerText}>✧</Text></View>

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
            <Text style={styles.primaryButtonText}>Zaczynamy ✦</Text>
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
            Twoi bliscy będą wiedzieć, że myślisz o nich ✦
          </Text>
        </FadeInView>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="np. Mama, Tomek, Kasia..."
          placeholderTextColor="rgba(212,165,116,0.35)"
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
          <Text style={styles.greeting}>Cześć, {name}! ✦</Text>
        </FadeInView>
        <FadeInView delay={100}>
          <Text style={styles.question}>Co chcesz zrobić?</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <PressableScale onPress={() => setStep('create')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>✦ Stwórz rodzinę</Text>
          </PressableScale>
        </FadeInView>
        <FadeInView delay={300}>
          <PressableScale onPress={() => setStep('join')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>✧ Dołącz do rodziny</Text>
          </PressableScale>
        </FadeInView>
      </View>
    );
  }

  if (step === 'create') {
    return (
      <View style={styles.container}>
        <FadeInView>
          <Text style={styles.question}>Tworzymy Twoją rodzinę! ✦</Text>
        </FadeInView>
        <FadeInView delay={100}>
          <Text style={styles.hint}>
            Dostaniesz kod, który wyślij bliskim
          </Text>
        </FadeInView>
        {loading ? (
          <ActivityIndicator size="large" color="#D4A574" style={{ marginVertical: 20 }} />
        ) : (
          <FadeInView delay={200}>
            <PressableScale onPress={handleCreateFamily} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Stwórz! ✦</Text>
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
            Dostałeś go od bliskiej osoby ✦
          </Text>
        </FadeInView>
        <TextInput
          style={styles.codeInput}
          value={familyCode}
          onChangeText={setFamilyCode}
          placeholder="ABC123"
          placeholderTextColor="rgba(212,165,116,0.25)"
          autoCapitalize="characters"
          autoFocus
          maxLength={6}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#D4A574" style={{ marginVertical: 20 }} />
        ) : (
          <PressableScale
            onPress={handleJoinFamily}
            disabled={familyCode.trim().length < 4}
            style={[styles.primaryButton, familyCode.trim().length < 4 && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Dołącz! ✦</Text>
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
          <Text style={styles.question}>Twoja rodzina gotowa! ✦</Text>
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
            Bliscy wpiszą ten kod w aplikacji Cmok ✦
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
    backgroundColor: '#1A1A2E',
    padding: 32,
  },
  // Decorative corners
  cornerTL: { position: 'absolute', top: 60, left: 24 },
  cornerTR: { position: 'absolute', top: 60, right: 24 },
  cornerBL: { position: 'absolute', bottom: 40, left: 24 },
  cornerBR: { position: 'absolute', bottom: 40, right: 24 },
  cornerText: { fontSize: 20, color: 'rgba(212,165,116,0.2)' },
  // Heart
  heartWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heartGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(200,90,90,0.15)',
  },
  heartContainer: {
    width: 80,
    height: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartShape: {
    width: 60,
    height: 52,
    position: 'relative',
  },
  heartLobe: {
    position: 'absolute',
    top: 0,
    width: 34,
    height: 52,
    borderRadius: 34,
    backgroundColor: '#C85A5A',
  },
  heartLeft: {
    left: 2,
    transform: [{ rotate: '-45deg' }],
  },
  heartRight: {
    right: 2,
    transform: [{ rotate: '45deg' }],
  },
  innerDiamond: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#D4A574',
    transform: [{ rotate: '45deg' }],
    top: 30,
  },
  centerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F0E6D3',
    top: 34,
  },
  // Confetti
  confettiContainer: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    fontSize: 22,
    color: '#D4A574',
  },
  // Typography
  logo: {
    fontSize: 64,
    fontWeight: '800',
    color: '#F0E6D3',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 22,
    color: 'rgba(212,165,116,0.7)',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#D4A574',
    marginBottom: 8,
  },
  question: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F0E6D3',
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    fontSize: 16,
    color: 'rgba(240,230,211,0.45)',
    textAlign: 'center',
    marginBottom: 24,
  },
  warmHint: {
    fontSize: 16,
    color: 'rgba(212,165,116,0.6)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  // Inputs
  input: {
    width: '100%',
    fontSize: 22,
    borderBottomWidth: 2,
    borderBottomColor: '#D4A574',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#F0E6D3',
    marginBottom: 32,
  },
  codeInput: {
    width: '80%',
    fontSize: 32,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: '#D4A574',
    paddingVertical: 12,
    textAlign: 'center',
    color: '#F0E6D3',
    marginBottom: 32,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 36,
    paddingVertical: 22,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#D4A574',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#D4A574',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Buttons
  primaryButton: {
    backgroundColor: 'rgba(200,90,90,0.9)',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.3)',
    shadowColor: '#C85A5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#F0E6D3',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#D4A574',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#D4A574',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.4,
  },
  backLink: {
    color: 'rgba(212,165,116,0.5)',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
});
