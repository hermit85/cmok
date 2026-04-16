import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useRelationship } from '../hooks/useRelationship';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { analytics } from '../services/analytics';

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
  const phoneInputRef = useRef<TextInput>(null);
  const [justAddedName, setJustAddedName] = useState<string | null>(null);
  const [notFoundPhone, setNotFoundPhone] = useState<string | null>(null);

  const canManage = status === 'active' && !!relationship?.id;

  const cleanPhone = phone.replace(/\D/g, '');
  const isValid = cleanPhone.length === 9;
  const displayNumber = cleanPhone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

  const activeContacts = contacts.filter((c) => c.status === 'active');
  const myName = profile?.name || 'bliska osoba';

  const handleAdd = async () => {
    if (!isValid || !canManage || !relationship?.id) return;
    setJustAddedName(null);
    setNotFoundPhone(null);
    try {
      const added = await addTrustedContact(`48${cleanPhone}`);
      analytics.contactAdded();
      setJustAddedName(added?.name || 'Osoba');
      setPhone('');
      setTimeout(() => setJustAddedName(null), 3000);
    } catch (error) {
      const msg = (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : (error instanceof Error ? error.message : '');
      if (msg.includes('not found') || msg.includes('User not found')) {
        // Inline invite flow — not an error, just means we need to invite them
        setNotFoundPhone(`+48 ${displayNumber}`);
      } else if (msg.includes('already belongs') || msg.includes('already')) {
        Alert.alert('Już w kręgu', 'Ta osoba jest już w Twoim kręgu.');
      } else {
        Alert.alert('Nie udało się dodać', msg || 'Sprawdź numer i spróbuj ponownie.');
      }
    }
  };

  const handleSendInvite = async () => {
    const msg = `Cześć! ${myName} poprosił(a), żebyś był(a) w jej/jego kręgu bliskich w cmok.\n\ncmok to apka, która daje codzienny znak "wszystko OK" osobom które mieszkają osobno. Ty dostaniesz wiadomość tylko jeśli coś się będzie działo.\n\nPobierz i zaloguj się swoim numerem:\nhttps://cmok.app/pobierz`;
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
    } catch { /* cancelled */ }
    setNotFoundPhone(null);
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
            <Pressable style={styles.inputCard} onPress={() => phoneInputRef.current?.focus()}>
              <View style={styles.inputWrapper}>
                <Text style={styles.prefix}>+48</Text>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.input}
                  value={displayNumber}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 9))}
                  keyboardType="phone-pad"
                  placeholder="600 100 200"
                  placeholderTextColor="#D1CBC4"
                  maxLength={11}
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
              disabled={!isValid || saving}
              style={({ pressed }) => [
                styles.addButton,
                (!isValid || saving) && styles.addButtonDisabled,
                pressed && isValid && !saving && { opacity: 0.88, transform: [{ scale: 0.98 }] },
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
                <Text style={styles.inviteTitle}>Ta osoba nie ma jeszcze cmok</Text>
                <Text style={styles.inviteBody}>
                  Numer {notFoundPhone} nie jest w bazie. Wyślij zaproszenie, a gdy pobierze apkę i zaloguje się, dodasz ją do kręgu.
                </Text>
                <Pressable
                  onPress={handleSendInvite}
                  style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                >
                  <Text style={styles.inviteBtnText}>Wyślij zaproszenie</Text>
                </Pressable>
                <Pressable onPress={() => { setNotFoundPhone(null); setPhone(''); }} style={({ pressed }) => [styles.inviteDismiss, pressed && { opacity: 0.5 }]}>
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
              ) : activeContacts.length === 0 ? (
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
                        <Text style={styles.contactName}>{contact.name}</Text>
                        {contact.phone ? <Text style={styles.contactPhone}>{contact.phone}</Text> : null}
                      </View>
                      <Pressable
                        onPress={() => handleRemove(contact.id, contact.name)}
                        style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.6 }]}
                        hitSlop={12}
                      >
                        <Text style={styles.removeText}>Usuń</Text>
                      </Pressable>
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
  },
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
    shadowColor: '#E85D3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
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
