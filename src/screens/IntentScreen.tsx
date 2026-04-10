import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { haptics } from '../utils/haptics';

type UserIntent = 'i-am-center' | 'join-circle';

interface IntentScreenProps {
  onSelect: (intent: UserIntent) => void;
  onBack: () => void;
}

export type { UserIntent };

export function IntentScreen({ onSelect, onBack }: IntentScreenProps) {
  const [selected, setSelected] = useState<UserIntent | null>(null);
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;

  const selectWith = (intent: UserIntent, scale: Animated.Value) => {
    haptics.light();
    setSelected(intent);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Co chcesz zrobić?</Text>

        <View style={styles.options}>
          <Animated.View style={{ transform: [{ scale: scale1 }] }}>
          <Pressable
            onPress={() => selectWith('i-am-center', scale1)}
            style={[
              styles.optionCard,
              selected === 'i-am-center' && styles.optionCardSelected,
            ]}
          >
            <Text style={[styles.optionTitle, selected === 'i-am-center' && styles.optionTitleSelected]}>
              Chcę dawać codzienny znak
            </Text>
            <Text style={styles.optionBody}>
              Raz dziennie stukniesz „Daj znak" — bliscy będą wiedzieć, że wszystko OK.
            </Text>
          </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: scale2 }] }}>
          <Pressable
            onPress={() => selectWith('join-circle', scale2)}
            style={[
              styles.optionCard,
              selected === 'join-circle' && styles.optionCardSelected,
            ]}
          >
            <Text style={[styles.optionTitle, selected === 'join-circle' && styles.optionTitleSelected]}>
              Ktoś mnie zaprosił
            </Text>
            <Text style={styles.optionBody}>
              Masz kod zaproszenia i chcesz dołączyć do kręgu bliskiej osoby.
            </Text>
          </Pressable>
          </Animated.View>
        </View>
      </View>

      <View style={styles.footer}>
        <BigButton
          title="Dalej"
          onPress={() => selected && onSelect(selected)}
          disabled={!selected}
          color={Colors.accent}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  top: { flex: 1, paddingTop: 16 },
  miniLogo: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.accent, marginBottom: 22 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginLeft: -8, paddingHorizontal: 8, marginBottom: 18 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 22 },
  options: { gap: 14 },
  optionCard: { backgroundColor: Colors.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 18, minHeight: 100, justifyContent: 'center' },
  optionCardSelected: { backgroundColor: Colors.accentWash, borderColor: Colors.accent },
  optionTitle: { fontSize: Typography.bodyLarge, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 6 },
  optionTitleSelected: { color: Colors.accentStrong },
  optionBody: { fontSize: Typography.bodySmall, lineHeight: 21, color: Colors.textSecondary },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
