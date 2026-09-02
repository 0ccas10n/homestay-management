// ─── Notifications.tsx ────────────────────────────────────────────────────────────────
//
// Fetches notifications from the API via useNotifications.
// Supports mark-read (single) and mark-all-read actions.
// darkMode is sourced from useOutletContext.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types/index';

const TYPE_ICONS: Record<string, string> = {
  check_in: '🛎', check_out: '🚪', cleaning: '🧹',
  maintenance: '🔧', payment: '💳', late: '⏰',
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  high:   { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
  medium: { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  low:    { bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
};

export default function Notifications() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { notifications, loading, refetch, markRead, markAllRead } = useNotifications();

  useEffect(() => { refetch(); }, [refetch]);

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8'  : '#64748B';
  const border     = darkMode ? '#334155'  : '#E2E8F0';
  const bg          = darkMode ? '#1E293B' : '#fff';

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    try { await markAllRead(); } catch { /* silently handled */ }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{
        background: bg, borderRadius: 12, border: `1px solid ${border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Notification Center</div>
          <div style={{ fontSize: 12, color: textMuted }}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              background: 'none', border: `1px solid ${border}`, borderRadius: 8,
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', color: textMuted,
              fontFamily: "var(--font-sans)",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>
            No notifications
          </div>
        ) : notifications.map(n => {
          const pc = PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.low;
          const icon = TYPE_ICONS[n.type] ?? '🔔';

          return (
            <div
              key={n.notificationId}
              onClick={() => !n.read && markRead(n.notificationId).catch(() => {})}
              style={{
                background: bg, borderRadius: 12,
                border: `1px solid ${n.read ? border : pc.dot + '40'}`,
                padding: '16px 20px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                cursor: 'pointer',
                opacity: n.read ? 0.7 : 1,
                transition: 'opacity 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: n.read ? (darkMode ? '#334155' : '#F1F5F9') : pc.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: n.read ? 500 : 700, color: textPrimary }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {n.time ? new Date(n.time).toLocaleString() : '—'}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: textMuted, marginTop: 3 }}>{n.message}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: pc.dot, opacity: n.read ? 0.3 : 1 }} />
                {!n.read && <span style={{ fontSize: 9, fontWeight: 700, color: '#2563EB' }}>NEW</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
