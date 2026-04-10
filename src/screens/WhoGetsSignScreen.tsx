import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

const RELATIONS = ['Syn', 'Córka', 'Wnuk', 'Wnuczka', 'Ktoś bliski'];

interface WhoGetsSignScreenProps {
  onContinue: (name: string) => void;
  onBack: () => void;
}

export function WhoGetsSignScreen({ onContinue, onBack }: WhoGetsSignScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');

  const isCustom = selected === 'Ktoś bliski';
  const resolvedName = isCustom ? customName.trim() : selected || '';
  const canContinue = resolvedName.length > 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.top}>
        <Text style={s.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={s.backText}>← Wróć</Text>
        </Pressable>

        <Text style={s.title}>Kto ma dostawać Twój codzienny znak?</Text>
        <Text style={s.subtitle}>Wybierz osobę lub wpisz imię.</Text>

        <View style={s.grid}>
          {RELATIONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setSelected(r)}
              style={({ pressed }) => [s.chip, selected === r && s.chipSelected, pressed && { opacity: 0.88 }]}
            >
              <Text style={[s.chipText, selected === r && s.chipTextSelected]}>{r}</Text>
            </Pressable>
          ))}
        </View>

        {isCustom ? (
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Wpisz imię"
              placeholderTextColor={Colors.textSoft}
              autoCapitalize="words"
              autoFocus
            />
          </View>
        ) : null}
      </View>

      <View style={s.footer}>
        <BigButton
          title="Dalej"
          onPress={() => onContinue(resolvedName)}
          disabled={!canContinue}
          color={Colors.accent}
          style={s.cta}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  top: { flex: 1, paddingTop: 16 },
  miniLogo: { fontSize: 16, fontFamily: Typography.fontFamilyBold, color: Colors.accent, marginBottom: 22 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginLeft: -8, paddingHorizontal: 8, marginBottom: 18 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: Typography.body, lineHeight: 23, color: Colors.textSecondary, marginBottom: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: Colors.cardStrong, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  chipSelected: { backgroundColor: Colors.accentWash, borderColor: Colors.accent },
  chipText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.text },
  chipTextSelected: { color: Colors.accentStrong },
  inputWrap: { marginTop: 16 },
  input: {
    minHeight: 54, borderRadius: 16, backgroundColor: Colors.surface,
    paddingHorizontal: 16, fontSize: Typography.bodyLarge, color: Colors.text,
  },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
