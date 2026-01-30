import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../services/api';
import type { Company, LoginResponse, MeResponse, UserPermissions } from '../services/types';

type AuthState = {
  token: string | null;
  userId: number | null;
  email: string | null;
  companies: Company[];
  companyId: number | null;
  companyName: string | null;
  permissions: UserPermissions | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<LoginResponse>;
  selectCompany: (companyId: number) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LS_TOKEN = 'auth_token';
const LS_EMAIL = 'auth_email';
const LS_USER_ID = 'auth_user_id';
const LS_COMPANY_ID = 'auth_company_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(LS_TOKEN);
    const email = localStorage.getItem(LS_EMAIL);
    const userIdRaw = localStorage.getItem(LS_USER_ID);
    const companyIdRaw = localStorage.getItem(LS_COMPANY_ID);
    return {
      token: token || null,
      email: email || null,
      userId: userIdRaw ? Number(userIdRaw) : null,
      companies: [],
      companyId: companyIdRaw ? Number(companyIdRaw) : null,
      companyName: null,
      permissions: null,
      isLoading: Boolean(token),
    };
  });

  const refreshMe = async (): Promise<MeResponse | null> => {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return null;
    try {
      const me = await apiClient.getCurrentUser();
      setState((s) => ({
        ...s,
        token,
        userId: me.user_id,
        email: me.email,
        companyId: (me.company_id ?? null) as number | null,
        companyName: (me.company_name ?? null) as string | null,
        permissions: (me.permissions ?? null) as UserPermissions | null,
        isLoading: false,
      }));
      return me;
    } catch {
      // invalid session token
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_USER_ID);
      localStorage.removeItem(LS_COMPANY_ID);
      setState((s) => ({
        ...s,
        token: null,
        email: null,
        userId: null,
        companies: [],
        companyId: null,
        companyName: null,
        permissions: null,
        isLoading: false,
      }));
      return null;
    }
  };

  useEffect(() => {
    void refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for session expiration events from API client
  useEffect(() => {
    const handleSessionExpired = () => {
      setState({
        token: null,
        email: null,
        userId: null,
        companies: [],
        companyId: null,
        companyName: null,
        permissions: null,
        isLoading: false,
      });
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.login(email, password);
    localStorage.setItem(LS_TOKEN, res.token);
    localStorage.setItem(LS_EMAIL, res.email);
    localStorage.setItem(LS_USER_ID, String(res.user_id));
    // companyId chosen later
    localStorage.removeItem(LS_COMPANY_ID);

    setState((s) => ({
      ...s,
      token: res.token,
      email: res.email,
      userId: res.user_id,
      companies: res.companies || [],
      companyId: null,
      companyName: null,
      permissions: null,
      isLoading: false,
    }));
    return res;
  };

  const selectCompany = async (companyId: number): Promise<void> => {
    const res = await apiClient.selectCompany(companyId);
    localStorage.setItem(LS_COMPANY_ID, String(res.company_id));
    setState((s) => ({
      ...s,
      companyId: res.company_id,
      companyName: (res.company_name ?? null) as string | null,
      permissions: res.permissions,
    }));
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout();
    } finally {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_USER_ID);
      localStorage.removeItem(LS_COMPANY_ID);
      setState({
        token: null,
        email: null,
        userId: null,
        companies: [],
        companyId: null,
        companyName: null,
        permissions: null,
        isLoading: false,
      });
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      selectCompany,
      logout,
      refreshMe,
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}


