import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSearch } from '@/hooks/use-search';

export function SearchBar({ placeholder, style, testID }) {
  const { query, isSearching, setQuery, clearSearch } = useSearch();

  return (
    <View style={[styles.container, style]} testID={testID ?? 'search-bar'}>
      <Text style={styles.icon} accessibilityElementsHidden>
        {'搜'}
      </Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder ?? '搜索笔记...'}
        placeholderTextColor="#aaa"
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
        autoCapitalize="none"
        testID={testID ? `${testID}-input` : 'search-bar-input'}
        accessibilityLabel="搜索笔记"
      />
      {isSearching ? (
        <ActivityIndicator
          size="small"
          color="#4caf50"
          style={styles.indicator}
          testID={testID ? `${testID}-loading` : 'search-bar-loading'}
        />
      ) : null}
      {query.length > 0 && !isSearching ? (
        <Pressable
          onPress={clearSearch}
          style={styles.clearBtn}
          hitSlop={8}
          testID={testID ? `${testID}-clear` : 'search-bar-clear'}
          accessibilityLabel="清除搜索"
          accessibilityRole="button"
        >
          <Text style={styles.clearIcon}>{'x'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 40,
  },
  icon: {
    fontSize: 13,
    color: '#aaa',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
    margin: 0,
  },
  indicator: {
    marginLeft: 6,
  },
  clearBtn: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 13,
  },
});
