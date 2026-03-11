import { Text, StyleSheet } from 'react-native';

export function HighlightText({ text, keyword, style, highlightStyle, testID }) {
  if (!keyword || !keyword.trim() || !text) {
    return (
      <Text style={style} testID={testID}>
        {text}
      </Text>
    );
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  const parts = text.split(regex);

  if (parts.length <= 1) {
    return (
      <Text style={style} testID={testID}>
        {text}
      </Text>
    );
  }

  const lowerKeyword = keyword.toLowerCase();

  return (
    <Text style={style} testID={testID}>
      {parts.map((part, index) => {
        if (part.toLowerCase() === lowerKeyword) {
          return (
            <Text
              key={index}
              style={[styles.highlight, highlightStyle]}
              testID={testID ? `${testID}-highlight-${index}` : undefined}
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: '#fff176',
    color: '#333',
    fontWeight: '600',
  },
});
