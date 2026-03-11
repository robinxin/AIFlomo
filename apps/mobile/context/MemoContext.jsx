import { createContext, useContext, useReducer } from 'react';

const initialState = {
  memos: [],
  isLoading: false,
  error: null,
  filter: { type: 'all', tagId: null },
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  stats: null,
  heatmapData: [],
  tags: [],
  trashMemos: [],
  trashCount: 0,
};

function memoReducer(state, action) {
  switch (action.type) {
    case 'FETCH_MEMOS_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_MEMOS_SUCCESS':
      return { ...state, isLoading: false, memos: action.payload };
    case 'FETCH_MEMOS_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'ADD_MEMO':
      return { ...state, memos: [action.payload, ...state.memos] };
    case 'UPDATE_MEMO':
      return { ...state, memos: state.memos.map((m) => m.id === action.payload.id ? action.payload : m) };
    case 'DELETE_MEMO':
      return {
        ...state,
        memos: state.memos.filter((m) => m.id !== action.payload),
        trashCount: state.trashCount + 1,
      };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'FETCH_TAGS_SUCCESS':
      return { ...state, tags: action.payload };
    case 'FETCH_STATS_SUCCESS':
      return { ...state, stats: action.payload };
    case 'FETCH_HEATMAP_SUCCESS':
      return { ...state, heatmapData: action.payload };
    case 'SEARCH_START':
      return { ...state, isSearching: true, searchQuery: action.payload };
    case 'SEARCH_SUCCESS':
      return { ...state, isSearching: false, searchResults: action.payload };
    case 'SEARCH_CLEAR':
      return { ...state, isSearching: false, searchQuery: '', searchResults: [] };
    case 'FETCH_TRASH_SUCCESS':
      return {
        ...state,
        trashMemos: action.payload,
        trashCount: action.payload.length,
      };
    case 'RESTORE_MEMO':
      return {
        ...state,
        trashMemos: state.trashMemos.filter((m) => m.id !== action.payload),
        trashCount: Math.max(0, state.trashCount - 1),
      };
    case 'PERMANENT_DELETE_MEMO':
      return {
        ...state,
        trashMemos: state.trashMemos.filter((m) => m.id !== action.payload),
        trashCount: Math.max(0, state.trashCount - 1),
      };
    default:
      return state;
  }
}

const MemoContext = createContext(null);

export function MemoProvider({ children }) {
  const [state, dispatch] = useReducer(memoReducer, initialState);
  return (
    <MemoContext.Provider value={{ state, dispatch }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemoContext() {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error('useMemoContext must be used within MemoProvider');
  return ctx;
}
