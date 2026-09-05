// ─── Dashboard.tsx ────────────────────────────────────────────────────────────────────
//
// Uses useDashboard for stat cards, Today's Activity sections, and chart data.
// Modals make real API calls instead of just updating local state.
//
// Pages rendered inside AppShell receive darkMode via useOutletContext().
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import { useBookings } from '@/hooks/useBookings';
import { useCustomers } from '@/hooks/useCustomers';
import { bookingsApi, roomsApi, cleaningApi, expensesApi } from '@/services/api';
import type { Booking, CleaningTask } from '@/types/index';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getBookingStatus, getStatusColor, getStatusBg, minutesUntilCheckout, formatMinutes, OVERTIME_HOURLY_RATE } from '@/utils/pricing';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import BookingFormModal from '@/components/BookingFormModal';
import CheckOutModal from '@/components/CheckOutModal';
import EarlyCheckInModal from '@/components/EarlyCheckInModal';
import QuickEditModal from '@/components/QuickEditModal';
import QuickRoomFinder from '@/components/QuickRoomFinder';
import { formatVnd, getBookingTotal } from '@/utils/format';

const TODAY_DATE = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const outletCtx = useOutletContext<{ darkMode?: boolean }>() || {};
  const darkMode = outletCtx.darkMode ?? false;
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { data: dashboard, loading: dashLoading } = useDashboard();
  const monthlyRevenue = dashboard?.monthlyRevenue ?? [];
  const weeklyOccupancy = dashboard?.weeklyOccupancy ?? [];
  const monthlyRevenueTotal = dashboard?.monthlyRevenueTotal ?? 0;
  const { bookings, refetch: refetchBookings, updateStatus } = useBookings({ autoFetch: false });
  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof roomsApi.getInternal>>>([]);
  const [cleaningTasks, setCleaningTasks] = useState<CleaningTask[]>([]);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch rooms + cleaning tasks on mount
  const refetchLocalRooms = useCallback(() => {
    roomsApi.getInternal().then(r => setRooms(r || [])).catch(() => {});
  }, []);

  const refetchLocalCleaning = useCallback(() => {
    cleaningApi.get({ active: 'true' }).then(c => setCleaningTasks(c || [])).catch(() => {});
  }, []);

  useEffect(() => {
    refetchLocalRooms();
    refetchLocalCleaning();
    refetchBookings().catch(() => {});
  }, [refetchBookings, refetchLocalRooms, refetchLocalCleaning]);

  const roomMap: Record<string, (typeof rooms)[number] | undefined> = {};
  for (const r of (rooms || [])) {
    if (r?.roomId) roomMap[r.roomId] = r;
  }

  const [modal, setModal] = useState<null | 'add-booking' | 'check-in' | 'check-out' | 'cleaned' | 'expense'>(null);
  const [finderPrefill, setFinderPrefill] = useState<{
    roomId?: string;
    checkInDate?: string;
    checkOutDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
    numGuests?: string;
  } | null>(null);
  const [checkOutTarget, setCheckOutTarget] = useState<Booking | null>(null);
  const [earlyCheckInTarget, setEarlyCheckInTarget] = useState<{
    booking: Booking;
    roomName: string;
  } | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleBookFromFinder = (
    roomId: string,
    checkInDate: string,
    checkInTime: string,
    checkOutDate: string,
    checkOutTime: string,
    numGuests: string,
  ) => {
    setFinderPrefill({
      roomId,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      numGuests: String(numGuests || '2'),
    });
    setModal('add-booking');
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const activeRooms = (rooms || []).filter(r => r && r.active && r.status !== 'inactive');
  const totalRooms = activeRooms.length;

  const occupiedRoomIds = new Set(
    (bookings || []).filter(b => b && b.status === 'checked_in').map(b => b.roomId)
  );
  const occupied = activeRooms.filter(r => occupiedRoomIds.has(r.roomId)).length;

  const activeCleaning = (cleaningTasks || []).filter(t =>
    t && (t.status === 'pending' || t.status === 'in_progress'),
  );
  const cleaningRoomIds = new Set(activeCleaning.map(t => t.roomId));
  const roomsNeedingCleaning = activeRooms.filter(r => r.status === 'needs_cleaning' || cleaningRoomIds.has(r.roomId));
  const needsCleaning = roomsNeedingCleaning.length;

  const maintenanceRooms = activeRooms.filter(r => r.status === 'maintenance').length;
  const available = Math.max(0, totalRooms - occupied - needsCleaning - maintenanceRooms);

  const today = TODAY_DATE;
  const checkingInToday = (bookings || [])
    .filter(b => {
      if (!b || b.status !== 'confirmed') return false;
      const checkInDate = (b.checkInAt || '').slice(0, 10);
      return checkInDate === today;
    })
    .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());

  const overdueCheckIns = (bookings || []).filter(b => {
    if (!b || b.status !== 'confirmed') return false;
    const checkInDate = (b.checkInAt || '').slice(0, 10);
    return checkInDate && checkInDate < today;
  });
  const checkingIn = checkingInToday;
  const checkingOut = (bookings || [])
    .filter(b => {
      if (!b || b.status !== 'checked_in') return false;
      const checkoutDate = (b.expectedCheckOutAt || '').slice(0, 10);
      return checkoutDate && checkoutDate <= today;
    })
    .sort((a, b) => new Date(a.expectedCheckOutAt).getTime() - new Date(b.expectedCheckOutAt).getTime());

  const prevMonthRevenue = monthlyRevenue.length >= 2
    ? monthlyRevenue[monthlyRevenue.length - 2]!.revenue
    : 0;
  // Month-over-month delta percentage. Guards against both division by zero
  // and NaN so the UI never renders "NaN% vs last month".
  let monthlyDelta: number | null = null;
  const safeMonthlyTotal = Number.isFinite(monthlyRevenueTotal) ? monthlyRevenueTotal : 0;
  const safePrev = Number.isFinite(prevMonthRevenue) && prevMonthRevenue > 0 ? prevMonthRevenue : 0;
  if (safePrev > 0) {
    monthlyDelta = Math.round(((safeMonthlyTotal - safePrev) / safePrev) * 100);
  }
  const monthlyDeltaText = monthlyDelta === null
    ? 'No prior month data'
    : `${monthlyDelta >= 0 ? '+' : ''}${monthlyDelta}% so với tháng trước`;

  const formatShortVnd = (v: number) => {
    if (v === 0) return '0 ₫';
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} tr`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${v} ₫`;
  };

  const statColors = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
  const statCards = [
    { label: 'Phòng trống', value: available, sub: `${totalRooms > 0 ? Math.round((available / totalRooms) * 100) : 0}% tỷ lệ trống`, color: statColors[0], icon: '🛏' },
    { label: 'Đang có khách', value: occupied, sub: `${totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0}% (${occupied}/${totalRooms} phòng)`, color: statColors[1], icon: '👤' },
    { label: 'Cần dọn dẹp', value: needsCleaning, sub: `${needsCleaning} phòng cần dọn`, color: statColors[2], icon: '🧹' },
    { label: 'Doanh thu tháng', value: formatVnd(monthlyRevenueTotal), sub: monthlyDeltaText, color: statColors[3], icon: '💰' },
  ];

  const { customers } = useCustomers();
  const customerMap = React.useMemo(() => new Map(customers.map(c => [c.customerId, c.name])), [customers]);

  // Tỉ trọng kênh bán (Channel Mix)
  const { channelMixData, totalChannelCustomers } = React.useMemo(() => {
    const counts: Record<string, number> = {
      'INSTAGRAM': 0,
      'ZALO': 0,
      'FACEBOOK': 0,
      'TIKTOK': 0,
      'DIRECT / KHÁC': 0,
    };

    let total = 0;
    customers.forEach(c => {
      const src = (c.source || '').toUpperCase();
      if (src === 'FACEBOOK') { counts['FACEBOOK']++; total++; }
      else if (src === 'ZALO') { counts['ZALO']++; total++; }
      else if (src === 'TIKTOK') { counts['TIKTOK']++; total++; }
      else if (src === 'INSTAGRAM') { counts['INSTAGRAM']++; total++; }
      else if (src) { counts['DIRECT / KHÁC']++; total++; }
    });

    const CHANNEL_COLORS: Record<string, string> = {
      'FACEBOOK': '#1877F2',
      'ZALO': '#38BDF8',
      'TIKTOK': darkMode ? '#F1F5F9' : '#000000',
      'INSTAGRAM': '#F56040',
      'DIRECT / KHÁC': '#64748B',
    };

    const CHANNEL_NAMES: Record<string, string> = {
      'INSTAGRAM': 'Instagram',
      'ZALO': 'Zalo',
      'FACEBOOK': 'Facebook',
      'TIKTOK': 'TikTok',
      'DIRECT / KHÁC': 'Khác / Direct',
    };

    const result = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => ({
        key,
        name: CHANNEL_NAMES[key] || key,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: CHANNEL_COLORS[key] || '#64748B',
      }))
      .sort((a, b) => b.count - a.count);

    if (result.length === 0) {
      return {
        channelMixData: [{ key: 'DIRECT / KHÁC', name: 'Khác / Direct', count: customers.length || 1, percentage: 100, color: '#64748B' }],
        totalChannelCustomers: customers.length || 1,
      };
    }
    return { channelMixData: result, totalChannelCustomers: total };
  }, [customers, darkMode]);

  // Doanh thu theo từng phòng (Tháng này)
  const revenueByRoomData = React.useMemo(() => {
    const activeRooms = rooms.filter(r => r.active && r.status !== 'inactive');
    const revMap = new Map<string, number>();
    const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      // Chỉ tính các đơn đặt phòng trong tháng hiện tại
      if (!b.checkInAt || !b.checkInAt.startsWith(currentMonthKey)) return;
      const amount = getBookingTotal(b);
      revMap.set(b.roomId, (revMap.get(b.roomId) || 0) + amount);
    });

    return activeRooms
      .map(r => ({
        name: r.name,
        revenue: revMap.get(r.roomId) || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rooms, bookings]);

  const getGuestName = (booking: Booking): string => {
    return customerMap.get((booking.customerId || '').trim()) || booking.guestName || booking.customerId;
  };

  const getRoomNumber = (booking: Booking): string => {
    const r = roomMap[booking.roomId];
    return r?.name ?? booking.roomId;
  };

  const formatStayTime = (isoStr?: string): string => {
    if (!isoStr) return '';
    const datePart = isoStr.slice(0, 10);
    const timePart = isoStr.slice(11, 16);
    if (datePart === TODAY_DATE) {
      return `Hôm nay ${timePart}`;
    }
    const [, m, d] = datePart.split('-');
    return `${timePart} (${d}/${m})`;
  };

  const getLiveCheckoutTotal = (b: Booking) => {
    // For hourly bookings, backend skips auto overtime calculation 
    // (receptionist enters manual extra charges via API).
    // So we just return the stored total.
    if (b.bookingType === 'hourly' || b.ratePlanId === 'RP-0004' || b.ratePlanId === '__custom__') {
      return { total: getBookingTotal(b), overtimeAmount: 0, overtimeMinutes: 0 };
    }

    const expected = new Date(b.expectedCheckOutAt).getTime();
    const now = new Date().getTime();
    
    if (now <= expected) {
      return { total: getBookingTotal(b), overtimeAmount: 0, overtimeMinutes: 0 };
    }

    const overtimeMinutes = Math.max(0, Math.round((now - expected) / 60000));
    const overtimeHours = Math.ceil(overtimeMinutes / 60);
    const overtimeAmount = overtimeHours * OVERTIME_HOURLY_RATE;
    const total = (b.baseAmount ?? 0) + overtimeAmount;

    return { total, overtimeAmount, overtimeMinutes };
  };

  // ── Modal actions ──────────────────────────────────────────────────────────────

  const handleCheckIn = async (bookingId: string) => {
    try {
      await updateStatus(bookingId, 'checked_in');
      await refetchBookings();
      refetchLocalRooms();
      setModal(null);
      showToast('✅ Đã check-in thành công & cập nhật dữ liệu!');
    } catch {
      showToast('❌ Check-in thất bại. Vui lòng thử lại.');
    }
  };

  /**
   * Kiểm tra thông minh trước khi Check-in:
   * Nếu khách đến sớm hơn giờ hẹn > 30 phút: Chặn lại và bật Popup Xác nhận Check-in sớm!
   */
  const triggerCheckIn = (b: Booking, rName?: string) => {
    const scheduledMs = new Date(b.checkInAt).getTime();
    const nowMs = Date.now();
    const earlyMinutes = Math.round((scheduledMs - nowMs) / 60_000);

    if (earlyMinutes > 30) {
      setEarlyCheckInTarget({
        booking: b,
        roomName: rName || roomMap[b.roomId]?.name || b.roomId,
      });
      return;
    }

    handleCheckIn(b.bookingId);
  };

  const handleEarlyCheckInConfirm = async (
    bookingId: string,
    options: { earlySurcharge: number; note?: string }
  ) => {
    try {
      const targetBooking = bookings.find(b => b.bookingId === bookingId);
      if (!targetBooking) return;

      const newTotal = (targetBooking.totalAmount ?? 0) + options.earlySurcharge;
      const newExtra = (targetBooking.extraServicesAmount ?? 0) + options.earlySurcharge;
      const auditNote = options.earlySurcharge > 0
        ? `[Check-in sớm: phụ thu ${formatVnd(options.earlySurcharge)}${options.note ? ` - ${options.note}` : ''}]`
        : `[Check-in sớm miễn phí${options.note ? ` - ${options.note}` : ''}]`;
      const combinedNote = targetBooking.note
        ? `${targetBooking.note} | ${auditNote}`
        : auditNote;

      await bookingsApi.update(bookingId, {
        status: 'checked_in',
        totalAmount: newTotal,
        extraServicesAmount: newExtra > 0 ? newExtra : undefined,
        note: combinedNote,
      });

      await refetchBookings();
      refetchLocalRooms();
      setEarlyCheckInTarget(null);
      setModal(null);
      showToast(
        options.earlySurcharge > 0
          ? `✅ Check-in sớm thành công (+${formatVnd(options.earlySurcharge)} phụ thu)!`
          : '✅ Check-in sớm miễn phí thành công!'
      );
    } catch {
      showToast('❌ Check-in thất bại. Vui lòng thử lại.');
    }
  };

  const handleCheckOutConfirm = async (
    bookingId: string,
    payload: {
      actualCheckOutAt: string;
      paidAmount: number;
      paymentStatus: 'paid' | 'partial' | 'unpaid';
    }
  ) => {
    try {
      await bookingsApi.checkout(bookingId, payload);
      await refetchBookings();
      refetchLocalRooms();
      refetchLocalCleaning();
      setCheckOutTarget(null);
      setModal(null);
      showToast('✅ Check-out thành công & đã quyết toán dòng tiền');
    } catch {
      showToast('Check-out thất bại. Vui lòng thử lại.');
    }
  };

  const handleMarkCleaned = async (cleaningId?: string, roomId?: string) => {
    if (!roomId) return;
    try {
      if (cleaningId) {
        await cleaningApi.transition(cleaningId, { status: 'completed' });
        setCleaningTasks(prev => prev.filter(t => t.cleaningId !== cleaningId));
      }
      await roomsApi.update(roomId, { status: 'available' });
      refetchLocalRooms();
      refetchLocalCleaning();
      setModal(null);
      const rName = roomMap[roomId]?.name ?? roomId;
      showToast(`✅ Đã dọn xong phòng ${rName}! Phòng đã chuyển sang Trống.`);
    } catch {
      showToast('❌ Cập nhật thất bại. Vui lòng thử lại.');
    }
  };

  const handleAddExpense = async (expense: { category: string; amount: number; description: string; date: string; vendor?: string }) => {
    try {
      await expensesApi.create(expense);
      setModal(null);
      showToast('Expense recorded');
    } catch {
      showToast('Failed to save expense.');
    }
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  const card = (dark: boolean) => ({
    background: dark ? '#1E293B' : '#fff',
    borderRadius: 12,
    border: `1px solid ${dark ? '#334155' : '#E2E8F0'}`,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  });

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const borderColor = darkMode ? '#334155' : '#E2E8F0';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: '#1E293B', color: '#fff', padding: '12px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'modalIn 0.2s ease',
        }}>{toast}</div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ ...card(darkMode), display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: textMuted, fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{s.sub}</div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${s.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>{s.icon}</div>
            </div>
            <div style={{ height: 3, borderRadius: 99, background: borderColor, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: i === 1 ? `${totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0}%` : i === 0 ? '100%' : i === 2 ? `${(needsCleaning / Math.max(totalRooms, 1)) * 100}%` : `${Math.min(100, (safeMonthlyTotal / Math.max(safePrev, 1)) * 100)}%`, background: s.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ ...card(darkMode), display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: textMuted, marginRight: 4 }}>Quick Actions</span>
        {[
          { label: '+ Add Booking', action: 'add-booking', color: '#2563EB', bg: '#EFF6FF' },
          { label: '✓ Check In', action: 'check-in', color: '#059669', bg: '#ECFDF5' },
          { label: '⬆ Check Out', action: 'check-out', color: '#D97706', bg: '#FFFBEB' },
          { label: '🧹 Mark Cleaned', action: 'cleaned', color: '#7C3AED', bg: '#F5F3FF' },
          { label: '💳 Add Expense', action: 'expense', color: '#DC2626', bg: '#FEF2F2' },
        ].map(btn => (
          <button
            key={btn.action}
            onClick={() => setModal(btn.action as typeof modal)}
            style={{
              background: btn.bg, color: btn.color,
              border: `1px solid ${btn.color}30`,
              borderRadius: 8, padding: '8px 14px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${btn.color}25`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >{btn.label}</button>
        ))}
      </div>

      {/* Tra cứu & Báo giá phòng trống siêu tốc */}
      <QuickRoomFinder
        rooms={rooms}
        bookings={bookings}
        onBookRoom={handleBookFromFinder}
        darkMode={darkMode}
      />

      {/* Overdue Check-in Alert Banner (Khách quá hạn / No-show) */}
      {overdueCheckIns.length > 0 && (
        <div style={{
          background: darkMode ? '#7F1D1D20' : '#FEF2F2',
          border: `1px solid ${darkMode ? '#991B1B' : '#FECACA'}`,
          borderRadius: 12, padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️</span>
              <span>Có {overdueCheckIns.length} đơn đặt phòng quá hạn ngày Check-in</span>
            </div>
            <span style={{ fontSize: 12, color: darkMode ? '#FCA5A5' : '#991B1B', fontWeight: 500 }}>
              Chưa nhận phòng · Cần xác minh khách đến hay bùng kèo
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {overdueCheckIns.map(b => (
              <div key={b.bookingId} style={{
                background: darkMode ? '#1E293B' : '#FFFFFF',
                border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                borderRadius: 8, padding: '10px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{getGuestName(b)}</div>
                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 500 }}>
                    Phòng {getRoomNumber(b)} · Lẽ ra đến: {formatStayTime(b.checkInAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => updateStatus(b.bookingId, 'checked_in')}
                    title="Khách đến trễ, nhận phòng ngay"
                    style={{
                      padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Check-in
                  </button>
                  <button
                    onClick={() => updateStatus(b.bookingId, 'cancelled')}
                    title="Khách không đến, hủy phòng giải phóng lịch"
                    style={{
                      padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: darkMode ? '#334155' : '#F1F5F9',
                      color: '#EF4444', border: `1px solid ${darkMode ? '#475569' : '#CBD5E1'}`,
                      cursor: 'pointer',
                    }}
                  >
                    No-show
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Arrivals & Departures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Checking In */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🛬</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Khách nhận phòng hôm nay (Checking In)</div>
            </div>
            <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{checkingIn.length}</span>
          </div>
          {checkingIn.length === 0 ? (
            <div style={{ color: textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>✨ Hôm nay không có lượt nhận phòng nào</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checkingIn.map(b => (
                <div
                  key={b.bookingId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: darkMode ? '#0F172A' : '#F8FAFC',
                    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getGuestName(b)}
                    </div>
                    <div style={{ fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                      Phòng <strong>{getRoomNumber(b)}</strong> · In: <span style={{ color: '#2563EB', fontWeight: 600 }}>{formatStayTime(b.checkInAt)}</span> · {b.numGuests ?? 1} khách
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setEditBooking(b)}
                      title="Sửa nhanh thông tin đơn"
                      style={{
                        background: 'none',
                        border: `1px solid ${darkMode ? '#475569' : '#CBD5E1'}`,
                        color: textMuted,
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      onClick={() => triggerCheckIn(b, roomMap[b.roomId]?.name)}
                      style={{
                        background: '#2563EB',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                      }}
                    >
                      ✓ Check-in
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checking Out */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🛫</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Khách trả phòng hôm nay (Checking Out)</div>
            </div>
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{checkingOut.length}</span>
          </div>
          {checkingOut.length === 0 ? (
            <div style={{ color: textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>✨ Hôm nay không có lượt trả phòng nào</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checkingOut.map(b => {
                const depositPaid = b.paidAmount ?? b.depositAmount ?? 0;
                const totalAmt = getBookingTotal(b);
                const balanceDue = Math.max(0, totalAmt - depositPaid);

                return (
                  <div
                    key={b.bookingId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: darkMode ? '#0F172A' : '#F8FAFC',
                      border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getGuestName(b)}
                      </div>
                      <div style={{ fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                        Phòng <strong>{getRoomNumber(b)}</strong> · Out: <span style={{ color: '#D97706', fontWeight: 600 }}>{formatStayTime(b.expectedCheckOutAt)}</span> · Tổng: <strong>{formatVnd(totalAmt)}</strong>
                        {balanceDue > 0 && <span style={{ color: '#EF4444', fontWeight: 700, marginLeft: 4 }}>(Còn thu: {formatVnd(balanceDue)})</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setEditBooking(b)}
                        title="Sửa nhanh thông tin đơn"
                        style={{
                          background: 'none',
                          border: `1px solid ${darkMode ? '#475569' : '#CBD5E1'}`,
                          color: textMuted,
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => setCheckOutTarget(b)}
                        style={{
                          background: '#F59E0B',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 12px',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(245,158,11,0.3)',
                        }}
                      >
                        Check-out
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Cụm 2: Báo cáo & Phân tích Doanh thu (Song song) ────────────────────────── */}
      {!isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 0 0' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: 0 }}>Báo cáo & Phân tích Doanh thu</h3>
            <button
              onClick={() => navigate('/app/reports')}
              style={{
                background: 'none', border: 'none', color: '#2563EB', fontSize: 13,
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 6,
              }}
            >
              Xem phân tích chi tiết & P&L ➔
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            {/* Doanh thu vs Chi phí (6 tháng) */}
            <div style={card(darkMode)}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Doanh thu vs Chi phí</div>
                  <div style={{ fontSize: 12, color: textMuted }}>6 tháng gần nhất</div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#2563EB' }} />
                    <span style={{ color: textPrimary, fontWeight: 600 }}>Doanh thu</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
                    <span style={{ color: textPrimary, fontWeight: 600 }}>Chi phí</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} />
                  <YAxis width={60} tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={formatShortVnd} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }}
                    formatter={(v: any, name: any) => [formatVnd(Number(v) || 0), String(name || '')]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#rev)" name="Doanh thu" />
                  <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#exp)" name="Chi phí" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Doanh thu từng phòng (Cột đứng) */}
            <div style={card(darkMode)}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Doanh thu theo từng phòng</div>
                <div style={{ fontSize: 12, color: textMuted }}>Xếp hạng doanh thu tháng này</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByRoomData} barSize={22} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: textPrimary, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis width={60} tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={formatShortVnd} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }}
                    formatter={(v: unknown) => [formatVnd(v as number), 'Doanh thu']}
                  />
                  <Bar dataKey="revenue" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cụm 1: Sơ đồ phòng & Tỉ trọng nguồn khách (Kế bên nhau) ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: 16 }}>
        {/* Sơ đồ phòng (Room Rack) */}
        <div style={card(darkMode)}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 4px 0' }}>Sơ đồ phòng (Room Rack)</h3>
            <div style={{ fontSize: 12, color: textMuted }}>Trạng thái phòng hiện tại</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {rooms.filter(r => r.active && r.status !== 'inactive').map(room => {
              const currentBooking = bookings.find(b => (b.roomId === room.roomId || b.roomId === (room as any).id) && b.status === 'checked_in');
              const cleaningTask = cleaningTasks.find(t => (t.roomId === room.roomId || t.roomId === (room as any).id) && t.status !== 'completed');
              
              // Lấy các booking sắp tới của phòng này (chưa check-in, chưa huỷ, chưa checkout) và sort theo giờ check-in tăng dần
              const upcomingBookingsForRoom = (bookings || [])
                .filter(b => {
                  if (!b || b.status === 'cancelled' || b.status === 'checked_out' || b.status === 'checked_in') return false;
                  if (b.roomId !== room.roomId && b.roomId !== (room as any).id) return false;
                  return true;
                })
                .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());

              // Booking sắp đến GẦN NHẤT trong khung giờ liên quan (-4h đến +36h)
              const nowMs = new Date().getTime();
              const incoming = upcomingBookingsForRoom.find(b => {
                const diffHours = (new Date(b.checkInAt).getTime() - nowMs) / (1000 * 3600);
                return diffHours >= -4 && diffHours <= 36;
              });

              let statusText = 'Trống';
              let bgLight = darkMode ? '#064E3B' : '#ECFDF5';
              let borderColor = darkMode ? '#047857' : '#A7F3D0';
              let textColor = darkMode ? '#34D399' : '#065F46';

              if (currentBooking) {
                statusText = 'Có khách';
                bgLight = darkMode ? '#7F1D1D' : '#FEF2F2';
                borderColor = darkMode ? '#B91C1C' : '#FECACA';
                textColor = darkMode ? '#F87171' : '#991B1B';
              } else if (room.status === 'needs_cleaning' || cleaningTask) {
                statusText = 'Cần dọn';
                bgLight = darkMode ? '#78350F' : '#FFFBEB';
                borderColor = darkMode ? '#D97706' : '#FDE68A';
                textColor = darkMode ? '#FBBF24' : '#92400E';
              } else if (room.status === 'maintenance') {
                statusText = 'Bảo trì';
                bgLight = darkMode ? '#334155' : '#F1F5F9';
                borderColor = darkMode ? '#475569' : '#E2E8F0';
                textColor = darkMode ? '#94A3B8' : '#64748B';
              }

              const live = currentBooking ? getLiveCheckoutTotal(currentBooking) : null;
              const isOverdue = live && live.overtimeMinutes > 0;

              return (
                <div key={room.roomId || (room as any).id} style={{
                  background: darkMode ? '#0F172A' : '#F8FAFC',
                  borderRadius: 10,
                  border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '6px 10px', background: bgLight, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: textColor, fontSize: 13 }}>{room.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: textColor, background: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)', padding: '1px 6px', borderRadius: 8 }}>{statusText}</span>
                  </div>
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 80 }}>
                    {currentBooking ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getGuestName(currentBooking)}</div>
                        <div style={{ fontSize: 11, color: isOverdue ? '#EF4444' : textMuted }}>Out: {formatStayTime(currentBooking.expectedCheckOutAt)} {isOverdue && '(Quá giờ)'}</div>
                        {incoming && (
                          <div style={{ fontSize: 10, background: darkMode ? '#1E3A8A33' : '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🕒 Tiếp: {getGuestName(incoming)} ({formatStayTime(incoming.checkInAt)})
                          </div>
                        )}
                        {(() => {
                          const depositPaid = currentBooking.paidAmount ?? currentBooking.depositAmount ?? 0;
                          const totalAmt = live?.total || getBookingTotal(currentBooking);
                          const balanceDue = Math.max(0, totalAmt - depositPaid);
                          return (
                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                background: balanceDue > 0 ? (darkMode ? '#7F1D1D30' : '#FEF2F2') : (darkMode ? '#064E3B30' : '#ECFDF5'),
                                color: balanceDue > 0 ? '#EF4444' : '#10B981',
                                display: 'flex', justifyContent: 'space-between',
                              }}>
                                <span>{balanceDue > 0 ? 'Cần thu:' : 'Đã trả đủ:'}</span>
                                <span>{balanceDue > 0 ? formatVnd(balanceDue) : formatVnd(totalAmt)}</span>
                              </div>
                              <button
                                onClick={() => setCheckOutTarget(currentBooking)}
                                style={{ background: '#F59E0B', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Check-out & Thu tiền
                              </button>
                            </div>
                          );
                        })()}
                      </>
                    ) : (room.status === 'needs_cleaning' || cleaningTask) ? (
                      <>
                        <div style={{ fontSize: 11, color: textPrimary }}>Phòng đang đợi dọn</div>
                        {incoming && (
                          <div style={{ fontSize: 10, background: darkMode ? '#1E3A8A33' : '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 4, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🕒 Tiếp: {getGuestName(incoming)} ({formatStayTime(incoming.checkInAt)})
                          </div>
                        )}
                        <button
                          onClick={() => handleMarkCleaned(cleaningTask?.cleaningId, room.roomId)}
                          style={{
                            marginTop: 'auto',
                            background: '#F59E0B',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.25)',
                          }}
                        >
                          ✓ Đã dọn xong
                        </button>
                      </>
                    ) : room.status === 'maintenance' ? (
                      <div style={{ fontSize: 11, color: textMuted, fontStyle: 'italic', display: 'flex', flex: 1, alignItems: 'center' }}>Đang bảo trì</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>🟢</span> Phòng trống
                        </div>
                        {incoming && (
                          <div style={{ fontSize: 10, background: darkMode ? '#1E3A8A33' : '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🕒 Tiếp: {getGuestName(incoming)} ({formatStayTime(incoming.checkInAt)})
                          </div>
                        )}
                        <div style={{ marginTop: 'auto', display: 'flex', gap: 4 }}>
                          {incoming && (
                            <button
                              type="button"
                              onClick={() => triggerCheckIn(incoming, room.name)}
                              title="Nhận phòng cho khách sắp tới"
                              style={{
                                flex: 1,
                                background: '#3B82F6',
                                color: '#fff',
                                border: 'none',
                                padding: '5px 6px',
                                borderRadius: 6,
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              ✓ Check-in
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setFinderPrefill({ roomId: room.roomId, checkInDate: TODAY_DATE });
                              setModal('add-booking');
                            }}
                            title="Tạo đơn đặt phòng theo giờ hoặc qua đêm"
                            style={{
                              flex: incoming ? undefined : 1,
                              background: 'transparent',
                              color: '#2563EB',
                              border: `1px dashed ${borderColor}`,
                              padding: '5px 8px',
                              borderRadius: 6,
                              fontSize: 10.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Đặt phòng
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tỉ trọng nguồn khách (Kế bên Sơ đồ phòng) */}
        <div style={card(darkMode)}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 3px 0' }}>Tỉ trọng nguồn khách</h3>
              <div style={{ fontSize: 12, color: textMuted }}>Phân bổ theo kênh đặt phòng (Channel Mix)</div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: darkMode ? '#334155' : '#F1F5F9', color: textMuted,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Tổng: {totalChannelCustomers}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: 'calc(100% - 44px)' }}>
            <div style={{ width: '100%', height: 160, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {channelMixData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(v: any, name: any) => [`${v} khách`, String(name || '')]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Donut Metric */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: textPrimary, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                  {totalChannelCustomers}
                </div>
                <div style={{ fontSize: 9.5, color: textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                  Khách
                </div>
              </div>
            </div>
            
            {/* Legend gọn gàng, chuẩn Data Analytics */}
            <div style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px',
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px dashed ${darkMode ? '#334155' : '#E2E8F0'}`,
            }}>
              {channelMixData.map(entry => (
                <div key={entry.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '3px 6px', borderRadius: 6,
                  background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span style={{
                      color: textPrimary, fontWeight: 500, fontSize: 11.5,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {entry.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {entry.count}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: textMuted,
                      background: darkMode ? '#334155' : '#F1F5F9',
                      padding: '1px 4px', borderRadius: 4,
                    }}>
                      {entry.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      <BookingFormModal
        open={modal === 'add-booking'}
        onClose={() => {
          setModal(null);
          setFinderPrefill(null);
        }}
        initialRoomId={finderPrefill?.roomId}
        initialDate={finderPrefill?.checkInDate}
        initialCheckOutDate={finderPrefill?.checkOutDate}
        initialCheckInTime={finderPrefill?.checkInTime}
        initialCheckOutTime={finderPrefill?.checkOutTime}
        initialGuests={finderPrefill?.numGuests}
        darkMode={darkMode}
        onCreated={() => {
          refetchBookings();
          refetchLocalRooms();
          setFinderPrefill(null);
          showToast('Tạo đơn đặt phòng thành công');
        }}
      />

      <Modal open={modal === 'check-in'} onClose={() => setModal(null)} title="Check In Guest" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {checkingIn.length > 0 ? (
            <>
              <p style={{ margin: 0, color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>Chọn booking muốn check-in:</p>
              {checkingIn.map(b => (
                <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, cursor: 'pointer' }}
                  onClick={() => triggerCheckIn(b, roomMap[b.roomId]?.name)}>
                  <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
                  <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B' }}>Room {getRoomNumber(b)} · {(b.checkInAt || '').slice(0, 16).replace('T', ' ')} → {(b.expectedCheckOutAt || '').slice(0, 16).replace('T', ' ')}</div>
                </div>
              ))}
            </>
          ) : (
            <p style={{ margin: 0, color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>Hôm nay không có khách nào chờ check-in.</p>
          )}
        </div>
      </Modal>

      <Modal open={modal === 'check-out'} onClose={() => setModal(null)} title="Check Out Guest" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {checkingOut.map(b => {
            const live = getLiveCheckoutTotal(b);
            const isOverdue = live.overtimeMinutes > 0;
            const depositPaid = b.paidAmount ?? b.depositAmount ?? 0;
            const balanceDue = Math.max(0, live.total - depositPaid);

            return (
              <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}` }}>
                <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B', marginBottom: 8, lineHeight: 1.5 }}>
                  <div>Room {getRoomNumber(b)} · {(b.checkInAt || '').slice(0, 16).replace('T', ' ')} → {(b.expectedCheckOutAt || '').slice(0, 16).replace('T', ' ')}</div>
                  {isOverdue && (
                    <div style={{ color: '#EF4444' }}>
                      Quá giờ: {formatMinutes(live.overtimeMinutes)} (Phụ thu: +{formatVnd(live.overtimeAmount)})
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span>Đã cọc: <strong>{formatVnd(depositPaid)}</strong></span>
                    <span>·</span>
                    <span style={{ color: balanceDue > 0 ? '#EF4444' : '#10B981', fontWeight: 700 }}>
                      {balanceDue > 0 ? `Cần thu nốt: ${formatVnd(balanceDue)}` : 'Đã thu đủ 100%'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setModal(null);
                    setCheckOutTarget(b);
                  }}
                  style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Mở phiếu Check-out & Thêm phụ thu
                </button>
              </div>
            );
          })}
          {checkingOut.length === 0 && <p style={{ color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13, margin: 0 }}>Hôm nay không có khách nào cần check-out.</p>}
        </div>
      </Modal>

      {/* Smart Check-out Modal with Extras & Accounting Settlement */}
      <CheckOutModal
        open={!!checkOutTarget}
        onClose={() => setCheckOutTarget(null)}
        booking={checkOutTarget}
        room={checkOutTarget ? roomMap[checkOutTarget.roomId] : null}
        darkMode={darkMode}
        onConfirmCheckOut={handleCheckOutConfirm}
      />

      {/* Early Check-in Interceptor Modal */}
      <EarlyCheckInModal
        open={!!earlyCheckInTarget}
        onClose={() => setEarlyCheckInTarget(null)}
        booking={earlyCheckInTarget?.booking ?? null}
        roomName={earlyCheckInTarget?.roomName}
        darkMode={darkMode}
        onConfirm={handleEarlyCheckInConfirm}
      />

      <Modal open={modal === 'cleaned'} onClose={() => setModal(null)} title="Đánh dấu đã dọn xong phòng (Mark Cleaned)" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {roomsNeedingCleaning.map(room => {
            const rId = room.roomId || (room as any).id;
            const task = cleaningTasks.find(t => (t.roomId === rId || t.roomId === room.roomId) && t.status !== 'completed');
            return (
              <div key={rId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, background: darkMode ? '#0F172A' : '#F8FAFC' }}>
                <div>
                  <div style={{ fontWeight: 700, color: darkMode ? '#F1F5F9' : '#1E293B', fontSize: 13 }}>Phòng {room.name}</div>
                  <div style={{ fontSize: 11, color: '#D97706', marginTop: 2, fontWeight: 600 }}>
                    🧹 {task ? (task.status === 'in_progress' ? 'Đang dọn dẹp' : 'Chờ dọn dẹp') : 'Phòng cần dọn dẹp'}
                  </div>
                </div>
                <button
                  onClick={() => handleMarkCleaned(task?.cleaningId, rId)}
                  style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✓ Đã dọn xong
                </button>
              </div>
            );
          })}
          {roomsNeedingCleaning.length === 0 && (
            <div style={{ color: textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              ✨ Tất cả các phòng đều đã sạch sẽ, không có phòng nào cần dọn!
            </div>
          )}
        </div>
      </Modal>

      <Modal open={modal === 'expense'} onClose={() => setModal(null)} title="Add Expense" darkMode={darkMode}>
        <ExpenseForm darkMode={darkMode} onSave={handleAddExpense} />
      </Modal>

      <QuickEditModal
        booking={editBooking}
        guestName={editBooking ? (customerMap.get((editBooking.customerId || '').trim()) || editBooking.guestName) : undefined}
        roomName={editBooking ? roomMap[editBooking.roomId]?.name : undefined}
        onClose={() => setEditBooking(null)}
        onSuccess={() => {
          showToast('✅ Đã cập nhật booking thành công');
          refetchBookings();
          refetchLocalRooms();
          refetchLocalCleaning();
        }}
        darkMode={darkMode}
      />
    </div>
  );
}

// ─── Inline expense form ─────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Tiền phòng',
  'Tiền điện',
  'Tiền nước',
  'Dụng cụ dọn dẹp',
  'Sửa chữa & Bảo trì',
  'Đồ dùng Homestay (Nước giặt, gia vị...)',
  'Internet / Wifi',
  'Chi phí khác',
];

function ExpenseForm({ darkMode, onSave }: { darkMode: boolean; onSave: (e: { category: string; amount: number; description: string; date: string; vendor?: string }) => void }) {
  const [category, setCategory] = useState('Tiền điện');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(TODAY_DATE);

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#E2E8F0' : '#1E293B',
    fontSize: 13, fontFamily: "var(--font-sans)", outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[
        { label: 'Danh mục', el: <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select> },
        { label: 'Số tiền (VND) *', el: <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} /> },
        { label: 'Mô tả chi phí (tùy chọn)', el: <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Nội dung chi tiêu (mặc định theo danh mục)" style={inputStyle} /> },
        { label: 'Nơi mua / Nhà cung cấp (tùy chọn)', el: <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Siêu thị, cửa hàng..." style={inputStyle} /> },
        { label: 'Ngày chi *', el: <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /> },
      ].map(({ label, el }) => (
        <div key={label}>
          <label style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#94A3B8' : '#64748B', display: 'block', marginBottom: 4 }}>{label}</label>
          {el}
        </div>
      ))}
      <button
        onClick={() => {
          if (!amount || parseFloat(amount) <= 0) return;
          const desc = description.trim() || category;
          onSave({ category, amount: parseFloat(amount), description: desc, date, vendor: vendor.trim() || undefined });
        }}
        style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
        Lưu khoản chi
      </button>
    </div>
  );
}
