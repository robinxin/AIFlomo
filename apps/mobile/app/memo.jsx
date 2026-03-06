import { View, Text, StyleSheet } from 'react-native';

export default function MemoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AIFlomo</Text>
      <Text style={styles.subtitle}>快速记录，随时回看</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
