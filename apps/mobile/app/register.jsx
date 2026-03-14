/**
 * register.jsx — 注册页面
 *
 * 职责：收集邮箱、昵称、密码、隐私协议同意，执行字段级验证与全量校验，
 *       调用 useAuth().register()，成功后跳转到主页，失败时展示服务端错误。
 *
 * 路由：/register（Expo Router 文件路由）
 * 依赖：AuthContext（useAuth）、expo-router（useRouter）、四个认证通用组件
 *
 * register() 调用签名：register(email, nickname, password, true)
 *   第四个参数为布尔值 true，表示用户已同意隐私协议（由后端记录同意时间戳）
 */

import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';
import { PrivacyCheckbox } from '../components/PrivacyCheckbox.jsx';

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  if (!value || !EMAIL_REGEX.test(value)) {
    return '请输入有效的邮箱地址';
  }
  return '';
}

function validateNickname(value) {
  const trimmed = (value || '').trim();
  if (trimmed.length < 2) {
    return '昵称长度至少为 2 个字符';
  }
  if (trimmed.length > 20) {
    return '昵称最多 20 个字符';
  }
  return '';
}

function validatePassword(value) {
  if (!value || value.length < 8) {
    return '密码长度至少为 8 个字符';
  }
  if (value.length > 20) {
    return '密码最多 20 个字符';
  }
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  // Form field values
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);

  // Field-level validation errors
  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [privacyError, setPrivacyError] = useState(false);

  // Server-side / global form error
  const [serverError, setServerError] = useState('');

  // Submission loading state
  const [loading, setLoading] = useState(false);

  // ── Field blur handlers (field-level validation) ─────────────────────────

  function handleEmailBlur() {
    setEmailError(validateEmail(email));
  }

  function handleNicknameBlur() {
    setNicknameError(validateNickname(nickname));
  }

  function handlePasswordBlur() {
    setPasswordError(validatePassword(password));
  }

  // ── Submit handler ────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Run full validation
    const emailErr = validateEmail(email);
    const nicknameErr = validateNickname(nickname);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr);
    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPrivacyError(!privacyChecked);

    if (emailErr || nicknameErr || passwordErr || !privacyChecked) {
      return;
    }

    // Clear previous server error and enter loading state
    setServerError('');
    setLoading(true);

    try {
      await register(email, nickname, password, true);
      router.replace('/');
    } catch (err) {
      setServerError(err.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // ── Navigate to login ─────────────────────────────────────────────────────

  function handleGoToLogin() {
    // Clear all form fields and error states
    setEmail('');
    setNickname('');
    setPassword('');
    setPrivacyChecked(false);
    setEmailError('');
    setNicknameError('');
    setPasswordError('');
    setPrivacyError(false);
    setServerError('');

    router.push('/login');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} testID="register-screen">
      <View style={styles.form}>
        {/* Server-side error */}
        <AuthFormError
          message={serverError}
          testID="form-error"
        />

        {/* Email */}
        <AuthFormInput
          label="邮箱"
          value={email}
          onChangeText={setEmail}
          onBlur={handleEmailBlur}
          error={emailError}
          keyboardType="email-address"
          maxLength={200}
          editable={!loading}
          testID="email-input"
        />

        {/* Nickname */}
        <AuthFormInput
          label="昵称"
          value={nickname}
          onChangeText={setNickname}
          onBlur={handleNicknameBlur}
          error={nicknameError}
          maxLength={20}
          editable={!loading}
          testID="nickname-input"
        />

        {/* Password */}
        <AuthFormInput
          label="密码"
          value={password}
          onChangeText={setPassword}
          onBlur={handlePasswordBlur}
          error={passwordError}
          secureTextEntry
          maxLength={20}
          editable={!loading}
          testID="password-input"
        />

        {/* Privacy checkbox */}
        <PrivacyCheckbox
          checked={privacyChecked}
          onChange={setPrivacyChecked}
          error={privacyError}
          testID="privacy-checkbox"
        />

        {/* Submit button */}
        <AuthSubmitButton
          label="注册"
          loadingLabel="注册中..."
          loading={loading}
          onPress={handleSubmit}
          testID="register-submit-button"
        />

        {/* Navigate to login */}
        <TouchableOpacity
          testID="go-to-login-link"
          onPress={handleGoToLogin}
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>已有账号？返回登录</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  form: {
    padding: 24,
  },
  linkWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#3B82F6',
  },
});
