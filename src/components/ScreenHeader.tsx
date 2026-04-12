import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { GearIcon } from './GearIcon';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface ScreenHeaderProps {
  subtitle?: string | null;
}

export function ScreenHeader({ subtitle }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.spacer} />
      <View style={styles.center}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2}>cmok</Text>
        {subtitle ? <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>{subtitle}</Text> : null}
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [styles.gear, pressed && { opacity: 0.5 }]}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        accessibilityLabel="Ustawienia"
        accessibilityRole="button"
      >
        <GearIcon size={24} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  spacer: {
    width: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: Typography.headingFamily,
    color: Colors.accent,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  gear: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
