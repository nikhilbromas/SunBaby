import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-100 flex md:items-center md:justify-center">
      <Card className="w-full min-h-screen md:min-h-0 md:max-w-md bg-white border border-neutral-200 shadow-lg rounded-none md:rounded-xl">
        <CardContent className="p-6 sm:p-8 flex flex-col justify-center min-h-screen md:min-h-0 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-black">
              Welcome Back
            </h1>
            <p className="text-sm text-neutral-600">
              Sign in to your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-black">Email</Label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-neutral-300 focus:border-black focus:ring-black"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-black">Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-neutral-300 focus:border-black focus:ring-black"
              />
            </div>

            {error && (
              <div className="text-sm text-black bg-neutral-100 border border-neutral-300 p-2 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-black text-white hover:bg-neutral-800"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-xs text-center text-neutral-500 mt-6">
            © 2026 Your Company
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
