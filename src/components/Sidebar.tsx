import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '⊞' },
  { id: 'bookings',     label: 'Bookings',     icon: '📋' },
  { id: 'rooms',        label: 'Rooms',        icon: '🛏' },
  { id: 'calendar',      label: 'Calendar',     icon: '📅' },
  { id: 'timeline',      label: 'Timeline',      icon: '⏱' },
  { id: 'guests',        label: 'Guests',       icon: '👥' },
  { id: 'housekeeping', label: 'Housekeeping',  icon: '🧹' },
  { id: 'reports',      label: 'Reports',      icon: '📊' },
  { id: 'expenses',      label: 'Expenses',      icon: '💳' },
  { id: 'notifications',label: 'Notifications', icon: '🔔' },
  { id: 'settings',     label: 'Settings',      icon: '⚙️' },
];

interface SidebarProps {
  activePage: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Staff';

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <aside
      style={{
        width: collapsed ? 68 : 228,
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #2563EB, #10B981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 16, fontWeight: 700, color: '#fff',
        }}>S</div>
        {!collapsed && (
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>StayOS</div>
            <div style={{ color: '#64748B', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>Homestay Suite</div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: '#475569', fontSize: 14, padding: 4, borderRadius: 6,
            flexShrink: 0,
            display: collapsed ? 'none' : 'flex',
          }}
        >⟨</button>
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 14, padding: '12px 0', textAlign: 'center' }}
        >⟩</button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(37,99,235,0.18)' : 'transparent',
                color: active ? '#60A5FA' : '#94A3B8',
                fontFamily: "'Outfit', sans-serif",
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
                width: '100%',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#CBD5E1'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = active ? '#60A5FA' : '#94A3B8'; }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 99, flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}>{initials}</div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? 'Unknown'}
            </div>
            <div style={{ color: '#475569', fontSize: 11 }}>{roleLabel}</div>
          </div>
        )}
      </div>

      {/* Logout button — appears when not collapsed */}
      {!collapsed && (
        <button
          onClick={handleLogout}
          style={{
            margin: '4px 12px 12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#FCA5A5',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 'calc(100% - 24px)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'; (e.currentTarget as HTMLElement).style.color = '#FCA5A5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#FCA5A5'; }}
        >
          <span>🚪</span>
          <span>Sign out</span>
        </button>
      )}
    </aside>
  );
}
