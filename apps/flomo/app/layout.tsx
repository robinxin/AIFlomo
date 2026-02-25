import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Flomo-印象笔记',
  description: 'Flomo-印象笔记 note app built with Next.js',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <div className="app-shell">
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
