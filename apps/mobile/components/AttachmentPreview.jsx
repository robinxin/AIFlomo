import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';

export function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((a) => a.type === 'image');
  const links = attachments.filter((a) => a.type === 'link');

  return (
    <View style={styles.container}>
      {images.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imagesScroll}
          contentContainerStyle={styles.imagesContainer}
          testID="attachment-preview-images"
        >
          {images.map((attachment) => (
            <View key={attachment.url} style={styles.imageWrapper}>
              <Image
                source={{ uri: attachment.url }}
                style={styles.imageThumb}
                testID={`attachment-image-${attachment.url}`}
              />
              {onRemove ? (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onRemove(attachment.url)}
                  testID={`remove-attachment-${attachment.url}`}
                  accessibilityLabel="删除图片"
                  accessibilityRole="button"
                >
                  <Text style={styles.removeBtnText}>x</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {links.length > 0 ? (
        <View style={styles.linksContainer} testID="attachment-preview-links">
          {links.map((attachment) => (
            <View key={attachment.url} style={styles.linkRow}>
              <Text
                style={styles.linkText}
                numberOfLines={1}
                testID={`attachment-link-${attachment.url}`}
              >
                {attachment.url}
              </Text>
              {onRemove ? (
                <Pressable
                  style={styles.linkRemoveBtn}
                  onPress={() => onRemove(attachment.url)}
                  testID={`remove-link-${attachment.url}`}
                  accessibilityLabel="删除链接"
                  accessibilityRole="button"
                >
                  <Text style={styles.linkRemoveText}>x</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 8,
  },
  imagesScroll: {
    flexGrow: 0,
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
  removeBtn: {
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
  removeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  linksContainer: {
    gap: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  linkText: {
    flex: 1,
    color: '#1565c0',
    fontSize: 12,
  },
  linkRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  linkRemoveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
