import React, { useState } from 'react';

/**
 * AuthFormInput - Universal controlled input for authentication forms.
 * Supports error display, password toggle, focus styling, and disabling.
 *
 * @param {object} props
 * @param {string} props.label - Input label text
 * @param {string} props.value - Current value (controlled)
 * @param {Function} props.onChangeText - Text change handler (text) => void
 * @param {Function} [props.onBlur] - Blur handler for field-level validation
 * @param {string} [props.error] - Error message; shown below input in red when non-empty
 * @param {string} [props.keyboardType] - Input type (default: 'default')
 * @param {boolean} [props.secureTextEntry] - If true, renders password input with toggle
 * @param {number} [props.maxLength] - Max character limit
 * @param {boolean} [props.editable] - Whether input is editable (default: true)
 * @param {string} [props.testID] - Test ID for E2E/unit test selectors
 */
export function AuthFormInput({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  keyboardType,
  secureTextEntry,
  maxLength,
  editable = true,
  testID,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Determine input type
  let inputType = 'text';
  if (secureTextEntry && !showPassword) {
    inputType = 'password';
  } else if (keyboardType === 'email-address') {
    inputType = 'email';
  }

  const borderColor = error ? '#EF4444' : isFocused ? '#3B82F6' : '#D1D5DB';

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleChange = (e) => {
    onChangeText(e.target.value);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 4,
          fontSize: 14,
          fontWeight: '500',
          color: '#374151',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          data-testid={testID}
          type={inputType}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={!editable}
          maxLength={maxLength}
          aria-label={label}
          style={{
            width: '100%',
            padding: secureTextEntry ? '10px 40px 10px 12px' : '10px 12px',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor,
            borderRadius: 8,
            fontSize: 16,
            boxSizing: 'border-box',
            backgroundColor: editable ? '#FFFFFF' : '#F3F4F6',
            color: '#111827',
          }}
        />
        {secureTextEntry && (
          <button
            type="button"
            data-testid="toggle-secure-entry"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: '#6B7280',
            }}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? '👁' : '👁‍🗨'}
          </button>
        )}
      </div>
      {error ? (
        <span
          style={{
            color: '#EF4444',
            fontSize: 12,
            marginTop: 4,
            display: 'block',
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
