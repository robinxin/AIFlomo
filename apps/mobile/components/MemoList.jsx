import { useCallback } from 'react';
import { FlatList, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MemoCard } from './MemoCard';

function ListEmpty({ isLoading }) {
  if (isLoading) return null;
  return (
    <View style={styles.emptyContainer} testID="memo-list-empty">
      <Text style={styles.emptyText}>暂无笔记，快来记录第一条吧</Text>
    </View>
  );
}

function ListFooter({ isLoading }) {
  if (!isLoading) return null;
  return (
    <View style={styles.footerContainer} testID="memo-list-loading">
      <ActivityIndicator size="small" color="#4caf50" />
    </View>
  );
}

export function MemoList({ memos, isLoading, onEdit, onDelete, onRefresh, refreshing }) {
  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <MemoCard memo={item} onEdit={onEdit} onDelete={onDelete} />
    ),
    [onEdit, onDelete]
  );

  return (
    <FlatList
      testID="memo-list"
      data={memos}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={memos && memos.length === 0 ? styles.emptyList : styles.list}
      ListEmptyComponent={<ListEmpty isLoading={isLoading} />}
      ListFooterComponent={<ListFooter isLoading={isLoading && memos && memos.length > 0} />}
      onRefresh={onRefresh}
      refreshing={refreshing ?? false}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
  },
  footerContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
