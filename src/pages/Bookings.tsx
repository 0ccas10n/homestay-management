// ─── Bookings.tsx ────────────────────────────────────────────────────────────────
//
// Uses useBookings for real data from the API.
// Status transitions (cancel) call the API and update local state.
// Fetches rooms + customers to display names instead of raw IDs.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { useCustomers } from '@/hooks/useCustomers';
import type { Booking } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { formatVnd, getBookingTotal } from '@/utils/format';

const STATUSES = ['All', 'inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

export default function Bookings() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { bookings, loading, refetch, cancelBooking } = useBookings({ autoFetch: false });
  const { rooms, refetch: refetchRooms } = useRooms();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    refetch();
    refetchRooms();
    refetchCustomers();
  }, [refetch, refetchRooms, refetchCustomers]);

  // Build lookup maps: id → name
  const roomMap = useMemo(
    () => new Map(rooms.map(r => [r.roomId, r.name])),
    [rooms],
  );
  const customerMap = useMemo(
    () => new Map(customers.map(c => [c.customerId, c.name])),
    [customers],
  );

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase();
    const guestName = customerMap.get(b.customerId) ?? '';
    const roomName = roomMap.get(b.roomId) ?? '';
    const matchQ = !q
      || b.bookingId.toLowerCase().includes(q)
      || b.customerId.toLowerCase().includes(q)
      || guestName.toLowerCase().includes(q)
      || b.roomId.toLowerCase().includes(q)
      || roomName.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchQ && matchStatus;
  });

  // True when the booking is in a state where it can still be cancelled.
  const canCancel = (b: Booking) =>
    b.status !== 'cancelled' && b.status !== 'checked_out' && b.status !== 'no_show';

  const handleCancel = async (id: string) => {
    try {
      await cancelBooking(id);
      setSelected(null);
      setConfirmCancel(null);
      showToast('Booking cancelled — room is now available');
    } catch {
      showToast('Failed to cancel booking');
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#F1F5F9' : '#1E293B', fontSize: 13, fontFamily: "'Outfit', sans-serif", outline: 'none',
  };

  const bg = darkMode ? '#1E293B' : '#fff';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: '#1E293B', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên khách, tên phòng, booking ID…"
          style={{ ...inputStyle, maxWidth: 280 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: textMuted }}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Table */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {['Booking ID', 'Khách', 'Phòng', 'Check-in', 'Check-out', 'Tổng tiền', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', background: darkMode ? '#1E293B' : '#F8FAFC' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading bookings…</td>
                </tr>
              ) : filtered.map(b => {
                return (
                <tr key={b.bookingId}
                  style={{ borderBottom: `1px solid ${border}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = darkMode ? '#0F172A40' : '#F8FAFC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563EB', fontWeight: 600, whiteSpace: 'nowrap' }}>{b.bookingId}</td>
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {customerMap.get(b.customerId) ?? <span style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{b.customerId}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap' }}>
                    {roomMap.get(b.roomId) ?? <span style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{b.roomId}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{b.checkInAt.slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{b.expectedCheckOutAt.slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#10B981', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                      {formatVnd(getBookingTotal(b))}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setSelected(b)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: textMuted, marginRight: 4 }}>Xem</button>
                    {canCancel(b) && (
                      <button onClick={() => setConfirmCancel(b)} style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#EF4444' }}>Huỷ</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>Không tìm thấy booking</div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Booking ${selected?.bookingId}`} darkMode={darkMode}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Booking ID', selected.bookingId],
              ['Khách', customerMap.get(selected.customerId) ?? selected.customerId],
              ['Phòng', roomMap.get(selected.roomId) ?? selected.roomId],
              ['Check-in', selected.checkInAt.slice(0, 16).replace('T', ' ')],
              ['Check-out', selected.expectedCheckOutAt.slice(0, 16).replace('T', ' ')],
              ['Loại', selected.bookingType === 'hourly' ? 'Theo giờ' : 'Theo ngày'],
              ['Thời gian (phút)', `${selected.expectedDurationMinutes} phút`],
              ['Đơn giá/đêm (snapshot)', selected.unitPriceAtBooking != null ? `${formatVnd(selected.unitPriceAtBooking)} / đêm` : '—'],
              ['Base Amount', formatVnd(selected.baseAmount && selected.baseAmount > 10 ? selected.baseAmount : getBookingTotal(selected))],
              ['Overtime', selected.overtimeAmount != null ? `${formatVnd(selected.overtimeAmount)} (${selected.overtimeMinutes} phút)` : 'Không có'],
              ['Tổng tiền', formatVnd(getBookingTotal(selected))],
              ['Số khách', `${selected.numGuests ?? 1}`],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 13, color: k === 'Tổng tiền' ? '#10B981' : textPrimary, fontWeight: k === 'Tổng tiền' ? 700 : 500 }}>{v}</span>
              </div>
            ))}
            <StatusBadge status={selected.status} />
            {selected.note && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: darkMode ? '#0F172A' : '#F8FAFC', border: `1px solid ${border}`, fontSize: 12, color: textMuted }}>
                <span style={{ fontWeight: 600 }}>Ghi chú: </span>{selected.note}
              </div>
            )}
            {canCancel(selected) && (
              <button
                onClick={() => { setConfirmCancel(selected); }}
                style={{
                  marginTop: 4,
                  background: '#FEE2E2', color: '#991B1B',
                  border: '1px solid #FCA5A5', borderRadius: 8,
                  padding: '10px 14px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                }}>
                Huỷ Booking
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel-confirmation modal */}
      <Modal
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Xác nhận huỷ booking?"
        darkMode={darkMode}
      >
        {confirmCancel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: darkMode ? '#94A3B8' : '#475569' }}>
              Booking <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{confirmCancel.bookingId}</strong> của khách{' '}
              <strong>{customerMap.get(confirmCancel.customerId) ?? confirmCancel.customerId}</strong>{' '}
              (phòng <strong>{roomMap.get(confirmCancel.roomId) ?? confirmCancel.roomId}</strong>) sẽ bị huỷ và phòng được giải phóng ngay.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmCancel(null)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                  borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', color: darkMode ? '#94A3B8' : '#64748B',
                  fontFamily: "'Outfit', sans-serif",
                }}>
                Giữ booking
              </button>
              <button
                onClick={() => handleCancel(confirmCancel.bookingId)}
                style={{
                  background: '#EF4444', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                }}>
                Xác nhận huỷ
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
