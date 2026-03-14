import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

const TAG_COLOR = '#4caf50';

function renderContent(content, tags) {
  if (!tags || tags.length === 0) {
    return <Text style={styles.content}>{content}</Text>;
  }

  // 将内容按标签分割，高亮显示 #标签名
  const parts = [];
  let remaining = content;
  let key = 0;

  // 构建正则
  const tagPattern = new RegExp(
    `(#(?:${tags.map((t) => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
    'g',
  );

  const segments = remaining.split(tagPattern);
  for (const seg of segments) {
    if (seg.startsWith('#') && tags.some((t) => `#${t.name}` === seg)) {
      parts.push(
        <Text key={key++} style={styles.tagText}>
          {seg}
        </Text>,
      );
    } else if (!!seg) {
      parts.push(
        <Text key={key++} style={styles.content}>
          {seg}
        </Text>,
      );
    }
  }

  return <Text>{parts}</Text>;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function MemoCard({ memo, onDelete }) {
  const handleDelete = () => {
    Alert.alert('移入回收站', '确定要删除这条笔记吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => onDelete(memo.id),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(memo.createdAt)}</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteBtnText}>···</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>{renderContent(memo.content, memo.tags)}</View>
      {memo.tags && memo.tags.length > 0 && (
        <View style={styles.tagRow}>
          {memo.tags.map((tag) => (
            <View key={tag.id} style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>#{tag.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  deleteBtn: {
    padding: 2,
  },
  deleteBtnText: {
    fontSize: 18,
    color: '#bbb',
    lineHeight: 18,
  },
  body: {
    marginBottom: 6,
  },
  content: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  tagText: {
    fontSize: 15,
    color: TAG_COLOR,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tagBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBadgeText: {
    fontSize: 12,
    color: TAG_COLOR,
  },
});
