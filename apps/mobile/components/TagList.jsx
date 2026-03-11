import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

function TagItem({ tag, isActive, onPress }) {
  return (
    <Pressable
      style={[styles.tagItem, isActive && styles.tagItemActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`标签 #${tag.name}，共 ${tag.memoCount ?? 0} 条笔记`}
      accessibilityState={{ selected: isActive }}
      testID={`tag-list-item-${tag.id}`}
    >
      <Text
        style={[styles.tagName, isActive && styles.tagNameActive]}
        numberOfLines={1}
      >
        #{tag.name}
      </Text>
      <Text style={[styles.tagCount, isActive && styles.tagCountActive]}>
        {tag.memoCount ?? 0}
      </Text>
    </Pressable>
  );
}

export function TagList({ tags = [], activeTagId = null, onTagPress, isLoading = false }) {
  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <TagItem
        tag={item}
        isActive={activeTagId === item.id}
        onPress={() => onTagPress && onTagPress(item.id)}
      />
    ),
    [activeTagId, onTagPress]
  );

  if (isLoading && tags.length === 0) {
    return (
      <View style={styles.loadingContainer} testID="tag-list-loading">
        <ActivityIndicator size="small" color="#4caf50" />
      </View>
    );
  }

  if (!isLoading && tags.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="tag-list-empty">
        <Text style={styles.emptyText}>暂无标签</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="tag-list"
      data={tags}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      removeClippedSubviews
      initialNumToRender={20}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 2,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  tagItemActive: {
    backgroundColor: '#e8f5e9',
  },
  tagName: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    flex: 1,
  },
  tagNameActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  tagCount: {
    fontSize: 12,
    color: '#bbb',
    marginLeft: 6,
    minWidth: 18,
    textAlign: 'right',
  },
  tagCountActive: {
    color: '#66bb6a',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#bbb',
  },
});
