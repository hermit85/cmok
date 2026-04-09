import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

const RELATIONS = ['Mama', 'Tata', 'Babcia', 'Dziadek', 'Inna bliska osoba'] as const;

interface RelationTypeScreenProps {
  initialValue?: string;
  onBack: () => void;
  onContinue: (value: string) => void;
}

export function RelationTypeScreen({ initialValue, onBack, onContinue }: RelationTypeScreenProps) {
  const defaultChoice = RELATIONS.includes(initialValue as (typeof RELATIONS)[number])
    ? (initialValue as (typeof RELATIONS)[number])
    : null;

  const [selectedRelation, setSelectedRelation] = useState<(typeof RELATIONS)[number] | null>(defaultChoice);
  const [otherLabel, setOtherLabel] = useState(defaultChoice ? '' : initialValue && initialValue !== 'Bliska osoba' ? initialValue : '');

  const resolvedValue = useMemo(() => {
    if (selectedRelation === 'Inna bliska osoba') return otherLabel.trim();
    return selectedRelation || '';
  }, [otherLabel, selectedRelation]);

  const canContinue = resolvedValue.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Relacja</Text>
        <Text style={styles.title}>Kogo dotyczy ten kontakt?</Text>
        <Text style={styles.subtitle}>Wybierz relację. Własną nazwę wpiszesz dopiero po wyborze ostatniej opcji.</Text>

        <View style={styles.grid}>
          {RELATIONS.map((relation) => {
            const selected = selectedRelation === relation;
            return (
              <Pressable
                key={relation}
                onPress={() => setSelectedRelation(relation)}
                style={({ pressed }) => [
                  styles.relationCard,
                  selected && styles.relationCardSelected,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={[styles.relationText, selected && styles.relationTextSelected]}>{relation}</Text>
              </Pressable>
            );
          })}
        </View>

        {selectedRelation === 'Inna bliska osoba' ? (
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Wpisz własną nazwę</Text>
            <TextInput
              style={styles.input}
              value={otherLabel}
              onChangeText={setOtherLabel}
              placeholder="np. Ciocia albo Ania"
              placeholderTextColor={Colors.textSoft}
              autoCapitalize="words"
              autoFocus
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <BigButton title="Dalej" onPress={() => onContinue(resolvedValue)} disabled={!canContinue} style={styles.cta} />
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
    maxWidth: 280,
  },
  subtitle: {
    fontSize: Typography.body,
    lineHeight: 23,
    color: Colors.textSecondary,
    marginBottom: 20,
    maxWidth: 320,
  },
  grid: {
    gap: 10,
  },
  relationCard: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardStrong,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  relationCardSelected: {
    backgroundColor: Colors.accentWash,
    borderColor: Colors.accent,
  },
  relationText: {
    fontSize: Typography.body,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.text,
  },
  relationTextSelected: {
    color: Colors.accentStrong,
    fontFamily: Typography.fontFamilyBold,
  },
  inputCard: {
    marginTop: 14,
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
  footer: {
    paddingTop: 10,
    paddingBottom: 16,
  },
  cta: {
    width: '100%',
  },
});
