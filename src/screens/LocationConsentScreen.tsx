import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

interface LocationConsentScreenProps {
  onContinue: (consent: boolean) => void;
  onBack: () => void;
}

export function LocationConsentScreen({ onContinue, onBack }: LocationConsentScreenProps) {
  const [choice, setChoice] = useState<boolean | null>(null);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.top}>
        <Text style={s.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={s.backText}>← Wróć</Text>
        </Pressable>

        <Text style={s.title}>Lokalizacja przy pilnym sygnale</Text>
        <Text style={s.subtitle}>
          Jeśli kiedyś wyślesz pilny sygnał, Cmok może dołączyć Twoją lokalizację — żeby bliscy wiedzieli, gdzie jesteś.
        </Text>

        <View style={s.options}>
          <Pressable
            onPress={() => setChoice(true)}
            style={({ pressed }) => [s.optionCard, choice === true && s.optionCardSelected, pressed && { opacity: 0.88 }]}
          >
            <Text style={[s.optionTitle, choice === true && s.optionTitleSelected]}>Tak, dołączaj lokalizację</Text>
            <Text style={s.optionBody}>Bliscy zobaczą, gdzie jesteś, gdy wyślesz sygnał.</Text>
          </Pressable>

          <Pressable
            onPress={() => setChoice(false)}
            style={({ pressed }) => [s.optionCard, choice === false && s.optionCardSelected, pressed && { opacity: 0.88 }]}
          >
            <Text style={[s.optionTitle, choice === false && s.optionTitleSelected]}>Nie, bez lokalizacji</Text>
            <Text style={s.optionBody}>Sygnał pójdzie bez informacji, gdzie jesteś.</Text>
          </Pressable>
        </View>

        <Text style={s.hint}>Możesz to zmienić później w ustawieniach.</Text>
      </View>

      <View style={s.footer}>
        <BigButton
          title="Dalej"
          onPress={() => choice !== null && onContinue(choice)}
          disabled={choice === null}
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
  options: { gap: 14 },
  optionCard: { backgroundColor: Colors.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 16 },
  optionCardSelected: { backgroundColor: Colors.accentWash, borderColor: Colors.accent },
  optionTitle: { fontSize: Typography.body, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 4 },
  optionTitleSelected: { color: Colors.accentStrong },
  optionBody: { fontSize: Typography.bodySmall, lineHeight: 20, color: Colors.textSecondary },
  hint: { fontSize: Typography.caption, color: Colors.textMuted, marginTop: 16 },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
