import { createContext, useContext, useReducer } from 'react';

const initialState = {
  memos: [],
  allMemos: [],
  tags: [],
  stats: {
    totalMemos: 0,
    taggedMemos: 0,
    activeDays: 0,
    trashCount: 0,
  },
  heatmap: [],
  activeFilter: null,
  keyword: '',
  page: 1,
  hasMore: true,
  isLoading: false,
  isSubmitting: false,
  error: null,
};

function memoReducer(state, action) {
  switch (action.type) {
    case 'FETCH_MEMOS_START':
      return { ...state, isLoading: true, error: null };

    case 'FETCH_MEMOS_SUCCESS': {
      const { items, total, page } = action.payload;
      const updatedMemos = page === 1 ? items : [...state.memos, ...items];
      return {
        ...state,
        isLoading: false,
        memos: updatedMemos,
        allMemos: page === 1 ? items : [...state.allMemos, ...items],
        page,
        hasMore: updatedMemos.length < total,
        error: null,
      };
    }

    case 'FETCH_MEMOS_ERROR':
      return { ...state, isLoading: false, error: action.payload };

    case 'CREATE_MEMO_START':
      return { ...state, isSubmitting: true };

    case 'CREATE_MEMO_SUCCESS': {
      const newMemo = action.payload;
      return {
        ...state,
        isSubmitting: false,
        memos: [newMemo, ...state.memos],
        allMemos: [newMemo, ...state.allMemos],
        stats: {
          ...state.stats,
          totalMemos: state.stats.totalMemos + 1,
        },
      };
    }

    case 'CREATE_MEMO_ERROR':
      return { ...state, isSubmitting: false, error: action.payload };

    case 'DELETE_MEMO_SUCCESS': {
      const id = action.payload;
      return {
        ...state,
        memos: state.memos.filter((m) => m.id !== id),
        allMemos: state.allMemos.filter((m) => m.id !== id),
        stats: {
          ...state.stats,
          totalMemos: Math.max(0, state.stats.totalMemos - 1),
          trashCount: state.stats.trashCount + 1,
        },
      };
    }

    case 'SET_FILTER':
      return {
        ...state,
        activeFilter: action.payload,
        memos: [],
        allMemos: [],
        page: 1,
        hasMore: true,
        keyword: '',
      };

    case 'SET_KEYWORD': {
      const keyword = action.payload;
      const filtered = keyword
        ? state.allMemos.filter((m) =>
            m.content.toLowerCase().includes(keyword.toLowerCase()),
          )
        : state.allMemos;
      return { ...state, keyword, memos: filtered };
    }

    case 'FETCH_TAGS_SUCCESS':
      return { ...state, tags: action.payload };

    case 'FETCH_STATS_SUCCESS':
      return { ...state, stats: action.payload };

    case 'FETCH_HEATMAP_SUCCESS':
      return { ...state, heatmap: action.payload };

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
