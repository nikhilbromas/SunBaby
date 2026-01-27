import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Company } from '../../services/types';
import './Auth.css';

interface PermissionBadgeProps {
  icon: string;
  label: string;
  enabled: boolean;
}

function PermissionBadge({ icon, label, enabled }: PermissionBadgeProps) {
  return (
    <span
      className={`auth-permission-badge ${enabled ? 'active' : 'disabled'}`}
      title={label}
      aria-label={`${label}: ${enabled ? 'enabled' : 'disabled'}`}
    >
      <span className="auth-permission-icon">{icon}</span>
      <span className="auth-permission-label">{label}</span>
    </span>
  );
}

function PermissionBadges({ permissions }: { permissions: Company['Permissions'] }) {
  const badges = [
    { icon: '📋', label: 'Presets', enabled: permissions.AllowPreset },
    { icon: '📝', label: 'Templates', enabled: permissions.AllowTemplate },
    { icon: '👁️', label: 'Preview', enabled: permissions.AllowPreview },
    { icon: '⚙️', label: 'Template Config', enabled: permissions.AllowTemplateConfig },
  ].filter(badge => badge.enabled);

  if (badges.length === 0) {
    return (
      <div className="auth-permissions" role="group" aria-label="Company permissions">
        <span className="auth-permission-badge disabled" title="No permissions">
          <span className="auth-permission-icon">🔒</span>
          <span className="auth-permission-label">No permissions</span>
        </span>
      </div>
    );
  }

  return (
    <div className="auth-permissions" role="group" aria-label="Company permissions">
      {badges.map((badge) => (
        <PermissionBadge
          key={badge.label}
          icon={badge.icon}
          label={badge.label}
          enabled={badge.enabled}
        />
      ))}
    </div>
  );
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
                <PermissionBadges permissions={c.Permissions} />
                {loadingId === c.CompanyId && <div className="auth-company-status">Connecting…</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


