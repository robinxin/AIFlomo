import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api-client';
import { useMemoContext } from '@/context/MemoContext';

function TrashMemoCard({ memo }) {
  const deletedDate = memo.deletedAt
    ? new Date(memo.deletedAt).toLocaleDateString('zh-CN')
    : '';

  return (
    <View style={styles.card}>
      <Text style={styles.content} numberOfLines={3}>
        {memo.content}
      </Text>
      <Text style={styles.date}>删除于 {deletedDate}</Text>
    </View>
  );
}

export default function TrashScreen() {
  const router = useRouter();
  const { state } = useMemoContext();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadItems = useCallback(
    async (reset = false) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const nextPage = reset ? 1 : page;
        const result = await api.get(`/api/memos/trash?page=${nextPage}&limit=20`);
        const newItems = reset ? result.items : [...items, ...result.items];
        setItems(newItems);
        setTotal(result.total);
        setPage(nextPage + 1);
        setHasMore(newItems.length < result.total);
      } catch (_) {
        // 失败不处理，保持现有列表
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, page, items],
  );

  useEffect(() => {
    loadItems(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>回收站 ({total})</Text>
      </View>

      {!isLoading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>回收站为空</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TrashMemoCard memo={item} />}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (hasMore) loadItems(false); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoading ? <ActivityIndicator style={{ margin: 16 }} color="#4caf50" /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    fontSize: 15,
    color: '#4caf50',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    opacity: 0.7,
  },
  content: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
    color: '#aaa',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
  },
});
