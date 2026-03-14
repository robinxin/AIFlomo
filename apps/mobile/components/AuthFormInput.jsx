/**
 * AuthFormInput.jsx
 *
 * General-purpose controlled text input for authentication forms.
 * Handles label rendering, focus highlight, error display, and
 * secure-text-entry eye-toggle.
 *
 * Named export: AuthFormInput
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

const COLORS = {
  border: '#D1D5DB',      // gray-300
  borderFocused: '#3B82F6', // blue-500
  borderError: '#EF4444',  // red-500
  label: '#374151',        // gray-700
  error: '#EF4444',        // red-500
  eyeIcon: '#6B7280',      // gray-500
};

const STYLES = {
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: '#111827',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  eyeButton: {
    paddingLeft: 8,
    paddingVertical: 10,
  },
  eyeText: {
    fontSize: 16,
    color: COLORS.eyeIcon,
  },
};

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
  const [isFocused, setIsFocused] = useState(false);
  const [showText, setShowText] = useState(false);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? COLORS.borderError
    : isFocused
    ? COLORS.borderFocused
    : COLORS.border;

  function handleFocus() {
    setIsFocused(true);
  }

  function handleBlur() {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  }

  function handleToggleSecure() {
    setShowText((prev) => !prev);
  }

  const isSecure = secureTextEntry && !showText;

  return (
    <View style={STYLES.container}>
      {label ? <Text style={STYLES.label}>{label}</Text> : null}

      <View style={[STYLES.inputRow, { borderColor }]}>
        <TextInput
          style={STYLES.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          maxLength={maxLength}
          editable={editable}
          testID={testID}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            onPress={handleToggleSecure}
            testID="toggle-secure-entry"
            style={STYLES.eyeButton}
            accessibilityLabel={showText ? '隐藏密码' : '显示密码'}
          >
            <Text style={STYLES.eyeText}>{showText ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasError ? <Text style={STYLES.errorText}>{error}</Text> : null}
    </View>
  );
}
