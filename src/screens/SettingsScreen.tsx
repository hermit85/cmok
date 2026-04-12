import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Share, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, SUPABASE_URL } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';

export function SettingsScreen() {
  const router = useRouter();
  const { profile, relationship, status } = useRelationship();
  const { signalers, recipients, loading: circleLoading } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const isRecipient = profile?.role === 'recipient';
  const circlePerson = isRecipient ? signalers[0] : recipients[0];
  // Fallback: use relationship label if circle data hasn't loaded yet
  const mainPersonName = circlePerson?.name || relationship?.signalerLabel || null;
  const mainPerson = circlePerson || (relationship && mainPersonName ? { name: mainPersonName } : null);
  const circleCount = contacts.length;

  const handleInviteAnother = async () => {
    const msg = 'Dołącz do cmok — codzienny znak od bliskiej osoby. Mniej martwienia się, więcej spokoju.\n\nhttps://cmok.app/pobierz';
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
    } catch { /* cancelled */ }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Usunąć konto?',
      'Wszystkie Twoje dane zostaną trwale usunięte. Tej operacji nie można cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń konto',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Brak sesji');
              // Call edge function to purge all user data
              const response = await fetch(
                `${SUPABASE_URL}/functions/v1/delete-account`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: '{}',
                },
              );
              if (!response.ok) throw new Error('Delete failed');
              await supabase.auth.signOut();
              router.replace('/onboarding');
            } catch {
              Alert.alert('Błąd', 'Nie udało się usunąć konta. Spróbuj ponownie.');
            }
          },
        },
      ],
    );
  };

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Ustawienia</Text>

        {/* ─── Circle summary ─── */}
        <Pressable
          onPress={() => router.push('/circle')}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.cardLabel}>Twój krąg</Text>
          {mainPerson ? (
            <View style={styles.circleRow}>
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>{(mainPerson.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.circleInfo}>
                <Text style={styles.cardValue}>{mainPerson.name}</Text>
                <Text style={styles.cardDetail}>
                  {isRecipient ? 'Codzienny znak' : 'Dostaje Twój znak'}
                  {circleCount > 0 ? ` · ${circleCount} w kręgu` : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </View>
          ) : circleLoading ? (
            <Text style={styles.cardDetail}>Ładowanie...</Text>
          ) : (
            <Text style={styles.cardDetail}>
              {status === 'pending' ? 'Czeka na połączenie' : 'Jeszcze nie połączono'}
            </Text>
          )}
        </Pressable>

        {/* ─── Invite another person ─── */}
        <Pressable
          onPress={handleInviteAnother}
          style={({ pressed }) => [styles.card, styles.inviteCard, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.inviteText}>Zaproś kolejną osobę</Text>
          <Text style={styles.cardDetail}>Znasz kogoś, kto mieszka sam? Wyślij zaproszenie.</Text>
        </Pressable>

        {/* ─── Account ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Konto</Text>
          <Text style={styles.cardValue}>{profile?.name || 'cmok'}</Text>
          {profile?.phone ? <Text style={styles.cardDetail}>{profile.phone}</Text> : null}
        </View>

        {/* ─── Reminder surface ─── */}
        {profile?.role === 'signaler' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Przypomnienie</Text>
            <Text style={styles.cardValue}>Poranne przypomnienie</Text>
            <Text style={styles.cardDetail}>Będziemy przypominać o znaku, jeśli jeszcze go nie dałeś.</Text>
          </View>
        ) : null}

        {/* ─── Legal ─── */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/polityka-prywatnosci')} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={styles.legalLink}>Polityka prywatności</Text>
          </Pressable>
          <Text style={styles.legalDot}> · </Text>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/regulamin')} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={styles.legalLink}>Regulamin</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.logoutText}>Wyloguj ten telefon</Text>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.deleteText}>Usuń konto i dane</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const MINI_AV = 36;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screen + 4, paddingTop: 16, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, minHeight: 44, marginBottom: 20 },
  backText: { fontSize: 16, fontWeight: '500', color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16, padding: Spacing.card, marginBottom: 16,
  },
  cardLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8 },
  cardValue: { fontSize: Typography.bodyLarge, fontFamily: Typography.fontFamilyBold, color: Colors.text },
  cardDetail: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  circleRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: MINI_AV, height: MINI_AV, borderRadius: MINI_AV / 2,
    backgroundColor: Colors.safe, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  miniAvatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  circleInfo: { flex: 1 },
  chevron: { fontSize: 18, color: Colors.textMuted },
  inviteCard: { },
  inviteText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.accent, marginBottom: 4 },
  logoutButton: {
    backgroundColor: 'transparent', minHeight: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  logoutText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.textSecondary },
  deleteButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  deleteText: { fontSize: 14, color: Colors.alert },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  legalLink: { fontSize: 13, color: Colors.textMuted },
  legalDot: { fontSize: 13, color: Colors.textMuted },
});
