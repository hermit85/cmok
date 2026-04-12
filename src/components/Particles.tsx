import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';

const DEFAULT_COLORS = [Colors.safe, Colors.love, Colors.highlight, Colors.delight];

interface ParticlesProps {
  visible: boolean;
  count?: number;
  colors?: string[];
}

interface Particle {
  translateX: Animated.Value;
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  size: number;
  angle: number;
  distance: number;
  delay: number;
}

export function Particles({ visible, count = 14, colors = DEFAULT_COLORS }: ParticlesProps) {
  const particles = useRef<Particle[]>(
    Array.from({ length: count }, (_, i) => ({
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: colors[i % colors.length],
      size: 4 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      distance: 80 + Math.random() * 40,
      delay: Math.random() * 150,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    particles.forEach((p) => {
      p.translateX.setValue(0);
      p.translateY.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(1);
    });

    const animations = particles.map((p) => {
      const targetX = Math.cos(p.angle) * p.distance;
      const targetY = Math.sin(p.angle) * p.distance + 40; // gravity pull down

      return Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.translateX, { toValue: targetX, duration: 1000, useNativeDriver: true }),
          Animated.timing(p.translateY, { toValue: targetY, duration: 1000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.scale, { toValue: 1.3, duration: 200, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.translateX },
                { translateY: p.translateY },
                { scale: p.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
  },
});
