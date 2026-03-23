import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

export function CaregiverDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard Opiekuna</Text>
      <Text style={styles.subtitle}>Tu pojawi się status seniorów i alerty</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  title: {
    fontSize: Typography.caregiverTitle,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: Typography.caregiverBody,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
