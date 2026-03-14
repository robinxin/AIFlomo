/**
 * apps/mobile/app/_layout.jsx
 * Task T016 - 根布局文件，挂载 AuthProvider，实现路由守卫
 *
 * 功能：
 * 1. 挂载 AuthProvider，包裹所有子路由
 * 2. loading=true 时渲染加载占位（ActivityIndicator），防止闪屏
 * 3. loading=false && !isAuthenticated 时跳转 /login（/login 和 /register 路径除外）
 * 4. 已登录用户访问 /login 或 /register 时跳转 /
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Auth-only paths that unauthenticated users may access
const AUTH_PATHS = ['/login', '/register'];

// ── RootLayoutNav ─────────────────────────────────────────────────────────────

/**
 * Inner component that has access to AuthContext via useAuth().
 * Handles the route guard logic using useEffect.
 */
function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Do nothing while auth state is still initializing
    if (loading) return;

    const isAuthPath = AUTH_PATHS.includes(pathname);

    if (!isAuthenticated && !isAuthPath) {
      // Unauthenticated user trying to access a protected route → send to /login
      router.replace('/login');
      return;
    }

    if (isAuthenticated && isAuthPath) {
      // Authenticated user visiting /login or /register → redirect to /
      router.replace('/');
    }
  }, [loading, isAuthenticated, pathname, router]);

  // Show loading placeholder while auth state is initializing (prevents flash of wrong screen)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  // Render child routes
  return <Slot />;
}

// ── RootLayout ────────────────────────────────────────────────────────────────

/**
 * Root layout component. Wraps everything in AuthProvider so all child
 * routes have access to authentication state.
 */
export default function RootLayout() {
  return (
    <AuthProvider baseURL={BASE_URL}>
      <RootLayoutNav />
    </AuthProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
