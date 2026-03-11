import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMemos } from '@/hooks/use-memos';

const MAX_CONTENT_LENGTH = 10000;
const MAX_TAG_COUNT = 10;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const TAG_REGEX = /#([\u4e00-\u9fa5\w]{1,20})/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;

function extractTags(content) {
  const matches = [];
  let match;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(content)) !== null) {
    const name = match[1];
    if (!matches.includes(name)) {
      matches.push(name);
    }
  }
  return matches;
}

function extractLinks(content) {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

export function MemoInput({ onSuccess }) {
  const { createMemo } = useMemos();

  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const tags = extractTags(content);
  const links = extractLinks(content);
  const charsLeft = MAX_CONTENT_LENGTH - content.length;

  const handlePickImage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限不足', '需要相册访问权限才能选择图片');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
      setError('图片大小不得超过 5MB');
      return;
    }

    setError(null);
    setImages((prev) => [...prev, { uri: asset.uri, fileSize: asset.fileSize }]);
  }, []);

  const handleRemoveImage = useCallback((uri) => {
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setError('请输入笔记内容');
      return;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`内容长度不能超过 ${MAX_CONTENT_LENGTH} 字符`);
      return;
    }

    if (tags.length > MAX_TAG_COUNT) {
      setError(`标签数量不能超过 ${MAX_TAG_COUNT} 个`);
      return;
    }

    const attachments = [];

    for (const img of images) {
      attachments.push({ type: 'image', url: img.uri });
    }

    for (const url of links) {
      attachments.push({ type: 'link', url });
    }

    setIsSubmitting(true);
    try {
      await createMemo(trimmedContent, attachments);
      setContent('');
      setImages([]);
      setError(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message ?? '创建笔记失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }, [content, tags, images, links, createMemo, onSuccess]);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.textInput}
        value={content}
        onChangeText={setContent}
        placeholder="现在有什么想法..."
        placeholderTextColor="#aaa"
        multiline
        maxLength={MAX_CONTENT_LENGTH}
        textAlignVertical="top"
        editable={!isSubmitting}
        testID="memo-text-input"
      />

      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsScroll}
          contentContainerStyle={styles.tagsContainer}
        >
          {tags.map((tag) => (
            <View key={tag} style={styles.tagBadge}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {links.length > 0 ? (
        <View style={styles.linksContainer}>
          {links.map((url) => (
            <View key={url} style={styles.linkBadge}>
              <Text style={styles.linkText} numberOfLines={1}>{url}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {images.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imagesScroll}
          contentContainerStyle={styles.imagesContainer}
        >
          {images.map((img) => (
            <View key={img.uri} style={styles.imageWrapper}>
              <Image source={{ uri: img.uri }} style={styles.imageThumb} />
              <Pressable
                style={styles.imageRemoveBtn}
                onPress={() => handleRemoveImage(img.uri)}
                testID={`remove-image-${img.uri}`}
              >
                <Text style={styles.imageRemoveText}>x</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Pressable
            style={styles.toolbarBtn}
            onPress={handlePickImage}
            disabled={isSubmitting}
            testID="pick-image-btn"
          >
            <Text style={styles.toolbarBtnText}>图片</Text>
          </Pressable>
        </View>

        <View style={styles.toolbarRight}>
          {content.length > MAX_CONTENT_LENGTH - 200 ? (
            <Text style={[styles.charCount, charsLeft < 0 && styles.charCountOver]}>
              {charsLeft}
            </Text>
          ) : null}

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            testID="submit-memo-btn"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>记录</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#fdecea',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    lineHeight: 18,
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    minHeight: 80,
    maxHeight: 200,
    paddingVertical: 4,
  },
  tagsScroll: {
    marginTop: 8,
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
  linksContainer: {
    marginTop: 8,
    gap: 4,
  },
  linkBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  linkText: {
    color: '#1565c0',
    fontSize: 12,
  },
  imagesScroll: {
    marginTop: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  imageWrapper: {
    position: 'relative',
  },
  imageThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  toolbarLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolbarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  toolbarBtnText: {
    fontSize: 13,
    color: '#555',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  charCountOver: {
    color: '#d32f2f',
  },
  submitBtn: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#a5d6a7',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
