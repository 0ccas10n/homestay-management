import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { useBookings } from '@/hooks/useBookings';
import { useCustomers } from '@/hooks/useCustomers';
import { useRooms } from '@/hooks/useRooms';
import { formatVnd, getBookingTotal } from '@/utils/format';
import StatusBadge from '@/components/StatusBadge';

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
  housekeeping: 'Housekeeping',
  reports:      'Reports',
  expenses:     'Expenses',
  notifications:'Notifications',
  settings:     'Settings',
};

export default function TopBar({ activePage, darkMode, onToggleDark, onNavigate, isMobile, onOpenMobileMenu }: TopBarProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { bookings } = useBookings();
  const { customers } = useCustomers();
  const { rooms } = useRooms();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const roomMap = useMemo(() => new Map(rooms.map(r => [r.roomId, r.name])), [rooms]);
  const customerMap = useMemo(() => new Map(customers.map(c => [c.customerId, c.name])), [customers]);

  const customerBookingStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookings) {
      if (b.customerId) {
        counts.set(b.customerId, (counts.get(b.customerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [bookings]);

  // Handle click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = search.trim().toLowerCase();

  const matchingBookings = useMemo(() => {
    if (!query) return [];
    return bookings.filter(b => {
      const gName = (customerMap.get(b.customerId) || (b as any).guestName || '').toLowerCase();
      const bId = (b.bookingId || '').toLowerCase();
      const rName = (roomMap.get(b.roomId) || '').toLowerCase();
      const note = (b.note || '').toLowerCase();
      return gName.includes(query) || bId.includes(query) || rName.includes(query) || note.includes(query);
    }).slice(0, 5);
  }, [bookings, query, customerMap, roomMap]);

  const matchingCustomers = useMemo(() => {
    if (!query) return [];
    return customers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const source = (c.source || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query) || source.includes(query);
    }).slice(0, 4);
  }, [customers, query]);

  const matchingRooms = useMemo(() => {
    if (!query) return [];
    return rooms.filter(r => {
      const name = (r.name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const id = (r.roomId || '').toLowerCase();
      return name.includes(query) || desc.includes(query) || id.includes(query);
    }).slice(0, 3);
  }, [rooms, query]);

  const hasResults = matchingBookings.length > 0 || matchingCustomers.length > 0 || matchingRooms.length > 0;

  const handleSelect = (targetPage: string) => {
    onNavigate(targetPage);
    setIsOpen(false);
    setSearch('');
  };

  const border = darkMode ? '#334155' : '#E2E8F0';
  const dropdownBg = darkMode ? '#1E293B' : '#FFFFFF';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const hoverBg = darkMode ? '#334155' : '#F1F5F9';

  return (
    <header style={{
      height: 60, background: darkMode ? '#1E293B' : '#fff',
      borderBottom: `1px solid ${border}`,
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {PAGE_TITLES[activePage] ?? 'Dashboard'}
        </h1>
        <p style={{ margin: 0, fontSize: 11, color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{today}</p>
      </div>

      {/* Global Search Bar */}
      {!isMobile && (
        <div ref={searchRef} style={{ position: 'relative', maxWidth: 320, width: '100%' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 10, color: '#94A3B8', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder="Tìm khách, phòng, đơn đặt…"
              style={{
                width: '100%', padding: '7px 28px 7px 30px',
                background: darkMode ? '#0F172A' : '#F8FAFC',
                border: `1px solid ${isOpen && query ? '#2563EB' : border}`,
                borderRadius: 8, fontSize: 13, color: textPrimary,
                outline: 'none', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setIsOpen(false); }}
                style={{
                  position: 'absolute', right: 8, background: 'none', border: 'none',
                  color: textMuted, cursor: 'pointer', fontSize: 14, padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Search Results Dropdown */}
          {isOpen && query && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: dropdownBg, border: `1px solid ${border}`,
              borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
              zIndex: 100, maxHeight: 440, overflowY: 'auto', padding: '8px 0',
            }}>
              {!hasResults && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: textMuted, fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
                  Không tìm thấy kết quả cho "{search}"
                </div>
              )}

              {/* Bookings Section */}
              {matchingBookings.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📋 Đơn đặt phòng ({matchingBookings.length})
                  </div>
                  {matchingBookings.map(b => {
                    const guestName = customerMap.get(b.customerId) || (b as any).guestName || 'Khách vãng lai';
                    const roomName = roomMap.get(b.roomId) || b.roomId;
                    return (
                      <div
                        key={b.bookingId}
                        onClick={() => handleSelect('bookings')}
                        style={{
                          padding: '8px 14px', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{guestName}</span>
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: darkMode ? '#334155' : '#E2E8F0', color: textMuted, fontFamily: 'monospace' }}>
                              {b.bookingId}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                            {roomName} · {b.checkInAt.slice(5, 10)} ➔ {b.expectedCheckOutAt.slice(5, 10)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
                            {formatVnd(getBookingTotal(b))}
                          </div>
                          <div style={{ marginTop: 2 }}>
                            <StatusBadge status={b.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Customers / Guests Section */}
              {matchingCustomers.length > 0 && (
                <div style={{ marginBottom: 8, borderTop: matchingBookings.length > 0 ? `1px solid ${border}` : 'none', paddingTop: matchingBookings.length > 0 ? 6 : 0 }}>
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    👤 Khách hàng ({matchingCustomers.length})
                  </div>
                  {matchingCustomers.map(c => {
                    const bCount = customerBookingStats.get(c.customerId) ?? 0;
                    return (
                      <div
                        key={c.customerId}
                        onClick={() => handleSelect('guests')}
                        style={{
                          padding: '8px 14px', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                            {c.name}
                            <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: darkMode ? '#334155' : '#E2E8F0', color: textMuted, fontFamily: 'monospace' }}>
                              {c.customerId}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                            {c.phone || 'Chưa có SĐT'} {c.source ? `· Nguồn: ${c.source}` : ''}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          color: bCount > 0 ? '#10B981' : textMuted,
                        }}>
                          {bCount} lần đặt
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rooms Section */}
              {matchingRooms.length > 0 && (
                <div style={{ borderTop: (matchingBookings.length > 0 || matchingCustomers.length > 0) ? `1px solid ${border}` : 'none', paddingTop: (matchingBookings.length > 0 || matchingCustomers.length > 0) ? 6 : 0 }}>
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🛏️ Phòng ({matchingRooms.length})
                  </div>
                  {matchingRooms.map(r => (
                    <div
                      key={r.roomId}
                      onClick={() => handleSelect('rooms')}
                      style={{
                        padding: '8px 14px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                          {r.description || `Tầng ${r.floor} · Sức chứa ${r.capacity}`}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
