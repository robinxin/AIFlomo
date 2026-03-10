import { createContext, useContext, useReducer } from 'react';

const initialState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT':
      return { ...state, isLoading: true };
    case 'AUTH_INIT_DONE':
      return {
        ...state,
        isLoading: false,
        user: action.payload ?? null,
        isAuthenticated: !!action.payload,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        user: action.payload,
        isAuthenticated: true,
      };
    case 'LOGOUT':
      return {
        ...state,
        isLoading: false,
        user: null,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
