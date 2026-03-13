import { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  translateX: Animated.Value;
  translateY: Animated.Value;
  duration: number;
}

function createStar(index: number): Star {
  // Deterministic but varied positions
  const positions = [
    { x: 0.15, y: 0.12 },
    { x: 0.82, y: 0.08 },
    { x: 0.08, y: 0.45 },
    { x: 0.88, y: 0.38 },
    { x: 0.5, y: 0.7 },
    { x: 0.25, y: 0.85 },
  ];
  const pos = positions[index % positions.length];

  return {
    x: pos.x * SCREEN_W,
    y: pos.y * SCREEN_H,
    size: 14 + (index % 3) * 6,
    opacity: new Animated.Value(0.1 + (index % 3) * 0.08),
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    duration: 4000 + index * 1200,
  };
}

export function FloatingStars() {
  const stars = useRef(Array.from({ length: 6 }, (_, i) => createStar(i))).current;

  useEffect(() => {
    stars.forEach((star) => {
      // Gentle floating motion
      const animateX = () => {
        Animated.sequence([
          Animated.timing(star.translateX, {
            toValue: 8 + Math.random() * 12,
            duration: star.duration,
            useNativeDriver: true,
          }),
          Animated.timing(star.translateX, {
            toValue: -(8 + Math.random() * 12),
            duration: star.duration * 1.1,
            useNativeDriver: true,
          }),
        ]).start(() => animateX());
      };

      const animateY = () => {
        Animated.sequence([
          Animated.timing(star.translateY, {
            toValue: -(6 + Math.random() * 10),
            duration: star.duration * 0.9,
            useNativeDriver: true,
          }),
          Animated.timing(star.translateY, {
            toValue: 6 + Math.random() * 10,
            duration: star.duration,
            useNativeDriver: true,
          }),
        ]).start(() => animateY());
      };

      // Gentle pulse
      const animateOpacity = () => {
        const baseOpacity = 0.1 + Math.random() * 0.1;
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: baseOpacity + 0.15,
            duration: star.duration * 0.7,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: baseOpacity,
            duration: star.duration * 0.7,
            useNativeDriver: true,
          }),
        ]).start(() => animateOpacity());
      };

      animateX();
      animateY();
      animateOpacity();
    });
  }, [stars]);

  const chars = ['✦', '✧', '✦', '✧', '✦', '✧'];

  return (
    <>
      {stars.map((star, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              fontSize: star.size,
              opacity: star.opacity,
              transform: [
                { translateX: star.translateX },
                { translateY: star.translateY },
              ],
            },
          ]}
        >
          {chars[i]}
        </Animated.Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    color: '#D4A574',
    zIndex: 0,
  },
});
