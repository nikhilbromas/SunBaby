import { useState, ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Company } from '../../services/types';

// ======================= UI COMPONENTS =======================
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ClipboardList, FileText, Eye, Settings } from 'lucide-react';

// ======================= PERMISSION BADGE =======================
interface PermissionBadgeProps {
  icon: ReactNode;
  label: string;
  enabled: boolean;
}

function PermissionBadge({ icon, label, enabled }: PermissionBadgeProps) {
  return (
    <Badge
      variant={enabled ? 'default' : 'secondary'}
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium',
        !enabled && 'opacity-50'
      )}
      aria-label={`${label} permission`}
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );
}

// ======================= PERMISSION GROUP =======================
function PermissionBadges({ permissions }: { permissions: Company['Permissions'] }) {
  const badges = [
    { icon: <ClipboardList className="h-3 w-3" />, label: 'Presets', enabled: permissions.AllowPreset },
    { icon: <FileText className="h-3 w-3" />, label: 'Templates', enabled: permissions.AllowTemplate },
    { icon: <Eye className="h-3 w-3" />, label: 'Preview', enabled: permissions.AllowPreview },
    { icon: <Settings className="h-3 w-3" />, label: 'Config', enabled: permissions.AllowTemplateConfig },
  ].filter(b => b.enabled);

  if (badges.length === 0) {
    return (
      <Badge variant="secondary" className="text-[11px]">
        No permissions
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(badge => (
        <PermissionBadge key={badge.label} {...badge} />
      ))}
    </div>
  );
}

// ======================= UTIL =======================
function formatPhone(c: Company): string | null {
  const raw = (c.PhoneNo ?? '').toString().trim();
  return raw || null;
}

// ======================= MAIN COMPONENT =======================
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
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-6 py-8">
      <Card className="w-full max-w-6xl shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-semibold">
            Select Company
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose the company you want to work with
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Empty state */}
          {companies.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No companies assigned to your account
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map(company => (
                <button
                  key={company.CompanyId}
                  onClick={() => onSelect(company.CompanyId)}
                  disabled={loadingId !== null}
                  className={cn(
                    'group relative rounded-xl border bg-background p-5 text-left transition-all',
                    'hover:shadow-lg hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring',
                    loadingId === company.CompanyId &&
                      'opacity-60 pointer-events-none'
                  )}
                >
                  {/* Top accent */}
                  <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-primary/70" />

                  {/* Company info */}
                  <div className="space-y-2">
                    <div className="text-lg font-semibold leading-tight">
                      {company.CompanyName || 'Company'}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {company.PermanentAddress && (
                        <div>{company.PermanentAddress}</div>
                      )}
                      {company.CompanyDescription && (
                        <div>{company.CompanyDescription}</div>
                      )}
                      {formatPhone(company) && (
                        <div>{formatPhone(company)}</div>
                      )}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="mt-4">
                    <PermissionBadges permissions={company.Permissions} />
                  </div>

                  {/* Loading */}
                  {loadingId === company.CompanyId && (
                    <div className="mt-3 text-xs font-medium text-primary">
                      Connecting…
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
