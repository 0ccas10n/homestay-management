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
import CheckOutModal from '@/components/CheckOutModal';
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
  const [checkOutTarget, setCheckOutTarget] = useState<Booking | null>(null);
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

  const filtered = (bookings || []).filter(b => {
    if (!b) return false;
    const q = search.toLowerCase();
    const guestName = customerMap.get(b.customerId) ?? (b as any).guestName ?? '';
    const roomName = roomMap.get(b.roomId) ?? '';
    const matchQ = !q
      || (b.bookingId || '').toLowerCase().includes(q)
      || (b.customerId || '').toLowerCase().includes(q)
      || guestName.toLowerCase().includes(q)
      || (b.roomId || '').toLowerCase().includes(q)
      || roomName.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchQ && matchStatus;
  });

  // Newest-created bookings first.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [search, filterStatus]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Bookings that can still be cancelled by the user.
  const canCancel = (b: Booking) =>
    b && (b.status === 'inquiry' || b.status === 'confirmed');

  const handleCheckOutConfirm = async (
    bookingId: string,
    payload: {
      actualCheckOutAt: string;
      extraServicesAmount: number;
      extraServicesNote?: string;
      paidAmount: number;
      paymentStatus: 'paid' | 'partial' | 'unpaid';
    }
  ) => {
    try {
      await checkOutBooking(bookingId, payload);
      setCheckOutTarget(null);
      setSelected(null);
      await refetch();
      showToast('✅ Check-out thành công & đã quyết toán dòng tiền');
    } catch {
      showToast('Check-out thất bại');
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const ok = await updateStatus(bookingId, 'checked_in');
      if (ok) {
        await refetch();
        showToast('Check-in thành công');
      }
    } catch {
      showToast('Check-in thất bại');
    }
  };

  const handleNoShow = async (bookingId: string) => {
    try {
      const ok = await updateStatus(bookingId, 'no_show');
      if (ok) {
        await refetch();
        showToast('Đã đánh dấu khách No-show');
      }
    } catch {
      showToast('Cập nhật thất bại');
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBooking(bookingId);
      setConfirmCancel(null);
      setSelected(null);
      await refetch();
      showToast('Booking cancelled');
    } catch {
      showToast('Huỷ thất bại');
    }
  };

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';
  const bg = darkMode ? '#1E293B' : '#fff';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: '#10B981', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã, tên khách, phòng..."
          style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0F172A' : '#F8FAFC', color: textPrimary, fontSize: 13, maxWidth: 280, width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filterStatus === s ? '#2563EB' : border}`,
                background: filterStatus === s ? '#2563EB' : bg,
                color: filterStatus === s ? '#fff' : textMuted,
              }}>
              {formatStatusLabel(s)}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: textMuted }}>{sorted.length} booking{sorted.length !== 1 ? 's' : ''}</div>
          <button
            onClick={() => setAddBookingOpen(true)}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
                {['Booking ID', 'Khách', 'Phòng', 'Check-in', 'Check-out', 'Tổng tiền', 'Thanh toán & Cọc', 'Trạng thái', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', background: darkMode ? '#1E293B' : '#F8FAFC' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading bookings…</td>
                </tr>
              ) : paginated.map(b => {
                const totalAmt = getBookingTotal(b);
                const depositPaid = b.paidAmount ?? b.depositAmount ?? 0;
                const balanceDue = Math.max(0, totalAmt - depositPaid);
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
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{(b.checkInAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '12px 16px', color: textPrimary, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{(b.expectedCheckOutAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#10B981', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{formatVnd(totalAmt)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {b.status === 'cancelled' ? <span style={{ color: textMuted, fontSize: 12 }}>—</span> : balanceDue === 0 && totalAmt > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: darkMode ? '#064E3B30' : '#ECFDF5', border: '1px solid #10B981', padding: '2px 8px', borderRadius: 6 }}>🟢 Đã trả đủ</span>
                    ) : depositPaid > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>Cọc: {formatVnd(depositPaid)}</span>
                        <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>Thiếu: {formatVnd(balanceDue)}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: darkMode ? '#7F1D1D30' : '#FEF2F2', border: '1px solid #EF4444', padding: '2px 8px', borderRadius: 6 }}>🔴 Chưa thu</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><StatusBadge status={b.status} /></td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setSelected(b)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: textMuted, marginRight: 4 }}>Xem</button>
                    {['inquiry', 'confirmed', 'checked_in'].includes(b.status) && (
                      <button onClick={() => setEditBooking(b)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#3B82F6', marginRight: 4 }}>Sửa</button>
                    )}
                    {(b.status === 'inquiry' || b.status === 'confirmed') && (
                      <button onClick={() => handleCheckIn(b.bookingId)} style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#047857', marginRight: 4 }}>Check-in</button>
                    )}
                    {b.status === 'checked_in' && (
                      <button onClick={() => setCheckOutTarget(b)} style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#B45309', marginRight: 4 }}>Check-out</button>
                    )}
                    {(b.status === 'inquiry' || b.status === 'confirmed') && (
                      <button onClick={() => handleNoShow(b.bookingId)} style={{ background: 'none', border: '1px solid #FDE68A', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#B45309', marginRight: 4 }}>No-show</button>
                    )}
                    {canCancel(b) && (
                      <button onClick={() => setConfirmCancel(b)} style={{ background: 'none', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#EF4444' }}>Hủy</button>
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

      <CheckOutModal
        open={!!checkOutTarget}
        onClose={() => setCheckOutTarget(null)}
        booking={checkOutTarget}
        room={checkOutTarget ? rooms.find(r => r.roomId === checkOutTarget.roomId) : null}
        darkMode={darkMode}
        onConfirmCheckOut={handleCheckOutConfirm}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Booking ${selected?.bookingId}`} darkMode={darkMode}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Booking ID', selected.bookingId],
              ['Khách', customerMap.get(selected.customerId) ?? (selected as any).guestName ?? selected.customerId],
              ['Phòng', roomMap.get(selected.roomId) ?? selected.roomId],
              ['Check-in', (selected.checkInAt || '').slice(0, 16).replace('T', ' ')],
              ['Check-out', (selected.expectedCheckOutAt || '').slice(0, 16).replace('T', ' ')],
              ['Loại', selected.bookingType === 'hourly' ? 'Theo giờ' : 'Theo ngày'],
              ['Thời gian (phút)', `${selected.expectedDurationMinutes} phút`],
              ['Đơn giá/đêm (snapshot)', selected.unitPriceAtBooking != null ? `${formatVnd(selected.unitPriceAtBooking)} / đêm` : '—'],
              ['Base Amount', formatVnd(selected.baseAmount && selected.baseAmount > 10 ? selected.baseAmount : getBookingTotal(selected))],
              ['Overtime', selected.overtimeAmount != null ? `${formatVnd(selected.overtimeAmount)} (${selected.overtimeMinutes} phút)` : 'Không có'],
              ['Dịch vụ phát sinh', selected.extraServicesAmount != null ? `+${formatVnd(selected.extraServicesAmount)} (${selected.extraServicesNote || ''})` : 'Không có'],
              ['Tổng tiền phòng', formatVnd(getBookingTotal(selected))],
              ['Đã thanh toán / Cọc', formatVnd(selected.paidAmount ?? selected.depositAmount ?? 0)],
              ['Còn phải thu', Math.max(0, getBookingTotal(selected) - (selected.paidAmount ?? selected.depositAmount ?? 0)) > 0
                ? `⚠️ ${formatVnd(Math.max(0, getBookingTotal(selected) - (selected.paidAmount ?? selected.depositAmount ?? 0)))}`
                : '✅ Đã thanh toán đủ 100%'],
              ['Số khách', `${selected.numGuests ?? 1}`],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>{k}</span>
                <span style={{
                  fontSize: 13,
                  color: k === 'Tổng tiền phòng' ? '#10B981' : (k === 'Còn phải thu' && String(v).startsWith('⚠️') ? '#EF4444' : textPrimary),
                  fontWeight: (k === 'Tổng tiền phòng' || k === 'Còn phải thu') ? 700 : 500,
                }}>{v}</span>
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
                    const target = selected;
                    setSelected(null);
                    setEditBooking(target);
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
                <button
                  onClick={() => {
                    const target = selected;
                    setSelected(null);
                    setCheckOutTarget(target);
                  }}
                  style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Check-out & Thu tiền
                </button>
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
