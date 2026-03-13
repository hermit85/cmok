import { useRef, useState, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GeometricHeart } from './GeometricHeart';

const HEART_EMOJIS = ['💕', '❤️', '💜', '💗', '💖', '🩷', '💘', '💝', '💓', '❤️‍🔥', '💕', '💗', '💜', '💖', '💗'];
const PARTICLE_COUNT = 15;

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const idleScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;
  const innerGlow = useRef(new Animated.Value(0)).current;
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

  // Idle breathing animation
  useEffect(() => {
    if (!disabled) {
      const breathe = () => {
        Animated.sequence([
          Animated.timing(idleScale, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
          Animated.timing(idleScale, { toValue: 1.0, duration: 2000, useNativeDriver: true }),
        ]).start(() => breathe());
      };
      breathe();

      // Glow ring gentle pulse
      const glowPulse = () => {
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.35, duration: 2500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.15, duration: 2500, useNativeDriver: true }),
        ]).start(() => glowPulse());
      };
      glowPulse();
    }
  }, [disabled, idleScale, glowOpacity]);

  // Sent label animation
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
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [sent, labelOpacity, sentLabelOpacity]);

  const explodeHearts = () => {
    setShowParticles(true);
    const animations = particles.map((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 100 + Math.random() * 150;

      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0.3);
      p.rotate.setValue(0);

      return Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 800, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance - 30, duration: 800, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: Math.random() * 2 - 1, duration: 800, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 0.8 + Math.random() * 0.4, duration: 250, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 550, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => setShowParticles(false));
  };

  const handlePress = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);

    // Easter egg: 5 rapid taps
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('😄', 'Oj, ktoś tu mocno tęskni!');
      return;
    }

    if (disabled) return;

    // 1. Haptic: Heavy
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // 2. BIG spring bounce: 1.0 → 1.4 → 0.9 → 1.05 → 1.0
    scale.stopAnimation();
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 30, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    // 3. Gold flash effect
    Animated.sequence([
      Animated.timing(innerGlow, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(innerGlow, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // 4. Heart emoji explosion
    explodeHearts();

    // 5. Additional haptic feedback
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);

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
              outputRange: ['-45deg', '0deg', '45deg'],
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

      {/* Outer glow ring */}
      <Animated.View style={[styles.outerRing, { opacity: glowOpacity }]} />

      {/* Inner ring */}
      <View style={styles.innerRing} />

      {/* Main heart button */}
      <Animated.View
        style={[
          styles.button,
          disabled && !sent && styles.disabled,
          { transform: [{ scale: Animated.multiply(scale, idleScale) }] },
        ]}
      >
        <Pressable onPress={handlePress} style={styles.pressable}>
          {/* Gold glow overlay (flash) */}
          <Animated.View style={[styles.goldFlash, { opacity: innerGlow }]} />

          {/* SVG Heart */}
          <GeometricHeart size={120} />
        </Pressable>
      </Animated.View>

      {/* Label */}
      <View style={styles.labelContainer}>
        <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>
          {disabled && !sent ? '' : 'Wyślij cmoka ✦'}
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
    height: 300,
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
    fontSize: 24,
  },
  outerRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4A574',
  },
  innerRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  button: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(30,42,74,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(212,165,116,0.4)',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  pressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 95,
    overflow: 'hidden',
  },
  goldFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 95,
    backgroundColor: 'rgba(212,165,116,0.25)',
  },
  labelContainer: {
    height: 30,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    color: '#D4A574',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
  sentLabel: {
    position: 'absolute',
    fontSize: 20,
    color: '#F0E6D3',
    textAlign: 'center',
    fontWeight: '700',
  },
});
