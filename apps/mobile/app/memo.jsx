import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, ToastAndroid, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMemos } from '@/hooks/use-memos';
import { api } from '@/lib/api-client';
import { StatsBar } from '@/components/StatsBar';
import { SearchBar } from '@/components/SearchBar';
import { MemoInput } from '@/components/MemoInput';
import { HeatmapCalendar } from '@/components/HeatmapCalendar';
import { MemoList } from '@/components/MemoList';
import { SideNav } from '@/components/SideNav';

function showToast(message) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}

export default function MemoScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const {
    memos,
    tags,
    stats,
    heatmap,
    activeFilter,
    keyword,
    isLoading,
    isSubmitting,
    error,
    hasMore,
    fetchMemos,
    loadMore,
    createMemo,
    deleteMemo,
    setFilter,
    setKeyword,
    fetchTags,
    fetchStats,
    fetchHeatmap,
  } = useMemos();

  // 初始化加载
  useEffect(() => {
    fetchMemos(true);
    fetchTags();
    fetchStats();
    fetchHeatmap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选条件变化时重新加载
  useEffect(() => {
    fetchMemos(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  const handleSubmit = useCallback(
    async (content) => {
      try {
        await createMemo(content);
        fetchStats();
        fetchTags();
      } catch (err) {
        showToast('提交失败，请重试');
        throw err;
      }
    },
    [createMemo, fetchStats, fetchTags],
  );

  const handleDelete = useCallback(
    async (id) => {
      try {
        await deleteMemo(id);
        fetchStats();
      } catch (_) {
        showToast('删除失败，请重试');
      }
    },
    [deleteMemo, fetchStats],
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
      logout();
      router.replace('/login');
    } catch (_) {
      showToast('退出失败，请重试');
    }
  }, [logout, router]);

  const getEmptyText = () => {
    if (keyword) return '未找到相关笔记';
    if (activeFilter) return '暂无符合条件的笔记';
    return '写下你的第一条想法';
  };

  return (
    <View style={styles.screen}>
      {/* 左侧导航 */}
      <SideNav
        tags={tags}
        activeFilter={activeFilter}
        trashCount={stats.trashCount}
        onFilterChange={setFilter}
      />

      {/* 右侧主区域 */}
      <View style={styles.main}>
        <StatsBar
          nickname={user?.nickname ?? ''}
          stats={stats}
          onLogout={handleLogout}
        />
        <SearchBar
          value={keyword}
          onChangeText={setKeyword}
          onClear={() => setKeyword('')}
        />
        <MemoInput
          onSubmit={handleSubmit}
          tags={tags}
          disabled={isSubmitting}
        />
        <HeatmapCalendar data={heatmap} />
        <MemoList
          memos={memos}
          isLoading={isLoading}
          error={error}
          emptyText={getEmptyText()}
          onDelete={handleDelete}
          onLoadMore={loadMore}
          onRetry={() => fetchMemos(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
  },
  main: {
    flex: 1,
    flexDirection: 'column',
  },
});
