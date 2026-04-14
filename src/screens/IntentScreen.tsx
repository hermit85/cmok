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
  /** When true, shows simplified two-button layout for testing phase. */
  simplified?: boolean;
}

export type { UserIntent };

export function IntentScreen({ onSelect, onBack, simplified = false }: IntentScreenProps) {
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

  if (simplified) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.miniLogo}>cmok</Text>

        <View style={styles.content}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
            <Text style={styles.backText}>← Wróć</Text>
          </Pressable>

          <Text style={styles.title}>Jak zaczynasz?</Text>
          <Text style={styles.simplifiedSubtitle}>
            Za chwilę połączysz się z bliską osobą w codzienny rytuał.
          </Text>

          <Pressable
            onPress={() => { haptics.light(); onSelect('i-am-center'); }}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.primaryBtnText}>Mam kod zaproszenia</Text>
          </Pressable>

          <Pressable
            onPress={() => { haptics.light(); onSelect('join-circle'); }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryBtnText}>Chcę zaprosić bliską osobę</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.miniLogo}>cmok</Text>
      <View style={styles.content}>
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
              Raz dziennie stukniesz „Daj znak", a bliscy będą wiedzieć, że wszystko OK.
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 38 },
  miniLogo: { fontSize: 16, fontFamily: Typography.headingFamily, color: Colors.accent, paddingHorizontal: 28, paddingTop: 16 },
  backButton: { alignSelf: 'flex-start' as const, paddingVertical: 8, paddingHorizontal: 8, minHeight: 44, marginBottom: 18, marginLeft: -8 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 12 },
  simplifiedSubtitle: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 23, marginBottom: 32, maxWidth: 300 },
  primaryBtn: {
    backgroundColor: Colors.accent, minHeight: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 5,
  },
  primaryBtnText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  secondaryBtn: { minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  secondaryBtnText: { fontSize: Typography.body, fontFamily: Typography.headingFamilySemiBold, color: Colors.accent },
  options: { gap: 14 },
  optionCard: { backgroundColor: Colors.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 18, minHeight: 100, justifyContent: 'center' },
  optionCardSelected: { backgroundColor: Colors.accentWash, borderColor: Colors.accent },
  optionTitle: { fontSize: Typography.bodyLarge, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  optionTitleSelected: { color: Colors.accentStrong },
  optionBody: { fontSize: Typography.bodySmall, lineHeight: 21, color: Colors.textSecondary },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
