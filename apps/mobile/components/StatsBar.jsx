import { View, Text, StyleSheet } from 'react-native';
import { useAuthContext } from '@/context/AuthContext';
import { useMemoContext } from '@/context/MemoContext';

export function StatsBar() {
  const { state: authState } = useAuthContext();
  const { state: memoState } = useMemoContext();

  const nickname = authState.user?.nickname ?? authState.user?.email ?? '';
  const totalCount = memoState.stats?.totalCount ?? 0;
  const daysUsed = memoState.stats?.daysUsed ?? 0;

  return (
    <View style={styles.container} testID="stats-bar">
      <Text style={styles.nickname} testID="stats-nickname" numberOfLines={1}>
        {nickname}
      </Text>
      <View style={styles.divider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue} testID="stats-total-count">
          {totalCount}
        </Text>
        <Text style={styles.statLabel}>全部笔记</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue} testID="stats-days-used">
          {daysUsed}
        </Text>
        <Text style={styles.statLabel}>使用天数</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  nickname: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 56,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4caf50',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
