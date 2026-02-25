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
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTagInput, setEditTagInput] = useState('');

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesTag = selectedTag
        ? note.tags.some((tag) => tag.name === selectedTag)
        : true;
      const matchesQuery = query
        ? note.content.toLowerCase().includes(query.toLowerCase()) ||
          (note.title ?? '').toLowerCase().includes(query.toLowerCase())
        : true;
      return matchesTag && matchesQuery;
    });
  }, [notes, query, selectedTag]);

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

    const tags = tagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title, tags }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '创建失败');
      setLoading(false);
      return;
    }

    setContent('');
    setTitle('');
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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTagInput('');
  };

  const handleEdit = async () => {
    if (!editingId || !editContent.trim()) return;

    const tags = editTagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const res = await fetch(`/api/notes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, content: editContent, tags }),
    });

    if (res.ok) {
      cancelEdit();
      await loadNotes();
      await loadTags();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    await loadNotes();
    await loadTags();
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="grid grid-2">
      <div className="card form-stack">
        <div className="top-bar">
          <h2>今天的灵感</h2>
          <button className="secondary" onClick={handleLogout}>退出</button>
        </div>
        <p className="note-meta">当前账号：{userEmail}</p>
        <input
          type="text"
          placeholder="标题（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="写下你的想法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          type="text"
          placeholder="标签，用逗号分隔"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        {error && <div className="note-meta" style={{ color: '#b1332b' }}>{error}</div>}
        <button onClick={handleCreate} disabled={loading}>
          {loading ? '保存中...' : '保存灵感'}
        </button>
      </div>

      <div className="card">
        <div className="top-bar" style={{ marginBottom: 12 }}>
          <h2>全部灵感</h2>
          <input
            type="search"
            placeholder="搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>
        <div className="note-meta" style={{ marginBottom: 12 }}>
          标签：
          <button
            className="secondary"
            onClick={() => setSelectedTag('')}
            style={{ marginLeft: 8 }}
          >
            全部
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className="secondary"
              onClick={() => setSelectedTag(tag.name)}
              style={{ marginLeft: 8 }}
            >
              {tag.name} ({tag.count})
            </button>
          ))}
        </div>
        <div className="note-list">
          {filteredNotes.length === 0 && (
            <div className="note-meta">还没有记录，快写下第一条吧。</div>
          )}
          {filteredNotes.map((note) => (
            <div key={note.id} className="note-card">
              {editingId === note.id ? (
                <div className="form-stack">
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleEdit}>保存</button>
                    <button className="secondary" onClick={cancelEdit}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  {note.title && <h3>{note.title}</h3>}
                  <p>{note.content}</p>
                  <div className="note-meta">
                    {new Date(note.createdAt).toLocaleString('zh-CN')}
                    {note.tags.map((tag) => (
                      <span key={tag.id} className="tag">#{tag.name}</span>
                    ))}
                    <button
                      className="secondary"
                      onClick={() => startEdit(note)}
                    >
                      编辑
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleDelete(note.id)}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
