'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      window.location.href = '/notes';
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data.error ?? '登录失败');
    setLoading(false);
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>登录</h1>
      <p className="note-meta">欢迎回来，记录灵感。</p>
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
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="note-meta" style={{ color: '#b1332b' }}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
      <p className="note-meta" style={{ marginTop: 16 }}>
        还没有账号？ <Link href="/register">注册</Link>
      </p>
    </div>
  );
}
