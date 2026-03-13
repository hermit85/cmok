import { useRef, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Dimensions, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 12;
const HEARTS = ['💜', '💗', '💕', '💖', '🩷', '💝'];

interface HeartButtonProps {
  onPress: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HeartButton({ onPress, disabled, sent }: HeartButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const bgWarm = useRef(new Animated.Value(0)).current;
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Particle animations
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const [showParticles, setShowParticles] = useState(false);

  const explodeParticles = () => {
    setShowParticles(true);
    const animations = particles.map((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 80 + Math.random() * 60;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;

      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0.3);

      return Animated.parallel([
        Animated.timing(p.x, { toValue: targetX, duration: 600, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: targetY, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => setShowParticles(false));
  };

  const handlePress = () => {
    // Easter egg: 5 rapid taps
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('😄', 'Spokojnie, Twoi bliscy wiedzą że ich kochasz!');
      return;
    }

    // Light haptic on touch
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Spring heart animation
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 15 }),
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();

    // Glow pulse
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 0.6, duration: 150, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // Warm background flash
    Animated.sequence([
      Animated.timing(bgWarm, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(bgWarm, { toValue: 0, duration: 800, useNativeDriver: false }),
    ]).start();

    // Explode particles
    explodeParticles();

    // Heavy haptic on send
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 100);

    // Success haptic after animation
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 400);

    onPress();
  };

  const bgColor = bgWarm.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,245,247,0)', 'rgba(232,87,139,0.08)'],
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.warmBg, { backgroundColor: bgColor }]} />

      {/* Particles */}
      {showParticles && (
        <View style={styles.particlesContainer}>
          {particles.map((p, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.particle,
                {
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { scale: p.scale },
                  ],
                  opacity: p.opacity,
                },
              ]}
            >
              {HEARTS[i % HEARTS.length]}
            </Animated.Text>
          ))}
        </View>
      )}

      {/* Glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

      {/* Main heart button */}
      <Animated.View style={[styles.button, disabled && styles.disabled, { transform: [{ scale }] }]}>
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          style={({ pressed }) => [styles.inner, pressed && styles.pressed]}
        >
          {/* Custom drawn heart using Views */}
          <View style={styles.heartShape}>
            <View style={[styles.heartPiece, styles.heartLeft]} />
            <View style={[styles.heartPiece, styles.heartRight]} />
          </View>
          {sent && <Text style={styles.sentOverlay}>💜</Text>}
        </Pressable>
      </Animated.View>

      <Text style={styles.label}>
        {sent ? 'Cmok wysłany! 💜' : disabled ? 'Za chwilę...' : 'Wyślij cmoka'}
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
  warmBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 200,
  },
  particlesContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    fontSize: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#E8578B',
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8578B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
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
  pressed: {
    opacity: 0.9,
  },
  // Custom heart shape
  heartShape: {
    width: 90,
    height: 80,
    position: 'relative',
    marginTop: -5,
  },
  heartPiece: {
    position: 'absolute',
    top: 0,
    width: 52,
    height: 80,
    borderRadius: 52,
    backgroundColor: '#E8578B',
  },
  heartLeft: {
    left: 5,
    transform: [{ rotate: '-45deg' }],
  },
  heartRight: {
    right: 5,
    transform: [{ rotate: '45deg' }],
  },
  sentOverlay: {
    position: 'absolute',
    fontSize: 60,
  },
  label: {
    fontSize: 16,
    color: '#7F5BA6',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});
