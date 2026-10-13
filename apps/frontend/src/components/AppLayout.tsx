import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { ReactNode } from 'react';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Topbar />
        <main className="page-content" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
