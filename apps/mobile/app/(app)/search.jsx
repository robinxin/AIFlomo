import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import { EmptyState } from '@/components/EmptyState';
import { useSearch } from '@/hooks/use-search';

export default function SearchScreen() {
  const { query, searchResults, isSearching } = useSearch();

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <HighlightText
        text={item.content}
        keyword={query}
        style={styles.content}
        highlightStyle={styles.highlight}
      />
      {item.tags && item.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Text key={tag.id ?? tag.name} style={styles.tag}>
              #{tag.name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchBar testID="search-screen-bar" />
      </View>

      {!query ? (
        <EmptyState
          message="输入关键词搜索笔记"
          testID="search-empty-hint"
        />
      ) : isSearching && searchResults.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>搜索中...</Text>
        </View>
      ) : searchResults.length === 0 ? (
        <EmptyState
          message="未找到相关笔记"
          hint={`没有包含「${query}」的笔记`}
          testID="search-no-results"
        />
      ) : (
        <FlatList
          testID="search-results-list"
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#aaa',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  highlight: {
    backgroundColor: '#fff9c4',
    color: '#333',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  tag: {
    fontSize: 12,
    color: '#4caf50',
  },
});
