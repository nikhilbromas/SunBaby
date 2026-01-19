import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Company } from '../../services/types';
import './Auth.css';

function permSummary(c: Company): string {
  const p = c.Permissions;
  const parts: string[] = [];
  if (p.AllowPreset) parts.push('Presets');
  if (p.AllowTemplate) parts.push('Templates');
  if (p.AllowPreview) parts.push('Preview');
  return parts.length ? parts.join(', ') : 'No permissions';
}

function formatPhone(c: Company): string | null {
  const raw = (c.PhoneNo ?? '').toString().trim();
  return raw ? raw : null;
}

export default function CompanySelector() {
  const { companies, selectCompany } = useAuth();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSelect = async (companyId: number) => {
    setError(null);
    setLoadingId(companyId);
    try {
      await selectCompany(companyId);
    } catch (err: any) {
      setError(err?.message || 'Failed to select company');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <h2 className="auth-title">Select Company</h2>
        <p className="auth-subtitle">Choose which company you want to work with.</p>
        {error && <div className="auth-error">{error}</div>}
        {companies.length === 0 ? (
          <div className="auth-empty">No companies assigned.</div>
        ) : (
          <div className="auth-company-grid">
            {companies.map((c) => (
              <button
                key={c.CompanyId}
                onClick={() => onSelect(c.CompanyId)}
                disabled={loadingId !== null}
                className="auth-company-btn"
              >
                <div className="auth-company-name">
                  {c.CompanyName || `Company`}
                </div>
                {c.PermanentAddress && <div className="auth-company-meta">{c.PermanentAddress}</div>}
                {c.CompanyDescription && <div className="auth-company-meta">{c.CompanyDescription}</div>}
                {formatPhone(c) && <div className="auth-company-meta">{formatPhone(c)}</div>}
                <div className="auth-company-meta">{permSummary(c)}</div>
                {loadingId === c.CompanyId && <div className="auth-company-status">Connecting…</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


