// ─── Timeline.tsx ──────────────────────────────────────────────────────────────
//
// Resource Timeline (resource view):
//   - Y-axis (rows)  = rooms fetched from GET /api/rooms
//   - X-axis (cols)  = calendar days, navigable via Prev / Today / Next / Date
//   - Bookings are drawn as absolutely-positioned blocks inside each row,
//     positioned by their checkInAt (left edge) and expectedCheckOutAt
//     (right edge, EXCLUSIVE — checkout day does not count toward occupancy).
//   - Same-day hourly bookings render as a narrower block on their single day.
//   - Overlapping bookings in the same room stack vertically into "lanes"
//     (computed once per row by `assignLanes` in timelineGeometry.ts).
//   - Block content adapts to width: dot-only → name → name + time → name + time + price.
//
// All data is live: useRooms + useBookings hit the real API.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRooms } from '@/hooks/useRooms';
import { useBookings } from '@/hooks/useBookings';
import { useCustomers } from '@/hooks/useCustomers';
import type { Booking, Room } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { assignLanes, bookingBlock } from '@/utils/timelineGeometry';
import { formatVnd, getBookingTotal, formatStatusLabel } from '@/utils/format';
import { bookingsApi } from '@/services/api';

interface TimelineProps { darkMode: boolean; }

// ── Layout constants ──────────────────────────────────────────────────────────
const LABEL_W      = 184;  // left "room" label column width
const DAY_MIN_W    = 96;   // each day column minimum width
const LANE_H       = 28;   // height of one stacked booking lane
const LANE_GAP     = 4;    // vertical gap between lanes
const ROW_PAD      = 12;   // top/bottom padding inside a room track
const DAY_HEADER_H = 48;   // day-column header height

// Zoom options for the visible window (days).
const ZOOMS: Array<{ days: 7 | 14 | 30; label: string }> = [
  { days: 7,  label: '7 ngày' },
  { days: 14, label: '14 ngày' },
  { days: 30, label: '30 ngày' },
];
const DEFAULT_ZOOM: 7 | 14 | 30 = 14;

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
// Geometry is computed by `src/utils/timelineGeometry.ts` so Timeline and
// CalendarView render identical, minute-precise block positions.

// ── Status → visual treatment ────────────────────────────────────────────────
// The status drives: background fill, border colour, text colour, whether
// the block reads as "active" (solid shadow), "tentative" (dashed border)
// or "disabled" (diagonal stripes + reduced opacity). `checked_in` blocks
// also get a progress fill bar at the bottom of the block.
interface StatusVisual {
  bg: string;
  border: string;
  text: string;
  /** Solid filled — gets elevation shadow. */
  solid: boolean;
  /** Tentative — border is dashed instead of solid. */
  dashed: boolean;
  /** Disabled — overlaid with diagonal stripes + opacity. */
  striped: boolean;
  /** Show elapsed-stay progress bar at bottom. */
  showProgress: boolean;
  /** Override opacity (used by cancelled/no_show). */
  opacity: number;
}

function statusVisual(status: string, darkMode: boolean): StatusVisual {
  const isDark = darkMode;
  const base: StatusVisual = {
    bg: '', border: '', text: '',
    solid: false, dashed: false, striped: false,
    showProgress: false, opacity: 1,
  };
  switch (status) {
    case 'checked_in':
      return {
        ...base,
        bg: isDark ? 'rgba(37,99,235,0.30)' : '#DBEAFE',
        border: '#2563EB',
        text: isDark ? '#DBEAFE' : '#1E40AF',
        solid: true,
        showProgress: true,
      };
    case 'confirmed':
      return {
        ...base,
        bg: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5',
        border: '#10B981',
        text: isDark ? '#6EE7B7' : '#065F46',
        solid: true,
      };
    case 'inquiry':
      return {
        ...base,
        bg: isDark ? 'rgba(139,92,246,0.15)' : '#F5F3FF',
        border: '#8B5CF6',
        text: isDark ? '#C4B5FD' : '#5B21B6',
        dashed: true,
      };
    case 'checked_out':
      return {
        ...base,
        bg: isDark ? '#334155' : '#F1F5F9',
        border: '#94A3B8',
        text: isDark ? '#CBD5E1' : '#475569',
      };
    case 'cancelled':
      return {
        ...base,
        bg: isDark ? 'rgba(239,68,68,0.10)' : '#FEF2F2',
        border: '#EF4444',
        text: isDark ? '#FCA5A5' : '#991B1B',
        striped: true,
        opacity: 0.55,
      };
    case 'no_show':
      return {
        ...base,
        bg: isDark ? 'rgba(245,158,11,0.10)' : '#FFFBEB',
        border: '#F59E0B',
        text: isDark ? '#FCD34D' : '#92400E',
        striped: true,
        opacity: 0.55,
      };
    default:
      return {
        ...base,
        bg: isDark ? '#334155' : '#F1F5F9',
        border: '#94A3B8',
        text: isDark ? '#CBD5E1' : '#475569',
      };
  }
}

/** Progress through a stay, in percent (0–100). */
function progressPct(b: Booking): number {
  const cin = new Date(b.checkInAt).getTime();
  const cout = new Date(b.expectedCheckOutAt).getTime();
  const now = Date.now();
  if (now <= cin) return 0;
  if (now >= cout) return 100;
  return ((now - cin) / (cout - cin)) * 100;
}

/** Compute the real-time lifecycle status of a booking based on current time. */
function getEffectiveBookingStatus(b: Booking): import('@/types/index').BookingStatus {
  if (b.status === 'cancelled' || b.status === 'no_show') {
    return b.status;
  }
  const cinMs = new Date(b.checkInAt).getTime();
  const coutMs = new Date(b.expectedCheckOutAt).getTime();
  const nowMs = Date.now();

  // Đã qua giờ checkout -> Đã trả phòng / Hoàn tất
  if (nowMs >= coutMs) {
    return 'checked_out';
  }
  // Đang trong thời gian ở (checkIn <= now < checkOut) -> Đang ở
  if (nowMs >= cinMs && nowMs < coutMs) {
    return 'checked_in';
  }
  // Tương lai -> Giữ nguyên (confirmed / inquiry)
  return b.status;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Timeline() {
  const { darkMode } = useOutletContext<TimelineProps>();
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useRooms();
  const { bookings, loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [zoom, setZoom] = useState<7 | 14 | 30>(DEFAULT_ZOOM);
  const [windowStart, setWindowStart] = useState<string>(() => addDaysStr(todayStr(), -1));
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    refetchRooms();
    refetchBookings();
    refetchCustomers();
  }, [refetchRooms, refetchBookings, refetchCustomers]);

  const windowDays = zoom;

  // Build lookup maps for names
  const customerMap = useMemo(
    () => new Map<string, string>(
      customers
        .filter((c): c is typeof c & { name: string } => Boolean(c.name))
        .map(c => [c.customerId, c.name as string]),
    ),
    [customers],
  );

  const activeRooms = useMemo(
    () => rooms.filter(r => r.status !== 'inactive'),
    [rooms],
  );

  // Apply the room filter from the toolbar <select>.
  const visibleRooms = useMemo(
    () => selectedRoomId === 'all'
      ? activeRooms
      : activeRooms.filter(r => r.roomId === selectedRoomId),
    [activeRooms, selectedRoomId],
  );

  const windowEnd = addDaysStr(windowStart, windowDays);
  const days = useMemo(
    () => Array.from({ length: windowDays }, (_, i) => addDaysStr(windowStart, i)),
    [windowStart, windowDays],
  );

  // Bookings considered in view (cancelled/no_show are now shown striped
  // for visual context; bookings outside the window are skipped).
  const inViewBookings = useMemo(() => {
    return bookings.filter(b => {
      if (selectedRoomId !== 'all' && b.roomId !== selectedRoomId) return false;
      const coutDate = b.expectedCheckOutAt.slice(0, 10);
      const cinDate  = b.checkInAt.slice(0, 10);
      if (coutDate <= windowStart || cinDate >= windowEnd) return false;
      return true;
    });
  }, [bookings, selectedRoomId, windowStart, windowEnd]);

  // Per-row bookings split: occupied (non-cancelled) for lane stacking,
  // plus cancelled shown striped without affecting lane count.
  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const r of visibleRooms) map.set(r.roomId, []);
    for (const b of inViewBookings) {
      if (b.status === 'cancelled' || b.status === 'no_show') continue;
      const arr = map.get(b.roomId);
      if (arr) arr.push(b);
    }
    return map;
  }, [inViewBookings, visibleRooms]);

  // Top-of-screen stats (only meaningful when no room filter is applied).
  const stats = useMemo(() => {
    const today = todayStr();
    const occupiedRoomIds = new Set<string>();
    let checkingInToday = 0;
    let checkingOutToday = 0;
    let currentlyStaying = 0;

    for (const b of bookings) {
      if (selectedRoomId !== 'all' && b.roomId !== selectedRoomId) continue;
      if (b.status === 'cancelled' || b.status === 'no_show') continue;

      const eff = getEffectiveBookingStatus(b);
      const cinDate  = b.checkInAt.slice(0, 10);
      const coutDate = b.expectedCheckOutAt.slice(0, 10);

      // Đang có khách lưu trú
      if (eff === 'checked_in') {
        occupiedRoomIds.add(b.roomId);
        currentlyStaying++;
      }
      if (cinDate === today)  checkingInToday++;
      if (coutDate === today) checkingOutToday++;
    }

    const total = visibleRooms.length;
    return {
      occupied: occupiedRoomIds.size,
      total,
      occupancyPct: total > 0 ? Math.round((occupiedRoomIds.size / total) * 100) : 0,
      checkingInToday,
      checkingOutToday,
      currentlyStaying,
    };
  }, [bookings, visibleRooms, selectedRoomId]);

  const goPrev  = () => setWindowStart(s => addDaysStr(s, -windowDays));
  const goNext  = () => setWindowStart(s => addDaysStr(s,  windowDays));
  const goToday = () => setWindowStart(addDaysStr(todayStr(), -1));

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const bg          = darkMode ? '#1E293B' : '#fff';
  const surface     = darkMode ? '#0B1120' : '#F8FAFC';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8' : '#64748B';
  const border      = darkMode ? '#334155' : '#E2E8F0';
  const headerBg    = darkMode ? '#0F172A' : '#F1F5F9';
  const statsBg     = darkMode ? '#0B1120' : '#F8FAFC';
  const todayBar    = '#EF4444';

  const isLoading = roomsLoading || bookingsLoading;
  // Day column grows to fill available width (flex: 1) but never shrinks
  // below DAY_MIN_W so the column stays readable on narrow viewports.
  // When the parent has more horizontal space than `totalWidth`, the
  // columns stretch evenly to fill it.
  const dayColStyle: React.CSSProperties = {
    minWidth: DAY_MIN_W, flex: '1 1 0',
  };

  const totalWidth = LABEL_W + windowDays * DAY_MIN_W;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: surface }}>
      {/* ── Toolbar row 1: title + nav + zoom + date picker ─────────────── */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${border}`,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: textPrimary,
            fontFamily: "'DM Serif Display', serif", lineHeight: 1.2,
          }}>
            Resource Timeline
          </div>
          <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
            {visibleRooms.length} phòng · {inViewBookings.length} booking đang hiển thị
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Zoom segmented control */}
          <div style={{
            display: 'inline-flex', gap: 2, padding: 3,
            background: surface, border: `1px solid ${border}`, borderRadius: 9,
          }}>
            {ZOOMS.map(z => {
              const active = zoom === z.days;
              return (
                <button
                  key={z.days}
                  onClick={() => setZoom(z.days)}
                  aria-pressed={active}
                  style={{
                    padding: '5px 11px',
                    border: 'none', borderRadius: 6,
                    background: active ? '#2563EB' : 'transparent',
                    color: active ? '#fff' : textMuted,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'background 0.15s',
                  }}
                >
                  {z.label}
                </button>
              );
            })}
          </div>

          {/* Date picker — jumps the window to any chosen day. */}
          <input
            type="date"
            value={windowStart}
            onChange={e => e.target.value && setWindowStart(e.target.value)}
            aria-label="Chọn ngày bắt đầu"
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: textPrimary,
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12, fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer', outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={goPrev} style={navBtnStyle(border, textPrimary)} aria-label="Lùi">‹</button>
            <button onClick={goToday} style={{ ...navBtnStyle(border, textPrimary), background: '#2563EB', color: '#fff', borderColor: '#2563EB', padding: '6px 14px' }}>Today</button>
            <button onClick={goNext} style={navBtnStyle(border, textPrimary)} aria-label="Tiếp">›</button>
          </div>

          <div style={{
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${border}`, fontSize: 13, fontWeight: 600,
            color: textPrimary, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {monthYearLabel(windowStart, addDaysStr(windowStart, windowDays - 1))}
          </div>
        </div>
      </div>

      {/* ── Toolbar row 2: room filter + legend ─────────────────────────── */}
      <div style={{
        padding: '9px 24px',
        borderBottom: `1px solid ${border}`,
        background: headerBg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10, color: textMuted, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            Phòng
          </span>
          <select
            value={selectedRoomId}
            onChange={e => setSelectedRoomId(e.target.value)}
            aria-label="Lọc theo phòng"
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: textPrimary,
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              minWidth: 180,
            }}
          >
            <option value="all">Tất cả phòng ({activeRooms.length})</option>
            {activeRooms.map(r => (
              <option key={r.roomId} value={r.roomId}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(['inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'] as const).map(status => {
            const v = statusVisual(status, darkMode);
            const swatchBg = v.striped
              ? `repeating-linear-gradient(45deg, ${v.border}33 0, ${v.border}33 3px, transparent 3px, transparent 6px)`
              : v.border;
            return (
              <span key={status} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: textMuted, fontWeight: 500,
              }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: swatchBg,
                  border: `1.5px ${v.dashed ? 'dashed' : 'solid'} ${v.border}`,
                  flexShrink: 0,
                }} />
                {formatStatusLabel(status)}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '9px 24px',
        borderBottom: `1px solid ${border}`,
        background: statsBg,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <StatPill
          icon={<OccupancyIcon color="#2563EB" />}
          label="Tỷ lệ lấp đầy"
          value={`${stats.occupied}/${stats.total}`}
          suffix={stats.total > 0 ? `(${stats.occupancyPct}%)` : ''}
          darkMode={darkMode}
        />
        <StatDivider darkMode={darkMode} />
        <StatPill
          icon={<ArrowDownIcon color="#10B981" />}
          label="Check-in hôm nay"
          value={String(stats.checkingInToday)}
          darkMode={darkMode}
        />
        <StatDivider darkMode={darkMode} />
        <StatPill
          icon={<ArrowUpIcon color="#F59E0B" />}
          label="Check-out hôm nay"
          value={String(stats.checkingOutToday)}
          darkMode={darkMode}
        />
        <StatDivider darkMode={darkMode} />
        <StatPill
          icon={<BedIcon color="#8B5CF6" />}
          label="Đang ở"
          value={String(stats.currentlyStaying)}
          darkMode={darkMode}
        />
      </div>

      {/* ── Scrollable grid ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && rooms.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading…</div>
        ) : (
          <div style={{ width: '100%', minWidth: totalWidth }}>
            {/* Sticky day-column header */}
            <div style={{
              display: 'flex', position: 'sticky', top: 0, zIndex: 10,
              background: headerBg, borderBottom: `1px solid ${border}`,
              height: DAY_HEADER_H,
            }}>
              <div style={{
                position: 'sticky', left: 0, zIndex: 11,
                width: LABEL_W, flexShrink: 0, padding: '8px 14px',
                fontSize: 11, fontWeight: 700, color: textMuted,
                borderRight: `1px solid ${border}`,
                background: headerBg,
                display: 'flex', alignItems: 'center',
                textTransform: 'uppercase', letterSpacing: 0.5,
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
                        ? (darkMode ? 'rgba(37,99,235,0.22)' : 'rgba(37,99,235,0.10)')
                        : 'transparent',
                      display: 'flex', flexDirection: 'column',
                      justifyContent: 'center', alignItems: 'center',
                      position: 'relative',
                    }}>
                      {isToday && (
                        <div style={{
                          position: 'absolute', top: 3, right: 4,
                          background: todayBar, color: '#fff',
                          fontSize: 8.5, fontWeight: 800,
                          padding: '1px 6px', borderRadius: 4,
                          letterSpacing: 0.6,
                          boxShadow: '0 1px 2px rgba(239,68,68,0.4)',
                        }}>
                          TODAY
                        </div>
                      )}
                      <div style={{
                        fontSize: 10, color: textMuted, fontWeight: 600,
                        letterSpacing: 0.3, textTransform: 'uppercase',
                      }}>
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

            {/* One row per visible room */}
            {visibleRooms.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>
                {activeRooms.length === 0
                  ? 'Chưa có phòng nào. Thêm phòng để xem timeline.'
                  : 'Không có phòng nào khớp với bộ lọc hiện tại.'}
              </div>
            )}

            {visibleRooms.map(room => (
              <RoomRow
                key={room.roomId}
                room={room}
                days={days}
                bookings={bookingsByRoom.get(room.roomId) ?? []}
                cancelledBookings={inViewBookings.filter(
                  b => b.roomId === room.roomId && (b.status === 'cancelled' || b.status === 'no_show'),
                )}
                windowStart={windowStart}
                windowEnd={windowEnd}
                windowDays={windowDays}
                darkMode={darkMode}
                onSelect={setSelectedBooking}
                customerMap={customerMap}
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
            guestName={customerMap.get(selectedBooking.customerId)}
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
  cancelledBookings: Booking[];
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  darkMode: boolean;
  onSelect: (b: Booking) => void;
  customerMap: Map<string, string>;
  styles: {
    border: string; bg: string; textPrimary: string;
    textMuted: string; todayBar: string; todayStr: string;
  };
}

function RoomRow({
  room, days, bookings, cancelledBookings,
  windowStart, windowEnd, windowDays, darkMode,
  onSelect, customerMap, styles,
}: RoomRowProps) {
  const todayColIndex = days.indexOf(styles.todayStr);
  const todayOffsetPct = todayColIndex >= 0
    ? ((todayColIndex + 0.5) / days.length) * 100
    : null;

  // Lane-stacking: only count the active (non-cancelled) bookings toward
  // lane height; cancelled entries render striped in their own dedicated lane
  // at the very bottom so they don't conflict with live occupancy.
  const activeLanes = useMemo(
    () => assignLanes(bookings, windowStart, windowEnd),
    [bookings, windowStart, windowEnd],
  );
  const cancelledLanes = useMemo(
    () => assignLanes(cancelledBookings, windowStart, windowEnd),
    [cancelledBookings, windowStart, windowEnd],
  );
  const totalActiveLanes    = activeLanes.total;
  const totalCancelledLanes = cancelledBookings.length > 0 ? cancelledLanes.total : 0;
  const totalLanes          = totalActiveLanes + totalCancelledLanes;

  const trackHeight = ROW_PAD * 2
    + totalActiveLanes * LANE_H + Math.max(0, totalActiveLanes - 1) * LANE_GAP
    + (totalCancelledLanes > 0 ? 6 : 0) // separator gap
    + totalCancelledLanes * (LANE_H - 4) + Math.max(0, totalCancelledLanes - 1) * (LANE_GAP - 1);

  const isOccupiedNow = bookings.some(b => {
    return getEffectiveBookingStatus(b) === 'checked_in';
  });

  const effectiveRoomStatus = isOccupiedNow ? 'occupied' : room.status;
  const effectiveStatusText = effectiveRoomStatus === 'occupied'
    ? 'Đang có khách'
    : effectiveRoomStatus === 'available'
    ? 'Sẵn sàng'
    : effectiveRoomStatus === 'cleaning' || effectiveRoomStatus === 'needs_cleaning'
    ? 'Cần dọn'
    : effectiveRoomStatus === 'maintenance'
    ? 'Bảo trì'
    : formatStatusLabel(effectiveRoomStatus);

  const activeOffset = ROW_PAD;

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${styles.border}`, minHeight: trackHeight }}>
      {/* Room label — sticky left so it stays visible when scrolling horizontally */}
      <div style={{
        position: 'sticky', left: 0, zIndex: 6,
        width: LABEL_W, flexShrink: 0, padding: '10px 14px',
        background: styles.bg, borderRight: `1px solid ${styles.border}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: styles.textPrimary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{room.name}</div>
        <div style={{
          fontSize: 10, color: styles.textMuted,
          textTransform: 'uppercase', letterSpacing: 0.4,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 99,
            background: roomStatusDot(effectiveRoomStatus),
          }} />
          {/* {effectiveStatusText} · {room.capacity ? `${room.capacity} khách` : 'Khách'} */}
          {effectiveStatusText}
        </div>
      </div>

      {/* Track area */}
      <div style={{ flex: 1, position: 'relative', height: trackHeight, overflow: 'hidden' }}>
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
                ? (darkMode ? 'rgba(37,99,235,0.07)' : 'rgba(37,99,235,0.05)')
                : 'transparent',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Today marker — thicker, more prominent */}
        {todayOffsetPct !== null && (
          <div style={{
            position: 'absolute',
            left: `${todayOffsetPct}%`,
            top: 0, bottom: 0,
            width: 3,
            marginLeft: -1,
            background: styles.todayBar,
            opacity: 0.65,
            zIndex: 4,
            pointerEvents: 'none',
            boxShadow: '0 0 6px rgba(239,68,68,0.4)',
          }} />
        )}

        {/* Active booking blocks (checked_in / confirmed / inquiry / checked_out) */}
        {bookings.map(b => {
          const geom = bookingBlock(b, windowStart, windowEnd);
          if (!geom) return null;
          const effectiveStatus = getEffectiveBookingStatus(b);
          const v = statusVisual(effectiveStatus, darkMode);
          const sameDay = b.checkInAt.slice(0, 10) === b.expectedCheckOutAt.slice(0, 10);
          const guestName = customerMap.get(b.customerId) ?? `#${b.customerId.slice(-4)}`;
          const lane = activeLanes.blockLanes.get(b.bookingId) ?? 0;
          const top  = activeOffset + lane * (LANE_H + LANE_GAP);
          const total = formatVnd(getBookingTotal(b));
          const widthPx = (geom.widthPct / 100) * (windowDays * DAY_MIN_W);
          const showPrice = widthPx > 180 && effectiveStatus !== 'checked_out';
          const showTime  = widthPx > 100;
          const narrow    = widthPx < 80;

          return (
            <BookingBlock
              key={b.bookingId}
              b={b}
              geom={geom}
              visual={v}
              sameDay={sameDay}
              guestName={guestName}
              total={total}
              top={top}
              height={LANE_H}
              showPrice={showPrice}
              showTime={showTime}
              narrow={narrow}
              onClick={() => onSelect(b)}
            />
          );
        })}

        {/* Cancelled / no_show blocks — striped, lower in the row */}
        {cancelledBookings.map(b => {
          const geom = bookingBlock(b, windowStart, windowEnd);
          if (!geom) return null;
          const v = statusVisual(b.status, darkMode);
          const guestName = customerMap.get(b.customerId) ?? `#${b.customerId.slice(-4)}`;
          const lane = cancelledLanes.blockLanes.get(b.bookingId) ?? 0;
          const cancelledTop = activeOffset
            + totalActiveLanes * LANE_H
            + Math.max(0, totalActiveLanes - 1) * LANE_GAP
            + 6
            + lane * (LANE_H - 4 + LANE_GAP - 1);
          const widthPx = (geom.widthPct / 100) * (windowDays * DAY_MIN_W);
          const narrow = widthPx < 80;

          return (
            <BookingBlock
              key={b.bookingId}
              b={b}
              geom={geom}
              visual={v}
              sameDay={false}
              guestName={guestName}
              total=""
              top={cancelledTop}
              height={LANE_H - 4}
              showPrice={false}
              showTime={widthPx > 100}
              narrow={narrow}
              onClick={() => onSelect(b)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Renders one booking block. Extracted so active and cancelled variants
// share the same internal layout but differ in styling props.
function BookingBlock({
  b, geom, visual, sameDay, guestName, total, top, height,
  showPrice, showTime, narrow, onClick,
}: {
  b: Booking;
  geom: { leftPct: number; widthPct: number };
  visual: StatusVisual;
  sameDay: boolean;
  guestName: string;
  total: string;
  top: number;
  height: number;
  showPrice: boolean;
  showTime: boolean;
  narrow: boolean;
  onClick: () => void;
}) {
  const progress = visual.showProgress ? progressPct(b) : null;
  const isStayWindow = b.status === 'confirmed' && (new Date(b.checkInAt).getTime() <= Date.now() && Date.now() < new Date(b.expectedCheckOutAt).getTime());

  return (
    <div
      onClick={onClick}
      title={`${guestName} · ${formatStatusLabel(b.status)}${isStayWindow ? ' (Đang trong giờ lưu trú)' : ''} · ${b.checkInAt} → ${b.expectedCheckOutAt}`}
      className={`${visual.striped ? 'timeline-stripe' : ''} ${visual.solid ? 'timeline-block-solid' : ''}`}
      style={{
        position: 'absolute',
        left: `${geom.leftPct}%`,
        width: `calc(${geom.widthPct}% - 4px)`,
        marginLeft: 2,
        top,
        height,
        borderRadius: 6,
        background: visual.bg,
        border: `${visual.dashed ? '1.5px dashed' : '1.5px solid'} ${visual.border}`,
        padding: narrow ? '0 4px' : '3px 8px',
        cursor: 'pointer',
        zIndex: 2,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
        opacity: visual.opacity,
      }}
    >
      {/* Row 1: status dot + guest name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 99,
          background: visual.border, flexShrink: 0,
        }} />
        {!narrow && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: visual.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {guestName}
          </span>
        )}
      </div>

      {/* Row 2: time + guest count */}
      {!narrow && showTime && (
        <div style={{
          fontSize: 9.5, color: visual.text, opacity: 0.85,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {sameDay
            ? `${fmtTime(b.checkInAt)}–${fmtTime(b.expectedCheckOutAt)}`
            : `${fmtTime(b.checkInAt)}→${fmtTime(b.expectedCheckOutAt)}`}
          {b.numGuests ? ` · ${b.numGuests}g` : ''}
        </div>
      )}

      {/* Row 3: total price (only on wide enough blocks, never on cancelled) */}
      {showPrice && total && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: visual.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {total}
        </div>
      )}

      {/* Progress bar for checked_in */}
      {progress !== null && (
        <div style={{
          position: 'absolute', bottom: 1, left: 4, right: 4,
          height: 2, background: 'rgba(0,0,0,0.10)', borderRadius: 99,
          overflow: 'hidden',
        }}>
          <div
            className="timeline-progress"
            style={{
              width: `${progress}%`, height: '100%',
              background: visual.border, borderRadius: 99,
            }}
          />
        </div>
      )}
    </div>
  );
}

function BookingDetail({
  booking, room, guestName, textPrimary, textMuted, border,
}: {
  booking: Booking;
  room: Room | undefined;
  guestName: string | undefined;
  textPrimary: string; textMuted: string; border: string;
}) {
  const effectiveStatus = getEffectiveBookingStatus(booking);
  const sameDay = booking.checkInAt.slice(0, 10) === booking.expectedCheckOutAt.slice(0, 10);
  const rows: Array<[string, string]> = [
    ['Booking ID', booking.bookingId],
    ['Khách', guestName ?? booking.customerId],
    ['Phòng', room?.name ?? booking.roomId],
    ['Check-in', `${booking.checkInAt.slice(0, 10)} ${fmtTime(booking.checkInAt)}`],
    ['Check-out', `${booking.expectedCheckOutAt.slice(0, 10)} ${fmtTime(booking.expectedCheckOutAt)} ${sameDay ? '(same day)' : ''}`],
    ['Số khách', String(booking.numGuests ?? 1)],
    ['Loại', booking.bookingType === 'hourly' ? 'Theo giờ' : 'Theo ngày'],
    ['Tổng tiền', formatVnd(getBookingTotal(booking))],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
          <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>{k}</span>
          <span style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <StatusBadge status={effectiveStatus} />
      </div>
    </div>
  );
}

function navBtnStyle(border: string, color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${border}`,
    color,
    borderRadius: 8,
    padding: '6px 11px',
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
    minWidth: 32,
  };
}

function roomStatusDot(status: string): string {
  switch (status) {
    case 'available':     return '#10B981';
    case 'occupied':      return '#2563EB';
    case 'cleaning':      return '#F59E0B';
    case 'needs_cleaning':return '#F97316';
    case 'maintenance':   return '#EF4444';
    default:              return '#94A3B8';
  }
}

// ── Stats strip subcomponents ────────────────────────────────────────────────
function StatPill({
  icon, label, value, suffix, darkMode,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  darkMode: boolean;
}) {
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8' : '#64748B';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '5px 12px',
      background: darkMode ? '#1E293B' : '#fff',
      border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
      borderRadius: 8,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span style={{
        fontSize: 11, color: textMuted, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: textPrimary, fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value}
      </span>
      {suffix && (
        <span style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

function StatDivider({ darkMode }: { darkMode: boolean }) {
  return (
    <div style={{
      width: 1, height: 24,
      background: darkMode ? '#334155' : '#E2E8F0',
    }} />
  );
}

// ── Inline SVG icons (avoid pulling another icon dep just for these) ─────────
function OccupancyIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="11" width="4" height="10" rx="1" fill={color} opacity="0.9" />
      <rect x="10" y="6" width="4" height="15" rx="1" fill={color} opacity="0.7" />
      <rect x="17" y="14" width="4" height="7" rx="1" fill={color} opacity="0.45" />
    </svg>
  );
}
function ArrowDownIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v14m0 0l-5-5m5 5l5-5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowUpIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 20V6m0 0l-5 5m5-5l5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BedIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 18V8m0 0V6a1 1 0 011-1h16a1 1 0 011 1v2M3 18h18m0 0v2M7 11h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}