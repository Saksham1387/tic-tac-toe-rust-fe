"use client"
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE, setToken, setUsername, getUsername, isAuthenticated } from '@/lib/auth';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      router.push('/');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Invalid credentials');
      }

      const data = await res.json();
      setToken(data.token);
      
      // Keep existing username if available (from signup)
      // If not, use email prefix as fallback
      const storedUsername = getUsername();
      if (!storedUsername) {
        setUsername(email.split('@')[0]);
      }
      
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-black mb-4">
            <span className="text-2xl font-bold">×</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TIC TAC TOE</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to play</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-border bg-white text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {error && (
            <div className="text-sm text-black bg-muted border border-border p-3 animate-scale-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white text-sm font-medium hover:bg-neutral-800 disabled:bg-neutral-400 transition-colors"
          >
            {loading ? '...' : 'Sign In'}
          </button>
        </form>

        {/* Link to signup */}
        <div className="mt-6 text-center">
          <Link
            href="/signup"
            className="text-sm text-muted-foreground hover:text-black transition-colors"
          >
            Don&apos;t have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
