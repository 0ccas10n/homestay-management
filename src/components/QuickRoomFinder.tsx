// ─── QuickRoomFinder.tsx ───────────────────────────────────────────────────────
//
// Quick Room Availability & Price Checker (Zero-click Room Finder)
// Allows receptionists/managers to instantly check which rooms are free for
// incoming customer inquiries (phone / Zalo) within 5 seconds.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react';
import type { Room, Booking, RatePlan, RatePlanPrice } from '@/types/index';
import { formatVnd } from '@/utils/format';
import { ratePlanPricesApi } from '@/services/api';

interface QuickRoomFinderProps {
  rooms: Room[];
  bookings: Booking[];
  darkMode: boolean;
  onBookRoom: (roomId: string, checkInDate: string, checkInTime: string, checkOutDate: string, checkOutTime: string, numGuests: string) => void;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function QuickRoomFinder({
  rooms,
  bookings,
  darkMode,
  onBookRoom,
}: QuickRoomFinderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ratePlanPrices, setRatePlanPrices] = useState<RatePlanPrice[]>([]);

  useEffect(() => {
    ratePlanPricesApi.getAll().then(res => setRatePlanPrices(res || [])).catch(() => {});
  }, []);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [checkInDate, setCheckInDate] = useState(() => toDateInput(now));
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutDate, setCheckOutDate] = useState(() => toDateInput(tomorrow));
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [numGuests, setNumGuests] = useState('2');

  // Filter available rooms in memory using non-overlap condition + cleaning buffer
  const availableRooms = useMemo(() => {
    if (!checkInDate || !checkOutDate) return [];
    const ci = new Date(`${checkInDate}T${checkInTime}:00+07:00`).getTime();
    const co = new Date(`${checkOutDate}T${checkOutTime}:00+07:00`).getTime();

    if (isNaN(ci) || isNaN(co) || ci >= co) return [];

    const activeRooms = rooms.filter(r => r.active && r.status !== 'inactive');

    // Buffer dọn dẹp tối thiểu 60 phút giữa 2 lượt khách
    // Đối với chu kỳ ngày (ra 12:00, vào 14:00), khoảng cách là 120 phút > 60 phút (hợp lệ hoàn hảo)
    const CLEANING_BUFFER_MS = 60 * 60 * 1000;

    return activeRooms.filter(room => {
      // Room capacity check
      const cap = Number(room.capacity) || 4;
      if (Number(numGuests) > cap) return false;

      // Overlap check with existing non-cancelled bookings (considering turnover cleaning buffer)
      const hasConflict = bookings.some(b => {
        if (b.status === 'cancelled' || b.status === 'no_show') return false;
        if (b.roomId !== room.roomId && b.roomId !== (room as any).id) return false;

        const bCi = new Date(b.checkInAt).getTime();
        const bCo = new Date(b.expectedCheckOutAt).getTime();

        // Xung đột nếu khung giờ yêu cầu [ci, co] chạm vào khung lưu trú + thời gian dọn phòng của đơn hiện tại
        return ci < (bCo + CLEANING_BUFFER_MS) && co > (bCi - CLEANING_BUFFER_MS);
      });

      return !hasConflict;
    });
  }, [rooms, bookings, checkInDate, checkInTime, checkOutDate, checkOutTime, numGuests]);

  const border = darkMode ? '#334155' : '#E2E8F0';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const bg = darkMode ? '#1E293B' : '#fff';
  const inputBg = darkMode ? '#0F172A' : '#F8FAFC';

  // Calculate duration in nights and stay hours
  const { nights, totalHours } = useMemo(() => {
    const ci = new Date(`${checkInDate}T${checkInTime}:00+07:00`).getTime();
    const co = new Date(`${checkOutDate}T${checkOutTime}:00+07:00`).getTime();
    if (isNaN(ci) || isNaN(co) || ci >= co) return { nights: 1, totalHours: 22 };
    const n = Math.max(1, Math.ceil((co - ci) / (24 * 60 * 60 * 1000)));
    const hours = (checkInTime === '14:00' && checkOutTime === '12:00')
      ? (24 * n - 2)
      : Math.round((co - ci) / (60 * 60 * 1000));
    return { nights: n, totalHours: hours };
  }, [checkInDate, checkInTime, checkOutDate, checkOutTime]);

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '14px 18px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      {/* Header bar / toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Kiểm tra phòng trống tức thì (Quick Room Finder)</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: availableRooms.length > 0 ? (darkMode ? '#064E3B' : '#DCFCE7') : (darkMode ? '#7F1D1D' : '#FEE2E2'),
                color: availableRooms.length > 0 ? '#10B981' : '#EF4444',
              }}>
                {availableRooms.length > 0 ? `Còn ${availableRooms.length} phòng trống` : 'Hết phòng'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 1 }}>
              Báo giá và giữ phòng cho khách gọi hotline/Zalo trong 5 giây
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          style={{
            background: isOpen ? (darkMode ? '#334155' : '#E2E8F0') : '#2563EB',
            color: isOpen ? textPrimary : '#fff',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {isOpen ? 'Thu gọn ▲' : 'Tìm phòng trống ngay ▼'}
        </button>
      </div>

      {/* Expanded Finder Form & Results */}
      {isOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Inputs Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
          }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, display: 'block', marginBottom: 4 }}>
                Check-in Ngày
              </label>
              <input
                type="date"
                value={checkInDate}
                onChange={e => setCheckInDate(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${border}`, background: inputBg, color: textPrimary, fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, display: 'block', marginBottom: 4 }}>
                Giờ Check-in
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={e => setCheckInTime(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${border}`, background: inputBg, color: textPrimary, fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, display: 'block', marginBottom: 4 }}>
                Check-out Ngày
              </label>
              <input
                type="date"
                value={checkOutDate}
                onChange={e => setCheckOutDate(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${border}`, background: inputBg, color: textPrimary, fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, display: 'block', marginBottom: 4 }}>
                Giờ Check-out
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={e => setCheckOutTime(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${border}`, background: inputBg, color: textPrimary, fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: textMuted, display: 'block', marginBottom: 4 }}>
                Số khách
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={numGuests}
                onChange={e => setNumGuests(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${border}`, background: inputBg, color: textPrimary, fontSize: 12,
                }}
              />
            </div>
          </div>

          {/* Results Room Cards */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: textMuted, marginBottom: 8, textTransform: 'uppercase' }}>
              Danh sách phòng còn trống ({nights} đêm · {totalHours} tiếng · {numGuests} khách):
            </div>
            {availableRooms.length === 0 ? (
              <div style={{
                padding: '16px', borderRadius: 8, textAlign: 'center', fontSize: 13,
                background: darkMode ? '#7F1D1D20' : '#FEF2F2',
                color: darkMode ? '#FCA5A5' : '#991B1B',
                border: `1px dashed ${darkMode ? '#7F1D1D' : '#FECACA'}`,
              }}>
                ❌ Không có phòng nào còn trống trong khoảng thời gian đã chọn (kể cả thời gian dọn dẹp phòng).
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
              }}>
                {availableRooms.map(room => {
                  const rId = room.roomId || (room as any).id;
                  const priceRow = ratePlanPrices.find(
                    p => (p.roomId === rId || p.roomId === room.roomId) && p.ratePlanId === 'RP-0004'
                  );
                  const nightPrice = (priceRow && Number(priceRow.priceVnd) > 0)
                    ? Number(priceRow.priceVnd)
                    : (Number(room.priceDisplay) || (room as any).pricePerNight || 810_000);
                  const estPrice = nightPrice * nights;

                  return (
                    <div
                      key={room.roomId || (room as any).id}
                      style={{
                        background: inputBg,
                        border: `1px solid ${border}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: textPrimary }}>
                            {room.name}
                          </span>
                          <span style={{ fontSize: 10, color: textMuted }}>
                            Tối đa {room.capacity || 2} khách
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                          {room.type || 'Phòng Homestay'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                          ~{formatVnd(estPrice)} <span style={{ fontSize: 10, fontWeight: 400, color: textMuted }}>({nights} đêm · {formatVnd(nightPrice)}/đêm)</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onBookRoom(
                          room.roomId || (room as any).id,
                          checkInDate,
                          checkInTime,
                          checkOutDate,
                          checkOutTime,
                          numGuests,
                        )}
                        style={{
                          width: '100%',
                          background: '#2563EB',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Đặt phòng này ngay
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
