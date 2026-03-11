import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { ConfirmDialog } from './ConfirmDialog';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

export function TrashMemoCard({ memo, onRestore, onPermanentDelete }) {
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleRestore = useCallback(() => {
    if (onRestore) onRestore(memo);
  }, [memo, onRestore]);

  const handlePermanentDeletePress = useCallback(() => {
    setConfirmVisible(true);
  }, []);

  const handleConfirmPermanentDelete = useCallback(() => {
    setConfirmVisible(false);
    if (onPermanentDelete) onPermanentDelete(memo);
  }, [memo, onPermanentDelete]);

  const handleCancelPermanentDelete = useCallback(() => {
    setConfirmVisible(false);
  }, []);

  const tags = memo.tags ?? [];

  return (
    <View style={styles.card} testID={`trash-card-${memo.id}`}>
      <View style={styles.header}>
        <Text style={styles.deletedLabel} testID={`trash-deleted-label-${memo.id}`}>
          已删除
        </Text>
        <Text style={styles.dateText} testID={`trash-date-${memo.id}`}>
          {formatDate(memo.deletedAt || memo.createdAt)}
        </Text>
      </View>

      <Text
        style={styles.content}
        testID={`trash-content-${memo.id}`}
        numberOfLines={6}
      >
        {memo.content}
      </Text>

      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContainer}
          testID={`trash-tags-${memo.id}`}
        >
          {tags.map((tag) => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            return (
              <View key={tagName} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tagName}</Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnRestore]}
          onPress={handleRestore}
          testID={`trash-restore-btn-${memo.id}`}
          accessibilityRole="button"
          accessibilityLabel="恢复笔记"
        >
          <Text style={styles.btnRestoreText}>恢复</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnDelete]}
          onPress={handlePermanentDeletePress}
          testID={`trash-permanent-delete-btn-${memo.id}`}
          accessibilityRole="button"
          accessibilityLabel="永久删除笔记"
        >
          <Text style={styles.btnDeleteText}>永久删除</Text>
        </Pressable>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        title="永久删除"
        message="删除后无法恢复，确认永久删除这条笔记吗？"
        confirmText="永久删除"
        cancelText="取消"
        confirmDanger
        onConfirm={handleConfirmPermanentDelete}
        onCancel={handleCancelPermanentDelete}
        testID={`trash-confirm-dialog-${memo.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    opacity: 0.85,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deletedLabel: {
    fontSize: 11,
    color: '#e53935',
    fontWeight: '500',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 16,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: '#888',
  },
  tagsScroll: {
    marginTop: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  tagBadge: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRestore: {
    backgroundColor: '#e8f5e9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#a5d6a7',
  },
  btnDelete: {
    backgroundColor: '#ffebee',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ef9a9a',
  },
  btnRestoreText: {
    fontSize: 14,
    color: '#388e3c',
    fontWeight: '600',
  },
  btnDeleteText: {
    fontSize: 14,
    color: '#e53935',
    fontWeight: '600',
  },
});
