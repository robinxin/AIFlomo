import { View, Text, Pressable, StyleSheet } from 'react-native';

export function PolicyCheckbox({ checked, onPress }) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.text}>
        我已阅读并同意
        <Text style={styles.link}>隐私协议</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    color: '#4caf50',
    textDecorationLine: 'underline',
  },
});
