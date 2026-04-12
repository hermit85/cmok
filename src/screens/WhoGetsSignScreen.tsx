import { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { haptics } from '../utils/haptics';

const SUGGESTIONS = ['Syn', 'Córka', 'Wnuk', 'Wnuczka'];

interface WhoGetsSignScreenProps {
  onContinue: (name: string) => void;
  onBack: () => void;
}

export function WhoGetsSignScreen({ onContinue, onBack }: WhoGetsSignScreenProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const chipScales = useRef(SUGGESTIONS.map(() => new Animated.Value(1))).current;

  const handleSuggestion = (suggestion: string, index: number) => {
    haptics.light();
    Animated.sequence([
      Animated.spring(chipScales[index], { toValue: 0.92, useNativeDriver: true, speed: 50 }),
      Animated.spring(chipScales[index], { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start();
    setName(suggestion);
  };

  const canContinue = name.trim().length > 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.top}>
        <Text style={s.miniLogo}>cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={s.backText}>← Wróć</Text>
        </Pressable>

        <Text style={s.title}>Kto ma dostawać{'\n'}Twój codzienny znak?</Text>

        <TextInput
          ref={inputRef}
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Wpisz imię"
          placeholderTextColor={Colors.textSoft}
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => canContinue && onContinue(name.trim())}
        />

        <Text style={s.orLabel}>lub wybierz:</Text>
        <View style={s.suggestions}>
          {SUGGESTIONS.map((suggestion, i) => (
            <Animated.View key={suggestion} style={{ transform: [{ scale: chipScales[i] }] }}>
              <Pressable
                onPress={() => handleSuggestion(suggestion, i)}
                style={({ pressed }) => [
                  s.chip,
                  name === suggestion && s.chipActive,
                  pressed && { opacity: 0.88 },
                ]}
              >
                <Text style={[s.chipText, name === suggestion && s.chipTextActive]}>{suggestion}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={s.footer}>
        <BigButton
          title="Dalej"
          onPress={() => onContinue(name.trim())}
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
  miniLogo: { fontSize: 16, fontFamily: Typography.headingFamily, color: Colors.accent, marginBottom: 22 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginLeft: -8, paddingHorizontal: 8, marginBottom: 18 },
  backText: { fontSize: Typography.body, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 20, lineHeight: 34 },
  input: {
    minHeight: 56, borderRadius: 18, backgroundColor: Colors.cardStrong,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 18, fontSize: Typography.bodyLarge, color: Colors.text,
  },
  orLabel: { fontSize: Typography.bodySmall, color: Colors.textMuted, marginTop: 16, marginBottom: 10 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  chipActive: { backgroundColor: Colors.accentWash },
  chipText: { fontSize: Typography.bodySmall, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  chipTextActive: { color: Colors.accentStrong },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
