// ─── CalendarView.tsx ──────────────────────────────────────────────────────────────
//
// Calendar view — fetches bookings from the API via useBookings.
// darkMode is sourced from useOutletContext.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useCustomers } from '@/hooks/useCustomers';
import type { Booking } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { formatVnd, getBookingTotal, formatStatusLabel } from '@/utils/format';
import { bookingBlock } from '@/utils/timelineGeometry';
import QuickEditModal from '@/components/QuickEditModal';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarView() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { bookings, loading, refetch, cancelBooking, checkOutBooking, updateStatus } = useBookings();
  const { rooms, refetch: refetchRooms } = useRooms();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { refetch(); }, [refetch]);
  useEffect(() => { refetchRooms(); }, [refetchRooms]);
  useEffect(() => { refetchCustomers(); }, [refetchCustomers]);

  const roomMap = useMemo(() => new Map(rooms.map(r => [r.roomId, r.name])), [rooms]);
  const customerMap = useMemo(() => new Map(customers.map(c => [(c.customerId || '').trim(), c.name])), [customers]);

  const getRoomName = (roomId: string) => roomMap.get(roomId) || roomId;
  const getCustomerName = (b: Booking) => customerMap.get((b.customerId || '').trim()) || b.guestName || b.customerId;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Bookings that can still be cancelled by the user.
  const canCancel = (b: Booking) =>
    b.status === 'inquiry' || b.status === 'confirmed';

  const handleCancel = async (id: string) => {
    try {
      await cancelBooking(id);
      setSelectedBooking(null);
      setConfirmCancel(null);
      showToast('Booking cancelled — room is now available');
    } catch {
      showToast('Failed to cancel booking');
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      const ok = await updateStatus(id, 'checked_in');
      if (ok) {
        setSelectedBooking(null);
        showToast('Guest checked in successfully');
      }
    } catch {
      showToast('Failed to check in guest');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      const res = await checkOutBooking(id);
      setSelectedBooking(null);
      showToast(res.overtimeAmount > 0 ? `Đã check-out — phụ thu quá giờ ${formatVnd(res.overtimeAmount)}` : 'Check-out thành công');
    } catch {
      showToast('Check-out thất bại');
    }
  };

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8'  : '#64748B';
  const border     = darkMode ? '#334155'  : '#E2E8F0';
  const bg          = darkMode ? '#1E293B' : '#fff';
  const cellBg     = darkMode ? '#0F172A' : '#F8FAFC';

  const activeRooms = useMemo(() => rooms.filter(r => r.status !== 'inactive'), [rooms]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay   = getFirstDayOfWeek(year, month);
  const today      = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Bookings intersecting this month, after the room filter. Used for block geometry.
  const monthBookings = useMemo(() => {
    const monthStart = `${year}-${pad(month + 1)}-01`;
    const monthEnd   = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;
    const wStart = new Date(`${monthStart}T00:00:00`).getTime();
    const wEnd   = new Date(`${monthEnd}T00:00:00`).getTime() + 24 * 60 * 60 * 1000; // exclusive next-day midnight
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      if (selectedRoomId !== 'all' && b.roomId !== selectedRoomId) return false;
      const cin  = new Date(b.checkInAt).getTime();
      const cout = new Date(b.expectedCheckOutAt).getTime();
      return cin < wEnd && cout > wStart;
    });
  }, [bookings, selectedRoomId, year, month, daysInMonth]);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const bookingColors: Record<string, string> = {
    confirmed: '#2563EB', checked_in: '#10B981',
    checked_out: '#94A3B8', cancelled: '#EF4444', no_show: '#F59E0B',
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: '#1E293B', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={prev} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: textPrimary, fontSize: 14 }}>←</button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif", minWidth: 200, textAlign: 'center' }}>
          {MONTHS[month]} {year}
        </h2>
        <button onClick={next} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: textPrimary, fontSize: 14 }}>→</button>
        <select
          value={selectedRoomId}
          onChange={e => setSelectedRoomId(e.target.value)}
          aria-label="Filter by room"
          style={{
            background: 'transparent',
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12, fontWeight: 600,
            color: textPrimary,
            cursor: 'pointer',
            fontFamily: 'inherit',
            minWidth: 160,
          }}
        >
          <option value="all">All rooms ({activeRooms.length})</option>
          {activeRooms.map(r => (
            <option key={r.roomId} value={r.roomId}>{r.name}</option>
          ))}
        </select>
        <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} style={{ marginLeft: 'auto', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {Object.entries(bookingColors).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v }} />
            {formatStatusLabel(k)}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Header Ngày trong tuần */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${border}`, background: darkMode ? '#0F172A' : '#F1F5F9' }}>
          {DAYS.map((d, di) => {
            const isWeekend = di === 5 || di === 6; // Sat (5) & Sun (6)
            return (
              <div
                key={d}
                style={{
                  padding: '12px 10px',
                  textAlign: 'center',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: isWeekend ? (darkMode ? '#60A5FA' : '#2563EB') : textPrimary,
                  borderRight: di < 6 ? `1px solid ${border}` : 'none',
                  letterSpacing: 0.3,
                }}
              >
                {d}
              </div>
            );
          })}
        </div>

        {loading && bookings.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading…</div>
        )}

        {Array.from({ length: cells.length / 7 }, (_, wi) => {
          const week = cells.slice(wi * 7, wi * 7 + 7);
          const rowStartDate = new Date(year, month, 1 - firstDay + wi * 7);
          const rowEndDate   = new Date(year, month, 1 - firstDay + wi * 7 + 7);
          const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const weekStartStr = fmt(rowStartDate);
          const weekEndStr   = fmt(rowEndDate);

          // Lấy đúng toạ độ thời gian gốc theo phút (Timeline Geometry)
          const weekBlocks = (weekStartStr && weekEndStr)
            ? monthBookings
                .map(b => ({ b, geom: bookingBlock(b, weekStartStr, weekEndStr) }))
                .filter((x): x is { b: Booking; geom: { leftPct: number; widthPct: number } } => x.geom !== null)
            : [];

          // Xếp lane thông minh để không đè lên nhau
          const laneCount = (() => {
            const lanes: number[] = [];
            const blockLanes = new Map<string, number>();
            for (const { b } of weekBlocks) {
              const start = new Date(b.checkInAt).getTime();
              const realEnd = new Date(b.expectedCheckOutAt).getTime();
              const visualEnd = Math.max(realEnd, start + 6 * 60 * 60 * 1000);
              
              let lane = lanes.findIndex(endTime => endTime <= start);
              if (lane === -1) { lane = lanes.length; lanes.push(visualEnd); }
              else { lanes[lane] = visualEnd; }
              blockLanes.set(b.bookingId, lane);
            }
            return { total: Math.max(1, lanes.length), blockLanes };
          })();

          const weekHasToday = week.some(d =>
            d !== null && year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
          );
          const ROW_MIN_H = 100;
          const BLOCK_H   = 20;
          const BLOCK_GAP = 3;
          const dayNumReserve = 30;
          const dynamicH = dayNumReserve + Math.max(0, laneCount.total) * (BLOCK_H + BLOCK_GAP) + 8;
          const rowMinH = Math.max(ROW_MIN_H, dynamicH);

          return (
            <div
              key={wi}
              style={{
                position: 'relative',
                borderBottom: wi < cells.length / 7 - 1 ? `1px solid ${border}` : 'none',
                background: weekHasToday ? (darkMode ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.03)') : 'transparent',
                minHeight: rowMinH,
              }}
            >
              {/* Lưới các ô ngày */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', position: 'absolute', inset: 0 }}>
                {week.map((day, di) => {
                  const isToday = day !== null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                  return (
                    <div
                      key={di}
                      style={{
                        borderRight: di < 6 ? `1px solid ${border}` : 'none',
                        background: day ? bg : cellBg,
                        position: 'relative',
                        minHeight: rowMinH,
                      }}
                    >
                      {day && (
                        <div style={{
                          position: 'absolute', top: 6, left: 8,
                          width: 22, height: 22, borderRadius: 99,
                          background: isToday ? '#2563EB' : 'transparent',
                          color: isToday ? '#fff' : textMuted,
                          fontSize: 12, fontWeight: isToday ? 700 : 500,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'JetBrains Mono', monospace",
                          zIndex: 1,
                        }}>
                          {day}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Các khối booking chuẩn toạ độ giờ gốc */}
              {weekBlocks.map(({ b, geom }) => {
                const color = bookingColors[b.status] ?? '#94A3B8';
                const lane = laneCount.blockLanes.get(b.bookingId) ?? 0;
                const top = dayNumReserve + lane * (BLOCK_H + BLOCK_GAP);
                const isOverdue = (b.status === 'confirmed' || b.status === 'checked_in')
                  && new Date(b.expectedCheckOutAt).getTime() < today.getTime();
                const fmtDate = (iso: string) => {
                  try {
                    const [date, time] = iso.split('T');
                    const [, m, d] = date.split('-');
                    const hhmm = time.slice(0, 5);
                    return `${hhmm} ${d}/${m}`;
                  } catch { return iso; }
                };

                const sameDay = b.checkInAt.slice(0, 10) === b.expectedCheckOutAt.slice(0, 10);
                const colWidthPct = 100 / 7;
                // Giới hạn mép phải của booking trong ngày để không bao giờ vượt qua mép phải của cột ngày đó
                const currentDayCol = Math.floor(geom.leftPct / colWidthPct);
                const maxAllowedPct = sameDay
                  ? Math.max(geom.widthPct, (currentDayCol + 1) * colWidthPct - geom.leftPct - 0.2)
                  : (100 - geom.leftPct - 0.2);

                return (
                  <div
                    key={b.bookingId}
                    onClick={() => setSelectedBooking(b)}
                    title={`${formatStatusLabel(b.status)}${isOverdue ? ' · Quá giờ Checkout' : ''} · ${fmtDate(b.checkInAt)} → ${fmtDate(b.expectedCheckOutAt)}`}
                    style={{
                      position: 'absolute',
                      left: `${geom.leftPct}%`,
                      width: `calc(${geom.widthPct}% - 2px)`,
                      minWidth: sameDay ? 'auto' : 40,
                      maxWidth: `${maxAllowedPct}%`,
                      marginLeft: 1,
                      top,
                      height: BLOCK_H,
                      background: `${color}18`,
                      color: darkMode ? (color === '#1E293B' ? '#E2E8F0' : color) : color,
                      borderLeft: `2.5px solid ${isOverdue ? '#DC2626' : color}`,
                      outline: isOverdue ? '1px dashed #DC2626' : 'none',
                      outlineOffset: -1,
                      borderRadius: '0 4px 4px 0',
                      padding: '0 6px',
                      fontSize: 10.5, fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: `${BLOCK_H - 1}px`,
                      zIndex: 2,
                    }}
                  >
                    {isOverdue && '⚠ '}{getCustomerName(b)} · {getRoomName(b.roomId)} · {b.checkInAt.slice(11, 16)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Booking detail modal */}
      <Modal open={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="Booking Details" darkMode={darkMode}>
        {selectedBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Booking ID', selectedBooking.bookingId],
              ['Customer', getCustomerName(selectedBooking)],
              ['Room', getRoomName(selectedBooking.roomId)],
              ['Check-in', `${selectedBooking.checkInAt.slice(0, 10)} ${selectedBooking.checkInAt.slice(11, 16)}`],
              ['Check-out', `${selectedBooking.expectedCheckOutAt.slice(0, 10)} ${selectedBooking.expectedCheckOutAt.slice(11, 16)}`],
              ['Guests', `${selectedBooking.numGuests ?? 1}`],
              ['Total', formatVnd(getBookingTotal(selectedBooking))],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <StatusBadge status={selectedBooking.status} />
            {canCancel(selectedBooking) && (
              <button
                onClick={() => setConfirmCancel(selectedBooking)}
                style={{
                  marginTop: 4,
                  background: '#FEE2E2', color: '#991B1B',
                  border: '1px solid #FCA5A5', borderRadius: 8,
                  padding: '10px 14px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Cancel Booking
              </button>
            )}
            {['inquiry', 'confirmed', 'checked_in'].includes(selectedBooking.status) && (
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setEditBooking(selectedBooking);
                }}
                style={{
                  marginTop: 4,
                  background: '#DBEAFE', color: '#1D4ED8',
                  border: 'none', borderRadius: 8,
                  padding: '10px 14px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Sửa nhanh
              </button>
            )}
            {(selectedBooking.status === 'inquiry' || selectedBooking.status === 'confirmed') && (
              <button
                onClick={() => handleCheckIn(selectedBooking.bookingId)}
                style={{
                  marginTop: 4,
                  background: '#D1FAE5', color: '#047857',
                  border: 'none', borderRadius: 8,
                  padding: '10px 14px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Check-in
              </button>
            )}
            {selectedBooking.status === 'checked_in' && (
              <button
                onClick={() => handleCheckOut(selectedBooking.bookingId)}
                style={{
                  marginTop: 4,
                  background: '#F59E0B', color: '#fff',
                  border: 'none', borderRadius: 8,
                  padding: '10px 14px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Xác nhận Check-out
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel-confirmation modal — guards the destructive action. */}
      <Modal
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Cancel booking?"
        darkMode={darkMode}
      >
        {confirmCancel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: darkMode ? '#94A3B8' : '#475569' }}>
              This will mark booking <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{confirmCancel.bookingId}</strong> as cancelled and free the room immediately.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmCancel(null)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                  borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', color: darkMode ? '#94A3B8' : '#64748B',
                  fontFamily: 'inherit',
                }}>
                Keep booking
              </button>
              <button
                onClick={() => handleCancel(confirmCancel.bookingId)}
                style={{
                  background: '#EF4444', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Cancel booking
              </button>
            </div>
          </div>
        )}
      </Modal>

      <QuickEditModal
        booking={editBooking}
        guestName={editBooking ? (editBooking.guestName || customerMap.get(editBooking.customerId)) : undefined}
        roomName={editBooking ? roomMap.get(editBooking.roomId) : undefined}
        onClose={() => setEditBooking(null)}
        onSuccess={() => {
          showToast('Đã cập nhật booking thành công');
          refetch();
        }}
        darkMode={darkMode}
      />
    </div>
  );
}
