import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';

const SCREENS = [
  { label: 'Welcome → Onboarding', route: '/onboarding' },
  { label: 'Signaler Home (before)', route: '/signaler-home?preview=before' },
  { label: 'Signaler Home (after)', route: '/signaler-home?preview=after' },
  { label: 'Signaler Home (support)', route: '/signaler-home?preview=support' },
  { label: 'Recipient Home (before)', route: '/recipient-home?preview=before' },
  { label: 'Recipient Home (after)', route: '/recipient-home?preview=after' },
  { label: 'Recipient Home (response)', route: '/recipient-home?preview=response' },
  { label: 'Settings', route: '/settings' },
  { label: 'Circle', route: '/circle' },
  { label: 'Waiting (invite code)', route: '/waiting' },
  { label: 'Trusted Support', route: '/trusted-support' },
  { label: 'Trusted Contacts', route: '/trusted-contacts' },
];

export default function DevScreens() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Dev Screens</Text>
        <Text style={s.sub}>Tap to preview each screen</Text>

        {SCREENS.map((screen) => (
          <Pressable
            key={screen.route}
            onPress={() => router.push(screen.route as any)}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.rowLabel}>{screen.label}</Text>
            <Text style={s.rowArrow}>→</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24 },
  title: { fontSize: 28, fontFamily: Typography.headingFamily, color: Colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 8,
  },
  rowLabel: { fontSize: 15, color: Colors.text },
  rowArrow: { fontSize: 18, color: Colors.textMuted },
});
