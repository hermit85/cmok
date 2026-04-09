import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

type UserIntent = 'setup-phone' | 'join-circle';

interface IntentScreenProps {
  onSelect: (intent: UserIntent) => void;
  onBack: () => void;
}

export function IntentScreen({ onSelect, onBack }: IntentScreenProps) {
  const [selected, setSelected] = useState<UserIntent | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Co chcesz zrobić?</Text>

        <View style={styles.options}>
          <Pressable
            onPress={() => setSelected('setup-phone')}
            style={({ pressed }) => [
              styles.optionCard,
              selected === 'setup-phone' && styles.optionCardSelected,
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.optionTitle, selected === 'setup-phone' && styles.optionTitleSelected]}>
              Ustawiam telefon bliskiej osoby
            </Text>
            <Text style={styles.optionBody}>
              Na tym telefonie będzie przycisk „Daj znak".
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelected('join-circle')}
            style={({ pressed }) => [
              styles.optionCard,
              selected === 'join-circle' && styles.optionCardSelected,
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.optionTitle, selected === 'join-circle' && styles.optionTitleSelected]}>
              Dołączam do kręgu bliskiej osoby
            </Text>
            <Text style={styles.optionBody}>
              Będziesz dostawać codzienny znak i pilny sygnał.
            </Text>
          </Pressable>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  top: {
    flex: 1,
    paddingTop: 16,
  },
  miniLogo: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accent,
    marginBottom: 22,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginLeft: -8,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  backText: {
    fontSize: Typography.body,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.accent,
  },
  title: {
    fontSize: Typography.title,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 22,
  },
  options: {
    gap: 14,
  },
  optionCard: {
    backgroundColor: Colors.cardStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 100,
    justifyContent: 'center',
  },
  optionCardSelected: {
    backgroundColor: Colors.accentWash,
    borderColor: Colors.accent,
  },
  optionTitle: {
    fontSize: Typography.bodyLarge,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 6,
  },
  optionTitleSelected: {
    color: Colors.accentStrong,
  },
  optionBody: {
    fontSize: Typography.bodySmall,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  cta: {
    width: '100%',
  },
});
