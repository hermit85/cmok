import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Cmok</Text>
      <ActivityIndicator size="small" color={Colors.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  logo: {
    fontSize: 32,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accent,
  },
  spinner: {
    marginTop: 16,
  },
});
