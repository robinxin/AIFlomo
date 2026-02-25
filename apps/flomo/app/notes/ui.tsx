'use client';

import { useEffect, useMemo, useState } from 'react';

type Note = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
};

type TagSummary = { id: string; name: string; count: number };

type Props = {
  userEmail: string;
};

export default function NotesApp({ userEmail }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [navExpanded, setNavExpanded] = useState(true);
  const [navFilter, setNavFilter] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    let filtered = notes;

    if (navFilter === 'no-tag') {
      filtered = filtered.filter((n) => n.tags.length === 0);
    } else if (navFilter === 'has-link') {
      filtered = filtered.filter((n) =>
        /https?:\/\//.test(n.content) || /https?:\/\//.test(n.title ?? '')
      );
    }

    return filtered.filter((note) => {
      const matchesTag = selectedTag
        ? note.tags.some((tag) => tag.name === selectedTag)
        : true;
      const matchesQuery = query
        ? note.content.toLowerCase().includes(query.toLowerCase()) ||
          (note.title ?? '').toLowerCase().includes(query.toLowerCase())
        : true;
      return matchesTag && matchesQuery;
    });
  }, [notes, query, selectedTag, navFilter]);

  const noteCount = notes.length;
  const tagCount = tags.length;
  const dayCount = useMemo(() => {
    const days = new Set(notes.map((n) => n.createdAt.slice(0, 10)));
    return days.size;
  }, [notes]);

  // Simple heatmap: last 4 rows x 16 cols
  const heatmapCells = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => {
      const d = n.createdAt.slice(0, 10);
      counts[d] = (counts[d] || 0) + 1;
    });
    const cells: number[] = [];
    const today = new Date();
    for (let i = 63; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const c = counts[key] || 0;
      cells.push(c === 0 ? 0 : c <= 1 ? 1 : c <= 3 ? 2 : 3);
    }
    return cells;
  }, [notes]);

  const loadNotes = async () => {
    const res = await fetch('/api/notes');
    if (!res.ok) return;
    const data = await res.json();
    setNotes(data.notes ?? []);
  };

  const loadTags = async () => {
    const res = await fetch('/api/tags');
    if (!res.ok) return;
    const data = await res.json();
    setTags(data.tags ?? []);
  };

  useEffect(() => {
    loadNotes();
    loadTags();
  }, []);

  const handleCreate = async () => {
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }

    setLoading(true);
    setError('');

    const parsedTags = tagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags: parsedTags }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '创建失败');
      setLoading(false);
      return;
    }

    setContent('');
    setTagInput('');
    await loadNotes();
    await loadTags();
    setLoading(false);
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditTitle(note.title ?? '');
    setEditContent(note.content);
    setEditTagInput(note.tags.map((t) => t.name).join(', '));
    setMenuOpenId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTagInput('');
  };

  const handleEdit = async () => {
    if (!editingId || !editContent.trim()) return;

    const parsedTags = editTagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const res = await fetch(`/api/notes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, content: editContent, tags: parsedTags }),
    });

    if (res.ok) {
      cancelEdit();
      await loadNotes();
      await loadTags();
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpenId(null);
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    await loadNotes();
    await loadTags();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleCreate();
    }
  };

  return (
    <>
      {/* ===== Left Sidebar ===== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {/* User row */}
          <div className="user-row">
            <span className="user-name">{userEmail.split('@')[0]}</span>
            <span className="user-badge">PRO</span>
            <button className="logout-btn" onClick={handleLogout} title="退出登录">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num">{noteCount}</div>
              <div className="stat-label">笔记</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{tagCount}</div>
              <div className="stat-label">标签</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{dayCount}</div>
              <div className="stat-label">天</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="heatmap-wrap">
            <div className="heatmap-grid">
              {heatmapCells.map((level, i) => (
                <div key={i} className={`heatmap-cell${level > 0 ? ` level-${level}` : ''}`} />
              ))}
            </div>
            <div className="heatmap-months">
              <span>十二月</span><span>一月</span><span>二月</span><span>三月</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <button
            className={`nav-item nav-parent${navFilter === 'all' && !selectedTag ? ' active' : ''}`}
            onClick={() => { setNavExpanded(!navExpanded); setNavFilter('all'); setSelectedTag(''); }}
          >
            <span className={`nav-arrow${navExpanded ? ' expanded' : ''}`}>&#9654;</span>
            全部笔记
          </button>
          {navExpanded && (
            <div className="nav-children">
              <button className={`nav-item${navFilter === 'no-tag' ? ' active' : ''}`} onClick={() => { setNavFilter('no-tag'); setSelectedTag(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/><line x1="2" y1="22" x2="22" y2="2" strokeDasharray="4 3"/></svg>
                无标签
              </button>
              <button className={`nav-item${navFilter === 'has-image' ? ' active' : ''}`} onClick={() => { setNavFilter('has-image'); setSelectedTag(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                有图片
              </button>
              <button className={`nav-item${navFilter === 'has-link' ? ' active' : ''}`} onClick={() => { setNavFilter('has-link'); setSelectedTag(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                有链接
              </button>
              <button className={`nav-item${navFilter === 'has-voice' ? ' active' : ''}`} onClick={() => { setNavFilter('has-voice'); setSelectedTag(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                有语音
              </button>
            </div>
          )}

          <div className="nav-divider" />

          <button className="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            每日回顾
          </button>
          <button className="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            AI 洞察
          </button>
          <button className="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            随机漫步
          </button>

          {/* All tags section */}
          <div className="nav-divider" />
          <div className="nav-section-title" onClick={() => setSelectedTag('')}>全部标签</div>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`nav-item${selectedTag === tag.name ? ' active' : ''}`}
              onClick={() => { setSelectedTag(tag.name); setNavFilter('all'); }}
              style={{ paddingLeft: 40 }}
            >
              # {tag.name}
              <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem' }}>{tag.count}</span>
            </button>
          ))}

          <div className="nav-divider" />
          <button className="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            回收站
          </button>
        </nav>
      </aside>

      {/* ===== Main Area ===== */}
      <div className="main-area">
        {/* Top bar */}
        <div className="main-topbar">
          <span className="topbar-brand">Flomo-印象笔记</span>
          <div className="topbar-search">
            <svg className="topbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="搜索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scroll area */}
        <div className="main-scroll">
          {/* Composer */}
          <div className="composer">
            <div className="composer-body">
              <textarea
                placeholder="现在的想法是..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="composer-tags">
              <input
                type="text"
                placeholder="#标签，用逗号分隔"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
              />
            </div>
            {error && <div className="composer-error">{error}</div>}
            <div className="composer-footer">
              <div className="composer-toolbar">
                <button className="toolbar-btn" title="标签">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                </button>
                <button className="toolbar-btn" title="图片">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </button>
                <div className="toolbar-divider" />
                <button className="toolbar-btn" title="文字大小">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                </button>
                <button className="toolbar-btn" title="无序列表">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button className="toolbar-btn" title="有序列表">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                </button>
              </div>
              <button className="send-btn" onClick={handleCreate} disabled={loading} title="发送 (⌘+Enter)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>

          {/* Tag filter bar */}
          {tags.length > 0 && (
            <div className="tags-bar">
              <button
                className={`tag-filter-btn${selectedTag === '' ? ' active' : ''}`}
                onClick={() => setSelectedTag('')}
              >
                全部
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`tag-filter-btn${selectedTag === tag.name ? ' active' : ''}`}
                  onClick={() => setSelectedTag(tag.name)}
                >
                  {tag.name} ({tag.count})
                </button>
              ))}
            </div>
          )}

          {/* Note list */}
          <div className="note-list">
            {filteredNotes.length === 0 && (
              <div className="empty-state">还没有记录，快写下第一条吧。</div>
            )}
            {filteredNotes.map((note) => (
              <div key={note.id} className="note-card">
                {editingId === note.id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      placeholder="标题（可选）"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="标签，用逗号分隔"
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                    />
                    <div className="edit-form-actions">
                      <button className="btn-save" onClick={handleEdit}>保存</button>
                      <button className="btn-cancel" onClick={cancelEdit}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-header">
                      <span className="note-date">
                        {new Date(note.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          hour12: false,
                        }).replace(/\//g, '-')}
                      </span>
                      <div style={{ position: 'relative' }}>
                        <button className="note-menu-btn" onClick={() => setMenuOpenId(menuOpenId === note.id ? null : note.id)}>
                          ···
                        </button>
                        {menuOpenId === note.id && (
                          <div className="note-actions">
                            <button onClick={() => startEdit(note)}>编辑</button>
                            <button onClick={() => handleDelete(note.id)}>删除</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {note.title && <div className="note-title">{note.title}</div>}
                    <div className="note-content">{note.content}</div>
                    {note.tags.length > 0 && (
                      <div className="note-tags">
                        {note.tags.map((tag) => (
                          <span key={tag.id} className="tag" onClick={() => setSelectedTag(tag.name)} style={{ cursor: 'pointer' }}>
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
