import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif } from '../components/BrandMotif';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { haptics } from '../utils/haptics';

interface WelcomeScreenProps {
  onStart: () => void;
  onLogin?: () => void;
}

const SLIDES = [
  {
    headline: 'Mały znak,\ndużo spokoju',
    body: 'Gdy bliska osoba mieszka osobno, jeden codzienny gest potrafi znaczyć naprawdę dużo.',
  },
  {
    headline: 'Stukasz raz\ni druga strona wie',
    body: 'Bez telefonów, bez SMS-ów, bez zamieszania. Po prostu prosty rytuał, który daje ulgę.',
  },
  {
    headline: 'Jeśli dzieje się\ncoś ważnego',
    body: 'Jeden przycisk i cały krąg bliskich od razu dostanie sygnał.',
  },
];

const SWIPE_THRESHOLD = 50;

export function WelcomeScreen({ onStart, onLogin }: WelcomeScreenProps) {
  const [slide, setSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;

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

  const animateToSlide = useCallback((next: number, direction: 'left' | 'right') => {
    const out = direction === 'left' ? -80 : 80;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: out, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setSlide(next);
      translateX.setValue(direction === 'left' ? 80 : -80);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, translateX]);

  const goNext = useCallback(() => {
    haptics.light();
    if (slide >= SLIDES.length - 1) {
      onStart();
      return;
    }
    animateToSlide(slide + 1, 'left');
  }, [slide, onStart, animateToSlide]);

  const goPrev = useCallback(() => {
    if (slide <= 0) return;
    haptics.light();
    animateToSlide(slide - 1, 'right');
  }, [slide, animateToSlide]);

  // Swipe gesture — refs to avoid stale closure in PanResponder
  const slideRef = useRef(slide);
  slideRef.current = slide;
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const goPrevRef = useRef(goPrev);
  goPrevRef.current = goPrev;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < 30,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD && slideRef.current < SLIDES.length - 1) {
          goNextRef.current();
        } else if (gs.dx > SWIPE_THRESHOLD && slideRef.current > 0) {
          goPrevRef.current();
        }
      },
    })
  ).current;

  const isLast = slide >= SLIDES.length - 1;
  const current = SLIDES[slide];

  return (
    <SafeAreaView style={s.container}>
      {/* Logo */}
      <View style={s.logoRow}>
        <Text style={s.logo}>cmok</Text>
        <Animated.View style={{ transform: [{ scale: breathe }] }}>
          <BrandMotif size={40} />
        </Animated.View>
      </View>

      {/* Slide content — swipeable */}
      <Animated.View
        style={[s.slideArea, { opacity: fadeAnim, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={s.headline}>{current.headline}</Text>
        <Text style={s.body}>{current.body}</Text>
      </Animated.View>

      {/* Bottom — fixed height so CTA doesn't jump */}
      <View style={s.bottom}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === slide && s.dotActive]} />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Zacznij używać cmok' : 'Dalej'}
        >
          <Text style={s.primaryBtnText}>{isLast ? 'Zacznij' : 'Dalej'}</Text>
        </Pressable>

        <Pressable
          onPress={() => { haptics.light(); (onLogin || onStart)(); }}
          style={({ pressed }) => [s.loginLink, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Mam już konto, zaloguj"
        >
          <Text style={s.loginText}>Mam już konto</Text>
        </Pressable>
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
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 5,
  },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  loginLink: { marginTop: 14, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  loginText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
});
