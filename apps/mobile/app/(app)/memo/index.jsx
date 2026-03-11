import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useMemos } from '@/hooks/use-memos';
import { useTags } from '@/hooks/use-tags';
import { useStats } from '@/hooks/use-stats';
import { MemoInput } from '@/components/MemoInput';
import { MemoList } from '@/components/MemoList';
import { SidebarFilter } from '@/components/SidebarFilter';
import { StatsBar } from '@/components/StatsBar';
import { Heatmap } from '@/components/Heatmap';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const SIDEBAR_WIDTH = 220;
const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_WIDE = SCREEN_WIDTH >= 768;

export default function MemoIndexScreen() {
  const { memos, isLoading, fetchMemos, deleteMemo } = useMemos();
  const { fetchTags } = useTags();
  const { fetchStats } = useStats();

  const [sidebarVisible, setSidebarVisible] = useState(IS_WIDE);
  const [pendingDeleteMemo, setPendingDeleteMemo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sidebarAnim = useRef(new Animated.Value(IS_WIDE ? 0 : -SIDEBAR_WIDTH)).current;

  useEffect(() => {
    fetchMemos();
    fetchTags();
    fetchStats();
  }, [fetchMemos, fetchTags, fetchStats]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMemos(), fetchTags(), fetchStats()]);
  }, [fetchMemos, fetchTags, fetchStats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);

  const handleMemoSuccess = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const handleDeleteRequest = useCallback((memo) => {
    setPendingDeleteMemo(memo);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteMemo) return;
    setIsDeleting(true);
    try {
      await deleteMemo(pendingDeleteMemo.id);
      await Promise.all([fetchTags(), fetchStats()]);
    } finally {
      setIsDeleting(false);
      setPendingDeleteMemo(null);
    }
  }, [pendingDeleteMemo, deleteMemo, fetchTags, fetchStats]);

  const handleDeleteCancel = useCallback(() => {
    setPendingDeleteMemo(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    const toValue = sidebarVisible ? -SIDEBAR_WIDTH : 0;
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 220,
      useNativeDriver: true,
    }).start();
    setSidebarVisible((prev) => !prev);
  }, [sidebarVisible, sidebarAnim]);

  const listHeader = (
    <View style={styles.listHeader}>
      <StatsBar />
      <Heatmap />
      <MemoInput onSuccess={handleMemoSuccess} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} testID="memo-index-screen">
      <View style={styles.topBar}>
        {!IS_WIDE ? (
          <Pressable
            style={styles.sidebarToggleBtn}
            onPress={toggleSidebar}
            accessibilityRole="button"
            accessibilityLabel={sidebarVisible ? '收起筛选面板' : '展开筛选面板'}
            testID="sidebar-toggle-btn"
          >
            <Text style={styles.sidebarToggleText}>{sidebarVisible ? '< 收起' : '> 筛选'}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.pageTitle} testID="memo-page-title">笔记</Text>
      </View>

      <View style={styles.body}>
        {IS_WIDE ? (
          <View style={styles.sidebarWide} testID="sidebar-wide">
            <SidebarFilter />
          </View>
        ) : (
          <Animated.View
            style={[
              styles.sidebarOverlay,
              { transform: [{ translateX: sidebarAnim }] },
            ]}
            testID="sidebar-overlay"
            pointerEvents={sidebarVisible ? 'auto' : 'none'}
          >
            <SidebarFilter />
          </Animated.View>
        )}

        {!IS_WIDE && sidebarVisible ? (
          <Pressable
            style={styles.sidebarBackdrop}
            onPress={toggleSidebar}
            testID="sidebar-backdrop"
            accessibilityLabel="关闭筛选面板"
          />
        ) : null}

        <View style={styles.content}>
          <MemoList
            memos={memos}
            isLoading={isLoading}
            onDelete={handleDeleteRequest}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            ListHeaderComponent={listHeader}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={!!pendingDeleteMemo}
        title="删除笔记"
        message="笔记将移入回收站，可在回收站中恢复。确认删除吗？"
        confirmText={isDeleting ? '删除中...' : '删除'}
        cancelText="取消"
        confirmDanger
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        testID="delete-confirm-dialog"
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
  sidebarToggleBtn: {
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  sidebarToggleText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sidebarWide: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e0e0e0',
    backgroundColor: '#f7f8fa',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 10,
    backgroundColor: '#f7f8fa',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e0e0e0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
    }),
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  content: {
    flex: 1,
    backgroundColor: '#f2f3f5',
  },
  listHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
});
