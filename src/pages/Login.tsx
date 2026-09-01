// ─── Login page ─────────────────────────────────────────────────────────────────────
//
// Public page — no authentication required.
// Shows a login form; on success, redirects to /app/dashboard.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const loginEmail = email.trim();
    const loginPassword = password.trim();

    if (!loginEmail || !loginPassword) {
      setError('Please enter your email and password');
      setLoading(false);
      return;
    }

    try {
      await login(loginEmail, loginPassword);
      navigate('/app/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  }, [email, password, login, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E3A5F 0%, #0F2744 100%)',
      fontFamily: "'Outfit', sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '44px 36px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 24,
            boxShadow: '0 8px 20px rgba(37,99,235,0.25)',
          }}>
            🏠
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1E293B', fontFamily: "'DM Serif Display', serif" }}>
            Homestay Manager
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Sign in to access your administrative dashboard
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: '#991B1B',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={e => handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Email address or Username
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@homestay.local or admin"
              required
              autoFocus
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 14,
                fontFamily: "'Outfit', sans-serif",
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563EB';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                Password
              </label>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 14,
                fontFamily: "'Outfit', sans-serif",
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563EB';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 6,
              transition: 'transform 0.1s, box-shadow 0.15s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 24, marginBottom: 0 }}>
          Protected administrative area · Homestay Management System
        </p>
      </div>
    </div>
  );
}
