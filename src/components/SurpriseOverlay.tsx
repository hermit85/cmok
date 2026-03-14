import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

const SURPRISES = [
  { emoji: '🐕', text: 'Szczeniak też przesyła cmoka!' },
  { emoji: '🐈', text: 'Mruuuu... ktoś Cię kocha!' },
  { emoji: '🦔', text: 'Nawet kolczasty jeżyk jest dziś miękki 💜' },
  { emoji: '🌻', text: 'Rośniesz mi w sercu!' },
  { emoji: '🧸', text: 'Przytulas od misia!' },
  { emoji: '🦉', text: 'Huu-huu! Ktoś o Tobie myśli!' },
  { emoji: '🐝', text: 'Bzzz! Słodki cmok leci!' },
  { emoji: '🌈', text: 'Po deszczu zawsze jest tęcza!' },
  { emoji: '🎵', text: 'Ktoś nuci dziś Twoje imię!' },
  { emoji: '🌙', text: 'Ktoś Ci życzy pięknych snów!' },
  { emoji: '🍀', text: 'Szczęśliwy dzień!' },
  { emoji: '🐦', text: 'Ćwir ćwir! Przyleciał z buziakiem!' },
  { emoji: '🧁', text: 'Słodki cmok na słodki dzień!' },
  { emoji: '🦋', text: 'Delikatny cmok leci do Ciebie...' },
  { emoji: '🌟', text: 'Świecisz jasno w czyimś życiu!' },
  { emoji: '🐧', text: 'Przytulas z Antarktyki! 🧊💜' },
  { emoji: '🎈', text: 'Cmok leci balonem!' },
  { emoji: '🦊', text: 'Sprytny lisek podkradł Ci cmoka!' },
];

export function getTodaySurprise(): { emoji: string; text: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return SURPRISES[dayOfYear % SURPRISES.length];
}

export async function markTodaySurpriseDiscovered(): Promise<void> {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const surpriseIndex = dayOfYear % SURPRISES.length;

  try {
    const existing = await AsyncStorage.getItem('cmok_discovered_surprises');
    const discovered: number[] = existing ? JSON.parse(existing) : [];
    if (!discovered.includes(surpriseIndex)) {
      discovered.push(surpriseIndex);
      await AsyncStorage.setItem('cmok_discovered_surprises', JSON.stringify(discovered));
    }
  } catch {}
}

export function getTodayDateLabel(): string {
  const now = new Date();
  const months = [
    'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
  ];
  return `${now.getDate()} ${months[now.getMonth()]}`;
}

interface SurpriseOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function SurpriseOverlay({ visible, onClose }: SurpriseOverlayProps) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.7)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      // Emoji bounce in with delay
      setTimeout(() => {
        Animated.spring(emojiScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 8,
          bounciness: 18,
        }).start();
      }, 200);
    } else {
      bgOpacity.setValue(0);
      cardScale.setValue(0.7);
      cardOpacity.setValue(0);
      emojiScale.setValue(0);
    }
  }, [visible, bgOpacity, cardScale, cardOpacity, emojiScale]);

  if (!visible) return null;

  const surprise = getTodaySurprise();
  const dateLabel = getTodayDateLabel();

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
          {surprise.emoji}
        </Animated.Text>
        <Text style={styles.surpriseText}>{surprise.text}</Text>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Zamknij</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_W - 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  surpriseText: {
    fontSize: 18,
    color: '#3D2C2C',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 26,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
  },
  dateText: {
    fontSize: 14,
    color: '#8B7E7E',
    marginBottom: 20,
    fontFamily: 'Nunito_400Regular',
  },
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FDF6F0',
  },
  closeText: {
    fontSize: 15,
    color: '#E07A5F',
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
  },
});
