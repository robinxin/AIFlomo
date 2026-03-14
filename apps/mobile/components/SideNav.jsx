import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ProModal } from './ProModal';

const QUICK_FILTERS = [
  { key: 'no_tag', label: '无标签' },
  { key: 'has_image', label: '有图片' },
  { key: 'has_link', label: '有链接' },
];

const PRO_FEATURES = ['微信输入', '每日回顾', 'AI 洞察', '随机漫步'];

const TAG_COLLAPSE_LIMIT = 5;

export function SideNav({ tags, activeFilter, trashCount, onFilterChange }) {
  const router = useRouter();
  const [showAllTags, setShowAllTags] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);

  const visibleTags = showAllTags ? tags : tags.slice(0, TAG_COLLAPSE_LIMIT);

  const handleFilterPress = (key) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  const handleTagPress = (tag) => {
    const filterKey = `tag:${tag.name}`;
    onFilterChange(activeFilter === filterKey ? null : filterKey);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 快速筛选 */}
        <Text style={styles.sectionTitle}>筛选</Text>
        {QUICK_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterItem, activeFilter === f.key && styles.filterItemActive]}
            onPress={() => handleFilterPress(f.key)}
          >
            <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* 标签列表 */}
        {tags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>标签</Text>
            {visibleTags.map((tag) => {
              const filterKey = `tag:${tag.name}`;
              const isActive = activeFilter === filterKey;
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.filterItem, isActive && styles.filterItemActive]}
                  onPress={() => handleTagPress(tag)}
                >
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    #{tag.name}
                  </Text>
                  <Text style={styles.tagCount}>{tag.memoCount}</Text>
                </TouchableOpacity>
              );
            })}
            {tags.length > TAG_COLLAPSE_LIMIT && (
              <TouchableOpacity onPress={() => setShowAllTags((v) => !v)} style={styles.expandBtn}>
                <Text style={styles.expandText}>{showAllTags ? '收起' : `展开全部 (${tags.length})`}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Pro 功能 */}
        <Text style={styles.sectionTitle}>Pro</Text>
        {PRO_FEATURES.map((f) => (
          <TouchableOpacity
            key={f}
            style={styles.filterItem}
            onPress={() => setProModalVisible(true)}
          >
            <Text style={styles.proLabel}>{f}</Text>
            <Text style={styles.proLock}>🔒</Text>
          </TouchableOpacity>
        ))}

        {/* 回收站 */}
        <TouchableOpacity style={styles.trashBtn} onPress={() => router.push('/trash')}>
          <Text style={styles.trashLabel}>🗑 回收站</Text>
          {trashCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{trashCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ProModal visible={proModalVisible} onClose={() => setProModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#bbb',
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 6,
  },
  filterItemActive: {
    backgroundColor: '#e8f5e9',
  },
  filterLabel: {
    fontSize: 13,
    color: '#555',
  },
  filterLabelActive: {
    color: '#4caf50',
    fontWeight: '600',
  },
  tagCount: {
    fontSize: 11,
    color: '#aaa',
  },
  expandBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expandText: {
    fontSize: 12,
    color: '#4caf50',
  },
  proLabel: {
    fontSize: 13,
    color: '#aaa',
  },
  proLock: {
    fontSize: 12,
  },
  trashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  trashLabel: {
    fontSize: 13,
    color: '#888',
  },
  badge: {
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
