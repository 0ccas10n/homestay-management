// ─── Dashboard.tsx ────────────────────────────────────────────────────────────────────
//
// Uses useDashboard for stat cards, Today's Activity sections, and chart data.
// Modals make real API calls instead of just updating local state.
//
// Pages rendered inside AppShell receive darkMode via useOutletContext().
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { formatVnd, getBookingTotal } from '@/utils/format';

const TODAY_DATE = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
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
    roomsApi.getInternal().then(r => setRooms(r)).catch(() => {});
  }, []);

  const refetchLocalCleaning = useCallback(() => {
    cleaningApi.get({ active: 'true' }).then(c => setCleaningTasks(c)).catch(() => {});
  }, []);

  useEffect(() => {
    refetchLocalRooms();
    refetchLocalCleaning();
    refetchBookings().catch(() => {});
  }, [refetchBookings, refetchLocalRooms, refetchLocalCleaning]);

  const roomMap: Record<string, (typeof rooms)[number] | undefined> = {};
  for (const r of rooms) roomMap[r.roomId] = r;

  const [modal, setModal] = useState<null | 'add-booking' | 'check-in' | 'check-out' | 'cleaned' | 'expense'>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const totalRooms = rooms.length;
  const occupied = dashboard?.occupiedRooms ?? 0;
  const available = dashboard?.availableRooms ?? 0;
  const needsCleaning = dashboard?.roomsToClean ?? 0;

  const today = TODAY_DATE;
  const checkingIn = bookings.filter(b => {
    if (b.status === 'cancelled' || (b.status !== 'confirmed' && b.status !== 'inquiry')) return false;
    const checkInDate = b.checkInAt.slice(0, 10);
    return checkInDate <= today;
  });
  const checkingOut = bookings.filter(b => {
    if (b.status !== 'checked_in') return false;
    const checkoutDate = b.expectedCheckOutAt.slice(0, 10);
    return checkoutDate <= today;
  });

  const activeCleaning = cleaningTasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress',
  );

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

  const statColors = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
  const statCards = [
    { label: 'Số phòng', value: available, sub: `${available} phòng`, color: statColors[0], icon: '🛏' },
    { label: 'Đang có khách', value: occupied, sub: `${totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0}%`, color: statColors[1], icon: '👤' },
    { label: 'Cần dọn dẹp', value: needsCleaning, sub: `${activeCleaning.length}`, color: statColors[2], icon: '🧹' },
    { label: 'Doanh thu tháng', value: formatVnd(monthlyRevenueTotal), sub: monthlyDeltaText, color: statColors[3], icon: '💰' },
  ];

  const { customers } = useCustomers();
  const customerMap = React.useMemo(() => new Map(customers.map(c => [c.customerId, c.name])), [customers]);

  // Tỉ trọng kênh bán (Channel Mix)
  const channelMixData = React.useMemo(() => {
    const counts: Record<string, number> = {
      'FACEBOOK': 0,
      'ZALO': 0,
      'TIKTOK': 0,
      'INSTAGRAM': 0,
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
      'FACEBOOK': '#1877F2',                                      // Xanh đậm Facebook
      'ZALO': '#38BDF8',                                          // Xanh nhạt Sky Blue (Zalo)
      'TIKTOK': darkMode ? '#F1F5F9' : '#000000',                 // Đen TikTok (Trắng sáng trên DarkMode để không bị chìm)
      'INSTAGRAM': '#F56040',                                     // Cam hồng Instagram
      'DIRECT / KHÁC': '#64748B',                                 // Xám trung tính (Chuẩn UX cho mục "Khác")
    };

    const result = Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: CHANNEL_COLORS[name] || '#64748B',
      }));

    if (result.length === 0) {
      return [{ name: 'DIRECT / KHÁC', count: customers.length || 1, percentage: 100, color: '#64748B' }];
    }
    return result;
  }, [customers, darkMode]);

  // Doanh thu theo từng phòng
  const revenueByRoomData = React.useMemo(() => {
    const activeRooms = rooms.filter(r => r.active && r.status !== 'inactive');
    const revMap = new Map<string, number>();

    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const amount = getBookingTotal(b);
      revMap.set(b.roomId, (revMap.get(b.roomId) || 0) + amount);
    });

    return activeRooms
      .map(r => ({
        name: r.name,
        revenue: revMap.get(r.id) || revMap.get(r.roomId) || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rooms, bookings]);

  const getGuestName = (booking: Booking): string => {
    return booking.guestName || customerMap.get(booking.customerId) || booking.customerId;
  };

  const getRoomNumber = (booking: Booking): string => {
    const r = roomMap[booking.roomId];
    return r?.name ?? booking.roomId;
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
      const ok = await updateStatus(bookingId, 'checked_in');
      if (ok) {
        await refetchBookings();
        setModal(null);
        showToast('Guest checked in successfully');
      }
    } catch {
      showToast('Check-in failed. Please try again.');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      const now = new Date().toISOString();
      await bookingsApi.update(bookingId, { actualCheckOutAt: now });
      await refetchBookings();
      refetchLocalRooms(); // room status flips to 'needs_cleaning' on the server
      refetchLocalCleaning(); // a new cleaning task is generated on the server
      setModal(null);
      showToast('Guest checked out — room flagged for cleaning');
    } catch {
      showToast('Check-out failed. Please try again.');
    }
  };

  const handleMarkCleaned = async (cleaningId: string, roomId: string) => {
    try {
      await cleaningApi.transition(cleaningId, { status: 'completed' });
      await roomsApi.update(roomId, { status: 'available' });
      setCleaningTasks(prev => prev.filter(t => t.cleaningId !== cleaningId));
      setModal(null);
      showToast('Room marked as cleaned');
    } catch {
      showToast('Failed to update. Please try again.');
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

      {/* Today's Arrivals & Departures */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Checking In */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Checking In Today</div>
            <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{checkingIn.length}</span>
          </div>
          {checkingIn.length === 0 ? (
            <p style={{ color: textMuted, fontSize: 13, margin: 0 }}>No arrivals today</p>
          ) : checkingIn.map(b => (
            <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 12, color: textMuted }}>Room {getRoomNumber(b)} · {b.checkInAt.slice(11, 16)} · {b.numGuests ?? 1} khách</div>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>

        {/* Checking Out */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Checking Out Today</div>
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{checkingOut.length}</span>
          </div>
          {checkingOut.length === 0 ? (
            <p style={{ color: textMuted, fontSize: 13, margin: 0 }}>No departures today</p>
          ) : checkingOut.map(b => (
            <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 12, color: textMuted }}>Room {getRoomNumber(b)} · {b.expectedCheckOutAt.slice(11, 16)} · Tổng: {formatVnd(getBookingTotal(b))}</div>
              </div>
              <StatusBadge status="Checked In" />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Cụm 2: Báo cáo & Phân tích Doanh thu (Song song) ────────────────────────── */}
      {!isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: '8px 0 0 0' }}>Báo cáo & Phân tích Doanh thu</h3>
          
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
                  <YAxis tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={v => formatVnd(v as number)} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#rev)" name="Doanh thu" />
                  <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#exp)" name="Chi phí" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Doanh thu từng phòng (Cột đứng) */}
            <div style={card(darkMode)}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Doanh thu theo từng phòng</div>
                <div style={{ fontSize: 12, color: textMuted }}>Xếp hạng doanh thu thực tế</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByRoomData} barSize={22} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: textPrimary, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={v => formatVnd(v as number)} />
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
              const incoming = checkingIn.find(b => (b.roomId === room.roomId || b.roomId === (room as any).id));

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
              } else if (incoming) {
                statusText = 'Sắp đến';
                bgLight = darkMode ? '#1E3A8A' : '#EFF6FF';
                borderColor = darkMode ? '#1D4ED8' : '#BFDBFE';
                textColor = darkMode ? '#60A5FA' : '#1E40AF';
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
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 72 }}>
                    {currentBooking ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getGuestName(currentBooking)}</div>
                        <div style={{ fontSize: 11, color: isOverdue ? '#EF4444' : textMuted }}>Out: {currentBooking.expectedCheckOutAt.slice(11, 16)} {isOverdue && '(Quá giờ)'}</div>
                        <div style={{ fontSize: 11, color: textMuted, marginTop: 'auto' }}>Tổng: <strong style={{ color: isOverdue ? '#EF4444' : textPrimary }}>{formatVnd(live?.total || 0)}</strong></div>
                      </>
                    ) : cleaningTask ? (
                      <>
                        <div style={{ fontSize: 11, color: textPrimary }}>Phòng đang đợi dọn</div>
                        <button onClick={() => setModal('cleaned')} style={{ marginTop: 'auto', background: '#F59E0B', color: '#fff', border: 'none', padding: '4px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Đã dọn xong</button>
                      </>
                    ) : incoming ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getGuestName(incoming)}</div>
                        <div style={{ fontSize: 11, color: textMuted }}>In: {incoming.checkInAt.slice(11, 16)}</div>
                        <button onClick={() => setModal('check-in')} style={{ marginTop: 'auto', background: '#3B82F6', color: '#fff', border: 'none', padding: '4px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Check-in</button>
                      </>
                    ) : room.status === 'maintenance' ? (
                      <div style={{ fontSize: 11, color: textMuted, fontStyle: 'italic', display: 'flex', flex: 1, alignItems: 'center' }}>Đang bảo trì</div>
                    ) : (
                      <div style={{ fontSize: 11, color: textMuted, fontStyle: 'italic', display: 'flex', flex: 1, alignItems: 'center' }}>Phòng trống</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tỉ trọng nguồn khách (Kế bên Sơ đồ phòng) */}
        <div style={card(darkMode)}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 4px 0' }}>Tỉ trọng nguồn khách</h3>
            <div style={{ fontSize: 12, color: textMuted }}>Phân bổ theo kênh đặt phòng (Channel Mix)</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: 'calc(100% - 46px)' }}>
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {channelMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }}
                    formatter={(v: unknown, name: string) => [`${v} khách (${channelMixData.find(c => c.name === name)?.percentage || 0}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              {channelMixData.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, background: darkMode ? '#0F172A' : '#F8FAFC', padding: '6px 8px', borderRadius: 6, border: `1px solid ${borderColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ color: textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: item.color, marginLeft: 4 }}>{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}

      <BookingFormModal
        open={modal === 'add-booking'}
        onClose={() => setModal(null)}
        darkMode={darkMode}
        onCreated={async () => {
          setModal(null);
          await refetchBookings();
          showToast('Booking created successfully');
        }}
        onError={msg => showToast(msg)}
      />

      <Modal open={modal === 'check-in'} onClose={() => setModal(null)} title="Check In Guest" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {checkingIn.length > 0 ? (
            <>
              <p style={{ margin: 0, color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>Chọn booking muốn check-in:</p>
              {checkingIn.map(b => (
                <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, cursor: 'pointer' }}
                  onClick={() => handleCheckIn(b.bookingId)}>
                  <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
                  <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B' }}>Room {getRoomNumber(b)} · {b.checkInAt.slice(0, 16).replace('T', ' ')} → {b.expectedCheckOutAt.slice(0, 16).replace('T', ' ')}</div>
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
            return (
              <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}` }}>
                <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B', marginBottom: 8, lineHeight: 1.5 }}>
                  <div>Room {getRoomNumber(b)} · {b.checkInAt.slice(0, 16).replace('T', ' ')} → {b.expectedCheckOutAt.slice(0, 16).replace('T', ' ')}</div>
                  {isOverdue && (
                    <div style={{ color: '#EF4444' }}>
                      Quá giờ: {formatMinutes(live.overtimeMinutes)} (Phụ thu: +{formatVnd(live.overtimeAmount)})
                    </div>
                  )}
                  <div>Tổng thu: <strong style={{ color: isOverdue ? '#EF4444' : 'inherit', fontSize: 14 }}>{formatVnd(live.total)}</strong></div>
                </div>
                <button onClick={() => handleCheckOut(b.bookingId)} style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Xác nhận Check-out & Thu tiền
                </button>
              </div>
            );
          })}
          {checkingOut.length === 0 && <p style={{ color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13, margin: 0 }}>Hôm nay không có khách nào cần check-out.</p>}
        </div>
      </Modal>

      <Modal open={modal === 'cleaned'} onClose={() => setModal(null)} title="Mark Room as Cleaned" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cleaningTasks.filter(t => t.status !== 'completed').map(t => (
            <div key={t.cleaningId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}` }}>
              <div>
                <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B', fontSize: 13 }}>Room {roomMap[t.roomId]?.name ?? t.roomId}</div>
                <StatusBadge status={t.status} />
              </div>
              <button
                onClick={() => handleMarkCleaned(t.cleaningId, t.roomId)}
                style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Mark Done
              </button>
            </div>
          ))}
          {cleaningTasks.filter(t => t.status !== 'completed').length === 0 && (
            <p style={{ color: '#64748B', fontSize: 13 }}>No rooms to clean.</p>
          )}
        </div>
      </Modal>

      <Modal open={modal === 'expense'} onClose={() => setModal(null)} title="Add Expense" darkMode={darkMode}>
        <ExpenseForm darkMode={darkMode} onSave={handleAddExpense} />
      </Modal>
    </div>
  );
}

// ─── Inline expense form ─────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ['Cleaning Supplies', 'Electricity', 'Water', 'Internet', 'Repairs', 'Staff', 'Other'];

function ExpenseForm({ darkMode, onSave }: { darkMode: boolean; onSave: (e: { category: string; amount: number; description: string; date: string; vendor?: string }) => void }) {
  const [category, setCategory] = useState('Cleaning Supplies');
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
        { label: 'Category', el: <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select> },
        { label: 'Amount (VND)', el: <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} /> },
        { label: 'Description', el: <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" style={inputStyle} /> },
        { label: 'Vendor (optional)', el: <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name" style={inputStyle} /> },
        { label: 'Date', el: <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /> },
      ].map(({ label, el }) => (
        <div key={label}>
          <label style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#94A3B8' : '#64748B', display: 'block', marginBottom: 4 }}>{label}</label>
          {el}
        </div>
      ))}
      <button
        onClick={() => {
          if (!amount || !description) return;
          onSave({ category, amount: parseFloat(amount), description, date, vendor });
        }}
        style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
        Save Expense
      </button>
    </div>
  );
}
