/**
 * apps/mobile/context/AuthContext.jsx
 * Task T009 - 实现 AuthContext
 *
 * 提供全局用户认证状态管理，包含：
 * - authReducer: 处理 AUTH_INIT_SUCCESS, AUTH_INIT_FAILURE, AUTH_LOGIN_SUCCESS, AUTH_LOGOUT
 * - AuthProvider: 挂载时调用 GET /api/auth/me 初始化登录状态，loading=true 防闪屏
 * - login / register / logout 三个异步方法
 * - useAuth Hook: 在 Provider 外调用时抛出错误
 *
 * 使用方式:
 *   // 在根布局挂载 Provider
 *   <AuthProvider baseURL="http://localhost:3000">
 *     <App />
 *   </AuthProvider>
 *
 *   // 在组件中消费
 *   const { user, isAuthenticated, loading, login, register, logout } = useAuth();
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { createApiClient } from '../lib/api-client.js';

// ── Initial State ──────────────────────────────────────────────────────────────

const initialState = {
  user: null,            // 当前登录用户对象 { id, email, nickname } 或 null
  isAuthenticated: false, // 是否已登录
  loading: true,         // 初始化时为 true，等待 GET /api/auth/me 完成后设为 false
};

// ── Reducer ────────────────────────────────────────────────────────────────────

/**
 * authReducer 处理认证相关的状态变更。
 *
 * @param {object} state - 当前状态
 * @param {object} action - 动作对象 { type, payload? }
 * @returns {object} 新状态（不可变，始终返回新对象）
 */
export function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };

    case 'AUTH_INIT_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };

    case 'AUTH_LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

// ── Provider ───────────────────────────────────────────────────────────────────

/**
 * AuthProvider 负责：
 * 1. 挂载时调用 GET /api/auth/me 初始化登录状态（loading=true 防闪屏）
 * 2. 对外暴露 login / register / logout 三个异步操作方法
 * 3. 通过 Context 向子组件传递 { user, isAuthenticated, loading, login, register, logout }
 *
 * @param {object} props
 * @param {string} props.baseURL - API 根地址（如 'http://localhost:3000'）
 * @param {React.ReactNode} props.children - 子组件
 */
export function AuthProvider({ baseURL, children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 创建 API Client 实例（baseURL 和 dispatch 稳定，无需每次重建）
  const apiClient = useMemo(
    () => createApiClient({ baseURL, dispatch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseURL]
  );

  // 挂载时初始化：调用 GET /api/auth/me 获取当前登录状态
  useEffect(() => {
    let cancelled = false;

    apiClient
      .get('/api/auth/me')
      .then((response) => {
        if (cancelled) return;
        // response.data 存在时才认为登录成功，否则视为未登录
        if (response && response.data) {
          dispatch({ type: 'AUTH_INIT_SUCCESS', payload: { user: response.data } });
        } else {
          dispatch({ type: 'AUTH_INIT_FAILURE' });
        }
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({ type: 'AUTH_INIT_FAILURE' });
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  /**
   * 登录方法
   *
   * @param {string} email - 用户邮箱
   * @param {string} password - 用户密码
   * @returns {Promise<object>} 登录成功的用户对象 { id, email, nickname }
   * @throws {Error} 登录失败时抛出含服务端错误信息的 Error
   */
  const login = useCallback(
    async (email, password) => {
      const response = await apiClient.post('/api/auth/login', { email, password });
      const user = response.data;
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user } });
      return user;
    },
    [apiClient]
  );

  /**
   * 注册方法
   *
   * @param {string} email - 用户邮箱
   * @param {string} nickname - 用户昵称
   * @param {string} password - 用户密码（明文，后端负责哈希）
   * @param {number} agreedAt - 用户同意隐私协议时的 Unix 毫秒时间戳
   * @returns {Promise<object>} 注册成功的用户对象 { id, email, nickname }
   * @throws {Error} 注册失败时抛出含服务端错误信息的 Error
   */
  const register = useCallback(
    async (email, nickname, password, agreedAt) => {
      const response = await apiClient.post('/api/auth/register', {
        email,
        nickname,
        password,
        agreedAt,
      });
      const user = response.data;
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user } });
      return user;
    },
    [apiClient]
  );

  /**
   * 登出方法
   *
   * @returns {Promise<void>}
   * @throws {Error} 登出失败时抛出含服务端错误信息的 Error
   */
  const logout = useCallback(async () => {
    await apiClient.post('/api/auth/logout');
    dispatch({ type: 'AUTH_LOGOUT' });
  }, [apiClient]);

  // 对外暴露的 Context Value
  const contextValue = useMemo(
    () => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      loading: state.loading,
      login,
      register,
      logout,
    }),
    [state.user, state.isAuthenticated, state.loading, login, register, logout]
  );

  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}

// ── useAuth Hook ──────────────────────────────────────────────────────────────

/**
 * useAuth Hook：消费 AuthContext，必须在 AuthProvider 内部使用。
 *
 * @returns {{ user: object|null, isAuthenticated: boolean, loading: boolean, login: function, register: function, logout: function }}
 * @throws {Error} 在 AuthProvider 外部调用时抛出错误
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
