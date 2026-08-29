// ─── Login page ─────────────────────────────────────────────────────────────────────
//
// Public page — no authentication required.
// Shows a login form; on success, redirects to /app/dashboard.
//
// This component is intentionally minimal — it does NOT use the app shell
// (no Sidebar/TopBar) so it can serve as a standalone auth screen.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/app/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Please try again.');
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
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 24,
          }}>
            🏠
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1E293B', fontFamily: "'DM Serif Display', serif" }}>
            Homestay Manager
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B' }}>
            Sign in to your admin dashboard
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
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="staff@example.com"
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
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Password
            </label>
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
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#2563EB')}
              onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
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
              background: loading ? '#93C5FD' : '#2563EB',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              transition: 'background 0.15s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
            Quick Demo Logins:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@homestay.local');
                setPassword('admin123');
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 12,
                fontWeight: 600,
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Admin Demo
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('staff@homestay.local');
                setPassword('staff123');
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 12,
                fontWeight: 600,
                background: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Staff Demo
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 16 }}>
          Staff accounts are managed by your administrator.
        </p>
      </div>
    </div>
  );
}
