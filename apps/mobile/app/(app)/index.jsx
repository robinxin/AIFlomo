import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const { state, logout } = useAuth();
  const { user } = state;

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>欢迎回来，{user?.username}</Text>
      <Text style={styles.placeholder}>主应用功能即将上线 🚀</Text>
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 24,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 14,
    color: '#888',
    marginBottom: 40,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logoutText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
});
