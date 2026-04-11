'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jarvis-bg flex items-center justify-center p-4">
      <div className="bg-jarvis-card rounded-lg border border-jarvis-border p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-jarvis-accent mb-2">JARVIS</h1>
          <p className="text-jarvis-text-secondary">Enter your access credentials</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-jarvis-bg border border-jarvis-border rounded-lg text-jarvis-text focus:outline-none focus:ring-2 focus:ring-jarvis-accent focus:border-transparent"
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-6 py-3 bg-jarvis-accent text-jarvis-bg font-medium rounded-lg hover:bg-jarvis-accent/90 focus:outline-none focus:ring-2 focus:ring-jarvis-accent focus:ring-offset-2 focus:ring-offset-jarvis-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Authenticating...' : 'Enter Jarvis'}
          </button>
        </form>
      </div>
    </div>
  );
}