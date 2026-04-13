import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, Share, Platform, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, SUPABASE_URL } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { shareInvite, shareCircleInvite } from '../utils/invite';

export function SettingsScreen() {
  const router = useRouter();
  const { profile, relationship, status, refreshRelationship } = useRelationship();
  const { signalers, recipients, loading: circleLoading } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const isRecipient = profile?.role === 'recipient';
  const isSignaler = profile?.role === 'signaler';
  const circlePerson = isRecipient ? signalers[0] : recipients[0];
  const mainPersonName = circlePerson?.name || relationship?.signalerLabel || null;
  const mainPerson = circlePerson || (relationship && mainPersonName ? { name: mainPersonName } : null);
  const circleCount = contacts.length;
  const isActive = status === 'active';

  const displayPhone = profile?.phone
    ? profile.phone.replace(/^48/, '+48 ').replace(/(\d{3})(?=\d)/g, '$1 ')
    : '';

  /* ─── Edit name ─── */
  const startEditName = () => {
    setNameValue(profile?.name || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !profile?.id) return;
    setSavingName(true);
    try {
      await supabase.from('users').update({ name: trimmed }).eq('id', profile.id);
      setEditingName(false);
      refreshRelationship?.();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać imienia.');
    } finally {
      setSavingName(false);
    }
  };

  /* ─── Invite ─── */
  const handleInviteAnother = async () => {
    // If recipient has an active relationship, share invite code for circle
    if (isRecipient && relationship?.inviteCode) {
      await shareInvite({ code: relationship.inviteCode, signalerLabel: mainPersonName || undefined });
    } else {
      // Generic app invite
      const msg = 'Dołącz do cmok, codzienny znak od bliskiej osoby. Mniej martwienia się, więcej spokoju.\n\nhttps://cmok.app/pobierz';
      try {
        await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
      } catch { /* cancelled */ }
    }
  };

  /* ─── Delete account ─── */
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
                  {circleCount > 0 ? ` · +${circleCount} w kręgu` : ''}
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

        {/* ─── Account with editable name ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Twoje konto</Text>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.nameInput}
                value={nameValue}
                onChangeText={setNameValue}
                autoFocus
                maxLength={30}
                placeholder="Twoje imię"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              {savingName ? (
                <ActivityIndicator size="small" color={Colors.safe} />
              ) : (
                <Pressable onPress={saveName} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.saveBtnText}>Zapisz</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable onPress={startEditName} style={({ pressed }) => [styles.nameRow, pressed && { opacity: 0.7 }]}>
              <Text style={styles.cardValue}>{profile?.name || 'Ustaw imię'}</Text>
              <Text style={styles.editHint}>Zmień</Text>
            </Pressable>
          )}
          {displayPhone ? <Text style={styles.cardDetail}>{displayPhone}</Text> : null}
          <Text style={styles.roleTag}>
            {isRecipient ? 'Dostajesz codzienny znak' : isSignaler ? 'Dajesz codzienny znak' : ''}
          </Text>
        </View>

        {/* ─── Reminder surface (signaler only) ─── */}
        {isSignaler ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Przypomnienie</Text>
            <Text style={styles.cardValue}>Poranne przypomnienie</Text>
            <Text style={styles.cardDetail}>Będziemy przypominać o znaku, jeśli jeszcze go nie dałeś.</Text>
          </View>
        ) : null}

        {/* ─── Legal center ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Prawne</Text>
          <Pressable onPress={() => Linking.openURL('https://cmok-web.vercel.app/regulamin')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Regulamin</Text>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://cmok-web.vercel.app/polityka-prywatnosci')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Polityka prywatności</Text>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('mailto:cmok.app@gmail.com')} style={({ pressed }) => [styles.legalItem, { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Kontakt</Text>
            <Text style={styles.legalDetail}>cmok.app@gmail.com</Text>
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
  cardLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  // Editable name
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHint: { fontSize: 13, color: Colors.accent, fontWeight: '500' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: {
    flex: 1, fontSize: 17, color: Colors.text, fontWeight: '600',
    backgroundColor: Colors.cardStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.safe,
  },
  saveBtn: { backgroundColor: Colors.safe, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  roleTag: { fontSize: 12, color: Colors.safe, fontWeight: '500', marginTop: 8 },
  legalItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  legalItemText: { fontSize: 14, color: Colors.text },
  legalDetail: { fontSize: 12, color: Colors.textMuted },
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
