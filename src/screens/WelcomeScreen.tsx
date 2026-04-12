import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif } from '../components/BrandMotif';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { haptics } from '../utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

interface WelcomeScreenProps {
  onStart: () => void;
}

const SLIDES = [
  {
    headline: 'Codzienny znak,\nże wszystko OK',
    body: 'Dla Ciebie i Twoich bliskich.\nBez dzwonienia, bez stresu.',
  },
  {
    headline: 'Jeden gest dziennie.\nSpokój dla obu stron.',
    body: 'Ty dajesz znak albo go dostajesz.\nProste jak cmok na dzień dobry.',
  },
  {
    headline: 'Stwórz swój krąg\nbliskich osób',
    body: 'Im więcej osób w kręgu,\ntym większe bezpieczeństwo.',
  },
];

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;

  // Breathing for motif
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const goNext = useCallback(() => {
    haptics.light();
    if (slide >= SLIDES.length - 1) {
      onStart();
      return;
    }
    // Cross-fade to next slide
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSlide((s) => s + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [slide, fadeAnim, onStart]);

  const isLast = slide >= SLIDES.length - 1;
  const current = SLIDES[slide];

  return (
    <SafeAreaView style={s.container}>
      {/* Logo — always visible */}
      <View style={s.logoRow}>
        <Text style={s.logo}>Cmok</Text>
        <Animated.View style={{ transform: [{ scale: breathe }] }}>
          <BrandMotif size={40} />
        </Animated.View>
      </View>

      {/* Slide content */}
      <Animated.View style={[s.slideArea, { opacity: fadeAnim }]}>
        <Text style={s.headline}>{current.headline}</Text>
        <Text style={s.body}>{current.body}</Text>
      </Animated.View>

      {/* Dots + CTA */}
      <View style={s.bottom}>
        {/* Dot indicators */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === slide && s.dotActive]} />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={s.primaryBtnText}>{isLast ? 'Zacznij' : 'Dalej'}</Text>
        </Pressable>

        {slide === 0 && !isLast ? (
          <Pressable onPress={onStart} style={({ pressed }) => [s.skipLink, pressed && { opacity: 0.5 }]}>
            <Text style={s.skipText}>Mam już konto</Text>
          </Pressable>
        ) : null}

        {__DEV__ ? (
          <Pressable onPress={() => router.push('/dev-screens' as any)} style={({ pressed }) => [s.devLink, pressed && { opacity: 0.5 }]}>
            <Text style={s.devLinkText}>Dev: preview all screens</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background,
    justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 22,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingTop: 24, marginBottom: 8,
  },
  logo: {
    fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.accent,
  },
  slideArea: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8,
  },
  headline: {
    fontSize: 28, fontFamily: Typography.headingFamily, color: Colors.text,
    textAlign: 'center', lineHeight: 36, marginBottom: 16,
  },
  body: {
    fontSize: 16, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 24, maxWidth: 300,
  },
  bottom: { paddingBottom: 4 },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border,
  },
  dotActive: { backgroundColor: Colors.accent, width: 24 },
  primaryBtn: {
    backgroundColor: Colors.accent, minHeight: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 5,
  },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  skipLink: { marginTop: 14, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 15, color: Colors.textSecondary },
  devLink: { marginTop: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  devLinkText: { fontSize: 13, color: Colors.textMuted },
});
