import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface WelcomeScreenProps {
  onSelectRole: (role: 'senior' | 'caregiver') => void;
}

export function WelcomeScreen({ onSelectRole }: WelcomeScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>Cmok</Text>
        <Text style={styles.tagline}>
          Jedno kliknięcie dziennie{'\n'}daje spokój rodzinie.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => onSelectRole('caregiver')}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryBtnText}>Jestem bliskim</Text>
        </Pressable>

        <Pressable
          onPress={() => onSelectRole('senior')}
          style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.outlineBtnText}>Jestem seniorem</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    padding: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1B4F72',
    marginBottom: 16,
  },
  tagline: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  buttons: {
    gap: 12,
    paddingBottom: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    minHeight: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: Typography.seniorBody,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outlineBtn: {
    backgroundColor: '#FFFFFF',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: Typography.seniorBody,
    fontWeight: '700',
    color: Colors.accent,
  },
});
