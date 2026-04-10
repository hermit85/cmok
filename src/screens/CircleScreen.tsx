import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { Radius, Spacing } from '../constants/tokens';
import { useRelationship } from '../hooks/useRelationship';
import { useCircle } from '../hooks/useCircle';
import { useTrustedContacts } from '../hooks/useTrustedContacts';
import { shareCircleInvite } from '../utils/invite';

function StatusBadge({ joined }: { joined: boolean }) {
  return (
    <View style={[st.badge, joined ? st.badgeJoined : st.badgePending]}>
      <Text style={[st.badgeText, joined ? st.badgeTextJoined : st.badgeTextPending]}>
        {joined ? 'w kręgu' : 'oczekuje'}
      </Text>
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

  // Main person in the daily ritual
  const mainPerson = isRecipient
    ? signalers[0] || null
    : recipients[0] || null;

  return (
    <SafeAreaView style={st.container}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [st.back, pressed && { opacity: 0.6 }]} hitSlop={16}>
          <Text style={st.backText}>← Wróć</Text>
        </Pressable>

        <Text style={st.title}>Twój krąg</Text>

        {/* ─── Main daily person ─── */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>Codzienny znak</Text>
          {mainPerson ? (
            <View style={st.personRow}>
              <View style={st.personAvatar}>
                <Text style={st.personAvatarText}>{(mainPerson.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={st.personInfo}>
                <Text style={st.personName}>{mainPerson.name}</Text>
                <Text style={st.personRole}>
                  {isRecipient ? 'Daje codzienny znak' : 'Dostaje Twój codzienny znak'}
                </Text>
              </View>
              <StatusBadge joined={isActive} />
            </View>
          ) : (
            <View style={st.emptyRow}>
              <Text style={st.emptyText}>
                {status === 'pending' ? 'Czeka na połączenie' : 'Jeszcze nie połączono'}
              </Text>
            </View>
          )}
        </View>

        {/* ─── Circle / trusted contacts ─── */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>Krąg bliskich</Text>
          <Text style={st.sectionHint}>Wiedzą, gdy coś się dzieje — i mogą szybko zareagować</Text>

          {contacts.length === 0 ? (
            <View style={st.emptyRow}>
              <Text style={st.emptyText}>Zaproś bliskich, żeby mogli być obok, gdy będzie trzeba.</Text>
            </View>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={st.personRow}>
                <View style={st.personAvatar}>
                  <Text style={st.personAvatarText}>{(c.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={st.personInfo}>
                  <Text style={st.personName}>{c.name}</Text>
                  {c.phone ? <Text style={st.personPhone}>{c.phone}</Text> : null}
                </View>
                <StatusBadge joined={c.status === 'active'} />
              </View>
            ))
          )}

          {isRecipient && isActive ? (
            <View style={st.actions}>
              <Pressable
                onPress={() => router.push('/trusted-contacts')}
                style={({ pressed }) => [st.addBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={st.addBtnText}>Dodaj osobę do kręgu</Text>
              </Pressable>

              <Pressable
                onPress={() => shareCircleInvite()}
                style={({ pressed }) => [st.inviteLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={st.inviteLinkText}>Zaproś do kręgu</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR = 40;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screen, paddingTop: 16, paddingBottom: 32 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 20 },
  backText: { fontSize: 16, fontWeight: '500', color: Colors.accent },
  title: { fontSize: Typography.title, fontFamily: Typography.fontFamilyBold, color: Colors.text, marginBottom: 24 },

  /* sections */
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.accent, marginBottom: 4 },
  sectionHint: { fontSize: 14, color: Colors.textMuted, marginBottom: 12 },

  /* person row */
  personRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  personAvatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: Colors.safeLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  personAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.safe },
  personInfo: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  personRole: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  personPhone: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  /* badges */
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeJoined: { backgroundColor: Colors.safeLight },
  badgePending: { backgroundColor: Colors.surfaceWarm },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextJoined: { color: Colors.statusOkText },
  badgeTextPending: { color: Colors.textSecondary },

  /* empty */
  emptyRow: { paddingVertical: 16 },
  emptyText: { fontSize: 15, color: Colors.textMuted },

  /* actions */
  actions: { marginTop: 16 },
  addBtn: { backgroundColor: Colors.accent, minHeight: 48, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  inviteLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  inviteLinkText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
