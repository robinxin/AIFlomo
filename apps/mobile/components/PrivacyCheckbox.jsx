import React from 'react';

/**
 * PrivacyCheckbox - Privacy policy agreement checkbox for registration form.
 * Shows error state when user tries to submit without agreeing.
 *
 * @param {object} props
 * @param {boolean} props.checked - Current checked state (controlled)
 * @param {Function} props.onChange - State change handler (checked: boolean) => void
 * @param {boolean} [props.error] - Whether to show error highlighting
 * @param {string} [props.testID] - Test ID for E2E/unit test selectors
 */
export function PrivacyCheckbox({ checked, onChange, error, testID }) {
  const handleToggle = () => {
    onChange(!checked);
  };

  return (
    <div data-testid={testID} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
        onClick={handleToggle}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: error ? '#EF4444' : checked ? '#3B82F6' : '#D1D5DB',
            borderRadius: 4,
            backgroundColor: checked ? '#3B82F6' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {checked && (
            <span
              data-testid="checkbox-checked-icon"
              style={{ color: '#FFFFFF', fontSize: 12 }}
            >
              ✓
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 14,
            color: '#374151',
            userSelect: 'none',
          }}
        >
          我已阅读并同意隐私协议
        </span>
      </div>
      {error && (
        <span
          style={{
            color: '#EF4444',
            fontSize: 12,
            marginTop: 4,
            display: 'block',
          }}
        >
          请阅读并同意隐私协议
        </span>
      )}
    </div>
  );
}
