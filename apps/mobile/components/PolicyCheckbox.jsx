import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * PolicyCheckbox component for privacy agreement
 * @param {Object} props
 * @param {boolean} props.checked - Whether checkbox is checked
 * @param {Function} props.onPress - Press handler to toggle checkbox
 * @param {string} props.error - Error message to display
 */
export function PolicyCheckbox({ checked = false, onPress, error = '' }) {
  const hasError = !!error;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.checkboxRow,
          pressed && styles.checkboxRowPressed,
        ]}
        onPress={onPress}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked, hasError && styles.checkboxError]}>
          {checked && <View style={styles.checkmark} />}
        </View>
        <Text style={styles.label}>我已阅读并同意隐私协议</Text>
      </Pressable>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxRowPressed: {
    opacity: 0.7,
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
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  checkboxError: {
    borderColor: '#f44336',
  },
  checkmark: {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  label: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
    marginLeft: 28,
  },
});
