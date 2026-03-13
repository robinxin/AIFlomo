/**
 * _layout.jsx — Expo Router 根布局
 *
 * 功能：
 *   - 挂载 AuthProvider 包裹所有子路由
 *   - 路由守卫：
 *     - loading=true 时渲染加载占位（防闪屏）
 *     - loading=false && !isAuthenticated 时跳转 /login
 *     - 已登录用户访问 /login 或 /register 时跳转 /
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

// ---------------------------------------------------------------------------
// Route Guard (inner component that can consume AuthContext)
// ---------------------------------------------------------------------------

function RouteGuard({ children }) {
  const router = useRouter();
  const segments = useSegments();
  const { loading, isAuthenticated } = useAuth();

  const AUTH_ROUTES = ['login', 'register'];

  useEffect(() => {
    if (loading) return;

    const currentSegment = segments[0];
    const isAuthRoute = AUTH_ROUTES.includes(currentSegment);

    if (!isAuthenticated && !isAuthRoute) {
      // Not logged in and not on auth page — redirect to login
      router.replace('/login');
    } else if (isAuthenticated && isAuthRoute) {
      // Logged in but on auth page — redirect to home
      router.replace('/');
    }
  }, [loading, isAuthenticated, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer} testID="layout-loading">
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return children;
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGuard>
        <Slot />
      </RouteGuard>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
