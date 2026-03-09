import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { PolicyCheckbox } from '@/components/PolicyCheckbox';
import { useAuthActions } from '@/hooks/use-auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthActions();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({
    email: '',
    nickname: '',
    password: '',
    policy: '',
  });

  // 邮箱格式验证
  const validateEmail = (value) => {
    if (!value) return '请输入邮箱地址';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return '请输入有效的邮箱地址';
    if (value.length > 255) return '邮箱地址过长';
    return '';
  };

  // 昵称验证
  const validateNickname = (value) => {
    if (!value) return '请输入昵称';
    if (value.length < 1 || value.length > 50) return '昵称长度需在 1-50 个字符之间';
    return '';
  };

  // 密码验证
  const validatePassword = (value) => {
    if (!value) return '请输入密码';
    if (value.length < 6) return '密码至少需要 6 个字符';
    if (value.length > 128) return '密码长度不能超过 128 个字符';
    return '';
  };

  // 隐私协议验证
  const validatePolicy = (checked) => {
    if (!checked) return '请先同意隐私协议';
    return '';
  };

  // onChange 时清除对应字段的错误
  const handleEmailChange = (value) => {
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handleNicknameChange = (value) => {
    setNickname(value);
    if (errors.nickname) {
      setErrors((prev) => ({ ...prev, nickname: '' }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  const handlePolicyChange = () => {
    setAgreePolicy((prev) => !prev);
    if (errors.policy) {
      setErrors((prev) => ({ ...prev, policy: '' }));
    }
  };

  // onBlur 时触发字段验证
  const handleEmailBlur = () => {
    const error = validateEmail(email);
    if (error) {
      setErrors((prev) => ({ ...prev, email: error }));
    }
  };

  const handleNicknameBlur = () => {
    const error = validateNickname(nickname);
    if (error) {
      setErrors((prev) => ({ ...prev, nickname: error }));
    }
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);
    if (error) {
      setErrors((prev) => ({ ...prev, password: error }));
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    // 完整校验所有字段
    const emailError = validateEmail(email);
    const nicknameError = validateNickname(nickname);
    const passwordError = validatePassword(password);
    const policyError = validatePolicy(agreePolicy);

    // 如果有任何错误，显示并阻止提交
    if (emailError || nicknameError || passwordError || policyError) {
      setErrors({
        email: emailError,
        nickname: nicknameError,
        password: passwordError,
        policy: policyError,
      });
      return;
    }

    // 提交到后端
    setLoading(true);
    const result = await register(email.toLowerCase(), nickname, password);
    setLoading(false);

    if (result.success) {
      // 注册成功，跳转到登录页面
      router.replace('/login');
    } else {
      // 注册失败，显示后端返回的错误
      if (result.error.includes('邮箱')) {
        setErrors((prev) => ({ ...prev, email: result.error }));
      } else {
        // 通用错误提示
        setErrors((prev) => ({ ...prev, email: result.error }));
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>注册账号</Text>
        <Text style={styles.subtitle}>开始使用 AIFlomo 记录你的想法</Text>

        <TextInput
          label="邮箱地址"
          value={email}
          onChangeText={handleEmailChange}
          onBlur={handleEmailBlur}
          keyboardType="email-address"
          placeholder="请输入邮箱地址"
          error={errors.email}
          autoCapitalize="none"
        />

        <TextInput
          label="昵称"
          value={nickname}
          onChangeText={handleNicknameChange}
          onBlur={handleNicknameBlur}
          placeholder="请输入昵称"
          error={errors.nickname}
        />

        <TextInput
          label="密码"
          value={password}
          onChangeText={handlePasswordChange}
          onBlur={handlePasswordBlur}
          secureTextEntry
          placeholder="请输入密码（至少 6 个字符）"
          error={errors.password}
          autoCapitalize="none"
        />

        <PolicyCheckbox
          checked={agreePolicy}
          onPress={handlePolicyChange}
          error={errors.policy}
        />

        <Button
          title="注册"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>已有账号？</Text>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.link}>返回登录</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  link: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },
});
