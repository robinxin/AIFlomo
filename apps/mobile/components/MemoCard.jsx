import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { AttachmentPreview } from './AttachmentPreview';
import { HighlightText } from './HighlightText';

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

export function MemoCard({ memo, onEdit, onDelete, highlight }) {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleOpenMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleEdit = useCallback(() => {
    setMenuVisible(false);
    if (onEdit) onEdit(memo);
  }, [memo, onEdit]);

  const handleDelete = useCallback(() => {
    setMenuVisible(false);
    if (onDelete) onDelete(memo);
  }, [memo, onDelete]);

  const tags = memo.tags ?? [];
  const attachments = memo.attachments ?? [];

  return (
    <View style={styles.card} testID={`memo-card-${memo.id}`}>
      <View style={styles.header}>
        <Text style={styles.dateText} testID={`memo-date-${memo.id}`}>
          {formatDate(memo.createdAt)}
        </Text>
        <Pressable
          style={styles.menuBtn}
          onPress={handleOpenMenu}
          testID={`memo-menu-btn-${memo.id}`}
          accessibilityLabel="操作菜单"
          accessibilityRole="button"
        >
          <Text style={styles.menuBtnText}>...</Text>
        </Pressable>
      </View>

      <HighlightText
        text={memo.content}
        keyword={highlight}
        style={styles.content}
        testID={`memo-content-${memo.id}`}
      />

      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContainer}
          testID={`memo-tags-${memo.id}`}
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

      {attachments.length > 0 ? (
        <AttachmentPreview attachments={attachments} />
      ) : null}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMenu}
        testID={`memo-menu-modal-${memo.id}`}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={handleCloseMenu}
          testID={`memo-menu-overlay-${memo.id}`}
        >
          <View style={styles.menuSheet}>
            {onEdit ? (
              <Pressable
                style={styles.menuItem}
                onPress={handleEdit}
                testID={`memo-edit-btn-${memo.id}`}
                accessibilityRole="button"
              >
                <Text style={styles.menuItemText}>编辑</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={handleDelete}
                testID={`memo-delete-btn-${memo.id}`}
                accessibilityRole="button"
              >
                <Text style={styles.menuItemTextDanger}>删除</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.menuItem, styles.menuItemCancel]}
              onPress={handleCloseMenu}
              testID={`memo-cancel-btn-${memo.id}`}
              accessibilityRole="button"
            >
              <Text style={styles.menuItemTextCancel}>取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
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
  dateText: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 16,
  },
  menuBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    fontSize: 18,
    color: '#bbb',
    lineHeight: 22,
    letterSpacing: 2,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
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
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    color: '#388e3c',
    fontSize: 12,
    fontWeight: '500',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    paddingTop: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  menuItemDanger: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemTextDanger: {
    fontSize: 16,
    color: '#e53935',
  },
  menuItemTextCancel: {
    fontSize: 16,
    color: '#999',
  },
});
