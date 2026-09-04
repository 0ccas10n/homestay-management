// ─── CheckOutModal.tsx ─────────────────────────────────────────────────────────
//
// Smart Check-Out & Final Settlement Modal
// Handles:
//   1. Overtime surcharge calculation
//   2. Deposit vs Balance Due reconciliation
//   3. 1-click checkout & mark as fully paid
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react';
import type { Booking, Room } from '@/types/index';
import Modal from '@/components/Modal';
import { formatVnd, formatMinutes, getBookingTotal } from '@/utils/format';
import { useCustomers } from '@/hooks/useCustomers';

interface CheckOutModalProps {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  room?: Room | null;
  darkMode: boolean;
  onConfirmCheckOut: (bookingId: string, payload: {
    actualCheckOutAt: string;
    paidAmount: number;
    paymentStatus: 'paid' | 'partial' | 'unpaid';
  }) => Promise<void>;
}

export default function CheckOutModal({
  open,
  onClose,
  booking,
  room,
  darkMode,
  onConfirmCheckOut,
}: CheckOutModalProps) {
  const now = new Date();
  const [actualCheckOutAt, setActualCheckOutAt] = useState(() => now.toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { customers } = useCustomers();
  const matchedCustomer = useMemo(() => {
    if (!booking?.customerId) return null;
    return (customers || []).find(c => c && c.customerId === booking.customerId);
  }, [customers, booking?.customerId]);

  const guestDisplayName = useMemo(() => {
    if (!booking) return '';
    if (booking.guestName && booking.guestName.trim() && !booking.guestName.startsWith('CUS-')) {
      return booking.guestName.trim();
    }
    if (matchedCustomer?.name && matchedCustomer.name.trim() && !matchedCustomer.name.startsWith('CUS-')) {
      return matchedCustomer.name.trim();
    }
    if ((booking as any).customerName && (booking as any).customerName.trim() && !(booking as any).customerName.startsWith('CUS-')) {
      return (booking as any).customerName.trim();
    }
    return 'Khách hàng';
  }, [booking, matchedCustomer]);

  const initialTotal = useMemo(() => booking ? getBookingTotal(booking) : 0, [booking]);
  const [customBaseCharge, setCustomBaseCharge] = useState<string>(() => String(initialTotal));
  const [isEditingRoomCharge, setIsEditingRoomCharge] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'full' | 'keep_partial'>('full');

  // Luôn đồng bộ lại dữ liệu chuẩn xác mỗi khi mở modal hoặc đổi đơn phòng
  useEffect(() => {
    if (booking && open) {
      const correctTotal = getBookingTotal(booking);
      setCustomBaseCharge(String(correctTotal));
      setOverrideReason('');
      setActualCheckOutAt(new Date().toISOString());
      setIsEditingRoomCharge(false);
      setError(null);
      setPaymentOption('full');
    }
  }, [booking?.bookingId, open]);

  // Overtime computation
  const expectedCheckOutTime = booking ? new Date(booking.expectedCheckOutAt).getTime() : 0;
  const actualCheckOutTime = new Date(actualCheckOutAt).getTime();
  const checkInTime = booking ? new Date(booking.checkInAt).getTime() : 0;

  // Tính số tiếng lưu trú theo kế hoạch đặt phòng (hoặc thực tế nếu về trễ hơn)
  const plannedStayMinutes = Math.max(0, Math.round((expectedCheckOutTime - checkInTime) / 60_000));
  const actualStayMinutes = Math.max(0, Math.round((actualCheckOutTime - checkInTime) / 60_000));
  const totalStayMinutes = plannedStayMinutes > 0 ? plannedStayMinutes : actualStayMinutes;
  const totalStayHours = Math.round((totalStayMinutes / 60) * 10) / 10;

  const overtimeMinutes = expectedCheckOutTime > 0 ? Math.max(0, Math.round((actualCheckOutTime - expectedCheckOutTime) / 60_000)) : 0;
  const isHourly = booking?.bookingType === 'hourly';
  const overtimeHours = Math.ceil(overtimeMinutes / 60);
  const overtimeAmount = !isHourly && overtimeMinutes > 0 ? overtimeHours * 70_000 : 0;

  // Total stay and settlement
  const baseRoomCharge = (customBaseCharge !== '' && !isNaN(Number(customBaseCharge)))
    ? Number(customBaseCharge)
    : initialTotal;
  const finalTotalAmount = baseRoomCharge + overtimeAmount;
  const depositPaid = booking ? (booking.depositAmount ?? (booking.paidAmount ?? 0)) : 0;
  const remainingDue = Math.max(0, finalTotalAmount - depositPaid);

  if (!open || !booking) return null;

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const finalPaid = paymentOption === 'full' ? finalTotalAmount : depositPaid;
      const finalPaymentStatus = finalPaid >= finalTotalAmount ? 'paid' : (finalPaid > 0 ? 'partial' : 'unpaid');

      const isPriceOverridden = Number(customBaseCharge) !== initialTotal;
      const auditNote = isPriceOverridden
        ? `[Sửa giá check-out: ${formatVnd(initialTotal)} ➔ ${formatVnd(baseRoomCharge)}. Lý do: ${overrideReason.trim() || 'Không ghi lý do'}]`
        : undefined;
      const combinedNote = auditNote
        ? (booking.note ? `${booking.note} | ${auditNote}` : auditNote)
        : booking.note;

      await onConfirmCheckOut(booking.bookingId, {
        actualCheckOutAt,
        paidAmount: finalPaid,
        paymentStatus: finalPaymentStatus,
        totalAmount: finalTotalAmount,
        baseAmount: baseRoomCharge,
        note: combinedNote,
      } as any);

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Check-out thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const border = darkMode ? '#334155' : '#E2E8F0';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const sectionBg = darkMode ? '#0F172A' : '#F8FAFC';

  return (
    <Modal open={open} onClose={onClose} title="Quyết toán & Trả phòng (Check-out)" darkMode={darkMode}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header summary: Room & Guest */}
        <div style={{
          background: sectionBg, border: `1px solid ${border}`, borderRadius: 10,
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
              🏠 {room?.name || booking.roomId} · {guestDisplayName}
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
              {new Date(booking.checkInAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} ➔ {new Date(booking.expectedCheckOutAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              <strong style={{ marginLeft: 6, color: '#2563EB' }}>({totalStayHours} tiếng)</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: depositPaid >= baseRoomCharge ? (darkMode ? '#064E3B' : '#DCFCE7') : (darkMode ? '#78350F' : '#FEF3C7'),
              color: depositPaid >= baseRoomCharge ? '#10B981' : '#D97706',
            }}>
              {depositPaid >= baseRoomCharge ? '🟢 Đã thanh toán tiền phòng' : `Đã cọc: ${formatVnd(depositPaid)}`}
            </span>
          </div>
        </div>

        {/* Overtime Alert (if any) */}
        {overtimeMinutes > 0 && (
          <div style={{
            background: darkMode ? '#7F1D1D25' : '#FEF2F2',
            border: `1px solid ${darkMode ? '#7F1D1D' : '#FECACA'}`,
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⏰</span>
                <span>Khách trả trễ: {formatMinutes(overtimeMinutes)}</span>
              </div>
              <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                Định mức phụ thu: {overtimeHours} giờ × 70.000 ₫/giờ
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#EF4444' }}>
              +{formatVnd(overtimeAmount)}
            </div>
          </div>
        )}

        {/* ─── Detailed Accounting Statement ─── */}
        <div style={{
          background: sectionBg, border: `1px solid ${border}`, borderRadius: 10,
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: textPrimary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>1. Tiền phòng lưu trú:</span>
              <button
                type="button"
                onClick={() => setIsEditingRoomCharge(prev => !prev)}
                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                {isEditingRoomCharge ? '✓ Xong' : '✏️ Sửa tiền phòng'}
              </button>
            </div>
            {isEditingRoomCharge ? (
              <input
                type="number"
                step={10000}
                value={customBaseCharge}
                onChange={e => setCustomBaseCharge(e.target.value)}
                style={{
                  width: 140, padding: '4px 8px', borderRadius: 6,
                  border: '1.5px solid #2563EB', background: sectionBg, color: textPrimary,
                  fontSize: 13, fontWeight: 800, textAlign: 'right', outline: 'none',
                }}
              />
            ) : (
              <span style={{ fontWeight: 700 }}>{formatVnd(baseRoomCharge)}</span>
            )}
          </div>
          {Number(customBaseCharge) !== initialTotal && (
            <div style={{ padding: '8px 10px', background: darkMode ? '#78350F20' : '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, margin: '4px 0' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#D97706', display: 'block', marginBottom: 4 }}>
                ⚠️ Giá đang khác giá niêm yết ({formatVnd(initialTotal)}). Nhập lý do (để chủ kiểm toán):
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Giảm giá khách quen 10%, đền bù máy lạnh hỏng..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  border: `1px solid ${border}`, fontSize: 12,
                  background: sectionBg, color: textPrimary, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          {overtimeAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
              <span>2. Phụ thu quá giờ:</span>
              <span style={{ fontWeight: 700 }}>+{formatVnd(overtimeAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: textMuted, paddingTop: 4, borderTop: `1px dashed ${border}` }}>
            <span>Khách đã cọc / thanh toán trước:</span>
            <span>- {formatVnd(depositPaid)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 8, marginTop: 4, borderTop: `2px solid ${border}`,
          }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: textPrimary }}>
              CẦN THU NỐT KHI CHECK-OUT:
            </span>
            <span style={{
              fontWeight: 800, fontSize: 18,
              color: remainingDue > 0 ? '#EF4444' : '#10B981',
              fontFamily: "'DM Serif Display', serif",
            }}>
              {remainingDue > 0 ? formatVnd(remainingDue) : '0 ₫ (Đã đủ)'}
            </span>
          </div>
        </div>

        {/* Payment confirmation toggle */}
        {remainingDue > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setPaymentOption('full')}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: paymentOption === 'full' ? '#10B981' : 'transparent',
                color: paymentOption === 'full' ? '#fff' : textMuted,
                border: `1px solid ${paymentOption === 'full' ? '#10B981' : border}`,
              }}
            >
              💵 Đã thu đủ {formatVnd(remainingDue)}
            </button>
            <button
              type="button"
              onClick={() => setPaymentOption('keep_partial')}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: paymentOption === 'keep_partial' ? '#EF4444' : 'transparent',
                color: paymentOption === 'keep_partial' ? '#fff' : textMuted,
                border: `1px solid ${paymentOption === 'keep_partial' ? '#EF4444' : border}`,
              }}
            >
              ⚠️ Ghi nợ / Chưa thu đủ
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 12,
            background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA',
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px', borderRadius: 8, border: `1px solid ${border}`,
              background: 'transparent', color: textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: '#2563EB', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}
          >
            {submitting ? 'Đang xử lý...' : '✅ Xác nhận Check-out & Quyết toán'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
