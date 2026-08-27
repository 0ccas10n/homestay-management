// ─── Timeline.tsx ──────────────────────────────────────────────────────────────
//
// Live Timeline page — fetches rooms from useRooms, uses hourlyData for
// live countdown UI logic. The hourlyBookings from hourlyData drive the
// live countdown UI unchanged (no backend for real-time room events yet).
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRooms } from '@/hooks/useRooms';
import { hourlyBookings as initialHourly, ratePlans, timeToMin, minToTime, type HourlyBookingView } from '@/data/hourlyData';
import {
  getBookingStatus, getStatusColor, getStatusBg,
  calculatePrice, hasConflict, minutesUntilCheckoutUI as minutesUntilCheckout, formatMinutes, getRatePlan,
} from '@/utils/pricing';
import StatusBadge from '@/components/StatusBadge';

type HourlyBooking = HourlyBookingView;

interface TimelineProps { darkMode: boolean; }

const HOUR_PX = 80;
const ROW_H = 70;
const HEADER_H = 48;
const LABEL_W = 112;
const TOTAL_W = 24 * HOUR_PX;

function useNowMinutes(): number {
  const [min, setMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setMin(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return min;
}

export default function Timeline() {
  const { darkMode } = useOutletContext<TimelineProps>();
  const { rooms, loading: roomsLoading, refetch } = useRooms();
  const nowMin = useNowMinutes();

  const [selectedBooking, setSelectedBooking] = useState<HourlyBooking | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [activeModalBooking, setActiveModalBooking] = useState<HourlyBooking | null>(null);

  // Filter to active rooms only
  const activeRooms = rooms.filter(r => r.status !== 'inactive' && r.status !== 'maintenance');

  const book = (r: HourlyBooking) => { setSelectedBooking(r); setCheckInOpen(true); };
  const checkout = (r: HourlyBooking) => { setActiveModalBooking(r); setCheckOutOpen(true); };

  const bg       = darkMode ? '#1E293B' : '#fff';
  const textMuted = darkMode ? '#94A3B8'  : '#64748B';
  const border    = darkMode ? '#334155'  : '#E2E8F0';
  const cellBg   = darkMode ? '#0F172A' : '#F8FAFC';
  const accent   = darkMode ? '#38BDF8' : '#0EA5E9';

  const handleCheckIn = () => { setCheckInOpen(false); setSelectedBooking(null); void refetch(); };
  const handleCheckOut = () => { setCheckOutOpen(false); setActiveModalBooking(null); void refetch(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: darkMode ? '#0B1120' : '#F8FAFC' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${border}`, background: bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: darkMode ? '#F1F5F9' : '#1E293B', fontFamily: "'DM Serif Display', serif" }}>
            Room Timeline
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: textMuted }}>
              {activeRooms.length} rooms · <span style={{ color: accent }}>Now: {minToTime(nowMin)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981' }} />Available
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563EB' }} />Occupied
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: textMuted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444' }} />Overdue
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {roomsLoading && rooms.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading rooms…</div>
        ) : (
          <div>
            {/* Room grid header */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10, background: darkMode ? '#0F172A' : '#F1F5F9', borderBottom: `1px solid ${border}` }}>
              <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 12px', fontSize: 11, fontWeight: 700, color: textMuted, borderRight: `1px solid ${border}` }}>
                Room
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{
                    position: 'absolute', left: h * HOUR_PX, width: HOUR_PX,
                    padding: '8px 4px', fontSize: 10, color: textMuted, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {minToTime(h * 60)}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {activeRooms.map(room => (
              <div key={room.roomId} style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
                <div style={{ width: LABEL_W, flexShrink: 0, padding: '10px 12px', background: bg, borderRight: `1px solid ${border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{room.name}</div>
                  <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>{room.status}</div>
                </div>
                <div style={{ flex: 1, height: ROW_H, position: 'relative', overflow: 'hidden', background: cellBg }}>
                  {/* Hour grid */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ position: 'absolute', left: h * HOUR_PX, width: HOUR_PX, top: 0, bottom: 0, borderRight: `1px solid ${border}44` }} />
                  ))}
                  {/* Now line */}
                  <div style={{ position: 'absolute', left: (nowMin / 60) * HOUR_PX, top: 0, bottom: 0, width: 2, background: '#EF4444', zIndex: 5 }} />
                  {/* Booking blocks */}
                  {initialHourly
                    .filter(b => b.roomId === room.roomId)
                    .map(b => {
                      const s = timeToMin(b.checkIn);
                      const e = timeToMin(b.checkOut);
                      const width = Math.max(e - s, 1);
                      const overdue = nowMin > e;
                      const color = overdue ? '#EF4444' : getStatusColor(getBookingStatus(b));
                      const bgColor = overdue ? '#FEF2F2' : getStatusBg(getBookingStatus(b));
                      const minsLeft = minutesUntilCheckout(b);
                      return (
                        <div key={b.bookingId}
                          onClick={() => { setActiveModalBooking(b); }}
                          style={{
                            position: 'absolute', left: (s / 60) * HOUR_PX, width: (width / 60) * HOUR_PX,
                            top: 4, bottom: 4, borderRadius: 6,
                            background: bgColor, border: `1.5px solid ${color}`,
                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                            padding: '0 6px', cursor: 'pointer', zIndex: 2, overflow: 'hidden',
                          }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.guestName}
                          </div>
                          {minsLeft !== null && minsLeft > 0 && (
                            <div style={{ fontSize: 9, color, opacity: 0.8 }}>
                              {formatMinutes(minsLeft)} left
                            </div>
                          )}
                          {overdue && <div style={{ fontSize: 9, color: '#EF4444', fontWeight: 600 }}>Overdue</div>}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
