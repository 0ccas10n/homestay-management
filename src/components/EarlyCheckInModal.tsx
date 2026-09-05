// ─── EarlyCheckInModal.tsx ───────────────────────────────────────────────────
// Hộp thoại xác nhận khi khách đến sớm hơn dự kiến (> 30 phút).
// Ngăn ngừa rủi ro bấm nhầm và hỗ trợ tính phụ thu nhận phòng sớm linh hoạt
// (miễn phí, định mức 70k/h, định mức 50k/h hoặc nhập số tiền tùy ý).
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import type { Booking } from '@/types/index';
import Modal from '@/components/Modal';
import { formatVnd } from '@/utils/format';

export interface EarlyCheckInModalProps {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
  roomName?: string;
  darkMode: boolean;
  onConfirm: (
    bookingId: string,
    options: {
      earlySurcharge: number;
      note?: string;
    }
  ) => Promise<void>;
}

export default function EarlyCheckInModal({
  open,
  onClose,
  booking,
  roomName,
  darkMode,
  onConfirm,
}: EarlyCheckInModalProps) {
  const [policyType, setPolicyType] = useState<'free' | 'surcharge'>('surcharge');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [reasonNote, setReasonNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tính thời gian khách đến sớm so với kế hoạch
  const timing = useMemo(() => {
    if (!booking?.checkInAt) return { earlyMinutes: 0, earlyHours: 0, formattedEarly: '0 phút' };
    const scheduledMs = new Date(booking.checkInAt).getTime();
    const nowMs = Date.now();
    const diffMinutes = Math.max(0, Math.round((scheduledMs - nowMs) / 60_000));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const earlyHours = Math.ceil(diffMinutes / 60);

    let formattedEarly = '';
    if (hours > 0 && mins > 0) {
      formattedEarly = `${hours}h ${mins}p`;
    } else if (hours > 0) {
      formattedEarly = `${hours} tiếng`;
    } else {
      formattedEarly = `${mins} phút`;
    }

    return { earlyMinutes: diffMinutes, earlyHours, formattedEarly };
  }, [booking?.checkInAt, open]);

  const suggestedRate70 = timing.earlyHours * 70_000;
  const suggestedRate50 = timing.earlyHours * 50_000;

  // Reset dữ liệu mỗi khi mở popup
  useEffect(() => {
    if (booking && open) {
      setPolicyType('surcharge');
      setCustomAmount(String(suggestedRate70));
      setReasonNote('');
      setError(null);
      setSubmitting(false);
    }
  }, [booking?.bookingId, open, suggestedRate70]);

  if (!open || !booking) return null;

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const finalSurcharge =
        policyType === 'free'
          ? 0
          : customAmount !== '' && !isNaN(Number(customAmount))
          ? Math.max(0, Number(customAmount))
          : suggestedRate70;

      await onConfirm(booking.bookingId, {
        earlySurcharge: finalSurcharge,
        note: reasonNote.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Check-in thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const border = darkMode ? '#334155' : '#E2E8F0';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const sectionBg = darkMode ? '#0F172A' : '#F8FAFC';

  const scheduledStr = new Date(booking.checkInAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
  const nowStr = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xác nhận Nhận phòng sớm (Early Check-in)"
      darkMode={darkMode}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Banner cảnh báo đến sớm */}
        <div
          style={{
            background: darkMode ? '#78350F25' : '#FFFBEB',
            border: `1.5px solid ${darkMode ? '#D97706' : '#FDE68A'}`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#D97706' }}>
              Khách đến sớm hơn lịch hẹn {timing.formattedEarly}!
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 4, lineHeight: 1.5 }}>
              Khách đang đến trước giờ nhận phòng dự kiến. Bạn có chắc chắn phòng đã sạch sẽ và muốn cho khách vào ngay bây giờ không?
            </div>
          </div>
        </div>

        {/* Thông tin phòng & so sánh thời gian */}
        <div
          style={{
            background: sectionBg,
            border: `1px solid ${border}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: textMuted }}>Phòng & Khách:</span>
            <span style={{ fontWeight: 700, color: textPrimary }}>
              🏠 {roomName || booking.roomId} · {booking.guestName || 'Khách hàng'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: textMuted }}>Lịch hẹn nhận phòng:</span>
            <span style={{ fontWeight: 600, color: textPrimary }}>{scheduledStr}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: textMuted }}>Thời điểm hiện tại:</span>
            <span style={{ fontWeight: 700, color: '#2563EB' }}>
              {nowStr} <span style={{ fontSize: 11 }}>(Sớm {timing.formattedEarly})</span>
            </span>
          </div>
        </div>

        {/* Chọn chính sách phụ thu */}
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: textPrimary, display: 'block', marginBottom: 8 }}>
            Chính sách phụ thu Check-in sớm:
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Lựa chọn 1: Có phụ thu */}
            <div
              onClick={() => setPolicyType('surcharge')}
              style={{
                border: policyType === 'surcharge' ? '2px solid #C17A5A' : `1px solid ${border}`,
                background: policyType === 'surcharge' ? (darkMode ? '#7F1D1D20' : '#FBECE6') : sectionBg,
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: textPrimary }}>
                  <input
                    type="radio"
                    name="policyType"
                    checked={policyType === 'surcharge'}
                    onChange={() => setPolicyType('surcharge')}
                  />
                  <span>💰 Có phụ thu nhận phòng sớm:</span>
                </label>

                {policyType === 'surcharge' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#C17A5A' }}>+</span>
                    <input
                      type="number"
                      step={10000}
                      min={0}
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      placeholder="0"
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: 120,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1.5px solid #C17A5A',
                        background: darkMode ? '#1E293B' : '#ffffff',
                        color: '#C17A5A',
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#C17A5A' }}>₫</span>
                  </div>
                )}
              </div>

              {policyType === 'surcharge' && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${border}` }}>
                  <div style={{ fontSize: 11, color: textMuted, marginBottom: 6 }}>
                    Gợi ý định mức tính theo thời gian: ({timing.earlyHours} giờ làm tròn)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setCustomAmount(String(suggestedRate70));
                      }}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #C17A5A',
                        background: customAmount === String(suggestedRate70) ? '#C17A5A' : 'transparent',
                        color: customAmount === String(suggestedRate70) ? '#fff' : '#C17A5A',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      70k/h: +{formatVnd(suggestedRate70)}
                    </button>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setCustomAmount(String(suggestedRate50));
                      }}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #8AAAA2',
                        background: customAmount === String(suggestedRate50) ? '#8AAAA2' : 'transparent',
                        color: customAmount === String(suggestedRate50) ? '#fff' : '#2D534C',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      50k/h: +{formatVnd(suggestedRate50)}
                    </button>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setCustomAmount('0');
                      }}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: `1px solid ${border}`,
                        background: customAmount === '0' ? (darkMode ? '#334155' : '#E2E8F0') : 'transparent',
                        color: textMuted,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      0 ₫
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lựa chọn 2: Miễn phí */}
            <div
              onClick={() => setPolicyType('free')}
              style={{
                border: policyType === 'free' ? '2px solid #10B981' : `1px solid ${border}`,
                background: policyType === 'free' ? (darkMode ? '#064E3B20' : '#ECFDF5') : sectionBg,
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: textPrimary }}>
                <input
                  type="radio"
                  name="policyType"
                  checked={policyType === 'free'}
                  onChange={() => setPolicyType('free')}
                />
                <span>🎁 Miễn phí nhận phòng sớm (0 ₫)</span>
              </label>
              <div style={{ fontSize: 11.5, color: textMuted, marginLeft: 24, marginTop: 2 }}>
                Áp dụng cho khách quen hoặc ưu đãi riêng của Hiên Homestay
              </div>
            </div>
          </div>
        </div>

        {/* Ghi chú lý do */}
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
            Ghi chú kiểm toán (tùy chọn):
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Khách bay chuyến sớm, đồng ý phụ thu 100k..."
            value={reasonNote}
            onChange={e => setReasonNote(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              border: `1px solid ${border}`,
              fontSize: 12,
              background: sectionBg,
              color: textPrimary,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              background: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
            }}
          >
            {error}
          </div>
        )}

        {/* Nút hành động */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✕ Hủy / Bấm nhầm
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2563EB',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            }}
          >
            {submitting ? 'Đang xử lý...' : '✅ Xác nhận Check-in sớm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}