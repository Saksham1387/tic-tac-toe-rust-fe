"use client"
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE, setToken, setUsername as storeUsername, isAuthenticated } from '@/lib/auth';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      router.push('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign up
      const signupRes = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });

      if (!signupRes.ok) {
        const data = await signupRes.json();
        throw new Error(data.message || 'Signup failed');
      }

      // Then sign in
      const signinRes = await fetch(`${API_BASE}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!signinRes.ok) {
        const data = await signinRes.json();
        throw new Error(data.message || 'Signin failed');
      }

      const data = await signinRes.json();
      setToken(data.token);
      storeUsername(username);
      
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
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
          <p className="text-muted-foreground text-sm mt-1">Create your account</p>
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
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
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
              minLength={6}
              autoComplete="new-password"
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
            {loading ? '...' : 'Create Account'}
          </button>
        </form>

        {/* Link to signin */}
        <div className="mt-6 text-center">
          <Link
            href="/signin"
            className="text-sm text-muted-foreground hover:text-black transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
