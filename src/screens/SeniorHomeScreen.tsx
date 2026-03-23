import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';

export function SeniorHomeScreen() {
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState(false);

  const handleCheckin = () => {
    setCheckedIn(true);
  };

  const handleSOS = () => {
    Alert.alert(
      'Wezwanie pomocy',
      'Czy na pewno chcesz wezwać pomoc?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Tak',
          style: 'destructive',
          onPress: () => {
            // TODO: trigger SOS alert
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Ustawienia — zębatka w prawym górnym rogu */}
      <View style={styles.topBar}>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
          hitSlop={16}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      {/* Powitanie */}
      <Text style={styles.greeting}>Cześć, Mamo!</Text>

      {/* Przycisk JESTEM OK — wycentrowany */}
      <View style={styles.centerArea}>
        {checkedIn ? (
          <View style={[styles.checkedCircle]}>
            <Text style={styles.checkedText}>{'✔ Dziękuję!\nDo jutra.'}</Text>
          </View>
        ) : (
          <BigButton
            title={'JESTEM\nOK'}
            onPress={handleCheckin}
            color={Colors.primary}
            size="large"
            style={styles.checkinButton}
          />
        )}
      </View>

      {/* Przycisk POTRZEBUJĘ POMOCY — dół ekranu */}
      <BigButton
        title="POTRZEBUJĘ POMOCY"
        onPress={handleSOS}
        color={Colors.danger}
        style={styles.sosButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  spacer: {
    flex: 1,
  },
  settingsButton: {
    width: Typography.minSeniorTouch,
    height: Typography.minSeniorTouch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
    color: Colors.disabled,
  },
  greeting: {
    fontSize: Typography.seniorTitle,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkinButton: {
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  checkedCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  checkedText: {
    fontSize: Typography.seniorBody,
    fontWeight: '700',
    color: Colors.background,
    textAlign: 'center',
    lineHeight: 28,
  },
  sosButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    minHeight: 120,
    borderRadius: 16,
    elevation: 8,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
