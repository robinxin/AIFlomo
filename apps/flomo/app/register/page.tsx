'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPwd) {
      setError('两次密码不一致');
      return;
    }
    if (!agreed) {
      setError('请先同意用户协议和隐私协议');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname }),
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
          <h1 className="auth-title">账号注册</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="再次输入密码"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            required
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? '注册中...' : '确定'}
          </button>
        </form>

        <label className="auth-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>我已阅读并同意遵守 <a href="#">用户协议</a> 和 <a href="#">隐私协议</a></span>
        </label>

        <div className="auth-footer" style={{ justifyContent: 'center' }}>
          <Link href="/login" className="auth-footer-link">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
