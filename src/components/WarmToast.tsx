import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

type Tone = 'safe' | 'love' | 'neutral';

interface Props {
  visible: boolean;
  text: string;
  tone?: Tone;
  /** Total visible duration before auto fade-out (ms). */
  duration?: number;
  onHide?: () => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Short, warm affirmation shown after every successful user action. Slides up
 * 12px, fades in 300ms, holds for `duration`, fades out 500ms. Consistent
 * across screens so the app *feels* solid to elderly users.
 */
export function WarmToast({ visible, text, tone = 'safe', duration = 2500, onHide, style }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    slide.setValue(12);
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(duration),
      Animated.timing(fade, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]);
    seq.start(({ finished }) => { if (finished && onHide) onHide(); });
    return () => seq.stop();
  }, [visible, duration, fade, slide, onHide]);

  if (!visible) return null;

  const palette = tone === 'love'
    ? { bg: Colors.loveLight, fg: Colors.love }
    : tone === 'neutral'
      ? { bg: Colors.surface, fg: Colors.textSecondary }
      : { bg: Colors.safeLight, fg: Colors.safeStrong };

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.wrap, { backgroundColor: palette.bg, opacity: fade, transform: [{ translateY: slide }] }, style as ViewStyle]}
    >
      <Text style={[s.text, { color: palette.fg }]}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 12,
  },
  text: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyMedium,
  },
});
