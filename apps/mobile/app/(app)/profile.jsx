import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
      router.replace('/login');
    } catch (err) {
      Alert.alert('登出失败', err.message ?? '请稍后重试');
    }
  }

  return (
    <View style={styles.container} testID="profile-screen">
      <View style={styles.card}>
        <Text style={styles.label}>昵称</Text>
        <Text style={styles.value} testID="profile-nickname">
          {user?.nickname ?? user?.email ?? ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>邮箱</Text>
        <Text style={styles.value} testID="profile-email">
          {user?.email ?? ''}
        </Text>
      </View>

      <Pressable
        style={styles.logoutBtn}
        onPress={handleLogout}
        testID="profile-logout-btn"
        accessibilityRole="button"
        accessibilityLabel="退出登录"
      >
        <Text style={styles.logoutBtnText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0',
    padding: 16,
    paddingTop: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  logoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  logoutBtnText: {
    fontSize: 15,
    color: '#e53935',
    fontWeight: '600',
  },
});
