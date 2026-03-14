import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';
import { PrivacyCheckbox } from '../components/PrivacyCheckbox.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 20;

function validateEmail(email) {
  if (!email) return '请输入邮箱地址';
  if (!EMAIL_REGEX.test(email)) return '请输入有效的邮箱地址';
  return '';
}

function validateNickname(nickname) {
  const trimmed = nickname.trim();
  if (!trimmed) return '请输入昵称';
  if (trimmed.length < MIN_NICKNAME_LENGTH) return `昵称至少为 ${MIN_NICKNAME_LENGTH} 个字符`;
  if (trimmed.length > MAX_NICKNAME_LENGTH) return `昵称最多 ${MAX_NICKNAME_LENGTH} 个字符`;
  return '';
}

function validatePassword(password) {
  if (!password) return '请输入密码';
  if (password.length < MIN_PASSWORD_LENGTH) return `密码长度至少为 ${MIN_PASSWORD_LENGTH} 个字符`;
  if (password.length > MAX_PASSWORD_LENGTH) return `密码长度最多为 ${MAX_PASSWORD_LENGTH} 个字符`;
  return '';
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [privacyError, setPrivacyError] = useState(false);
  const [serverError, setServerError] = useState('');

  const [loading, setLoading] = useState(false);

  // Field-level blur validation (only for register page)
  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handleNicknameBlur = () => {
    setNicknameError(validateNickname(nickname));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password));
  };

  const handleNicknameChange = (text) => {
    setNickname(text);
    if (text.length >= MAX_NICKNAME_LENGTH) {
      setNicknameError(`昵称最多 ${MAX_NICKNAME_LENGTH} 个字符`);
    } else {
      setNicknameError('');
    }
  };

  const handleSubmit = async () => {
    // Full validation before submit
    const emailErr = validateEmail(email);
    const nicknameErr = validateNickname(nickname);
    const passwordErr = validatePassword(password);
    const privacyErr = !agreedToPrivacy;

    setEmailError(emailErr);
    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPrivacyError(privacyErr);
    setServerError('');

    if (emailErr || nicknameErr || passwordErr || privacyErr) {
      return;
    }

    setLoading(true);

    try {
      await register(email, nickname.trim(), password, agreedToPrivacy);
      router.replace('/');
    } catch (error) {
      setServerError(error.error || error.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    // Clear all form state before navigating
    setEmail('');
    setNickname('');
    setPassword('');
    setAgreedToPrivacy(false);
    setEmailError('');
    setNicknameError('');
    setPasswordError('');
    setPrivacyError(false);
    setServerError('');
    router.push('/login');
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32, color: '#111827' }}>创建账号</h1>

      <AuthFormError message={serverError} testID="register-server-error" />

      <AuthFormInput
        label="邮箱"
        value={email}
        onChangeText={setEmail}
        onBlur={handleEmailBlur}
        error={emailError}
        keyboardType="email-address"
        editable={!loading}
        testID="register-email-input"
      />

      <AuthFormInput
        label="昵称"
        value={nickname}
        onChangeText={handleNicknameChange}
        onBlur={handleNicknameBlur}
        error={nicknameError}
        maxLength={MAX_NICKNAME_LENGTH}
        editable={!loading}
        testID="register-nickname-input"
      />

      <AuthFormInput
        label="密码"
        value={password}
        onChangeText={setPassword}
        onBlur={handlePasswordBlur}
        error={passwordError}
        secureTextEntry
        maxLength={MAX_PASSWORD_LENGTH}
        editable={!loading}
        testID="register-password-input"
      />

      <PrivacyCheckbox
        checked={agreedToPrivacy}
        onChange={setAgreedToPrivacy}
        error={privacyError}
        testID="register-privacy-checkbox"
      />

      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={loading}
        onPress={handleSubmit}
        testID="register-submit-btn"
      />

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={handleGoToLogin}
          style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: 14 }}
          data-testid="go-to-login-link"
        >
          已有账号？返回登录
        </button>
      </div>
    </div>
  );
}
