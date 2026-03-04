import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout() {
  const { state } = useAuth();
  const { user, isLoading } = state;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4caf50" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
});
