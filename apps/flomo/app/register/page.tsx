'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      window.location.href = '/notes';
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.error ?? '注册失败');
    setLoading(false);
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>注册</h1>
      <p className="note-meta">开始积累你的想法。</p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="note-meta" style={{ color: '#b1332b' }}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? '注册中...' : '创建账号'}</button>
      </form>
      <p className="note-meta" style={{ marginTop: 16 }}>
        已有账号？ <Link href="/login">登录</Link>
      </p>
    </div>
  );
}
