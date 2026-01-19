import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LoginPage from './LoginPage';
import CompanySelector from './CompanySelector';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, companyId, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app">
        <main className="app-main" style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: 16, color: 'var(--muted)', fontWeight: 700 }}>Loading…</div>
        </main>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="app">
        <LoginPage />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="app">
        <CompanySelector />
      </div>
    );
  }

  return <>{children}</>;
}


