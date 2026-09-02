import { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';

interface TopBarProps {
  activePage: string;
  darkMode: boolean;
  onToggleDark: () => void;
  onNavigate: (id: string) => void;
  isMobile: boolean;
  onOpenMobileMenu: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard:    'Dashboard',
  bookings:     'Bookings',
  rooms:        'Rooms',
  calendar:     'Calendar',
  timeline:     'Daily Timeline',
  guests:       'Guests',
  housekeeping:'Housekeeping',
  reports:      'Reports',
  expenses:     'Expenses',
  notifications:'Notifications',
  settings:     'Settings',
};

export default function TopBar({ activePage, darkMode, onToggleDark, onNavigate, isMobile, onOpenMobileMenu }: TopBarProps) {
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <header style={{
      height: 60, background: darkMode ? '#1E293B' : '#fff',
      borderBottom: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
      display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, padding: isMobile ? '0 12px' : '0 24px',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      {isMobile && (
        <button
          aria-label="Open navigation menu"
          title="Open navigation menu"
          onClick={onOpenMobileMenu}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: darkMode ? '#E2E8F0' : '#334155', fontSize: 20, lineHeight: 1,
          }}
        >
          ☰
        </button>
      )}
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: darkMode ? '#F1F5F9' : '#1E293B' }}>
          {PAGE_TITLES[activePage] ?? 'Dashboard'}
        </h1>
        <p style={{ margin: 0, fontSize: 11, color: darkMode ? '#64748B' : '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{today}</p>
      </div>

      {/* Search */}
      {!isMobile && <div style={{ position: 'relative', maxWidth: 280, width: '100%' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bookings, guests…"
          style={{
            width: '100%', padding: '7px 10px 7px 30px',
            background: darkMode ? '#0F172A' : '#F8FAFC',
            border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
            borderRadius: 8, fontSize: 13, color: darkMode ? '#E2E8F0' : '#1E293B',
            outline: 'none', fontFamily: "'Outfit', sans-serif",
          }}
        />
      </div>}

      {/* Dark mode toggle */}
      <button
        onClick={onToggleDark}
        style={{
          background: darkMode ? '#334155' : '#F1F5F9',
          border: 'none', cursor: 'pointer', borderRadius: 8,
          padding: '7px 10px', fontSize: 14,
        }}
        title="Toggle dark mode"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      {/* Notifications bell */}
      <button
        onClick={() => onNavigate('notifications')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 6, fontSize: 18 }}
      >
        🔔
      </button>

      {/* Avatar — shows user initial from session */}
      <div style={{
        width: 34, height: 34, borderRadius: 99, flexShrink: 0,
        background: 'linear-gradient(135deg, #2563EB, #10B981)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'default',
      }}>{initials}</div>
    </header>
  );
}
