import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { SOSConfirmation } from '../components/SOSConfirmation';

export function SeniorHomeScreen() {
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);

  const handleCheckin = () => {
    setCheckedIn(true);
  };

  const handleSOSConfirm = () => {
    setShowSOS(false);
    setSosTriggered(true);
    // TODO: wyślij alert SOS do backendu
  };

  const handleSOSCancel = () => {
    setShowSOS(false);
  };

  // ──────────────────────────────────────
  // Ekran "Pomoc wezwana"
  // ──────────────────────────────────────
  if (sosTriggered) {
    return (
      <SafeAreaView style={styles.sosScreen}>
        <View style={styles.sosContent}>
          <Text style={styles.sosTitle}>Powiadomiliśmy bliskiego.</Text>
          <Text style={styles.sosSubtitle}>Pomoc jest w drodze.</Text>

          <BigButton
            title="Zadzwoń do bliskiego"
            onPress={() => Linking.openURL('tel:+48000000000')}
            color={Colors.dangerDark}
            style={styles.callButton}
          />

          <Pressable
            onPress={() => Linking.openURL('tel:112')}
            style={styles.emergencyLink}
          >
            <Text style={styles.emergencyText}>Zadzwoń na 112</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setSosTriggered(false)}
          style={styles.cancelAlarmLink}
        >
          <Text style={styles.cancelAlarmText}>Anuluj alarm</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ──────────────────────────────────────
  // Normalny ekran seniora
  // ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <SOSConfirmation
        visible={showSOS}
        onConfirm={handleSOSConfirm}
        onCancel={handleSOSCancel}
      />

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
          <View style={styles.checkedCircle}>
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
        onPress={() => setShowSOS(true)}
        color={Colors.danger}
        style={styles.sosButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Normalny ekran ──
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

  // ── Ekran "Pomoc wezwana" ──
  sosScreen: {
    flex: 1,
    backgroundColor: Colors.danger,
    justifyContent: 'space-between',
  },
  sosContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sosTitle: {
    fontSize: Typography.seniorTitle,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  sosSubtitle: {
    fontSize: Typography.seniorBody,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 48,
  },
  callButton: {
    width: '100%',
    minHeight: 80,
    borderRadius: 16,
    marginBottom: 24,
  },
  emergencyLink: {
    minHeight: Typography.minSeniorTouch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emergencyText: {
    fontSize: 18,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  cancelAlarmLink: {
    minHeight: Typography.minSeniorTouch,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  cancelAlarmText: {
    fontSize: 14,
    color: Colors.disabled,
  },
});
