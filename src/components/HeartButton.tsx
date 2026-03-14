import { useRef, useState, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

const HEART_EMOJIS = ['💕', '❤️', '🧡', '💛', '💗', '💖', '🩷', '💘', '💝', '💓', '💕', '❤️'];
const PARTICLE_COUNT = 12;

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const idleScale = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const sentLabelOpacity = useRef(new Animated.Value(0)).current;
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  const [showParticles, setShowParticles] = useState(false);
  const [showSentLabel, setShowSentLabel] = useState(false);

  // Idle breathing — very subtle
  useEffect(() => {
    if (!disabled) {
      const breathe = () => {
        Animated.sequence([
          Animated.timing(idleScale, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
          Animated.timing(idleScale, { toValue: 1.0, duration: 1500, useNativeDriver: true }),
        ]).start(() => breathe());
      };
      breathe();
    }
  }, [disabled, idleScale]);

  // Sent label swap
  useEffect(() => {
    if (sent) {
      setShowSentLabel(true);
      Animated.parallel([
        Animated.timing(labelOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sentLabelOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(sentLabelOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(labelOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowSentLabel(false));
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [sent, labelOpacity, sentLabelOpacity]);

  const explodeHearts = () => {
    setShowParticles(true);
    const animations = particles.map((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const distance = 100 + Math.random() * 150;

      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0.3);
      p.rotate.setValue(0);

      return Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 800, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance - 40, duration: 800, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: Math.random() * 2 - 1, duration: 800, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 0.7 + Math.random() * 0.5, duration: 200, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => setShowParticles(false));
  };

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(scale, { toValue: 0.92, duration: 100, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.stopAnimation();
    scale.setValue(0.92);
  };

  const handlePress = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('😄', 'Oj, ktoś tu mocno tęskni!');
      return;
    }

    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Bounce: 1.0 → 1.3 → 0.95 → 1.05 → 1.0
    scale.stopAnimation();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    explodeHearts();
    onPress();
  };

  return (
    <View style={styles.wrapper}>
      {/* Flying heart emoji particles */}
      {showParticles && (
        <View style={styles.particlesContainer}>
          {particles.map((p, i) => {
            const rotation = p.rotate.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ['-30deg', '0deg', '30deg'],
            });
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.particle,
                  {
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { scale: p.scale },
                      { rotate: rotation },
                    ],
                    opacity: p.opacity,
                  },
                ]}
              >
                {HEART_EMOJIS[i % HEART_EMOJIS.length]}
              </Animated.Text>
            );
          })}
        </View>
      )}

      {/* Main heart button */}
      <Animated.View
        style={[
          styles.heartButton,
          disabled && !sent && styles.heartDisabled,
          { transform: [{ scale: Animated.multiply(scale, idleScale) }] },
        ]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.pressable}
        >
          <Text style={styles.heartEmoji}>❤️</Text>
        </Pressable>
      </Animated.View>

      {/* Label */}
      <View style={styles.labelContainer}>
        <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>
          {disabled && !sent ? '' : 'Kliknij aby wysłać cmoka'}
        </Animated.Text>
        {showSentLabel && (
          <Animated.Text style={[styles.sentLabel, { opacity: sentLabelOpacity }]}>
            Cmok wysłany! 😘
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 260,
  },
  particlesContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    fontSize: 26,
  },
  heartButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E07A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  heartDisabled: {
    opacity: 0.5,
  },
  pressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 80,
  },
  heartEmoji: {
    fontSize: 72,
  },
  labelContainer: {
    height: 28,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#E07A5F',
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
  },
  sentLabel: {
    position: 'absolute',
    fontSize: 20,
    color: '#3D2C2C',
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
});
