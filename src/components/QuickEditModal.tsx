import { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Booking } from '@/types/index';
import { getBookingTotal } from '@/utils/format';
import { bookingsApi } from '@/services/api';

interface QuickEditModalProps {
  booking: Booking | null;
  guestName?: string;
  roomName?: string;
  onClose: () => void;
  onSuccess: (updatedBooking: Booking) => void;
  darkMode: boolean;
}

function toLocalString(isoString: string) {
  if (!isoString) return '';
  // Convert ISO string to YYYY-MM-DDTHH:mm
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function QuickEditModal({ booking, guestName, roomName, onClose, onSuccess, darkMode }: QuickEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [checkInAt, setCheckInAt] = useState('');
  const [expectedCheckOutAt, setExpectedCheckOutAt] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  useEffect(() => {
    if (booking) {
      setCheckInAt(toLocalString(booking.checkInAt));
      setExpectedCheckOutAt(toLocalString(booking.expectedCheckOutAt));
      setTotalAmount(String(getBookingTotal(booking)));
      setError(null);
    }
  }, [booking]);

  if (!booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInAt || !expectedCheckOutAt) {
      setError('Vui lòng nhập đủ thời gian');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert local datetime-local value to ISO string
      const ciIso = new Date(checkInAt).toISOString();
      const coIso = new Date(expectedCheckOutAt).toISOString();

      const numTotal = Number(totalAmount.replace(/[^\d]/g, ''));

      const res = await bookingsApi.update(booking.bookingId, {
        checkInAt: ciIso,
        expectedCheckOutAt: coIso,
        totalAmount: isNaN(numTotal) ? undefined : numTotal,
      });

      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi cập nhật');
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: 13, fontWeight: 600, color: darkMode ? '#94A3B8' : '#475569', marginBottom: 4, display: 'block' };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#F1F5F9' : '#1E293B',
    fontSize: 14, fontFamily: "var(--font-sans)",
  };

  const titleGuest = guestName || booking.customerId;
  const titleRoom = roomName || booking.roomId;

  return (
    <Modal open={!!booking} onClose={onClose} title={`Cập Nhật Booking: ${titleGuest} · ${titleRoom}`} darkMode={darkMode} width={400}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
        {error && (
          <div style={{ padding: '8px 12px', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div>
          <label style={labelStyle}>Check-in dự kiến</label>
          <input
            type="datetime-local"
            value={checkInAt}
            onChange={e => setCheckInAt(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Check-out dự kiến</label>
          <input
            type="datetime-local"
            value={expectedCheckOutAt}
            onChange={e => setExpectedCheckOutAt(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Tổng tiền (VNĐ)</label>
          <input
            type="text"
            inputMode="numeric"
            value={totalAmount}
            onChange={e => {
              const val = e.target.value.replace(/[^\d]/g, '');
              setTotalAmount(val);
            }}
            style={inputStyle}
            placeholder="Ví dụ: 500000"
          />
          <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
            Nhập lại tổng tiền nếu khách gia hạn thêm giờ.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="button" onClick={onClose}
            style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, color: darkMode ? '#94A3B8' : '#64748B', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "inherit" }}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ flex: 1, padding: '10px', background: '#2563EB', border: 'none', color: '#fff', borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontWeight: 600, fontFamily: "inherit" }}
          >
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
