import { View, Text, StyleSheet } from 'react-native';

export function EmptyState({ message, hint, testID }) {
  return (
    <View style={styles.container} testID={testID ?? 'empty-state'}>
      <Text style={styles.icon} accessibilityElementsHidden>
        {'( ˘•ω•˘ )'}
      </Text>
      <Text style={styles.message} testID={testID ? `${testID}-message` : 'empty-state-message'}>
        {message ?? '暂无笔记'}
      </Text>
      {hint ? (
        <Text style={styles.hint} testID={testID ? `${testID}-hint` : 'empty-state-hint'}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  icon: {
    fontSize: 32,
    color: '#ccc',
    marginBottom: 16,
    lineHeight: 40,
  },
  message: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
});
