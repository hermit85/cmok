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
import { FloatingStars } from '../src/components/FloatingStars';
import { GeometricHeart } from '../src/components/GeometricHeart';

const FOLK_SHAPES = ['✦', '✧', '❋', '✿', '✻', '❊', '✾', '✽', '❁', '✺', '◆', '◇', '✦', '✧', '✦', '✧'];

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
    <Animated.View style={[styles.heartWrapper, { transform: [{ scale }] }]}>
      <GeometricHeart size={140} />
    </Animated.View>
  );
}

function GlowButton({
  onPress,
  label,
  disabled,
  style,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  style?: any;
}) {
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!disabled) {
      const glow = () => {
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]).start(() => glow());
      };
      glow();
    }
  }, [disabled, glowOpacity]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <PressableScale onPress={handlePress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabledButton, style]}>
      <Animated.View style={[styles.buttonGlow, { opacity: glowOpacity }]} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </PressableScale>
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

function StaggeredCode({ code }: { code: string }) {
  const letters = code.split('');
  const anims = useRef(letters.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20),
    scale: new Animated.Value(0.5),
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
    <View style={styles.staggeredCodeRow}>
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
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
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
        <FloatingStars />
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
          <Text style={styles.tagline}>
            Dla tych, którzy kochają z daleka 💫
          </Text>
        </FadeInView>
        <FadeInView delay={700}>
          <GlowButton onPress={() => setStep('name')} label="Zaczynamy ✦" />
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
        <FloatingStars />
        <FadeInView>
          <Text style={styles.question}>Jak masz na imię?</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="np. Mama, Tomek, Kasia..."
            placeholderTextColor="rgba(212,165,116,0.3)"
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && setStep('choice')}
          />
        </FadeInView>
        <FadeInView delay={400}>
          <GlowButton
            onPress={() => setStep('choice')}
            disabled={!name.trim()}
            label="Dalej"
          />
        </FadeInView>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'choice') {
    return (
      <View style={styles.container}>
        <FloatingStars />
        <FadeInView>
          <Text style={styles.greeting}>Cześć, {name}! ✦</Text>
        </FadeInView>
        <FadeInView delay={200}>
          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStep('create');
            }}
            style={styles.choiceCard}
          >
            <Text style={styles.choiceEmoji}>🏠</Text>
            <Text style={styles.choiceTitle}>Stwórz rodzinę</Text>
            <Text style={styles.choiceSub}>Dostaniesz kod dla bliskich</Text>
          </PressableScale>
        </FadeInView>
        <FadeInView delay={350}>
          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setStep('join');
            }}
            style={styles.choiceCard}
          >
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
        <FloatingStars />
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
            <GlowButton onPress={handleCreateFamily} label="Stwórz! ✦" />
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
        <FloatingStars />
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
          placeholderTextColor="rgba(212,165,116,0.2)"
          autoCapitalize="characters"
          autoFocus
          maxLength={6}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#D4A574" style={{ marginVertical: 20 }} />
        ) : (
          <GlowButton
            onPress={handleJoinFamily}
            disabled={familyCode.trim().length < 4}
            label="Dołącz! ✦"
          />
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
        <FloatingStars />
        <ConfettiOverlay />
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
          <GlowButton
            onPress={async () => {
              try {
                await Share.share({
                  message: `Dołącz do mojej rodziny w Cmok! ✦ Kod: ${displayCode}`,
                });
              } catch {}
            }}
            label="Udostępnij kod ✦"
            style={styles.shareBtn}
          />
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
    backgroundColor: '#1A1A2E',
    padding: 32,
  },
  // Heart
  heartWrapper: {
    marginBottom: 16,
  },
  // Typography
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F0E6D3',
    marginBottom: 8,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 22,
    color: '#D4A574',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(240,230,211,0.45)',
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#D4A574',
    marginBottom: 24,
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
  // Choice cards
  choiceCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.25)',
    alignItems: 'center',
  },
  choiceEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0E6D3',
    marginBottom: 4,
  },
  choiceSub: {
    fontSize: 14,
    color: 'rgba(212,165,116,0.6)',
  },
  // Inputs
  input: {
    width: '100%',
    fontSize: 24,
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
  // Code display
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(212,165,116,0.4)',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 6,
  },
  staggeredCodeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  staggeredLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: '#D4A574',
    marginHorizontal: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#E07A5F',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
  },
  primaryButtonText: {
    color: '#F0E6D3',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(212,165,116,0.5)',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#D4A574',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shareBtn: {
    backgroundColor: '#D4A574',
  },
  disabledButton: {
    opacity: 0.4,
  },
  backLink: {
    color: 'rgba(212,165,116,0.45)',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
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
});
