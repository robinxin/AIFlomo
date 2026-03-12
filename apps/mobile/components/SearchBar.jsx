import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

export function SearchBar({ value, onChangeText, onClear }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="搜索笔记..."
        placeholderTextColor="#bbb"
        returnKeyType="search"
        clearButtonMode="never"
      />
      {!!value && (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 12,
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  clearText: {
    fontSize: 14,
    color: '#aaa',
    marginLeft: 6,
  },
});
