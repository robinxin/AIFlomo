/**
 * AuthSubmitButton — authentication form submit button
 *
 * Shows `label` normally, `loadingLabel` when loading.
 * Disabled when `loading=true` OR `disabled=true`.
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export function AuthSubmitButton({
  label,
  loadingLabel,
  loading,
  onPress,
  disabled = false,
  testID,
}) {
  const isDisabled = loading || disabled;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && styles.buttonDisabled]}
    >
      <Text style={styles.label}>
        {loading ? loadingLabel : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthSubmitButton;
