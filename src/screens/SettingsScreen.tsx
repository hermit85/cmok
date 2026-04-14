import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, Share, Platform, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { shareInvite, logInviteEvent } from '../utils/invite';
import { analytics } from '../services/analytics';

export function SettingsScreen() {
  const router = useRouter();
  const { profile, relationship, status, refreshRelationship } = useRelationship();
  const { signalers, recipients, loading: circleLoading } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

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
      analytics.nameChanged();
      refreshRelationship?.();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać imienia.');
    } finally {
      setSavingName(false);
    }
  };

  /* ─── Invite: step 1 = generate code, step 2 = show + share ─── */
  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Zaloguj się', 'Połącz telefon z kontem.'); return; }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const col = isRecipient ? 'caregiver_id' : 'senior_id';

      // Check for existing pending pair to reuse
      const { data: existing } = await supabase
        .from('care_pairs')
        .select('id')
        .eq(col, user.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error: updateErr } = await supabase.from('care_pairs')
          .update({ invite_code: code, invite_expires_at: expiresAt })
          .eq('id', existing.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('care_pairs').insert({
          [col]: user.id,
          invite_code: code,
          invite_expires_at: expiresAt,
          status: 'pending',
          signaler_label: profile?.name || 'Bliska osoba',
        });
        if (insertErr) throw insertErr;
      }

      logInviteEvent('invite_created', { code });
      setInviteCode(code);
    } catch {
      Alert.alert('Nie udało się', 'Spróbuj ponownie za chwilę.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      logInviteEvent('invite_code_copied', { code: inviteCode });
      Alert.alert('Skopiowano', 'Kod jest w schowku.');
    } catch { /* silent */ }
  };

  const handleShareInviteCode = async () => {
    if (!inviteCode) return;
    await shareInvite({ code: inviteCode, signalerLabel: profile?.name || undefined });
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
              const { error: deleteError } = await supabase.functions.invoke('delete-account', { body: {} });
              if (deleteError) throw new Error('Delete failed');
              analytics.accountDeleted();
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
      analytics.loggedOut();
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
        {inviteCode ? (
          <View style={styles.card}>
            <Text style={styles.inviteText}>Zaproszenie gotowe</Text>
            <Text style={styles.cardDetail}>Pokaż ten kod lub wyślij go bliskiej osobie.</Text>

            <Pressable onPress={handleCopyInviteCode} style={({ pressed }) => [styles.codeFrame, pressed && { opacity: 0.85 }]}>
              <Text style={styles.codeValue}>{inviteCode}</Text>
              <Text style={styles.codeHint}>Stuknij, żeby skopiować</Text>
            </Pressable>

            <Pressable
              onPress={handleShareInviteCode}
              style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.shareBtnText}>Wyślij zaproszenie</Text>
            </Pressable>

            <Pressable onPress={() => setInviteCode(null)} style={({ pressed }) => [styles.dismissLink, pressed && { opacity: 0.5 }]}>
              <Text style={styles.dismissLinkText}>Zamknij</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleGenerateInvite}
            disabled={inviteLoading}
            style={({ pressed }) => [styles.card, styles.inviteCard, pressed && { opacity: 0.88 }]}
          >
            {inviteLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Text style={styles.inviteText}>Zaproś kolejną osobę</Text>
                <Text style={styles.cardDetail}>Znasz kogoś, kto mieszka sam? Wyślij zaproszenie.</Text>
              </>
            )}
          </Pressable>
        )}

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
            <Text style={styles.cardDetail}>Przypomnimy o znaku rano, jeśli jeszcze go nie dałeś.</Text>
          </View>
        ) : null}

        {/* ─── Legal center ─── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Prawne</Text>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/regulamin')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
            <Text style={styles.legalItemText}>Regulamin</Text>
            <Text style={styles.chevron}>→</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://cmok.app/polityka-prywatnosci')} style={({ pressed }) => [styles.legalItem, pressed && { opacity: 0.6 }]}>
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
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20, padding: Spacing.card, marginBottom: 16,
  },
  cardLabel: { fontSize: 11, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { fontSize: Typography.bodyLarge, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  cardDetail: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  circleRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: {
    width: MINI_AV, height: MINI_AV, borderRadius: MINI_AV / 2,
    backgroundColor: Colors.safe, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  miniAvatarText: { fontSize: 14, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  circleInfo: { flex: 1 },
  chevron: { fontSize: 18, color: Colors.textMuted },
  inviteCard: { },
  inviteText: { fontSize: 15, fontFamily: Typography.fontFamilyMedium, color: Colors.accent, marginBottom: 4 },
  codeFrame: {
    backgroundColor: Colors.cardStrong, borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 32,
    marginTop: 14, marginBottom: 14, alignItems: 'center',
  },
  codeValue: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text, letterSpacing: 6 },
  codeHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  shareBtn: {
    backgroundColor: Colors.accent, minHeight: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 4,
  },
  shareBtnText: { fontSize: 16, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  dismissLink: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  dismissLinkText: { fontSize: 13, color: Colors.textMuted },
  // Editable name
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHint: { fontSize: 13, color: Colors.accent, fontFamily: Typography.fontFamilyMedium },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: {
    flex: 1, fontSize: 17, color: Colors.text, fontFamily: Typography.fontFamilyMedium,
    backgroundColor: Colors.cardStrong, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.safe,
  },
  saveBtn: { backgroundColor: Colors.safe, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  saveBtnText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: '#FFFFFF' },
  roleTag: { fontSize: 12, color: Colors.safe, fontFamily: Typography.fontFamilyMedium, marginTop: 8 },
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
