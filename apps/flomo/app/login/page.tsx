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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" stroke="#2d6a4f" strokeWidth="6" fill="none" />
              <path d="M30 50 L45 50 L55 35 L65 65 L75 50 L85 50" stroke="#2d6a4f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="auth-logo-text">Flomo-印象笔记</span>
          </div>
          <h1 className="auth-title">账号登录</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="手机号 / 邮箱"
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
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="#" className="auth-footer-link">忘记密码</Link>
          <Link href="/register" className="auth-footer-link">立即注册</Link>
        </div>
      </div>
    </div>
  );
}
