import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

interface StatusCardProps {
  title: string;
  value: string;
  color?: string;
}

export function StatusCard({ title, value, color = Colors.text }: StatusCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: Typography.caregiverBody,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: Typography.seniorBody,
    fontWeight: '700',
  },
});
