import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppRole } from '../types';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

interface RelationNameScreenProps {
  initialValue: string;
  relationType: string;
  selectedRole: AppRole | null;
  onBack: () => void;
  onContinue: (value: string) => void;
}

export function RelationNameScreen({
  initialValue,
  relationType,
  selectedRole,
  onBack,
  onContinue,
}: RelationNameScreenProps) {
  const [value, setValue] = useState(initialValue);

  const helper = useMemo(() => {
    if (selectedRole === 'recipient') {
      return 'To imię wróci później na ekranie dnia.';
    }
    return 'To imię wróci później po drugiej stronie relacji.';
  }, [selectedRole]);

  const canContinue = value.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Nazwa</Text>
        <Text style={styles.title}>Jak ma się wyświetlać ta osoba?</Text>
        <Text style={styles.subtitle}>Możesz zostawić {relationType} albo wpisać własną nazwę.</Text>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Nazwa wyświetlana</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={relationType}
            placeholderTextColor={Colors.textSoft}
            autoCapitalize="words"
            autoFocus
          />
          <Text style={styles.helper}>{helper}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <BigButton title="Dalej" onPress={() => onContinue(value.trim())} disabled={!canContinue} style={styles.cta} />
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
    maxWidth: 300,
  },
  subtitle: {
    fontSize: Typography.body,
    lineHeight: 23,
    color: Colors.textSecondary,
    marginBottom: 20,
    maxWidth: 330,
  },
  inputCard: {
    backgroundColor: Colors.cardStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  inputLabel: {
    fontSize: Typography.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    fontSize: Typography.bodyLarge,
    color: Colors.text,
  },
  helper: {
    marginTop: 8,
    fontSize: Typography.caption,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  cta: {
    width: '100%',
  },
});
