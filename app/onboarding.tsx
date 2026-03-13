import { View, Text, StyleSheet } from 'react-native';

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cmok</Text>
      <Text style={styles.subtitle}>Wyslij buziaczka komus bliskiemu</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#E8578B',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: '#7F5BA6',
    textAlign: 'center',
  },
});
