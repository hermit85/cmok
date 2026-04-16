import { View, Text, StyleSheet, Pressable, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';

const AVATAR_BIG = 72;
const AVATAR_MED = 56;
const AVATAR_SM = 52;

function Avatar({ name, size, color }: { name: string; size: number; color?: string }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View style={[
      st.avatar,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: color || Colors.safeLight },
    ]}>
      <Text style={[st.avatarText, { fontSize: size * 0.4, color: color ? '#FFFFFF' : Colors.safe }]}>{initial}</Text>
    </View>
  );
}

export function CircleScreen() {
  const router = useRouter();
  const { profile, relationship, status } = useRelationship();
  const { signalers, recipients } = useCircle();
  const { contacts } = useTrustedContacts(relationship?.id || null);

  const isRecipient = profile?.role === 'recipient';
  const isActive = status === 'active';

  const mainPerson = isRecipient ? signalers[0] || null : recipients[0] || null;
  const myName = profile?.name || 'Ja';

  const activeContacts = contacts.filter((c) => c.status === 'active');

  const handleSharePeer = async () => {
    const msg = 'Znasz kogoś, kto mieszka sam? cmok to codzienny znak, że wszystko OK. Jeden gest dziennie.\n\nhttps://cmok.app/pobierz';
    try {
      await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: 'cmok' });
    } catch { /* cancelled */ }
  };

  return (
    <SafeAreaView style={st.container}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [st.back, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={st.backText}>← Wróć</Text>
        </Pressable>

        <Text style={st.title}>Twój krąg</Text>
        <Text style={st.subtitle}>Ludzie, którzy są obok</Text>

        {/* ─── Network visualization ─── */}
        <View style={st.network}>
          {/* YOU — center */}
          <View style={st.youWrap}>
            <Avatar name={myName} size={AVATAR_BIG} color={Colors.accent} />
            <Text style={st.youName}>{myName}</Text>
            <Text style={st.youRole}>To Ty</Text>
          </View>

          {/* Connection line to main person */}
          {mainPerson ? (
            <>
              <View style={st.connectionLine} />
              <Text style={st.connectionLabel}>codzienny znak</Text>
              <View style={st.mainPersonWrap}>
                <Avatar name={mainPerson.name} size={AVATAR_MED} />
                <Text style={st.personName}>{mainPerson.name}</Text>
                <Text style={st.personRole}>
                  {isRecipient ? 'Daje znak' : 'Odbiera znak'}
                </Text>
                {isActive ? <View style={st.activeDot} /> : null}
              </View>
            </>
          ) : (
            <>
              <View style={st.connectionLinePending} />
              <View style={st.mainPersonWrap}>
                <View style={[st.avatar, st.avatarEmpty, { width: AVATAR_MED, height: AVATAR_MED, borderRadius: AVATAR_MED / 2 }]}>
                  <Text style={st.avatarEmptyText}>?</Text>
                </View>
                <Text style={st.personNameEmpty}>
                  {status === 'pending' ? 'Czeka na połączenie' : 'Jeszcze nie połączono'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ─── Trusted circle ─── */}
        {isActive ? (
          <View style={st.trustedSection}>
            <View style={st.trustedHeader}>
              <Text style={st.trustedTitle}>Krąg bliskich</Text>
              <Text style={st.trustedCount}>
                {activeContacts.length > 0 ? `${activeContacts.length} ${activeContacts.length === 1 ? 'osoba' : 'osób'}` : 'pusty'}
              </Text>
            </View>
            <Text style={st.trustedHint}>Wiedzą, gdy coś się dzieje</Text>

            <View style={st.contactsGrid}>
              {activeContacts.map((c) => (
                <View key={c.id} style={st.contactCard}>
                  <Avatar name={c.name} size={AVATAR_SM} />
                  <Text style={st.contactName} numberOfLines={1}>{c.name}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => router.push('/trusted-contacts')}
                style={({ pressed }) => [st.contactCard, st.addCard, pressed && { opacity: 0.6 }]}
              >
                <View style={[st.avatar, st.avatarAdd, { width: AVATAR_SM, height: AVATAR_SM, borderRadius: AVATAR_SM / 2 }]}>
                  <Text style={st.avatarAddText}>+</Text>
                </View>
                <Text style={st.contactAddLabel}>Dodaj</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ─── Viral: peer recommendation ─── */}
        {isActive ? (
          <Pressable onPress={handleSharePeer} style={({ pressed }) => [st.peerCard, pressed && { opacity: 0.85 }]}>
            <Text style={st.peerTitle}>Znasz kogoś, kto mieszka sam?</Text>
            <Text style={st.peerBody}>cmok pomaga. Poleć koleżance, sąsiadce, bratu.</Text>
            <Text style={st.peerCta}>Podziel się →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 12 },
  backText: { fontSize: 16, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
  title: { fontSize: 32, fontFamily: Typography.headingFamily, color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 4, marginBottom: 32 },

  /* network */
  network: { alignItems: 'center' as const, marginBottom: 32 },
  youWrap: { alignItems: 'center' as const },
  youName: { fontSize: 17, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginTop: 10 },
  youRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  connectionLine: { width: 2, height: 32, backgroundColor: Colors.safe, opacity: 0.4, marginTop: 12, marginBottom: 4 },
  connectionLinePending: { width: 2, height: 32, backgroundColor: Colors.border, marginTop: 12, marginBottom: 4, borderStyle: 'dashed' as const },
  connectionLabel: { fontSize: 11, color: Colors.safe, fontFamily: Typography.fontFamilyMedium, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  mainPersonWrap: { alignItems: 'center' as const },
  personName: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginTop: 10 },
  personRole: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  personNameEmpty: { fontSize: 14, color: Colors.textMuted, marginTop: 10, fontFamily: Typography.fontFamilyMedium },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.safe, marginTop: 6 },

  /* avatar */
  avatar: { justifyContent: 'center' as const, alignItems: 'center' as const },
  avatarText: { fontFamily: Typography.headingFamilySemiBold },
  avatarEmpty: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' as const },
  avatarEmptyText: { fontSize: 20, color: Colors.textMuted, fontFamily: Typography.headingFamilySemiBold },
  avatarAdd: { backgroundColor: Colors.safeLight, borderWidth: 2, borderColor: Colors.safe, borderStyle: 'dashed' as const },
  avatarAddText: { fontSize: 22, color: Colors.safe, fontFamily: Typography.headingFamilySemiBold },

  /* trusted */
  trustedSection: { marginBottom: 28 },
  trustedHeader: { flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, marginBottom: 2 },
  trustedTitle: { fontSize: 18, fontFamily: Typography.headingFamilySemiBold, color: Colors.text },
  trustedCount: { fontSize: 12, color: Colors.textMuted },
  trustedHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  contactsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16 },
  contactCard: { alignItems: 'center' as const, width: 72 },
  addCard: {},
  contactName: { fontSize: 12, color: Colors.text, marginTop: 8, textAlign: 'center' as const, fontFamily: Typography.fontFamilyMedium },
  contactAddLabel: { fontSize: 12, color: Colors.safe, marginTop: 8, textAlign: 'center' as const, fontFamily: Typography.fontFamilyMedium },

  /* peer recommendation */
  peerCard: {
    marginTop: 8, padding: 20, borderRadius: 20,
    backgroundColor: Colors.surfaceWarm, borderWidth: 1, borderColor: Colors.accent + '22',
  },
  peerTitle: { fontSize: 16, fontFamily: Typography.headingFamilySemiBold, color: Colors.text, marginBottom: 6 },
  peerBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  peerCta: { fontSize: 14, fontFamily: Typography.fontFamilyMedium, color: Colors.accent },
});
