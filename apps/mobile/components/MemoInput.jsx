import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { api } from '@/lib/api-client';

export function MemoInput({ onSubmit, tags, disabled }) {
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [tagSuggest, setTagSuggest] = useState([]);
  const [tagQuery, setTagQuery] = useState('');
  const inputRef = useRef(null);

  const handleChangeText = (text) => {
    setContent(text);

    // 检测 # 触发标签联想
    const lastHashIdx = text.lastIndexOf('#');
    if (lastHashIdx !== -1) {
      const query = text.slice(lastHashIdx + 1).split(/\s/)[0];
      setTagQuery(query);
      const filtered = tags.filter((t) =>
        t.name.toLowerCase().startsWith(query.toLowerCase()),
      );
      setTagSuggest(filtered);
    } else {
      setTagSuggest([]);
      setTagQuery('');
    }
  };

  const handleTagSelect = (tag) => {
    // 替换最后一个 # 开始的部分
    const lastHashIdx = content.lastIndexOf('#');
    const newContent = content.slice(0, lastHashIdx) + `#${tag.name} `;
    setContent(newContent);
    setTagSuggest([]);
    setTagQuery('');
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    try {
      await onSubmit(trimmed);
      setContent('');
      setExpanded(false);
      setTagSuggest([]);
    } catch (_) {
      // 错误由父级处理，内容保留
    }
  };

  const canSubmit = !!content.trim() && !disabled;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, expanded && styles.containerExpanded]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, expanded && styles.inputExpanded]}
          value={content}
          onChangeText={handleChangeText}
          onFocus={() => setExpanded(true)}
          placeholder="现在的想法是..."
          placeholderTextColor="#bbb"
          multiline={expanded}
          numberOfLines={expanded ? 4 : 1}
          returnKeyType={expanded ? 'default' : 'done'}
          textAlignVertical="top"
        />

        {expanded && (
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => {
                setContent((c) => c + '#');
                inputRef.current?.focus();
              }}
            >
              <Text style={styles.toolBtnText}>#标签</Text>
            </TouchableOpacity>
            <View style={styles.toolbarRight}>
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {disabled ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>发送</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 标签联想浮层 */}
      {tagSuggest.length > 0 && (
        <View style={styles.suggestList}>
          {tagSuggest.slice(0, 6).map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={styles.suggestItem}
              onPress={() => handleTagSelect(tag)}
            >
              <Text style={styles.suggestText}>#{tag.name}</Text>
              <Text style={styles.suggestCount}>{tag.memoCount}</Text>
            </TouchableOpacity>
          ))}
          {!!tagQuery && !tagSuggest.some((t) => t.name === tagQuery) && (
            <TouchableOpacity
              style={styles.suggestItem}
              onPress={() => handleTagSelect({ id: 'new', name: tagQuery })}
            >
              <Text style={styles.suggestText}>创建 #{tagQuery}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    margin: 12,
    padding: 10,
  },
  containerExpanded: {
    borderColor: '#4caf50',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    fontSize: 15,
    color: '#333',
    minHeight: 36,
    padding: 0,
  },
  inputExpanded: {
    minHeight: 80,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  toolBtnText: {
    fontSize: 13,
    color: '#666',
  },
  toolbarRight: {
    flexDirection: 'row',
  },
  submitBtn: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestList: {
    position: 'absolute',
    top: '100%',
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  suggestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  suggestText: {
    fontSize: 14,
    color: '#4caf50',
  },
  suggestCount: {
    fontSize: 12,
    color: '#aaa',
  },
});
