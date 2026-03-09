import { View, Text, TextInput as RNTextInput, StyleSheet } from 'react-native';

/**
 * TextInput component for forms
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.value - Input value
 * @param {Function} props.onChangeText - Change handler
 * @param {Function} props.onBlur - Blur handler for validation
 * @param {boolean} props.secureTextEntry - Password masking
 * @param {string} props.keyboardType - Keyboard type (default, email-address, etc.)
 * @param {string} props.error - Error message to display
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.autoCapitalize - Auto capitalization (default: 'none')
 * @param {boolean} props.editable - Whether input is editable (default: true)
 */
export function TextInput({
  label,
  value,
  onChangeText,
  onBlur,
  secureTextEntry = false,
  keyboardType = 'default',
  error = '',
  placeholder = '',
  autoCapitalize = 'none',
  editable = true,
}) {
  const hasError = !!error;

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          hasError && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#999"
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#f44336',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
});
