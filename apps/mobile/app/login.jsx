/**
 * login.jsx
 *
 * Login screen for AIFlomo.
 * Route: /login
 *
 * Provides:
 *  - Email and password inputs (no blur-time validation on login page)
 *  - Submit enters loading state and calls useAuth().login()
 *  - Navigates to '/' on success
 *  - On 401 failure: shows "邮箱或密码错误，请重试", clears password, keeps email
 *  - On network failure: shows "网络连接失败，请稍后重试"
 *  - "Register now" link clears the form and navigates to /register
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVALID_CREDENTIALS_MESSAGE = '邮箱或密码错误，请重试';

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------

const INITIAL_FIELDS = {
  email: '',
  password: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  // Form field values
  const [fields, setFields] = useState(INITIAL_FIELDS);

  // Server-side error message shown at the top of the form
  const [serverError, setServerError] = useState('');

  // Whether a login request is in progress
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Field change handlers (immutable updates)
  // ---------------------------------------------------------------------------

  function handleEmailChange(text) {
    setFields((prev) => ({ ...prev, email: text }));
  }

  function handlePasswordChange(text) {
    setFields((prev) => ({ ...prev, password: text }));
  }

  // ---------------------------------------------------------------------------
  // Form reset helper
  // ---------------------------------------------------------------------------

  function resetForm() {
    setFields(INITIAL_FIELDS);
    setServerError('');
  }

  // ---------------------------------------------------------------------------
  // Navigation to register
  // ---------------------------------------------------------------------------

  function handleGoToRegister() {
    resetForm();
    router.push('/register');
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    // Begin loading state and clear previous errors
    setLoading(true);
    setServerError('');

    try {
      await login(fields.email, fields.password);
      router.replace('/');
    } catch (error) {
      const status = error && error.status;

      if (status === 401) {
        // Invalid credentials: show specific message, clear password, keep email
        setServerError(INVALID_CREDENTIALS_MESSAGE);
        setFields((prev) => ({ ...prev, password: '' }));
      } else {
        // Network error or other server error: use the error message from apiClient
        const message =
          error.message && typeof error.message === 'string'
            ? error.message
            : '登录失败，请稍后重试';
        setServerError(message);
      }
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
          <Text style={STYLES.title} testID="login-title">
            欢迎回来
          </Text>
          <Text style={STYLES.subtitle}>登录你的 AIFlomo 账号</Text>

          {/* Server-side error banner */}
          <AuthFormError
            message={serverError}
            testID="login-server-error"
          />

          {/* Email field — no onBlur validation on login page */}
          <AuthFormInput
            label="邮箱"
            value={fields.email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            editable={!loading}
            testID="login-email-input"
          />

          {/* Password field — no onBlur validation on login page */}
          <AuthFormInput
            label="密码"
            value={fields.password}
            onChangeText={handlePasswordChange}
            secureTextEntry
            editable={!loading}
            testID="login-password-input"
          />

          {/* Submit button */}
          <AuthSubmitButton
            label="登录"
            loadingLabel="登录中..."
            loading={loading}
            onPress={handleSubmit}
            testID="login-submit-button"
          />

          {/* Navigation to register */}
          <TouchableOpacity
            style={STYLES.linkButton}
            onPress={handleGoToRegister}
            testID="login-go-to-register"
            activeOpacity={0.7}
          >
            <Text style={STYLES.linkText}>没有账号？立即注册</Text>
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
