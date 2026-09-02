// ─── Guests.tsx ──────────────────────────────────────────────────────────────────────
//
// Fetches customers from the API via useCustomers.
// Falls back to local booking data for stay history (GET /api/bookings by customerId).
// darkMode is sourced from useOutletContext.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomers';
import { useBookings } from '@/hooks/useBookings';
import { bookingsApi } from '@/services/api';
import type { Customer, Booking } from '@/types/index';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { formatVnd, getBookingTotal } from '@/utils/format';

export default function Guests() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { customers, loading: customersLoading, refetch } = useCustomers();
  const { bookings: allBookings, refetch: refetchBookings } = useBookings({ autoFetch: true });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [guestBookings, setGuestBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => { refetch(); }, [refetch]);
  useEffect(() => { refetchBookings(); }, [refetchBookings]);

  // When a guest is selected, fetch their bookings
  useEffect(() => {
    if (!selected) { setGuestBookings([]); return; }
    setLoadingBookings(true);
    bookingsApi.get({ customerId: selected.customerId })
      .then(setGuestBookings)
      .catch(() => setGuestBookings([]))
      .finally(() => setLoadingBookings(false));
  }, [selected]);

  const filtered = customers.filter(g => {
    const q = search.toLowerCase();
    return (
      !q ||
      (g.name ?? '').toLowerCase().includes(q) ||
      (g.email?.toLowerCase().includes(q) ?? false) ||
      (g.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const nationalityFlags: Record<string, string> = {
    Nigerian:          '🇳🇬',
    'Chinese-American':'🇨🇳',
    Spanish:           '🇪🇸',
    British:           '🇬🇧',
    Malaysian:          '🇲🇾',
    Swedish:           '🇸🇪',
    Indian:            '🇮🇳',
    Brazilian:          '🇧🇷',
  };

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8'  : '#64748B';
  const border     = darkMode ? '#334155'  : '#E2E8F0';
  const bg          = darkMode ? '#1E293B' : '#fff';

  const cardBase = {
    background: bg, borderRadius: 12, border: `1px solid ${border}`,
    padding: '18px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Search bar */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guests by name, email, phone..."
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${border}`,
            background: darkMode ? '#0F172A' : '#F8FAFC',
            color: textPrimary, fontSize: 13,
            fontFamily: "var(--font-sans)", outline: 'none',
          }}
        />
        <span style={{ fontSize: 13, color: textMuted }}>
          {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Guest cards */}
      {customersLoading && customers.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading guests…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(g => {
            const gBookings = allBookings.filter(b => b.customerId === g.customerId);
            const totalSpent = gBookings.reduce((s, b) => s + getBookingTotal(b), 0);
            const totalBookings = gBookings.length;
            const displayName = g.name ?? '(chưa đặt tên)';
            const initials = displayName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
            const flag = nationalityFlags[''] ?? '🌐';

            return (
              <div
                key={g.customerId}
                onClick={() => setSelected(g)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
                style={cardBase}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 99, flexShrink: 0,
                    background: `hsl(${displayName.charCodeAt(0) * 37 % 360}, 65%, 55%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 15, fontWeight: 700,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: textPrimary, fontSize: 14 }}>{displayName}</div>
                    <div style={{ fontSize: 12, color: textMuted }}>{flag} Guest</div>
                  </div>
                  {totalBookings >= 4 && (
                    <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                      Loyal
                    </span>
                  )}
                </div>
                {g.email && <div style={{ fontSize: 12, color: textMuted, marginBottom: 4 }}>📧 {g.email}</div>}
                {g.phone && <div style={{ fontSize: 12, color: textMuted, marginBottom: 12 }}>📱 {g.phone}</div>}
                <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: `1px solid ${border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>{totalBookings}</div>
                    <div style={{ fontSize: 11, color: textMuted }}>Bookings</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981', fontFamily: "'DM Serif Display', serif" }}>{formatVnd(totalSpent)}</div>
                    <div style={{ fontSize: 11, color: textMuted }}>Total</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guest detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? selected?.customerId ?? ''}
        width={560}
        darkMode={darkMode}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Email',          selected.email ?? '—'],
                ['Phone',          selected.phone ?? '—'],
                ['Note',           selected.note ?? '—'],
                ['Bookings',       `${guestBookings.length}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: textMuted, marginBottom: 2, fontWeight: 600 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: textMuted, marginBottom: 10 }}>
                STAY HISTORY
              </div>
              {loadingBookings ? (
                <p style={{ color: textMuted, fontSize: 13 }}>Loading…</p>
              ) : guestBookings.length === 0 ? (
                <p style={{ color: textMuted, fontSize: 13 }}>No bookings found</p>
              ) : guestBookings.map(b => (
                <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                      Room {b.roomId.slice(-3)}
                    </div>
                    <div style={{ fontSize: 11, color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {b.checkInAt.slice(0, 10)} → {b.expectedCheckOutAt.slice(0, 10)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={b.status} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{formatVnd(getBookingTotal(b))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
