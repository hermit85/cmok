import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif } from '../components/BrandMotif';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const router = useRouter();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(-10)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  // Breathing animation for brand motif dots
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(logoTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.timing(buttonsOpacity, {
      toValue: 1, duration: 500, delay: 300, useNativeDriver: true,
    }).start();

    // Subtle breathing loop for the motif
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoArea,
            { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] },
          ]}
        >
          <Text style={styles.logo}>Cmok</Text>
          <Animated.View style={{ transform: [{ scale: breathe }] }}>
            <BrandMotif size={48} />
          </Animated.View>
          <Text style={styles.tagline}>
            Jeden spokojny znak{'\n'}dziennie od bliskiej osoby
          </Text>
          <Text style={styles.supporting}>
            Mniej martwienia się.{'\n'}Więcej spokoju.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, { opacity: buttonsOpacity }]}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.primaryBtnText}>Zacznij</Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable onPress={() => router.push('/dev-screens' as any)} style={({ pressed }) => [styles.devLink, pressed && { opacity: 0.5 }]}>
            <Text style={styles.devLinkText}>🔧 Dev: preview all screens</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 36,
  },
  logoArea: {
    alignItems: 'center',
    maxWidth: 340,
  },
  logo: {
    fontSize: 40,
    fontFamily: Typography.headingFamily,
    color: Colors.accent,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 26,
    fontFamily: Typography.headingFamily,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 34,
    marginTop: 20,
  },
  supporting: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 280,
  },
  bottom: {
    gap: 10,
    paddingBottom: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    minHeight: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E85D3A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: Typography.headingFamily,
    color: '#FFFFFF',
  },
  devLink: { marginTop: 16, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  devLinkText: { fontSize: 13, color: Colors.textMuted },
});
