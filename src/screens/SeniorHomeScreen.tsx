import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { BigButton } from '../components/BigButton';
import { SOSConfirmation } from '../components/SOSConfirmation';
import { useCheckin } from '../hooks/useCheckin';
import { useCarePair } from '../hooks/useCarePair';
import { useSOS } from '../hooks/useSOS';
import { supabase } from '../services/supabase';
import { savePendingCheckin, syncPendingCheckin } from '../services/offlineSync';

export function SeniorHomeScreen() {
  const router = useRouter();
  const { checkedInToday, loading: checkinLoading, performCheckin, refreshCheckin } = useCheckin();
  const { seniorName, callPhone } = useCarePair();
  const { sosActive, currentAlert, loading: sosLoading, triggerSOS, cancelSOS } = useSOS();

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSaved, setPendingSaved] = useState(false);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);

      // Came back online — sync pending check-in
      if (!offline && pendingSaved) {
        syncPendingCheckin().then((synced) => {
          if (synced) {
            setPendingSaved(false);
            refreshCheckin();
          }
        });
      }
    });
    return () => unsubscribe();
  }, [pendingSaved, refreshCheckin]);

  // Resume SOS state after app restart
  useEffect(() => {
    if (sosActive && currentAlert) {
      setSosTriggered(true);
    }
  }, [sosActive, currentAlert]);

  // Sync pending on mount
  useEffect(() => {
    syncPendingCheckin().then((synced) => {
      if (synced) refreshCheckin();
    });
  }, [refreshCheckin]);

  const handleCheckin = async () => {
    if (isOffline) {
      // Offline: zapisz lokalnie
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await savePendingCheckin(user.id);
          setPendingSaved(true);
        }
      } catch {
        Alert.alert('Błąd', 'Nie udało się zapisać.');
      }
      return;
    }

    try {
      await performCheckin();
    } catch {
      Alert.alert('Błąd', 'Nie udało się zapisać. Spróbuj ponownie.');
    }
  };

  const handleSOSConfirm = async () => {
    setShowSOSModal(false);
    setSosTriggered(true);

    if (isOffline) {
      // Offline: od razu ekran "zadzwoń" bez backendu
      return;
    }

    try {
      await triggerSOS();
    } catch {
      Alert.alert('Błąd', 'Nie udało się wysłać alarmu. Zadzwoń na 112.');
    }
  };

  const handleSOSCancel = () => {
    setShowSOSModal(false);
  };

  const handleCancelAlarm = async () => {
    if (currentAlert) {
      try { await cancelSOS(currentAlert.id); } catch { /* zamknij i tak */ }
    }
    setSosTriggered(false);
  };

  const phoneToCall = callPhone || '+48000000000';

  // ──────────────────────────────────────
  // Ekran "Pomoc wezwana" / offline SOS
  // ──────────────────────────────────────
  if (sosTriggered) {
    return (
      <SafeAreaView style={styles.sosScreen}>
        <View style={styles.sosContent}>
          {isOffline ? (
            <>
              <Text style={styles.sosTitle}>Brak internetu.</Text>
              <Text style={styles.sosSubtitle}>Zadzwoń bezpośrednio.</Text>
            </>
          ) : (
            <>
              <Text style={styles.sosTitle}>Powiadomiliśmy bliskiego.</Text>
              <Text style={styles.sosSubtitle}>Pomoc jest w drodze.</Text>
              {currentAlert?.latitude && currentAlert?.longitude && (
                <Text style={styles.sosLocation}>📍 Twoja lokalizacja została wysłana</Text>
              )}
            </>
          )}

          <BigButton
            title="Zadzwoń do bliskiego"
            onPress={() => Linking.openURL(`tel:${phoneToCall}`)}
            color={Colors.dangerDark}
            style={styles.callButton}
          />

          <Pressable onPress={() => Linking.openURL('tel:112')} style={styles.emergencyLink}>
            <Text style={styles.emergencyText}>Zadzwoń na 112</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleCancelAlarm} style={styles.cancelAlarmLink}>
          <Text style={styles.cancelAlarmText}>Fałszywy alarm? Anuluj</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ──────────────────────────────────────
  // Normalny ekran seniora
  // ──────────────────────────────────────
  const showChecked = checkedInToday || pendingSaved;

  return (
    <SafeAreaView style={styles.container}>
      <SOSConfirmation
        visible={showSOSModal}
        onConfirm={handleSOSConfirm}
        onCancel={handleSOSCancel}
      />

      {/* Ustawienia */}
      <View style={styles.topBar}>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>Brak internetu</Text>
          </View>
        )}
        <View style={styles.spacer} />
        <Pressable onPress={() => router.push('/settings')} style={styles.settingsButton} hitSlop={16}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      {/* Powitanie */}
      <Text style={styles.greeting}>Cześć, Mamo!</Text>

      {/* Przycisk JESTEM OK */}
      <View style={styles.centerArea}>
        {showChecked ? (
          <View style={styles.checkedCircle}>
            <Text style={styles.checkedText}>
              {pendingSaved && !checkedInToday
                ? '✔ Zapisano.\nWyślemy gdy\nwrócisz online.'
                : '✔ Dziękuję!\nDo jutra.'}
            </Text>
          </View>
        ) : checkinLoading ? (
          <View style={styles.checkedCircle}>
            <ActivityIndicator size="large" color={Colors.primary} />
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

      {/* Przycisk POTRZEBUJĘ POMOCY */}
      <BigButton
        title="POTRZEBUJĘ POMOCY"
        onPress={() => setShowSOSModal(true)}
        color={Colors.danger}
        style={styles.sosButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  offlineBadge: {
    backgroundColor: Colors.statusMissingBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offlineText: { fontSize: 12, fontWeight: '600', color: Colors.statusMissingText },
  spacer: { flex: 1 },
  settingsButton: { width: Typography.minSeniorTouch, height: Typography.minSeniorTouch, justifyContent: 'center', alignItems: 'center' },
  settingsIcon: { fontSize: 24, color: Colors.disabled },
  greeting: { fontSize: Typography.seniorTitle, fontWeight: '700', color: Colors.text, textAlign: 'center', marginTop: 4 },
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  checkinButton: { elevation: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  checkedCircle: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.disabled,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  checkedText: { fontSize: Typography.seniorBody, fontWeight: '700', color: Colors.background, textAlign: 'center', lineHeight: 26 },
  sosButton: {
    marginHorizontal: 24, marginBottom: 24, minHeight: 120, borderRadius: 16,
    elevation: 8, shadowColor: Colors.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  sosScreen: { flex: 1, backgroundColor: Colors.danger, justifyContent: 'space-between' },
  sosContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  sosTitle: { fontSize: Typography.seniorTitle, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  sosSubtitle: { fontSize: Typography.seniorBody, color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  sosLocation: { fontSize: 16, color: '#FFFFFF', opacity: 0.9, marginBottom: 32 },
  callButton: { width: '100%', minHeight: 80, borderRadius: 16, marginBottom: 24 },
  emergencyLink: { minHeight: Typography.minSeniorTouch, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emergencyText: { fontSize: 18, color: '#FFFFFF', textDecorationLine: 'underline' },
  cancelAlarmLink: { minHeight: Typography.minSeniorTouch, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  cancelAlarmText: { fontSize: 14, color: Colors.disabled },
});
