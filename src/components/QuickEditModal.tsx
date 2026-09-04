import { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Booking } from '@/types/index';
import { getBookingTotal, formatVnd } from '@/utils/format';
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
  const [paidAmount, setPaidAmount] = useState('');

  useEffect(() => {
    if (booking) {
      setCheckInAt(toLocalString(booking.checkInAt));
      setExpectedCheckOutAt(toLocalString(booking.expectedCheckOutAt));
      setTotalAmount(String(getBookingTotal(booking)));
      setPaidAmount(String(booking.paidAmount ?? booking.depositAmount ?? ''));
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

      // Ensure we append the correct local timezone offset (+07:00) 
      // instead of converting to UTC so slice() operations on the frontend still work.
      const formatToLocalIso = (dtLocal: string) => {
        return dtLocal.length === 16 ? `${dtLocal}:00+07:00` : dtLocal;
      };

      const ciIso = formatToLocalIso(checkInAt);
      const coIso = formatToLocalIso(expectedCheckOutAt);

      const numTotal = Number(totalAmount.replace(/[^\d]/g, ''));
      const numPaid = paidAmount.trim() ? Number(paidAmount.replace(/[^\d]/g, '')) : undefined;
      const paymentStatus = numPaid !== undefined
        ? (numPaid >= (numTotal || getBookingTotal(booking)) ? 'paid' : (numPaid > 0 ? 'partial' : 'unpaid'))
        : undefined;

      const res = await bookingsApi.update(booking.bookingId, {
        checkInAt: ciIso,
        expectedCheckOutAt: coIso,
        totalAmount: isNaN(numTotal) ? undefined : numTotal,
        paidAmount: numPaid,
        depositAmount: numPaid,
        paymentStatus,
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

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Đã thanh toán / Tiền cọc (VNĐ)</label>
            {Number(totalAmount) > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPaidAmount('0')}
                  style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'transparent', border: `1px solid ${darkMode ? '#334155' : '#CBD5E1'}`, color: '#64748B', cursor: 'pointer' }}>
                  0₫
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(Math.round(Number(totalAmount) * 0.5)))}
                  style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setPaidAmount(totalAmount)}
                  style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  100%
                </button>
              </div>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={paidAmount}
            onChange={e => {
              const val = e.target.value.replace(/[^\d]/g, '');
              setPaidAmount(val);
            }}
            style={inputStyle}
            placeholder="Số tiền khách đã trả..."
          />
          {Number(totalAmount) > 0 && (
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 11,
              background: (Number(totalAmount) - Number(paidAmount || 0)) > 0 ? (darkMode ? '#7F1D1D30' : '#FEF2F2') : (darkMode ? '#064E3B30' : '#ECFDF5'),
              color: (Number(totalAmount) - Number(paidAmount || 0)) > 0 ? '#EF4444' : '#10B981',
              display: 'flex', justifyContent: 'space-between', fontWeight: 600,
            }}>
              <span>{(Number(totalAmount) - Number(paidAmount || 0)) > 0 ? '⚠️ Còn thiếu:' : '✅ Đã trả đủ:'}</span>
              <span>{formatVnd(Math.max(0, Number(totalAmount) - Number(paidAmount || 0)))}</span>
            </div>
          )}
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
