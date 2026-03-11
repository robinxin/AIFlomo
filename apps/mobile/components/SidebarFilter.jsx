import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useMemos } from '@/hooks/use-memos';
import { useTags } from '@/hooks/use-tags';

const TYPE_FILTERS = [
  { key: 'all', label: '全部笔记' },
  { key: 'untagged', label: '无标签' },
  { key: 'image', label: '有图片' },
  { key: 'link', label: '有链接' },
];

function TypeFilterItem({ item, isActive, onPress }) {
  return (
    <Pressable
      style={[styles.filterItem, isActive && styles.filterItemActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      testID={`sidebar-type-${item.key}`}
    >
      <Text style={[styles.filterItemLabel, isActive && styles.filterItemLabelActive]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function TagItem({ tag, isActive, onPress }) {
  return (
    <Pressable
      style={[styles.tagItem, isActive && styles.tagItemActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      testID={`sidebar-tag-${tag.id}`}
    >
      <Text
        style={[styles.tagItemLabel, isActive && styles.tagItemLabelActive]}
        numberOfLines={1}
      >
        #{tag.name}
      </Text>
      {tag.memoCount != null ? (
        <Text style={[styles.tagItemCount, isActive && styles.tagItemCountActive]}>
          {tag.memoCount}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SidebarFilter() {
  const { filter, applyFilter, isLoading } = useMemos();
  const { tags } = useTags();

  const handleTypePress = useCallback(
    (typeKey) => {
      applyFilter({ type: typeKey, tagId: null });
    },
    [applyFilter]
  );

  const handleTagPress = useCallback(
    (tagId) => {
      applyFilter({ type: 'all', tagId });
    },
    [applyFilter]
  );

  const isTypeActive = (typeKey) =>
    filter.tagId == null && filter.type === typeKey;

  const isTagActive = (tagId) => filter.tagId === tagId;

  return (
    <View style={styles.container} testID="sidebar-filter">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>筛选类型</Text>
        {TYPE_FILTERS.map((item) => (
          <TypeFilterItem
            key={item.key}
            item={item}
            isActive={isTypeActive(item.key)}
            onPress={() => handleTypePress(item.key)}
          />
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>标签</Text>
        {isLoading && tags.length === 0 ? (
          <View style={styles.loadingContainer} testID="sidebar-tags-loading">
            <ActivityIndicator size="small" color="#4caf50" />
          </View>
        ) : tags.length === 0 ? (
          <Text style={styles.emptyTagsText} testID="sidebar-tags-empty">
            暂无标签
          </Text>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.tagList}
            testID="sidebar-tag-list"
          >
            {tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                isActive={isTagActive(tag.id)}
                onPress={() => handleTagPress(tag.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
    paddingTop: 16,
  },
  section: {
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  filterItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  filterItemActive: {
    backgroundColor: '#e8f5e9',
  },
  filterItemLabel: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  filterItemLabelActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
    marginVertical: 12,
  },
  tagList: {
    maxHeight: 320,
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
  tagItemLabel: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    flex: 1,
  },
  tagItemLabelActive: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  tagItemCount: {
    fontSize: 12,
    color: '#bbb',
    marginLeft: 6,
    minWidth: 18,
    textAlign: 'right',
  },
  tagItemCountActive: {
    color: '#66bb6a',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyTagsText: {
    fontSize: 13,
    color: '#bbb',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
});
