/**
 * register.jsx
 *
 * Registration screen for AIFlomo.
 * Route: /register
 *
 * Provides:
 *  - Email, nickname, and password inputs with blur-time field validation
 *  - Privacy agreement checkbox
 *  - Full-form validation on submit
 *  - Calls useAuth().register() on valid submission
 *  - Navigates to '/' on success
 *  - Displays server-side error at the top of the form on failure
 *  - "Return to login" link clears the form and navigates to /login
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';
import { PrivacyCheckbox } from '../components/PrivacyCheckbox.jsx';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the email field.
 * @param {string} value
 * @returns {string} Error message, or empty string when valid.
 */
function validateEmail(value) {
  if (!value.trim()) {
    return '请输入邮箱地址';
  }
  if (!EMAIL_REGEX.test(value.trim())) {
    return '请输入有效的邮箱地址';
  }
  return '';
}

/**
 * Validate the nickname field (2-20 characters after trim, no whitespace-only).
 * @param {string} value
 * @returns {string} Error message, or empty string when valid.
 */
function validateNickname(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '请输入昵称';
  }
  if (trimmed.length < 2) {
    return '昵称至少需要 2 个字符';
  }
  if (trimmed.length > 20) {
    return '昵称最多 20 个字符';
  }
  return '';
}

/**
 * Validate the password field (8-20 characters).
 * @param {string} value
 * @returns {string} Error message, or empty string when valid.
 */
function validatePassword(value) {
  if (!value) {
    return '请输入密码';
  }
  if (value.length < 8) {
    return '密码长度至少为 8 个字符';
  }
  if (value.length > 20) {
    return '密码最多 20 个字符';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------

const INITIAL_FIELDS = {
  email: '',
  nickname: '',
  password: '',
};

const INITIAL_ERRORS = {
  email: '',
  nickname: '',
  password: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  // Form field values
  const [fields, setFields] = useState(INITIAL_FIELDS);

  // Per-field validation error messages
  const [fieldErrors, setFieldErrors] = useState(INITIAL_ERRORS);

  // Whether the privacy checkbox is checked
  const [privacyChecked, setPrivacyChecked] = useState(false);

  // Whether to show the privacy error (unchecked on submit)
  const [privacyError, setPrivacyError] = useState(false);

  // Server-side error message shown at the top of the form
  const [serverError, setServerError] = useState('');

  // Whether a submission is in progress
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Field change handlers (immutable updates)
  // ---------------------------------------------------------------------------

  function handleEmailChange(text) {
    setFields((prev) => ({ ...prev, email: text }));
  }

  function handleNicknameChange(text) {
    setFields((prev) => ({ ...prev, nickname: text }));
  }

  function handlePasswordChange(text) {
    setFields((prev) => ({ ...prev, password: text }));
  }

  // ---------------------------------------------------------------------------
  // Blur-time validation handlers
  // ---------------------------------------------------------------------------

  function handleEmailBlur() {
    const error = validateEmail(fields.email);
    setFieldErrors((prev) => ({ ...prev, email: error }));
  }

  function handleNicknameBlur() {
    const error = validateNickname(fields.nickname);
    setFieldErrors((prev) => ({ ...prev, nickname: error }));
  }

  function handlePasswordBlur() {
    const error = validatePassword(fields.password);
    setFieldErrors((prev) => ({ ...prev, password: error }));
  }

  // ---------------------------------------------------------------------------
  // Privacy checkbox handler
  // ---------------------------------------------------------------------------

  function handlePrivacyChange(checked) {
    setPrivacyChecked(checked);
    if (checked) {
      setPrivacyError(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Form reset helper
  // ---------------------------------------------------------------------------

  function resetForm() {
    setFields(INITIAL_FIELDS);
    setFieldErrors(INITIAL_ERRORS);
    setPrivacyChecked(false);
    setPrivacyError(false);
    setServerError('');
  }

  // ---------------------------------------------------------------------------
  // Navigation to login
  // ---------------------------------------------------------------------------

  function handleGoToLogin() {
    resetForm();
    router.push('/login');
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    // Full form validation before submission
    const emailError = validateEmail(fields.email);
    const nicknameError = validateNickname(fields.nickname);
    const passwordError = validatePassword(fields.password);

    const newFieldErrors = {
      email: emailError,
      nickname: nicknameError,
      password: passwordError,
    };

    setFieldErrors(newFieldErrors);

    const hasPrivacyError = !privacyChecked;
    setPrivacyError(hasPrivacyError);

    const hasFieldErrors =
      Boolean(emailError) || Boolean(nicknameError) || Boolean(passwordError);

    if (hasFieldErrors || hasPrivacyError) {
      return;
    }

    // Begin loading state
    setLoading(true);
    setServerError('');

    try {
      await register(fields.email.trim(), fields.nickname.trim(), fields.password);
      router.replace('/');
    } catch (error) {
      const message =
        error.message && typeof error.message === 'string'
          ? error.message
          : '注册失败，请稍后重试';
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={STYLES.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={STYLES.scrollView}
        contentContainerStyle={STYLES.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={STYLES.container}>
          {/* Header */}
          <Text style={STYLES.title} testID="register-title">
            创建账号
          </Text>
          <Text style={STYLES.subtitle}>开始你的 AIFlomo 记录之旅</Text>

          {/* Server-side error banner */}
          <AuthFormError
            message={serverError}
            testID="register-server-error"
          />

          {/* Email field */}
          <AuthFormInput
            label="邮箱"
            value={fields.email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            error={fieldErrors.email}
            keyboardType="email-address"
            editable={!loading}
            testID="register-email-input"
          />

          {/* Nickname field */}
          <AuthFormInput
            label="昵称"
            value={fields.nickname}
            onChangeText={handleNicknameChange}
            onBlur={handleNicknameBlur}
            error={fieldErrors.nickname}
            maxLength={20}
            editable={!loading}
            testID="register-nickname-input"
          />

          {/* Password field */}
          <AuthFormInput
            label="密码"
            value={fields.password}
            onChangeText={handlePasswordChange}
            onBlur={handlePasswordBlur}
            error={fieldErrors.password}
            secureTextEntry
            maxLength={20}
            editable={!loading}
            testID="register-password-input"
          />

          {/* Privacy agreement checkbox */}
          <PrivacyCheckbox
            checked={privacyChecked}
            onChange={handlePrivacyChange}
            error={privacyError}
            testID="register-privacy-checkbox"
          />

          {/* Submit button */}
          <AuthSubmitButton
            label="注册"
            loadingLabel="注册中..."
            loading={loading}
            onPress={handleSubmit}
            testID="register-submit-button"
          />

          {/* Navigation to login */}
          <TouchableOpacity
            style={STYLES.linkButton}
            onPress={handleGoToLogin}
            testID="register-go-to-login"
            activeOpacity={0.7}
          >
            <Text style={STYLES.linkText}>已有账号？返回登录</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  container: {
    paddingHorizontal: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 28,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#3B82F6',
  },
});
