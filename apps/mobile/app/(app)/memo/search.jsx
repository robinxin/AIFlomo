import { useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSearch } from '@/hooks/use-search';
import { SearchBar } from '@/components/SearchBar';
import { MemoCard } from '@/components/MemoCard';
import { EmptyState } from '@/components/EmptyState';

function ListHeader({ query, resultCount }) {
  if (!query) return null;
  return (
    <View style={styles.resultHeader} testID="search-result-header">
      <Text style={styles.resultHeaderText} testID="search-result-count">
        {`搜索「${query}」，共 ${resultCount} 条笔记`}
      </Text>
    </View>
  );
}

function ListEmpty({ query, isSearching }) {
  if (isSearching) return null;
  if (!query) {
    return (
      <EmptyState
        message="输入关键词开始搜索"
        hint="支持搜索笔记内容"
        testID="search-empty-initial"
      />
    );
  }
  return (
    <EmptyState
      message="未找到相关笔记"
      hint={`没有包含「${query}」的笔记`}
      testID="search-empty-no-results"
    />
  );
}

export default function SearchScreen() {
  const { query, searchResults, isSearching, searchQuery } = useSearch();

  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <MemoCard memo={item} highlight={searchQuery} />
    ),
    [searchQuery]
  );

  return (
    <SafeAreaView style={styles.safeArea} testID="search-screen">
      <View style={styles.topBar}>
        <Text style={styles.pageTitle} testID="search-page-title">
          搜索
        </Text>
      </View>

      <View style={styles.searchBarWrapper}>
        <SearchBar
          placeholder="搜索笔记内容..."
          testID="search-page-bar"
        />
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer} testID="search-loading">
          <ActivityIndicator size="small" color="#4caf50" />
          <Text style={styles.loadingText}>搜索中...</Text>
        </View>
      ) : (
        <FlatList
          testID="search-result-list"
          data={searchResults}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={
            searchResults.length === 0 ? styles.emptyList : styles.list
          }
          ListHeaderComponent={
            <ListHeader query={searchQuery} resultCount={searchResults.length} />
          }
          ListEmptyComponent={
            <ListEmpty query={searchQuery} isSearching={isSearching} />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
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
  searchBarWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
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
  resultHeader: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  resultHeaderText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
});
