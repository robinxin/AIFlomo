import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Flomo Clone',
  description: 'Minimal flomo clone built with Next.js',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand">flomo</div>
            <span className="brand-sub">Quick thoughts, organized</span>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
