import React from 'react';

/**
 * AuthFormError - Displays server-side error messages at the top of auth forms.
 * Returns null when message is empty/null (renders nothing).
 *
 * @param {object} props
 * @param {string|null} props.message - Error message to display; null/empty = render nothing
 * @param {string} [props.testID] - Test ID for E2E/unit test selectors
 */
export function AuthFormError({ message, testID }) {
  if (!message) return null;

  return (
    <div
      data-testid={testID}
      role="alert"
      style={{
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 16,
      }}
    >
      <span
        style={{
          color: '#DC2626',
          fontSize: 14,
        }}
      >
        {message}
      </span>
    </div>
  );
}
