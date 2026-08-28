// ─── Timeline.tsx ──────────────────────────────────────────────────────────────
//
// Resource Timeline (resource view):
//   - Y-axis (rows)  = rooms fetched from GET /api/rooms
//   - X-axis (cols)  = calendar days, navigable via Prev / Today / Next
//   - Bookings are drawn as absolutely-positioned blocks inside each row,
//     positioned by their checkInAt (left edge) and expectedCheckOutAt
//     (right edge, EXCLUSIVE — checkout day does not count toward occupancy).
//   - Same-day hourly bookings render as a narrower block on their single day.
//
// All data is live: useRooms + useBookings hit the real API.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRooms } from '@/hooks/useRooms';
import { useBookings } from '@/hooks/useBookings';
import type { Booking, Room } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

interface TimelineProps { darkMode: boolean; }

// ── Layout constants ──────────────────────────────────────────────────────────
const ROW_H        = 78;   // per-row height
const HEADER_H     = 56;   // top header bar
const DAY_HEADER_H = 44;   // day-column header
const LABEL_W      = 168;  // left "room" label column width
const DAY_MIN_W    = 96;   // each day column minimum width
const DEFAULT_DAYS = 14;   // visible window in days

// ── Date helpers (local time, matches the rest of the UI) ─────────────────────
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return ymd(new Date(y, m - 1, d + days));
}
function todayStr(): string { return ymd(new Date()); }
function shortDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]!;
}
function dayOfMonthLabel(dateStr: string): string {
  const [, , d] = dateStr.split('-');
  return d!;
}
function monthYearLabel(startStr: string, endStr: string): string {
  const [, sm] = startStr.split('-');
  const [, em, ey] = endStr.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sLabel = `${MONTHS[Number(sm) - 1]!}`;
  const eLabel = `${MONTHS[Number(em) - 1]!} ${ey}`;
  return sLabel === eLabel.split(' ')[0] ? eLabel : `${sLabel} → ${eLabel}`;
}
function fmtTime(iso: string): string {
  // "2026-08-28T14:00:00+07:00" → "14:00"
  return iso.slice(11, 16);
}

// ── Booking → block geometry ─────────────────────────────────────────────────
// Given a day window [windowStart, windowEnd) and a booking, compute:
//   - leftOffset (0..1) within the window
//   - widthFraction (0..1) of the window
// Both are relative to the visible window so we can render with `left:%` / `width:%`.
function bookingBlock(
  b: Booking,
  windowStart: string,
  windowEnd: string,
): { leftPct: number; widthPct: number; visible: boolean } | null {
  const cinDate  = b.checkInAt.slice(0, 10);
  const coutDate = b.expectedCheckOutAt.slice(0, 10);

  // Visible window for the booking: intersect [cinDate, coutDate) with [windowStart, windowEnd).
  // expectedCheckOutAt is EXCLUSIVE — checkout day does not count toward occupancy.
  const segStart = cinDate  > windowStart ? cinDate  : windowStart;
  const segEnd   = coutDate < windowEnd   ? coutDate : windowEnd;
  if (segStart >= segEnd) return null; // entirely outside the window

  const totalDays = daysBetween(windowStart, windowEnd);
  const startOffset = daysBetween(windowStart, segStart);
  const lenDays     = daysBetween(segStart, segEnd);

  return {
    leftPct:  (startOffset / totalDays) * 100,
    widthPct: (lenDays     / totalDays) * 100,
    visible:  true,
  };
}
function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number) as [number, number, number];
  const [yb, mb, db] = b.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(ya, ma - 1, da);
  const me = Date.UTC(yb, mb - 1, db);
  return Math.round((me - ms) / 86_400_000);
}

// ── Status → color ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  inquiry:     { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6' },
  confirmed:   { bg: '#ECFDF5', border: '#10B981', text: '#065F46' },
  checked_in:  { bg: '#EFF6FF', border: '#2563EB', text: '#1E40AF' },
  checked_out: { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' },
  cancelled:   { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
  no_show:     { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
};
function colorsFor(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Timeline() {
  const { darkMode } = useOutletContext<TimelineProps>();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const { bookings, loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const [windowStart, setWindowStart] = useState<string>(() => todayStr());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    refetchRooms();
    refetchBookings();
  }, [refetchRooms, refetchBookings]);

  const activeRooms = useMemo(
    () => rooms.filter(r => r.status !== 'inactive'),
    [rooms],
  );

  const windowEnd = addDaysStr(windowStart, DEFAULT_DAYS);
  const days = useMemo(
    () => Array.from({ length: DEFAULT_DAYS }, (_, i) => addDaysStr(windowStart, i)),
    [windowStart],
  );

  // Per-row bookings, already filtered to the visible window so we render quickly.
  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const r of activeRooms) map.set(r.roomId, []);
    for (const b of bookings) {
      const coutDate = b.expectedCheckOutAt.slice(0, 10);
      const cinDate  = b.checkInAt.slice(0, 10);
      // Skip cancelled/no_show — they don't occupy the room.
      if (b.status === 'cancelled' || b.status === 'no_show') continue;
      // Skip entries completely outside the window.
      if (coutDate <= windowStart || cinDate >= windowEnd) continue;
      const arr = map.get(b.roomId);
      if (arr) arr.push(b);
    }
    return map;
  }, [bookings, activeRooms, windowStart, windowEnd]);

  const goPrev  = () => setWindowStart(s => addDaysStr(s, -DEFAULT_DAYS));
  const goNext  = () => setWindowStart(s => addDaysStr(s,  DEFAULT_DAYS));
  const goToday = () => setWindowStart(todayStr());

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const bg          = darkMode ? '#1E293B' : '#fff';
  const surface     = darkMode ? '#0B1120' : '#F8FAFC';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8' : '#64748B';
  const border      = darkMode ? '#334155' : '#E2E8F0';
  const headerBg    = darkMode ? '#0F172A' : '#F1F5F9';
  const todayBar    = '#EF4444';

  const isLoading = roomsLoading || bookingsLoading;
  const dayColStyle: React.CSSProperties = {
    minWidth: DAY_MIN_W, flex: '0 0 auto', width: DAY_MIN_W,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: surface }}>
      {/* ── Top header ────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${border}`, background: bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>
              Resource Timeline
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
              {activeRooms.length} rooms · {bookings.filter(b => b.status !== 'cancelled' && b.status !== 'no_show').length} bookings in view
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goPrev}  style={navBtnStyle(border, textPrimary)}>← Prev</button>
            <button onClick={goToday} style={{ ...navBtnStyle(border, textPrimary), background: '#2563EB', color: '#fff', borderColor: '#2563EB' }}>Today</button>
            <button onClick={goNext}  style={navBtnStyle(border, textPrimary)}>Next →</button>
            <div style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${border}`, fontSize: 13, fontWeight: 600, color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
              {monthYearLabel(windowStart, addDaysStr(windowStart, DEFAULT_DAYS - 1))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_COLORS).map(([status, c]) => (
              <span key={status} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: c.border }} />
                {status.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable grid ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && rooms.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading…</div>
        ) : (
          <div style={{ minWidth: LABEL_W + DEFAULT_DAYS * DAY_MIN_W }}>
            {/* Sticky day-column header */}
            <div style={{
              display: 'flex', position: 'sticky', top: 0, zIndex: 10,
              background: headerBg, borderBottom: `1px solid ${border}`,
              height: DAY_HEADER_H,
            }}>
              <div style={{
                width: LABEL_W, flexShrink: 0, padding: '8px 12px',
                fontSize: 11, fontWeight: 700, color: textMuted,
                borderRight: `1px solid ${border}`,
                display: 'flex', alignItems: 'center',
              }}>
                Room
              </div>
              <div style={{ display: 'flex', flex: 1 }}>
                {days.map(d => {
                  const isToday = d === todayStr();
                  return (
                    <div key={d} style={{
                      ...dayColStyle,
                      padding: '6px 8px',
                      borderRight: `1px solid ${border}`,
                      background: isToday
                        ? (darkMode ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.08)')
                        : 'transparent',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: 10, color: textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                        {shortDayLabel(d)}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        color: isToday ? '#2563EB' : textPrimary,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {dayOfMonthLabel(d)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* One row per active room */}
            {activeRooms.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>
                No active rooms. Add a room to see the timeline.
              </div>
            )}

            {activeRooms.map(room => (
              <RoomRow
                key={room.roomId}
                room={room}
                days={days}
                bookings={bookingsByRoom.get(room.roomId) ?? []}
                windowStart={windowStart}
                windowEnd={windowEnd}
                onSelect={setSelectedBooking}
                styles={{ border, bg, textPrimary, textMuted, todayBar, todayStr: todayStr() }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Booking detail modal ──────────────────────────────────────────── */}
      <Modal
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title="Booking Details"
        darkMode={darkMode}
        width={520}
      >
        {selectedBooking && (
          <BookingDetail
            booking={selectedBooking}
            room={rooms.find(r => r.roomId === selectedBooking.roomId)}
            textPrimary={textPrimary}
            textMuted={textMuted}
            border={border}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface RoomRowProps {
  room: Room;
  days: string[];
  bookings: Booking[];
  windowStart: string;
  windowEnd: string;
  onSelect: (b: Booking) => void;
  styles: { border: string; bg: string; textPrimary: string; textMuted: string; todayBar: string; todayStr: string };
}

function RoomRow({ room, days, bookings, windowStart, windowEnd, onSelect, styles }: RoomRowProps) {
  const todayColIndex = days.indexOf(styles.todayStr);
  const todayOffsetPct = todayColIndex >= 0
    ? ((todayColIndex + 0.5) / days.length) * 100
    : null;

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${styles.border}` }}>
      {/* Room label */}
      <div style={{
        width: 168, flexShrink: 0, padding: '10px 14px',
        background: styles.bg, borderRight: `1px solid ${styles.border}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: styles.textPrimary }}>{room.name}</div>
        <div style={{ fontSize: 10, color: styles.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {room.status.replace('_', ' ')} · cap {room.capacity}
        </div>
      </div>

      {/* Track area */}
      <div style={{ flex: 1, position: 'relative', height: ROW_H, overflow: 'hidden' }}>
        {/* Vertical day gridlines */}
        {days.map((d, i) => (
          <div
            key={d}
            style={{
              position: 'absolute',
              left: `${(i / days.length) * 100}%`,
              top: 0, bottom: 0,
              width: `${(1 / days.length) * 100}%`,
              borderRight: `1px solid ${styles.border}55`,
              background: d === styles.todayStr
                ? 'rgba(37,99,235,0.04)'
                : 'transparent',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Today marker */}
        {todayOffsetPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${todayOffsetPct}%`,
            top: 0, bottom: 0,
            width: 2,
            background: styles.todayBar,
            opacity: 0.6,
            zIndex: 4,
            pointerEvents: 'none',
          }} />
        )}

        {/* Booking blocks */}
        {bookings.map(b => {
          const geom = bookingBlock(b, windowStart, windowEnd);
          if (!geom) return null;
          const colors = colorsFor(b.status);
          const sameDay = b.checkInAt.slice(0, 10) === b.expectedCheckOutAt.slice(0, 10);

          return (
            <div
              key={b.bookingId}
              onClick={() => onSelect(b)}
              title={`${b.status} · ${b.checkInAt} → ${b.expectedCheckOutAt}`}
              style={{
                position: 'absolute',
                left: `${geom.leftPct}%`,
                width: `calc(${geom.widthPct}% - 4px)`,
                top: 8, bottom: 8,
                marginLeft: 2,
                borderRadius: 6,
                background: colors.bg,
                border: `1.5px solid ${colors.border}`,
                padding: '4px 8px',
                cursor: 'pointer',
                zIndex: 2,
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 700, color: colors.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {sameDay ? `Hourly ${fmtTime(b.checkInAt)}–${fmtTime(b.expectedCheckOutAt)}` : `${fmtTime(b.checkInAt)} → ${fmtTime(b.expectedCheckOutAt)}`}
              </div>
              <div style={{
                fontSize: 10, color: colors.text, opacity: 0.8,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                Guest {b.customerId.slice(-4)} · {b.numGuests ?? 1}g
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingDetail({
  booking, room, textPrimary, textMuted, border,
}: {
  booking: Booking;
  room: Room | undefined;
  textPrimary: string; textMuted: string; border: string;
}) {
  const sameDay = booking.checkInAt.slice(0, 10) === booking.expectedCheckOutAt.slice(0, 10);
  const rows: Array<[string, string]> = [
    ['Booking ID', booking.bookingId],
    ['Customer ID', booking.customerId],
    ['Room', room?.name ?? booking.roomId],
    ['Check-in', `${booking.checkInAt.slice(0, 10)} ${fmtTime(booking.checkInAt)}`],
    ['Check-out', `${booking.expectedCheckOutAt.slice(0, 10)} ${fmtTime(booking.expectedCheckOutAt)} ${sameDay ? '(same day)' : '(checkout day exclusive)'}`],
    ['Guests', String(booking.numGuests ?? 1)],
    ['Source', booking.source],
    ['Rate Plan', booking.ratePlanId],
    ['Total', vnd.format(booking.totalAmount)],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
          <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>{k}</span>
          <span style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <StatusBadge status={booking.status} />
    </div>
  );
}

function navBtnStyle(border: string, color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${border}`,
    color,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  };
}
