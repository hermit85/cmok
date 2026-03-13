import { useRef, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

const PARTICLE_COUNT = 10;
const FOLK_SHAPES = ['✦', '✧', '❋', '✿', '✻', '❊', '✾', '✽', '❁', '✺'];

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const innerGlow = useRef(new Animated.Value(0)).current;
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

  const explodeParticles = () => {
    setShowParticles(true);
    const animations = particles.map((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 90 + Math.random() * 50;

      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0.2);
      p.rotate.setValue(0);

      return Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 800, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance, duration: 800, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1, duration: 250, useNativeDriver: true }),
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
    if (disabled && !sent) {
      // Still count taps for easter egg even when disabled
    }

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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Heart spring animation
    scale.stopAnimation();
    scale.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    // Gold glow flash
    Animated.sequence([
      Animated.timing(innerGlow, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(innerGlow, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Glow ring pulse
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 0.8, duration: 150, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
    ]).start();

    explodeParticles();

    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);

    onPress();
  };

  return (
    <View style={styles.wrapper}>
      {/* Folk particles */}
      {showParticles && (
        <View style={styles.particlesContainer}>
          {particles.map((p, i) => {
            const rotation = p.rotate.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
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
                {FOLK_SHAPES[i % FOLK_SHAPES.length]}
              </Animated.Text>
            );
          })}
        </View>
      )}

      {/* Outer glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

      {/* Main button */}
      <Animated.View style={[styles.button, disabled && !sent && styles.disabled, { transform: [{ scale }] }]}>
        <Pressable onPress={handlePress} style={styles.inner}>
          {/* Gold glow overlay */}
          <Animated.View style={[styles.goldGlow, { opacity: innerGlow }]} />

          {/* Geometric folk heart */}
          <View style={styles.heartOuter}>
            {/* Main heart lobes */}
            <View style={styles.heartShape}>
              <View style={[styles.heartLobe, styles.heartLeft]} />
              <View style={[styles.heartLobe, styles.heartRight]} />
            </View>
            {/* Inner diamond decoration (folk style) */}
            <View style={styles.innerDiamond} />
            {/* Center dot */}
            <View style={styles.centerDot} />
          </View>

          {sent && (
            <View style={styles.sentBadge}>
              <Text style={styles.sentText}>✓</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Text style={styles.label}>
        {sent ? 'Cmok wysłany! ✦' : disabled ? 'Za chwilę...' : 'Wyślij cmoka'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
  particlesContainer: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    fontSize: 20,
    color: '#D4A574',
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4A574',
  },
  button: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#1E2A4A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4A574',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 85,
    backgroundColor: 'rgba(212,165,116,0.15)',
  },
  heartOuter: {
    width: 80,
    height: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartShape: {
    width: 80,
    height: 70,
    position: 'relative',
  },
  heartLobe: {
    position: 'absolute',
    top: 0,
    width: 46,
    height: 70,
    borderRadius: 46,
    backgroundColor: '#C85A5A',
  },
  heartLeft: {
    left: 3,
    transform: [{ rotate: '-45deg' }],
  },
  heartRight: {
    right: 3,
    transform: [{ rotate: '45deg' }],
  },
  innerDiamond: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: '#D4A574',
    transform: [{ rotate: '45deg' }],
    top: 22,
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0E6D3',
    top: 27,
  },
  sentBadge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D4A574',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentText: {
    color: '#1A1A2E',
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 16,
    color: '#D4A574',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
