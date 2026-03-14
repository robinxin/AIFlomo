/**
 * register.jsx — 注册页面
 *
 * 功能：
 *   - 使用 AuthFormInput（邮箱/昵称/密码）、PrivacyCheckbox、
 *     AuthFormError、AuthSubmitButton 组合表单
 *   - 失焦时触发字段级验证（邮箱正则、昵称 2-20 字符 trim、密码 8-20 字符）
 *   - 提交时全量校验，加载状态下所有字段禁用
 *   - 调用 useAuth().register()，成功后 router.replace('/')
 *   - 失败时表单顶部展示服务端错误
 *   - 点击"返回登录"清空表单并 router.push('/login')
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';
import { PrivacyCheckbox } from '../components/PrivacyCheckbox.jsx';

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value) {
  if (!value || !EMAIL_REGEX.test(value)) {
    return '请输入有效的邮箱地址';
  }
  return '';
}

function validateNickname(value) {
  const trimmed = (value || '').trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return '昵称长度为 2-20 字符';
  }
  return '';
}

function validatePassword(value) {
  if (!value || value.length < 8) {
    return '密码长度至少为 8 个字符';
  }
  if (value.length > 20) {
    return '密码长度至少为 8 个字符';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [privacyChecked, setPrivacyChecked] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [privacyError, setPrivacyError] = useState(false);
  const [formError, setFormError] = useState('');

  const [loading, setLoading] = useState(false);

  // ── Field-level validation on blur ──────────────────────────────────────

  function handleEmailBlur() {
    setEmailError(validateEmail(email));
  }

  function handleNicknameBlur() {
    setNicknameError(validateNickname(nickname));
  }

  function handlePasswordBlur() {
    setPasswordError(validatePassword(password));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Full validation
    const eErr = validateEmail(email);
    const nErr = validateNickname(nickname);
    const pErr = validatePassword(password);

    setEmailError(eErr);
    setNicknameError(nErr);
    setPasswordError(pErr);

    const hasFieldError = eErr || nErr || pErr;
    const hasPrivacyError = !privacyChecked;

    if (hasFieldError || hasPrivacyError) {
      setPrivacyError(hasPrivacyError);
      return;
    }

    setLoading(true);
    setFormError('');

    try {
      await register(email, nickname.trim(), password, true);
      router.replace('/');
    } catch (err) {
      const message = err?.message || '';
      if (message.includes('Network') || message.includes('network') || message.includes('Failed to fetch')) {
        setFormError('网络连接失败，请稍后重试');
      } else {
        setFormError(message || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Navigate to login ────────────────────────────────────────────────────

  function handleGoLogin() {
    // Clear all form state
    setEmail('');
    setNickname('');
    setPassword('');
    setPrivacyChecked(false);
    setEmailError('');
    setNicknameError('');
    setPasswordError('');
    setPrivacyError(false);
    setFormError('');
    router.push('/login');
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>创建账号</Text>

      <AuthFormError message={formError} testID="form-error" />

      <AuthFormInput
        label="邮箱"
        value={email}
        onChangeText={setEmail}
        onBlur={handleEmailBlur}
        error={emailError}
        keyboardType="email-address"
        editable={!loading}
        testID="input-email"
        errorTestID="error-email"
      />

      <AuthFormInput
        label="昵称"
        value={nickname}
        onChangeText={setNickname}
        onBlur={handleNicknameBlur}
        error={nicknameError}
        maxLength={20}
        editable={!loading}
        testID="input-nickname"
        errorTestID="error-nickname"
      />

      <AuthFormInput
        label="密码"
        value={password}
        onChangeText={setPassword}
        onBlur={handlePasswordBlur}
        error={passwordError}
        secureTextEntry
        maxLength={20}
        editable={!loading}
        testID="input-password"
        toggleTestID="btn-toggle-password"
        errorTestID="error-password"
      />

      <PrivacyCheckbox
        checked={privacyChecked}
        onChange={setPrivacyChecked}
        error={privacyError}
        testID="checkbox-privacy"
        errorTestID="error-privacy"
      />

      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={loading}
        onPress={handleSubmit}
        testID="btn-submit"
      />

      <TouchableOpacity
        onPress={handleGoLogin}
        style={styles.linkButton}
        testID="link-to-login"
      >
        <Text style={styles.linkText}>已有账号？返回登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
