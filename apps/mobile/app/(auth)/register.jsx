import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { PolicyCheckbox } from '@/components/PolicyCheckbox';
import { useAuthActions } from '@/hooks/use-auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthActions();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [policyError, setPolicyError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (value) => {
    if (!value) {
      return '请输入邮箱';
    }
    if (!EMAIL_REGEX.test(value)) {
      return '请输入有效的邮箱地址';
    }
    if (value.length > 255) {
      return '邮箱长度不能超过 255 个字符';
    }
    return '';
  };

  const validateNickname = (value) => {
    if (!value) {
      return '请输入昵称';
    }
    if (value.length < 1 || value.length > 50) {
      return '昵称长度需在 1-50 个字符之间';
    }
    return '';
  };

  const validatePassword = (value) => {
    if (!value) {
      return '请输入密码';
    }
    if (value.length < 6) {
      return '密码至少需要 6 个字符';
    }
    if (value.length > 128) {
      return '密码长度不能超过 128 个字符';
    }
    return '';
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (emailError) setEmailError('');
  };

  const handleNicknameChange = (value) => {
    setNickname(value);
    if (nicknameError) setNicknameError('');
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (passwordError) setPasswordError('');
  };

  const handlePolicyToggle = () => {
    setAgreePolicy(!agreePolicy);
    if (policyError) setPolicyError('');
  };

  const handleSubmit = async () => {
    const emailErr = validateEmail(email);
    const nicknameErr = validateNickname(nickname);
    const passwordErr = validatePassword(password);
    const policyErr = !agreePolicy ? '请先同意隐私协议' : '';

    setEmailError(emailErr);
    setNicknameError(nicknameErr);
    setPasswordError(passwordErr);
    setPolicyError(policyErr);

    if (emailErr || nicknameErr || passwordErr || policyErr) {
      return;
    }

    setIsSubmitting(true);

    const result = await register(email.toLowerCase().trim(), nickname.trim(), password);

    setIsSubmitting(false);

    if (result.success) {
      Alert.alert('注册成功', '即将跳转到登录页面', [
        {
          text: '确定',
          onPress: () => router.replace('/login'),
        },
      ]);
    } else {
      Alert.alert('注册失败', result.error || '注册失败，请稍后重试');
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>注册账号</Text>
        <Text style={styles.subtitle}>创建你的 AIFlomo 账号</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="邮箱"
          value={email}
          onChangeText={handleEmailChange}
          placeholder="请输入邮箱地址"
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
        />

        <TextInput
          label="昵称"
          value={nickname}
          onChangeText={handleNicknameChange}
          placeholder="请输入昵称（1-50 个字符）"
          autoCapitalize="none"
          error={nicknameError}
        />

        <TextInput
          label="密码"
          value={password}
          onChangeText={handlePasswordChange}
          placeholder="请输入密码（至少 6 个字符）"
          secureTextEntry
          autoCapitalize="none"
          error={passwordError}
        />

        <PolicyCheckbox checked={agreePolicy} onPress={handlePolicyToggle} />
        {policyError && <Text style={styles.policyError}>{policyError}</Text>}

        <Button
          title="注册"
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          variant="primary"
        />

        <Pressable onPress={handleGoToLogin} style={styles.linkContainer}>
          <Text style={styles.linkText}>已有账号？返回登录</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  policyError: {
    fontSize: 12,
    color: '#f44336',
    marginTop: -12,
    marginBottom: 16,
  },
  linkContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#4caf50',
    textDecorationLine: 'underline',
  },
});
