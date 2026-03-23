import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ustawienia</Text>
      <Text style={styles.subtitle}>Tu pojawią się ustawienia konta i powiadomień</Text>
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
    fontSize: Typography.seniorTitle,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: Typography.seniorBody,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
