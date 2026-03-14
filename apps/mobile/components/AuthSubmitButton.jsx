/**
 * AuthSubmitButton.jsx
 *
 * Submit button for authentication forms.
 * Handles loading state (shows loadingLabel, disables interaction) and an
 * independent disabled prop. Both conditions can be active simultaneously.
 *
 * Named export: AuthSubmitButton
 */

import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

const STYLES = {
  button: {
    backgroundColor: '#3B82F6', // blue-500
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF', // gray-400
    opacity: 0.7,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
};

export function AuthSubmitButton({
  label,
  loadingLabel,
  loading,
  onPress,
  disabled = false,
  testID,
}) {
  const isDisabled = loading || disabled;
  const displayLabel = loading ? loadingLabel : label;

  return (
    <TouchableOpacity
      style={[STYLES.button, isDisabled ? STYLES.buttonDisabled : null]}
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Text style={STYLES.label}>{displayLabel}</Text>
    </TouchableOpacity>
  );
}
