/**
 * AuthFormError.jsx
 *
 * Displays a server-side error message at the top of authentication forms.
 * Returns null when message is null or an empty string — nothing is rendered.
 *
 * Named export: AuthFormError
 */

import React from 'react';
import { View, Text } from 'react-native';

const STYLES = {
  container: {
    backgroundColor: '#FEF2F2', // red-50
    borderWidth: 1,
    borderColor: '#FECACA',     // red-200
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#DC2626',           // red-600
    lineHeight: 20,
  },
};

export function AuthFormError({ message, testID }) {
  if (!message) {
    return null;
  }

  return (
    <View style={STYLES.container} testID={testID}>
      <Text style={STYLES.message}>{message}</Text>
    </View>
  );
}
