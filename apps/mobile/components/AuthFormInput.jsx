/**
 * AuthFormInput — reusable authenticated form input field
 *
 * Features:
 *   - Label above input
 *   - Blue border on focus
 *   - Error message below input (red text) when error prop is set
 *   - Password toggle eye button when secureTextEntry=true
 *   - maxLength enforcement
 *   - editable=false disables the input
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export function AuthFormInput({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  editable = true,
  testID,
}) {
  const [focused, setFocused] = useState(false);
  const [showText, setShowText] = useState(false);

  function handleFocus() {
    setFocused(true);
  }

  function handleBlur() {
    setFocused(false);
    if (onBlur) {
      onBlur();
    }
  }

  function toggleSecureEntry() {
    setShowText((prev) => !prev);
  }

  const hasError = Boolean(error);
  const isSecure = secureTextEntry && !showText;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secureTextEntry && (
          <TouchableOpacity
            testID="toggle-secure-entry"
            onPress={toggleSecureEntry}
            style={styles.eyeButton}
          >
            <Text style={styles.eyeIcon}>{showText ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hasError && (
        <Text testID="input-error" style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3C3C43',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: '#007AFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  eyeButton: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
});

export default AuthFormInput;
