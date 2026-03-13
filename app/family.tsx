import { View, Text, StyleSheet } from 'react-native';

export default function FamilyScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rodzina</Text>
      <Text style={styles.subtitle}>Lista czlonkow rodziny</Text>
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
    fontSize: 36,
    fontWeight: '700',
    color: '#E8578B',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    color: '#7F5BA6',
  },
});
