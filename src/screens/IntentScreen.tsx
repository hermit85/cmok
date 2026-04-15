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

          <Text style={styles.title}>Co chcesz zrobić?</Text>
          <Text style={styles.simplifiedSubtitle}>
            Wybierz co pasuje do Twojej sytuacji.
          </Text>

          <Pressable
            onPress={() => { haptics.light(); onSelect('i-am-center'); }}
            style={({ pressed }) => [styles.optionBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
          >
            <Text style={styles.optionEmoji}>{'\u{1F4E9}'}</Text>
            <Text style={styles.optionBtnTitle}>Mam kod zaproszenia</Text>
            <Text style={styles.optionBtnHint}>Ktoś bliski wysłał mi kod. Chcę dołączyć i codziennie dawać znak.</Text>
          </Pressable>

          <Pressable
            onPress={() => { haptics.light(); onSelect('join-circle'); }}
            style={({ pressed }) => [styles.optionBtn, styles.optionBtnOutline, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
          >
            <Text style={styles.optionEmoji}>{'\u{1F49B}'}</Text>
            <Text style={styles.optionBtnTitle}>Chcę zaprosić bliską osobę</Text>
            <Text style={styles.optionBtnHint}>Bliska osoba mieszka osobno. Chcę wiedzieć, że u niej jest OK.</Text>
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
  optionBtn: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 14,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  optionBtnOutline: { backgroundColor: Colors.cardStrong, borderWidth: 1.5, borderColor: Colors.border },
  optionEmoji: { fontSize: 32, marginBottom: 10 },
  optionBtnTitle: { fontSize: 18, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 6 },
  optionBtnHint: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  optionTag: { backgroundColor: Colors.safeLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  optionTagText: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },
  optionTagAlt: { backgroundColor: Colors.accentWash },
  optionTagAltText: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  options: { gap: 14 },
  optionCard: { backgroundColor: Colors.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 18, minHeight: 100, justifyContent: 'center' },
  optionCardSelected: { backgroundColor: Colors.accentWash, borderColor: Colors.accent },
  optionTitle: { fontSize: Typography.bodyLarge, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  optionTitleSelected: { color: Colors.accentStrong },
  optionBody: { fontSize: Typography.bodySmall, lineHeight: 21, color: Colors.textSecondary },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
