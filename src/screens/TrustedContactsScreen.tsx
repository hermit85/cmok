import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useRelationship } from '../hooks/useRelationship';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { analytics } from '../services/analytics';
import { buildJoinUrl } from '../utils/invite';

const AVATAR = 44;

function Avatar({ name }: { name: string }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export function TrustedContactsScreen() {
  const router = useRouter();
  const { relationship, status, profile } = useRelationship();
  const { contacts, loading, saving, addTrustedContact, removeTrustedContact } = useTrustedContacts(relationship?.id || null);
  const [phone, setPhone] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);
  const [justAddedName, setJustAddedName] = useState<string | null>(null);
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const addedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addedToastTimerRef.current) clearTimeout(addedToastTimerRef.current);
  }, []);

  const canManage = status === 'active' && !!relationship?.id;

  const cleanPhone = phone.replace(/\D/g, '');
  const isValid = cleanPhone.length === 9;
  const displayNumber = cleanPhone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

  const activeContacts = contacts.filter((c) => c.status === 'active');
  const pendingContacts = contacts.filter((c) => c.status === 'pending');
  const myName = profile?.name || 'bliska osoba';

  const handleAdd = async () => {
    if (!isValid || !canManage || !relationship?.id) return;
    setJustAddedName(null);
    setNotFoundPhone(null);
    try {
      const added = await addTrustedContact(`48${cleanPhone}`);
      analytics.contactAdded();
      // If RPC returned a pending row (no user_id yet), surface the invite sheet
      // so the inviter can share the download link. The pending entry is already
      // in the list; status flips to active automatically when the invitee signs up.
      if (added && added.name === 'Oczekuje') {
        setPhone('');
        setNotFoundPhone(`+48 ${displayNumber}`);
        setPendingInviteCode(added.inviteCode || null);
      } else {
        setJustAddedName(added?.name || 'Osoba');
        setPhone('');
        if (addedToastTimerRef.current) clearTimeout(addedToastTimerRef.current);
        addedToastTimerRef.current = setTimeout(() => setJustAddedName(null), 3000);
      }
    } catch (error) {
      const msg = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : (error instanceof Error ? error.message : '');
      const low = msg.toLowerCase();
      if (msg.includes('already belongs') || msg.includes('already')) {
        Alert.alert('Już w kręgu', 'Ta osoba jest już w Twoim kręgu.');
      } else if (low.includes('network') || low.includes('failed to fetch') || low.includes('timeout') || low.includes('offline')) {
        Alert.alert('Brak internetu', 'Sprawdź połączenie i spróbuj ponownie za chwilę.');
      } else if (low.includes('not authenticated') || low.includes('jwt') || low.includes('unauthor')) {
        Alert.alert('Sesja wygasła', 'Zaloguj się ponownie i spróbuj jeszcze raz.');
      } else if (low.includes('permission') || low.includes('forbid')) {
        Alert.alert('Brak dostępu', 'Tę osobę może dodać ktoś inny z kręgu.');
      } else {
        Alert.alert('Nie udało się dodać', 'Sprawdź numer i spróbuj ponownie.');
      }
    }
  };

  const handleSendInvite = async () => {
    // Direct-join Universal Link carries the code + inviter id (for
    // PostHog attribution of the resulting join). Tapping it on a device
    // with cmok installed opens straight into the trusted-redeem flow.
    // On a fresh device the link falls through to App Store; the code
    // is preserved via pendingInvite storage in the deep-link handler.
    const joinLink = pendingInviteCode
      ? buildJoinUrl(pendingInviteCode, profile?.id)
      : 'https://cmok.app/pobierz';
    const codeLine = pendingInviteCode ? `Twój kod: ${pendingInviteCode}\n\n` : '';
    const msg = `Cześć! ${myName} dodał(a) Cię do kręgu bliskich w cmok. Dostaniesz wiadomość tylko jeśli coś się będzie działo, nic codziennie, żadnego spamu.\n\n${codeLine}${joinLink}`;
    try {
      const result = await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
      if (result.action === Share.sharedAction) analytics.inviteShared('circle');
    } catch { /* cancelled */ }
    setNotFoundPhone(null);
    setPendingInviteCode(null);
    setPhone('');
  };

  const handleRemove = (contactId: string, name: string) => {
    Alert.alert(
      'Usunąć z kręgu?',
      `${name} nie będzie już dostawać wiadomości, gdy poprosisz o pomoc.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTrustedContact(contactId);
              analytics.contactRemoved();
            } catch (error) {
              const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
                ? error.message
                : (error instanceof Error ? error.message : `Nie udało się usunąć ${name}.`);
              Alert.alert('Coś poszło nie tak', message);
            }
          },
        },
      ],
    );
  };

  const handleCancelPendingInvite = (contactId: string) => {
    Alert.alert(
      'Anulować zaproszenie?',
      'Ta osoba nie dołączy do kręgu. Możesz zaprosić ją ponownie w każdej chwili.',
      [
        { text: 'Nie', style: 'cancel' },
        {
          text: 'Tak, anuluj',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTrustedContact(contactId);
            } catch (error) {
              const message = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
                ? error.message
                : (error instanceof Error ? error.message : 'Nie udało się anulować zaproszenia.');
              Alert.alert('Coś poszło nie tak', message);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          hitSlop={16}
        >
          <Text style={styles.backText}>← Wróć</Text>
        </Pressable>

        <Text style={styles.title}>Krąg bliskich</Text>
        <Text style={styles.subtitle}>
          Sąsiad, koleżanka, brat. Dostaną wiadomość, gdy poprosisz o pomoc.
        </Text>

        {canManage && activeContacts.length > 0 ? (
          <View style={styles.heroBanner}>
            <Text style={styles.heroBannerEmoji}>{'\u{1F49A}'}</Text>
            <Text style={styles.heroBannerText}>
              {activeContacts.length === 1
                ? `${activeContacts[0].name} jest w Twoim kręgu`
                : `${activeContacts.length} osób w Twoim kręgu`}
            </Text>
          </View>
        ) : null}

        {!canManage ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Najpierw połącz główną relację</Text>
            <Text style={styles.infoText}>Wróć tutaj, gdy połączenie będzie aktywne.</Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.infoCta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.infoCtaText}>Wróć</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ─── Add card ─── */}
            <Text style={styles.sectionLabel}>Dodaj osobę</Text>
            <Pressable style={[styles.inputCard, phoneFocused && styles.inputCardFocused]} onPress={() => phoneInputRef.current?.focus()}>
              <View style={styles.inputWrapper}>
                <Text style={styles.prefix}>+48</Text>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.input}
                  value={displayNumber}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 9))}
                  keyboardType="phone-pad"
                  placeholder="600 100 200"
                  placeholderTextColor={Colors.textSoft}
                  maxLength={11}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
              </View>
              <Text style={[styles.helper, isValid && styles.helperReady]}>
                {phone.length === 0
                  ? 'Jeśli osoba nie ma cmok, wyślemy zaproszenie.'
                  : isValid
                    ? 'Numer wygląda dobrze.'
                    : 'Wpisz 9-cyfrowy numer.'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleAdd}
              disabled={!isValid || saving || !!justAddedName}
              accessibilityRole="button"
              accessibilityLabel="Dodaj tę osobę do kręgu bliskich"
              accessibilityState={{ disabled: !isValid || saving || !!justAddedName, busy: saving }}
              style={({ pressed }) => [
                styles.addButton,
                (!isValid || saving || !!justAddedName) && styles.addButtonDisabled,
                pressed && isValid && !saving && !justAddedName && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>Dodaj do kręgu</Text>}
            </Pressable>

            {/* ─── Success toast ─── */}
            {justAddedName ? (
              <View style={styles.toastSuccess}>
                <Text style={styles.toastSuccessText}>{justAddedName} dodany(a) do kręgu ✓</Text>
              </View>
            ) : null}

            {/* ─── Invite card (user not in cmok) ─── */}
            {notFoundPhone ? (
              <View style={styles.inviteCard}>
                <Text style={styles.inviteTitle}>Wyślij zaproszenie</Text>
                <Text style={styles.inviteBody}>
                  Numer {notFoundPhone} nie ma jeszcze cmok. Wyślij zaproszenie z kodem, ta osoba wpisze go w apce i dołączy do Twojego kręgu.
                </Text>
                {pendingInviteCode ? (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>Kod zaproszenia</Text>
                    <Text style={styles.codeValue}>{pendingInviteCode}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={handleSendInvite}
                  style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Wyślij zaproszenie do tej osoby"
                >
                  <Text style={styles.inviteBtnText}>Wyślij zaproszenie</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setNotFoundPhone(null); setPhone(''); }}
                  style={({ pressed }) => [styles.inviteDismiss, pressed && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Anuluj dodawanie"
                >
                  <Text style={styles.inviteDismissText}>Anuluj</Text>
                </Pressable>
              </View>
            ) : null}

            {/* ─── List ─── */}
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={styles.sectionLabel}>W kręgu</Text>
                {activeContacts.length > 0 ? (
                  <Text style={styles.listCount}>
                    {activeContacts.length} {activeContacts.length === 1 ? 'osoba' : 'osób'}
                  </Text>
                ) : null}
              </View>

              {loading ? (
                <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 16 }} />
              ) : (activeContacts.length === 0 && pendingContacts.length === 0) ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Krąg jest pusty</Text>
                  <Text style={styles.emptyText}>Dodaj kogoś, kto może zareagować szybko, sąsiada, kogoś z rodziny.</Text>
                </View>
              ) : (
                <View style={styles.listCard}>
                  {activeContacts.map((contact, i) => (
                    <View key={contact.id} style={[styles.contactRow, i > 0 && styles.contactRowDivider]}>
                      <Avatar name={contact.name} />
                      <View style={styles.contactMeta}>
                        <Text style={styles.contactName}>
                          {contact.name}{contact.isSelf ? ' (Ty)' : ''}
                        </Text>
                        <Text style={styles.contactPhone}>
                          {contact.phone || '+48 *** *** ***'}
                        </Text>
                      </View>
                      {contact.isAddableByMe ? (
                        <Pressable
                          onPress={() => handleRemove(contact.id, contact.name)}
                          style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.6 }]}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel={`Usuń ${contact.name} z kręgu`}
                        >
                          <Text style={styles.removeText}>Usuń</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {pendingContacts.map((contact, i) => (
                    <View
                      key={contact.id}
                      style={[styles.contactRow, (activeContacts.length + i) > 0 && styles.contactRowDivider]}
                    >
                      <Avatar name="?" />
                      <View style={styles.contactMeta}>
                        <Text style={styles.contactName} numberOfLines={1}>Czeka na instalację</Text>
                        <Text style={styles.contactPhone} numberOfLines={1}>
                          {contact.phone || '+48 *** *** ***'}
                        </Text>
                        {contact.inviteCode ? (
                          <Text style={styles.contactCode}>Kod: {contact.inviteCode}</Text>
                        ) : null}
                      </View>
                      {contact.isAddableByMe ? (
                        <View style={styles.pendingActions}>
                          <Pressable
                            onPress={() => {
                              setNotFoundPhone(contact.phone || '');
                              setPendingInviteCode(contact.inviteCode || null);
                            }}
                            style={({ pressed }) => [styles.resendButton, pressed && { opacity: 0.7 }]}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Wyślij zaproszenie ponownie"
                          >
                            <Text style={styles.resendText}>Przypomnij</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleCancelPendingInvite(contact.id)}
                            style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.6 }]}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Anuluj zaproszenie"
                          >
                            <Text style={styles.removeText}>Anuluj</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 12 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginTop: 6, marginBottom: 16 },

  /* hero banner (when at least 1 person in circle) */
  heroBanner: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: Colors.safeLight, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 24, gap: 10,
  },
  heroBannerEmoji: { fontSize: 22 },
  heroBannerText: { flex: 1, fontSize: 14, color: Colors.safeStrong, fontFamily: Typography.fontFamilyMedium },

  /* info card (not connected) */
  infoCard: {
    backgroundColor: Colors.surfaceWarm, borderRadius: 20,
    padding: 20, marginTop: 8,
  },
  infoTitle: { fontSize: 18, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  infoText: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 16 },
  infoCta: {
    backgroundColor: Colors.accent, height: 48, borderRadius: 16,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  infoCtaText: { fontSize: 15, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  /* phone input (matches onboarding) */
  sectionLabel: { fontSize: 13, fontFamily: Typography.headingFamilySemiBold, color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  inputCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 18,
    marginBottom: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  inputCardFocused: { borderColor: Colors.safe, backgroundColor: Colors.cardStrong },
  inputWrapper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  prefix: { fontSize: 22, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  input: {
    flex: 1, fontSize: 22, color: Colors.text,
    padding: 0, fontFamily: Typography.headingFamilySemiBold,
  },
  helper: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  helperReady: { color: Colors.safe },

  /* add button */
  addButton: {
    height: 56, borderRadius: 18,
    backgroundColor: Colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
    marginBottom: 32,
  },
  addButtonDisabled: { backgroundColor: Colors.disabled, shadowOpacity: 0, elevation: 0 },
  addButtonText: { fontSize: 17, fontFamily: Typography.headingFamily, color: '#FFFFFF' },

  /* success toast */
  toastSuccess: {
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 18,
    backgroundColor: Colors.safeLight, borderRadius: 14,
    alignItems: 'center' as const,
  },
  toastSuccessText: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },

  /* invite card (user not in cmok) */
  inviteCard: {
    marginTop: 16, padding: 20, borderRadius: 20,
    backgroundColor: Colors.surfaceWarm, borderWidth: 1, borderColor: Colors.accent + '33',
  },
  inviteTitle: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  inviteBody: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginBottom: 16 },
  inviteBtn: {
    backgroundColor: Colors.accent, height: 48, borderRadius: 14,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  inviteBtnText: { fontSize: 15, fontFamily: Typography.headingFamily, color: '#FFFFFF' },
  inviteDismiss: { minHeight: 40, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 6 },
  inviteDismissText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted },

  pendingActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  resendButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: Colors.safeLight, minHeight: 32, justifyContent: 'center' as const,
  },
  resendText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.safeStrong },

  codeBox: {
    backgroundColor: Colors.cardStrong, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16, alignItems: 'center' as const,
  },
  codeLabel: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.textMuted, letterSpacing: 1, marginBottom: 6 },
  codeValue: { fontSize: 28, fontFamily: Typography.headingFamily, color: Colors.accent, letterSpacing: 4 },

  contactCode: { fontSize: 12, fontFamily: Typography.fontFamilyMedium, color: Colors.accent, marginTop: 2 },

  /* list */
  listSection: {},
  listHeader: { flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, marginBottom: 10 },
  listCount: { fontSize: 12, color: Colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    padding: 20, alignItems: 'center' as const,
  },
  emptyTitle: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20, color: Colors.textMuted, textAlign: 'center' as const },

  listCard: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 4,
  },
  contactRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingVertical: 14,
  },
  contactRowDivider: {
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    backgroundColor: Colors.safeLight,
    justifyContent: 'center' as const, alignItems: 'center' as const,
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontFamily: Typography.headingFamilySemiBold, color: Colors.safe },
  contactMeta: { flex: 1 },
  contactName: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  contactPhone: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  removeButton: { minHeight: 40, justifyContent: 'center' as const, paddingHorizontal: 8 },
  removeText: { fontSize: 13, fontFamily: Typography.fontFamilyMedium, color: Colors.alertDark },
});
