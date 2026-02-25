import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'flomo-印象',
  description: 'flomo-印象 note app built with Next.js',
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
