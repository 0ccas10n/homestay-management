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
import BookingFormModal from '@/components/BookingFormModal';
import QuickEditModal from '@/components/QuickEditModal';
import { formatVnd, getBookingTotal, formatStatusLabel } from '@/utils/format';

const STATUSES = ['All', 'inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
const PAGE_SIZE = 20;

export default function Bookings() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { bookings, loading, refetch, updateStatus, checkOutBooking, cancelBooking } = useBookings({ autoFetch: false });
  const { rooms, refetch: refetchRooms } = useRooms();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [addBookingOpen, setAddBookingOpen] = useState(false);
  const [page, setPage] = useState(1);
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

  // Newest-created bookings first.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [search, filterStatus]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Bookings that can still be cancelled by the user.
  const canCancel = (b: Booking) =>
    b.status === 'inquiry' || b.status === 'confirmed';

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

  const handleCheckIn = async (id: string) => {
    try {
      const ok = await updateStatus(id, 'checked_in');
      if (ok) showToast('Đã check-in khách');
    } catch {
      showToast('Check-in thất bại');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      const { overtimeAmount } = await checkOutBooking(id);
      showToast(overtimeAmount > 0 ? `Đã check-out — phụ thu quá giờ ${formatVnd(overtimeAmount)}` : 'Đã check-out');
    } catch {
      showToast('Check-out thất bại');
    }
  };

  const handleNoShow = async (id: string) => {
    try {
      const ok = await updateStatus(id, 'no_show');
      if (ok) showToast('Đã đánh dấu no-show');
    } catch {
      showToast('Cập nhật thất bại');
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#F1F5F9' : '#1E293B', fontSize: 13, fontFamily: "var(--font-sans)", outline: 'none',
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
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All' : formatStatusLabel(s)}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: textMuted }}>{sorted.length} booking{sorted.length !== 1 ? 's' : ''}</div>
          <button
            onClick={() => setAddBookingOpen(true)}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
            + Add Booking
          </button>
        </div>
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
              ) : paginated.map(b => {
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
                    {['inquiry', 'confirmed', 'checked_in'].includes(b.status) && (
                      <button onClick={() => setEditBooking(b)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#3B82F6', marginRight: 4 }}>Sửa</button>
                    )}
                    {(b.status === 'inquiry' || b.status === 'confirmed') && (
                      <button onClick={() => handleCheckIn(b.bookingId)} style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#047857', marginRight: 4 }}>Check-in</button>
                    )}
                    {b.status === 'checked_in' && (
                      <button onClick={() => handleCheckOut(b.bookingId)} style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#B45309', marginRight: 4 }}>Check-out</button>
                    )}
                    {(b.status === 'inquiry' || b.status === 'confirmed') && (
                      <button onClick={() => handleNoShow(b.bookingId)} style={{ background: 'none', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#B45309', marginRight: 4 }}>No-show</button>
                    )}
                    {canCancel(b) && (
                      <button onClick={() => setConfirmCancel(b)} style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#EF4444' }}>Huỷ</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && sorted.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>Không tìm thấy booking</div>
          )}
        </div>
        {!loading && sorted.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderTop: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, color: textMuted }}>Trang {page}/{totalPages}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: page <= 1 ? 'default' : 'pointer', color: page <= 1 ? textMuted : textPrimary, opacity: page <= 1 ? 0.5 : 1 }}>
                ‹ Trước
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: page >= totalPages ? 'default' : 'pointer', color: page >= totalPages ? textMuted : textPrimary, opacity: page >= totalPages ? 0.5 : 1 }}>
                Sau ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Booking Modal */}
      <BookingFormModal
        open={addBookingOpen}
        onClose={() => setAddBookingOpen(false)}
        darkMode={darkMode}
        onCreated={async () => {
          setAddBookingOpen(false);
          await refetch();
          showToast('Booking created successfully');
        }}
        onError={msg => showToast(msg)}
      />

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['inquiry', 'confirmed', 'checked_in'].includes(selected.status) && (
                <button
                  onClick={() => {
                    setSelected(null);
                    setEditBooking(selected);
                  }}
                  style={{ background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Sửa nhanh
                </button>
              )}
              {(selected.status === 'inquiry' || selected.status === 'confirmed') && (
                <button onClick={() => handleCheckIn(selected.bookingId)} style={{ background: '#D1FAE5', color: '#047857', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Check-in</button>
              )}
              {selected.status === 'checked_in' && (
                <button onClick={() => handleCheckOut(selected.bookingId)} style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Check-out</button>
              )}
              {(selected.status === 'inquiry' || selected.status === 'confirmed') && (
                <button onClick={() => handleNoShow(selected.bookingId)} style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>No-show</button>
              )}
              {canCancel(selected) && (
                <button
                  onClick={() => { setConfirmCancel(selected); }}
                  style={{
                    background: '#FEE2E2', color: '#991B1B',
                    border: '1px solid #FCA5A5', borderRadius: 8,
                    padding: '10px 14px', fontWeight: 600, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Huỷ Booking
                </button>
              )}
            </div>
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
                  fontFamily: "var(--font-sans)",
                }}>
                Giữ booking
              </button>
              <button
                onClick={() => handleCancel(confirmCancel.bookingId)}
                style={{
                  background: '#EF4444', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', fontFamily: "var(--font-sans)",
                }}>
                Xác nhận huỷ
              </button>
            </div>
          </div>
        )}
      </Modal>

      <QuickEditModal
        booking={editBooking}
        guestName={editBooking ? customerMap.get(editBooking.customerId) : undefined}
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
