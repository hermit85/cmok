import { View, Text, StyleSheet } from 'react-native';
import { timeAgo } from '../utils/time';

interface MemberRowProps {
  name: string;
  lastCmokAt: string | null;
  status: string;
}

export function MemberRow({ name, lastCmokAt, status }: MemberRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.time}>{timeAgo(lastCmokAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 8,
  },
  status: {
    fontSize: 20,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  time: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
});
