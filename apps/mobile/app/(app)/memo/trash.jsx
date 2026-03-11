import { useEffect, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { useTrash } from '@/hooks/use-trash';
import { TrashMemoCard } from '@/components/TrashMemoCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function ListHeader({ count }) {
  return (
    <View style={styles.listHeader} testID="trash-list-header">
      <Text style={styles.listHeaderText} testID="trash-count-label">
        {count > 0 ? `回收站 (${count})` : '回收站'}
      </Text>
    </View>
  );
}

export default function TrashScreen() {
  const { trashMemos, trashCount, fetchTrash, restoreMemo, permanentDeleteMemo } = useTrash();
  const [isLoading, setIsLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchTrash().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchTrash]);

  const handleRestorePress = useCallback((memo) => {
    setRestoreTarget(memo);
  }, []);

  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreTarget) return;
    const id = restoreTarget.id;
    setRestoreTarget(null);
    try {
      await restoreMemo(id);
    } catch {
      Alert.alert('恢复失败', '笔记恢复失败，请重试');
    }
  }, [restoreTarget, restoreMemo]);

  const handleRestoreCancel = useCallback(() => {
    setRestoreTarget(null);
  }, []);

  const handlePermanentDelete = useCallback(async (memo) => {
    try {
      await permanentDeleteMemo(memo.id);
    } catch {
      Alert.alert('删除失败', '笔记永久删除失败，请重试');
    }
  }, [permanentDeleteMemo]);

  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <TrashMemoCard
        memo={item}
        onRestore={handleRestorePress}
        onPermanentDelete={handlePermanentDelete}
      />
    ),
    [handleRestorePress, handlePermanentDelete]
  );

  return (
    <SafeAreaView style={styles.safeArea} testID="trash-screen">
      <View style={styles.topBar}>
        <Text style={styles.pageTitle} testID="trash-page-title">
          回收站
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer} testID="trash-loading">
          <ActivityIndicator size="small" color="#4caf50" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <FlatList
          testID="trash-list"
          data={trashMemos}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={
            trashMemos.length === 0 ? styles.emptyList : styles.list
          }
          ListHeaderComponent={
            trashMemos.length > 0 ? (
              <ListHeader count={trashCount} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              message="回收站为空"
              hint="删除的笔记会在这里保留"
              testID="trash-empty"
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      <ConfirmDialog
        visible={!!restoreTarget}
        title="恢复笔记"
        message="确认将这条笔记恢复到笔记列表吗？"
        confirmText="恢复"
        cancelText="取消"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
        testID="trash-restore-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#aaa',
  },
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
  listHeader: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  listHeaderText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
});
