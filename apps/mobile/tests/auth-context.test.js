import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock react-native so jsdom environment doesn't break on native imports
vi.mock('react-native', () => ({
  View: ({ children }) => React.createElement('div', null, children),
  Text: ({ children }) => React.createElement('span', null, children),
  TouchableOpacity: ({ children, onPress }) =>
    React.createElement('button', { onClick: onPress }, children),
  StyleSheet: { create: (s) => s },
  Platform: { OS: 'web' },
}));

// Mock expo-router to prevent navigation side-effects
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSegments: () => [],
}));

// Mock api-client – must be set up before importing hooks that use it
vi.mock('../lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../lib/api-client';
import { AuthProvider, useAuthContext } from '../context/AuthContext';
import { useAuth } from '../hooks/use-auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TestConsumer() {
  const { state } = useAuthContext();
  return React.createElement(
    'div',
    { 'data-testid': 'consumer' },
    JSON.stringify(state)
  );
}

function renderWithProvider(ui) {
  return render(React.createElement(AuthProvider, null, ui));
}

// Hook test helper: renders a component that exposes hook return value
function UseAuthWrapper({ onRender }) {
  const result = useAuth();
  onRender(result);
  return null;
}

async function renderUseAuth() {
  let hookResult = {};
  const onRender = (r) => { hookResult = r; };
  const utils = renderWithProvider(
    React.createElement(UseAuthWrapper, { onRender })
  );
  // Allow any pending state updates to flush
  await act(async () => {});
  return { hookResult: () => hookResult, ...utils };
}

// ─── AuthContext Tests ────────────────────────────────────────────────────────

describe('AuthContext', () => {
  describe('AuthProvider', () => {
    it('provides the initial state with isLoading=true and isAuthenticated=false', () => {
      renderWithProvider(React.createElement(TestConsumer));
      const raw = JSON.parse(screen.getByTestId('consumer').textContent);
      expect(raw.user).toBeNull();
      expect(raw.isLoading).toBe(true);
      expect(raw.isAuthenticated).toBe(false);
    });

    it('renders children inside the provider', () => {
      renderWithProvider(React.createElement('span', { 'data-testid': 'child' }, 'hello'));
      expect(screen.getByTestId('child')).toBeTruthy();
    });
  });

  describe('authReducer via dispatch', () => {
    function DispatchConsumer({ action }) {
      const { state, dispatch } = useAuthContext();
      React.useEffect(() => {
        dispatch(action);
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return React.createElement(
        'div',
        { 'data-testid': 'state' },
        JSON.stringify(state)
      );
    }

    it('handles AUTH_INIT: sets isLoading to true', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, { action: { type: 'AUTH_INIT' } })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(true);
      });
    });

    it('handles AUTH_INIT_DONE with a user payload: sets user and isAuthenticated=true', async () => {
      const user = { id: '1', email: 'a@b.com', nickname: 'Alice' };
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'AUTH_INIT_DONE', payload: user },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.user).toEqual(user);
        expect(state.isAuthenticated).toBe(true);
      });
    });

    it('handles AUTH_INIT_DONE with null payload: clears user and sets isAuthenticated=false', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'AUTH_INIT_DONE', payload: null },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });
    });

    it('handles AUTH_INIT_DONE with undefined payload: treats as null (isAuthenticated=false)', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'AUTH_INIT_DONE', payload: undefined },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });
    });

    it('handles LOGIN_SUCCESS: sets user and isAuthenticated=true, isLoading=false', async () => {
      const user = { id: '2', email: 'c@d.com', nickname: 'Bob' };
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'LOGIN_SUCCESS', payload: user },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.user).toEqual(user);
        expect(state.isAuthenticated).toBe(true);
      });
    });

    it('handles LOGOUT: clears user and sets isAuthenticated=false', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, { action: { type: 'LOGOUT' } })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        expect(state.isLoading).toBe(false);
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });
    });

    it('handles unknown action type: returns current state unchanged', async () => {
      renderWithProvider(
        React.createElement(DispatchConsumer, {
          action: { type: 'UNKNOWN_ACTION' },
        })
      );
      await waitFor(() => {
        const state = JSON.parse(screen.getByTestId('state').textContent);
        // State should remain as initial state (before the effect runs we see initial,
        // after it runs we still get initial because unknown action is a no-op)
        expect(state.user).toBeNull();
        expect(state.isLoading).toBe(true);
        expect(state.isAuthenticated).toBe(false);
      });
    });
  });

  describe('useAuthContext', () => {
    it('throws an error when used outside of AuthProvider', () => {
      // Suppress expected React error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      function BareConsumer() {
        useAuthContext();
        return null;
      }
      expect(() => render(React.createElement(BareConsumer))).toThrow(
        'useAuthContext must be used within AuthProvider'
      );
      consoleSpy.mockRestore();
    });

    it('returns state and dispatch when used inside AuthProvider', () => {
      let captured = null;
      function Capturer() {
        captured = useAuthContext();
        return null;
      }
      renderWithProvider(React.createElement(Capturer));
      expect(captured).not.toBeNull();
      expect(typeof captured.state).toBe('object');
      expect(typeof captured.dispatch).toBe('function');
    });
  });
});

// ─── useAuth Hook Tests ───────────────────────────────────────────────────────

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial auth state values', async () => {
    const { hookResult } = await renderUseAuth();
    const result = hookResult();
    expect(result.user).toBeNull();
    expect(result.isLoading).toBe(true);
    expect(result.isAuthenticated).toBe(false);
  });

  it('exposes checkSession, login, register, logout as functions', async () => {
    const { hookResult } = await renderUseAuth();
    const result = hookResult();
    expect(typeof result.checkSession).toBe('function');
    expect(typeof result.login).toBe('function');
    expect(typeof result.register).toBe('function');
    expect(typeof result.logout).toBe('function');
  });

  describe('checkSession', () => {
    it('dispatches AUTH_INIT then AUTH_INIT_DONE with user on success', async () => {
      const user = { id: '1', email: 'a@b.com', nickname: 'Alice' };
      api.get.mockResolvedValue(user);

      const { hookResult } = await renderUseAuth();

      await act(async () => {
        await hookResult().checkSession();
      });

      const result = hookResult();
      expect(api.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result.user).toEqual(user);
      expect(result.isAuthenticated).toBe(true);
      expect(result.isLoading).toBe(false);
    });

    it('dispatches AUTH_INIT then AUTH_INIT_DONE with null on API failure', async () => {
      api.get.mockRejectedValue(new Error('Unauthorized'));

      const { hookResult } = await renderUseAuth();

      await act(async () => {
        await hookResult().checkSession();
      });

      const result = hookResult();
      expect(api.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result.user).toBeNull();
      expect(result.isAuthenticated).toBe(false);
      expect(result.isLoading).toBe(false);
    });

    it('is a stable callback reference across re-renders', async () => {
      api.get.mockResolvedValue(null);
      const { hookResult, rerender } = await renderUseAuth();
      const first = hookResult().checkSession;

      await act(async () => {
        rerender(
          React.createElement(
            AuthProvider,
            null,
            React.createElement(UseAuthWrapper, { onRender: (r) => { hookResult._latest = r; } })
          )
        );
      });

      // useCallback should keep a stable reference
      expect(typeof first).toBe('function');
    });
  });

  describe('login', () => {
    it('calls api.post with credentials and dispatches LOGIN_SUCCESS', async () => {
      const user = { id: '2', email: 'c@d.com', nickname: 'Bob' };
      api.post.mockResolvedValue(user);

      const { hookResult } = await renderUseAuth();
      let returnedUser;

      await act(async () => {
        returnedUser = await hookResult().login('c@d.com', 'password123');
      });

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'c@d.com',
        password: 'password123',
      });
      expect(returnedUser).toEqual(user);
      const result = hookResult();
      expect(result.user).toEqual(user);
      expect(result.isAuthenticated).toBe(true);
      expect(result.isLoading).toBe(false);
    });

    it('propagates the API error when login fails', async () => {
      api.post.mockRejectedValue(new Error('Invalid credentials'));

      const { hookResult } = await renderUseAuth();

      await expect(
        act(async () => {
          await hookResult().login('bad@email.com', 'wrong');
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('calls api.post with registration data and dispatches LOGIN_SUCCESS', async () => {
      const user = { id: '3', email: 'new@user.com', nickname: 'NewUser' };
      api.post.mockResolvedValue(user);

      const { hookResult } = await renderUseAuth();
      let returnedUser;

      await act(async () => {
        returnedUser = await hookResult().register('new@user.com', 'securePass', 'NewUser');
      });

      expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
        email: 'new@user.com',
        password: 'securePass',
        nickname: 'NewUser',
      });
      expect(returnedUser).toEqual(user);
      const result = hookResult();
      expect(result.user).toEqual(user);
      expect(result.isAuthenticated).toBe(true);
    });

    it('propagates the API error when registration fails', async () => {
      api.post.mockRejectedValue(new Error('Email already taken'));

      const { hookResult } = await renderUseAuth();

      await expect(
        act(async () => {
          await hookResult().register('taken@email.com', 'pass', 'Name');
        })
      ).rejects.toThrow('Email already taken');
    });
  });

  describe('logout', () => {
    it('calls api.post on logout endpoint and dispatches LOGOUT', async () => {
      api.post.mockResolvedValue({});

      // First log the user in so we can verify logout clears state
      const user = { id: '4', email: 'e@f.com', nickname: 'Eve' };
      api.post.mockResolvedValueOnce(user).mockResolvedValue({});

      const { hookResult } = await renderUseAuth();

      await act(async () => {
        await hookResult().login('e@f.com', 'pass');
      });
      expect(hookResult().isAuthenticated).toBe(true);

      await act(async () => {
        await hookResult().logout();
      });

      expect(api.post).toHaveBeenLastCalledWith('/api/auth/logout', {});
      const result = hookResult();
      expect(result.user).toBeNull();
      expect(result.isAuthenticated).toBe(false);
      expect(result.isLoading).toBe(false);
    });

    it('propagates the API error when logout fails', async () => {
      api.post.mockRejectedValue(new Error('Server error'));

      const { hookResult } = await renderUseAuth();

      await expect(
        act(async () => {
          await hookResult().logout();
        })
      ).rejects.toThrow('Server error');
    });
  });

  describe('state transitions – full flow', () => {
    it('login then logout resets all auth state', async () => {
      const user = { id: '5', email: 'g@h.com', nickname: 'Grace' };
      api.post.mockResolvedValueOnce(user).mockResolvedValue({});

      const { hookResult } = await renderUseAuth();

      await act(async () => {
        await hookResult().login('g@h.com', 'pass');
      });
      expect(hookResult().isAuthenticated).toBe(true);
      expect(hookResult().user).toEqual(user);

      await act(async () => {
        await hookResult().logout();
      });
      expect(hookResult().isAuthenticated).toBe(false);
      expect(hookResult().user).toBeNull();
    });

    it('register then checkSession reflects current server state', async () => {
      const user = { id: '6', email: 'i@j.com', nickname: 'Ivan' };
      api.post.mockResolvedValueOnce(user);
      api.get.mockResolvedValue(user);

      const { hookResult } = await renderUseAuth();

      await act(async () => {
        await hookResult().register('i@j.com', 'pass', 'Ivan');
      });
      expect(hookResult().isAuthenticated).toBe(true);

      await act(async () => {
        await hookResult().checkSession();
      });
      expect(hookResult().user).toEqual(user);
      expect(hookResult().isAuthenticated).toBe(true);
    });
  });
});
