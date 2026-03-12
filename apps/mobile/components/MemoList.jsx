import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MemoCard } from './MemoCard';

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.line} />
      <View style={[skeletonStyles.line, { width: '70%' }]} />
      <View style={[skeletonStyles.line, { width: '50%', marginTop: 8 }]} />
    </View>
  );
}

export function MemoList({ memos, isLoading, error, emptyText, onDelete, onLoadMore, onRetry }) {
  if (isLoading && memos.length === 0) {
    return (
      <View style={styles.container}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  if (error && memos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>加载失败，点击重试</Text>
        {!!onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!isLoading && memos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{emptyText || '写下你的第一条想法'}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={memos}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MemoCard memo={item} onDelete={onDelete} />}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        isLoading ? <ActivityIndicator style={{ margin: 16 }} color="#4caf50" /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  list: {
    padding: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#e53935',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  line: {
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
});
