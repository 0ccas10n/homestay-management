// ─── Housekeeping.tsx ──────────────────────────────────────────────────────────────
//
// Uses useCleaning for real data from the API.
// Status transitions call the API and update local state.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCleaning } from '@/hooks/useCleaning';
import { roomsApi } from '@/services/api';
import type { CleaningTask } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';

export default function Housekeeping() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { tasks, loading, refetch, transition } = useCleaning();
  const [filter, setFilter] = useState<'All' | 'pending' | 'in_progress' | 'completed'>('All');
  const [toast, setToast] = useState<string | null>(null);
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});

  useEffect(() => { refetch(); }, [refetch]);

  // Fetch room names for display
  useEffect(() => {
    roomsApi.getInternal().then(rooms => {
      const map: Record<string, string> = {};
      for (const r of rooms) map[r.roomId] = r.name;
      setRoomNames(map);
    }).catch(() => {});
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleTransition = async (id: string, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      await transition(id, status);
      showToast(`Task updated to ${status}`);
    } catch {
      showToast('Failed to update task');
    }
  };

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter);

  const stats = [
    { label: 'Waiting', count: tasks.filter(t => t.status === 'pending').length, color: '#EF4444' },
    { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: '#F59E0B' },
    { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: '#10B981' },
  ];

  const priorityBorder: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };

  const bg = darkMode ? '#1E293B' : '#fff';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: '#1E293B', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: 99, background: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>{s.count}</div>
              <div style={{ fontSize: 12, color: textMuted }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['All', 'pending', 'in_progress', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: "var(--font-sans)",
            background: filter === f ? '#2563EB' : bg,
            color: filter === f ? '#fff' : textMuted,
            border: `1px solid ${filter === f ? '#2563EB' : border}`,
          }}>
            {f === 'All' ? 'All' : f === 'pending' ? 'Waiting' : f === 'in_progress' ? 'In Progress' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Task cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {loading && tasks.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: textMuted }}>Loading tasks…</div>
        ) : filtered.map(t => (
          <div key={t.cleaningId} style={{
            background: bg, borderRadius: 12,
            border: `1px solid ${border}`,
            borderLeft: `4px solid ${priorityBorder[t.priority] ?? '#94A3B8'}`,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>
                  Room {roomNames[t.roomId] ?? t.roomId}
                </div>
                <div style={{ fontSize: 11, color: textMuted, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {t.scheduledAt}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <StatusBadge status={t.priority} />
                <StatusBadge status={t.status} />
              </div>
            </div>
            {t.note && <div style={{ fontSize: 12, color: textMuted, marginBottom: 12 }}>{t.note}</div>}
            {t.assignedTo && (
              <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 600, marginBottom: 14 }}>
                👤 {t.assignedTo}
              </div>
            )}
            {t.status !== 'completed' && (
              <div style={{ display: 'flex', gap: 6 }}>
                {t.status === 'pending' && (
                  <button onClick={() => handleTransition(t.cleaningId, 'in_progress')}
                    style={{ flex: 1, background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
                    Start Cleaning
                  </button>
                )}
                {t.status === 'in_progress' && (
                  <button onClick={() => handleTransition(t.cleaningId, 'pending')}
                    style={{ background: darkMode ? '#334155' : '#F1F5F9', color: textMuted, border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
                    Pause
                  </button>
                )}
                <button onClick={() => handleTransition(t.cleaningId, 'completed')}
                  style={{ flex: 1, background: '#ECFDF5', color: '#065F46', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
                  Mark Completed ✓
                </button>
              </div>
            )}
            {t.status === 'completed' && (
              <div style={{ background: '#D1FAE5', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#065F46', textAlign: 'center' }}>
                ✓ Cleaning Complete
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: textMuted, fontSize: 14 }}>
            No tasks in this category ✓
          </div>
        )}
      </div>
    </div>
  );
}
