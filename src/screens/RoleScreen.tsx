import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppRole } from '../types';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

interface RoleScreenProps {
  onSelectRole: (role: AppRole) => void;
  onBack: () => void;
}

export function RoleScreen({ onSelectRole, onBack }: RoleScreenProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Czyj to telefon?</Text>
        <Text style={styles.subtitle}>Wybierz tylko, po czyjej stronie relacji jest ten telefon.</Text>

        <View style={styles.options}>
          <Pressable
            onPress={() => setSelectedRole('recipient')}
            style={({ pressed }) => [
              styles.optionCard,
              selectedRole === 'recipient' && styles.optionCardSelected,
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.optionTitle, selectedRole === 'recipient' && styles.optionTitleSelected]}>Mój telefon</Text>
            <Text style={styles.optionBody}>Tutaj będę widzieć codzienny znak.</Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedRole('signaler')}
            style={({ pressed }) => [
              styles.optionCard,
              selectedRole === 'signaler' && styles.optionCardSelected,
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={[styles.optionTitle, selectedRole === 'signaler' && styles.optionTitleSelected]}>Telefon bliskiej osoby</Text>
            <Text style={styles.optionBody}>Tutaj raz dziennie pojawi się prosty znak „u mnie dobrze”.</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <BigButton
          title="Dalej"
          onPress={() => onSelectRole(selectedRole as AppRole)}
          disabled={!selectedRole}
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
  eyebrow: {
    fontSize: Typography.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accentStrong,
    marginBottom: 10,
  },
  title: {
    fontSize: Typography.title,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 10,
    maxWidth: 260,
  },
  subtitle: {
    fontSize: Typography.body,
    lineHeight: 23,
    color: Colors.textSecondary,
    marginBottom: 22,
    maxWidth: 310,
  },
  options: {
    gap: 14,
  },
  optionCard: {
    backgroundColor: Colors.cardStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 106,
    justifyContent: 'center',
  },
  optionCardSelected: {
    backgroundColor: Colors.accentWash,
    borderColor: Colors.accent,
  },
  optionTitle: {
    fontSize: Typography.heading,
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
