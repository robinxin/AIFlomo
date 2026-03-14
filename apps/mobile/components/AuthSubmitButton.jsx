import React from 'react';

/**
 * AuthSubmitButton - Submit button for authentication forms.
 * Handles loading state, disabled state, and label switching.
 *
 * @param {object} props
 * @param {string} props.label - Normal state button text
 * @param {string} props.loadingLabel - Loading state button text
 * @param {boolean} props.loading - Whether in loading state (disables button + shows loadingLabel)
 * @param {Function} props.onPress - Click handler
 * @param {boolean} [props.disabled] - Additional disabled condition (independent of loading)
 * @param {string} [props.testID] - Test ID for E2E/unit test selectors
 */
export function AuthSubmitButton({ label, loadingLabel, loading, onPress, disabled, testID }) {
  const isDisabled = loading || disabled;

  return (
    <button
      type="button"
      data-testid={testID}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onPress}
      style={{
        backgroundColor: isDisabled ? '#9CA3AF' : '#3B82F6',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 8,
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: '600',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.7 : 1,
        width: '100%',
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
