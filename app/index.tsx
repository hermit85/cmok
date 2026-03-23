import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/services/supabase';
import { Colors } from '../src/constants/colors';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace('/onboarding');
        return;
      }

      // Sprawdź profil w public.users
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        router.replace('/onboarding');
        return;
      }

      // Sprawdź aktywną parę
      const column = profile.role === 'senior' ? 'senior_id' : 'caregiver_id';
      const { data: pairs } = await supabase
        .from('care_pairs')
        .select('id')
        .eq(column, session.user.id)
        .eq('status', 'active')
        .limit(1);

      const hasPair = !!(pairs && pairs.length > 0);

      if (profile.role === 'senior' && hasPair) {
        router.replace('/senior-home');
      } else if (profile.role === 'caregiver' && hasPair) {
        router.replace('/caregiver-dashboard');
      } else if (profile.role === 'caregiver') {
        // Caregiver bez pary — niech zaprosi seniora
        router.replace('/onboarding');
      } else {
        // Senior bez pary — niech dołączy
        router.replace('/onboarding');
      }
    } catch {
      router.replace('/onboarding');
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
