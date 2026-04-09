import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';

export function SettingsScreen() {
  const router = useRouter();
  const { profile } = useRelationship();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/onboarding');
    } catch {
      Alert.alert('Błąd', 'Nie udało się wylogować.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
        <Text style={styles.backText}>← Wróć</Text>
      </Pressable>

      <Text style={styles.title}>Ustawienia</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Konto</Text>
        <Text style={styles.cardValue}>{profile?.name || 'Cmok'}</Text>
        {profile?.phone ? <Text style={styles.cardDetail}>{profile.phone}</Text> : null}
      </View>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={styles.logoutText}>Wyloguj ten telefon</Text>
      </Pressable>
      <Text style={styles.logoutHint}>Wyloguje tylko to urządzenie. Możesz wrócić później.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.screen + 4,
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.accent,
  },
  title: {
    fontSize: Typography.title,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.cardStrong,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.card,
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: Typography.heading,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.text,
  },
  cardDetail: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: Colors.surface,
    minHeight: 52,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyMedium,
    color: Colors.textSecondary,
  },
  logoutHint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
});
