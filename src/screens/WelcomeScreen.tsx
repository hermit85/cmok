import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMotif } from '../components/BrandMotif';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { FeatureFlags } from '../constants/featureFlags';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(-10)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(logoTranslateY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.timing(buttonsOpacity, {
      toValue: 1, duration: 500, delay: 300, useNativeDriver: true,
    }).start();
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
          <BrandMotif size={72} />
          <Text style={styles.tagline}>
            Jeden spokojny znak{'\n'}dziennie od bliskiej osoby
          </Text>
          <Text style={styles.supporting}>
            {FeatureFlags.ALLOW_ORGANIC_SIGNUP
              ? 'Mniej dzwonienia z niepokoju. Więcej zwykłej bliskości.'
              : 'Cmok działa w parach. Poproś bliską osobę o zaproszenie lub wpisz kod, który dostałeś/aś.'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.bottom, { opacity: buttonsOpacity }]}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.primaryBtnText}>{FeatureFlags.ALLOW_ORGANIC_SIGNUP ? 'Zacznij' : 'Mam kod zaproszenia'}</Text>
        </Pressable>
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
    fontSize: Typography.display,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
  },
  tagline: {
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginTop: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  supporting: {
    fontSize: Typography.body,
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
    minHeight: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
});
