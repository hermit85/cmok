import { View, Text, StyleSheet } from 'react-native';

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak < 1) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Seria: {streak} {streak === 1 ? 'dzien' : 'dni'} z rzedu
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5EEFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  text: {
    fontSize: 16,
    color: '#7F5BA6',
    fontWeight: '600',
  },
});
