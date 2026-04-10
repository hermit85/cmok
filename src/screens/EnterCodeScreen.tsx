import { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

interface EnterCodeScreenProps {
  onSubmit: (code: string) => void;
  onBack: () => void;
}

export function EnterCodeScreen({ onSubmit, onBack }: EnterCodeScreenProps) {
  const [code, setCode] = useState('');
  const inputRef = useRef<TextInput>(null);

  const cleanCode = code.replace(/\D/g, '').slice(0, 6);
  const isValid = cleanCode.length === 6;

  const handleSubmit = () => {
    if (!isValid) return;
    Keyboard.dismiss();
    onSubmit(cleanCode);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.miniLogo}>Cmok</Text>

        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Ktoś Cię zaprosił?</Text>
        <Text style={styles.subtitle}>
          Wpisz kod, który dostałeś od bliskiej osoby
        </Text>

        <Pressable style={styles.inputWrap} onPress={() => inputRef.current?.focus()}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={cleanCode}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={Colors.textSoft}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={handleSubmit}
          />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <BigButton
          title="Dalej"
          onPress={handleSubmit}
          disabled={!isValid}
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
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 32 },
  inputWrap: { backgroundColor: Colors.cardStrong, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingVertical: 14 },
  input: { fontSize: 32, fontFamily: Typography.fontFamilyBold, color: Colors.text, textAlign: 'center', letterSpacing: 8 },
  footer: { paddingTop: 10, paddingBottom: 16 },
  cta: { width: '100%' },
});
