// ─── Reports.tsx ─────────────────────────────────────────────────────────────────────
//
// Financial Analytics & P&L Statement Dashboard
// Structured 5-Tier Architecture:
//   1. Header & Dynamic Time Period Filters (Tháng này / Tháng trước / Quý / Năm / Tùy chọn) + Export Excel
//   2. Top 4 KPI Metric Cards (Doanh thu | Chi phí | Lợi nhuận | Biên lợi nhuận %)
//   3. 6-Month Macro Trend (Grouped Bar Revenue/Expenses + Margin Line %)
//   4. 3 Period Structure Breakdown Charts (Công suất từng phòng | Nguồn khách Kênh | Cơ cấu Chi phí)
//   5. Financial P&L Statement Table (Kế toán Quản trị Lời / Lỗ chi tiết)
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useBookings } from '@/hooks/useBookings';
import { useExpenses } from '@/hooks/useExpenses';
import { useCustomers } from '@/hooks/useCustomers';
import { useRooms } from '@/hooks/useRooms';
import { formatVnd, getBookingTotal } from '@/utils/format';
import type { BookingStatus } from '@/types/index';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

const REVENUE_STATUS_SET = new Set(['confirmed', 'checked_in', 'checked_out', 'checkedin', 'checkedout', 'completed', 'paid']);

function isRevenueStatus(status?: string): boolean {
  if (!status) return false;
  const s = String(status).toLowerCase().trim().replace(/[\s-]/g, '_');
  return REVENUE_STATUS_SET.has(s) || s === 'checkedin' || s === 'checkedout';
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type TimeRange = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

export default function Reports() {
  const outletCtx = useOutletContext<{ darkMode?: boolean }>() || {};
  const darkMode = Boolean(outletCtx.darkMode);

  const { bookings = [], loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const { expenses = [], loading: expensesLoading, refetch: refetchExpenses } = useExpenses();
  const { customers = [] } = useCustomers();
  const { rooms = [] } = useRooms();
  const totalRoomsCount = rooms.length > 0 ? rooms.length : 6;

  useEffect(() => {
    refetchBookings().catch(() => {});
    refetchExpenses().catch(() => {});
  }, [refetchBookings, refetchExpenses]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const now = new Date();
  const todayStr = formatDateStr(now);

  // 1. Time Period state
  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return formatDateStr(d);
  });
  const [customEnd, setCustomEnd] = useState(() => todayStr);

  // Derive active date boundaries (Timezone safe)
  const { startDate, endDate, periodLabel, isOngoingPeriod } = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth();

    if (timeRange === 'this_month') {
      const start = formatDateStr(new Date(y, m, 1));
      const end = formatDateStr(new Date(y, m + 1, 0));
      return { startDate: start, endDate: end, periodLabel: `Tháng này (Thg ${m + 1}/${y})`, isOngoingPeriod: true };
    }
    if (timeRange === 'last_month') {
      const start = formatDateStr(new Date(y, m - 1, 1));
      const end = formatDateStr(new Date(y, m, 0));
      const lastMonthNum = m === 0 ? 12 : m;
      const lastMonthYear = m === 0 ? y - 1 : y;
      return { startDate: start, endDate: end, periodLabel: `Tháng trước (Thg ${lastMonthNum}/${lastMonthYear})`, isOngoingPeriod: false };
    }
    if (timeRange === 'this_quarter') {
      const q = Math.floor(m / 3);
      const start = formatDateStr(new Date(y, q * 3, 1));
      const end = formatDateStr(new Date(y, (q + 1) * 3, 0));
      return { startDate: start, endDate: end, periodLabel: `Quý ${q + 1}/${y}`, isOngoingPeriod: true };
    }
    if (timeRange === 'this_year') {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { startDate: start, endDate: end, periodLabel: `Năm ${y}`, isOngoingPeriod: true };
    }
    // custom
    return {
      startDate: customStart,
      endDate: customEnd,
      periodLabel: `${customStart} ➔ ${customEnd}`,
      isOngoingPeriod: customEnd >= todayStr,
    };
  }, [timeRange, customStart, customEnd, todayStr]);

  // Revenue-eligible bookings
  const revenueBookings = useMemo(() => (bookings || []).filter(b => isRevenueStatus(b.status)), [bookings]);

  // Filtered by Selected Period
  const periodBookings = useMemo(() => {
    return revenueBookings.filter(b => {
      const d = b.checkInAt ? b.checkInAt.slice(0, 10) : '';
      return d >= startDate && d <= endDate;
    });
  }, [revenueBookings, startDate, endDate]);

  const periodExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (!e.date || !e.amount) return false;
      const d = e.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // Financial calculations for Selected Period
  const periodRevenue = useMemo(() => periodBookings.reduce((s, b) => s + getBookingTotal(b), 0), [periodBookings]);
  const periodExpensesTotal = useMemo(() => periodExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [periodExpenses]);
  const periodNetProfit = periodRevenue - periodExpensesTotal;
  const periodProfitMargin = periodRevenue > 0 ? Math.round((periodNetProfit / periodRevenue) * 100) : 0;
  const isProfitPositive = periodNetProfit >= 0;

  // Surcharge & Base breakdown
  const totalSurcharges = useMemo(() => periodBookings.reduce((s, b) => s + (Number((b as any).overtimeAmount) || 0), 0), [periodBookings]);
  const baseRoomRevenue = periodRevenue - totalSurcharges;

  // Category breakdown for Selected Period
  const periodExpenseByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of periodExpenses) {
      const cat = e.category || 'Chi phí khác';
      totals[cat] = (totals[cat] ?? 0) + (Number(e.amount) || 0);
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .filter(c => c.value > 0);
  }, [periodExpenses]);

  // Fixed vs Variable breakdown for Period (MECE principle)
  const periodFixedExpenses = useMemo(() => {
    return periodExpenses.filter(e => {
      const cat = (e.category || '').toLowerCase();
      if ((e as any).costType === 'fixed') return true;
      if ((e as any).costType === 'variable') return false;
      return (
        cat.includes('thuê') ||
        cat.includes('mặt bằng') ||
        cat.includes('phòng') ||
        cat.includes('nhà') ||
        cat.includes('wifi') ||
        cat.includes('internet') ||
        cat.includes('lương') ||
        cat.includes('staff') ||
        cat.includes('bảo hiểm')
      );
    });
  }, [periodExpenses]);

  const periodVariableExpenses = useMemo(() => {
    const fixedSet = new Set(periodFixedExpenses.map(e => e.expenseId));
    return periodExpenses.filter(e => !fixedSet.has(e.expenseId));
  }, [periodExpenses, periodFixedExpenses]);

  const fixedCostTotal = useMemo(() => periodFixedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [periodFixedExpenses]);
  const variableCostTotal = useMemo(() => periodVariableExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [periodVariableExpenses]);

  // Contribution Margin = Revenue - Variable Costs
  const contributionMargin = periodRevenue - variableCostTotal;
  const contributionMarginPct = periodRevenue > 0 ? Math.round((contributionMargin / periodRevenue) * 100) : 0;

  // Channel mix for Selected Period
  const customerSourceMap = useMemo(() => new Map((customers || []).map(c => [c.customerId, c.source || ''])), [customers]);
  const CHANNEL_BRAND_COLORS: Record<string, string> = {
    'FACEBOOK': '#1877F2',
    'ZALO': '#38BDF8',
    'TIKTOK': darkMode ? '#F1F5F9' : '#000000',
    'INSTAGRAM': '#F56040',
    'DIRECT / KHÁC': '#64748B',
  };

  const periodRevenueByChannel = useMemo(() => {
    const totals: Record<string, number> = {
      'FACEBOOK': 0, 'ZALO': 0, 'TIKTOK': 0, 'INSTAGRAM': 0, 'DIRECT / KHÁC': 0,
    };
    for (const b of periodBookings) {
      const srcVal = customerSourceMap.get(b.customerId) || (b as any)?.source || 'DIRECT';
      const rawSrc = String(srcVal || 'DIRECT').toUpperCase();
      const amount = getBookingTotal(b);
      if (rawSrc.includes('FACEBOOK') || rawSrc === 'FB') totals['FACEBOOK'] += amount;
      else if (rawSrc.includes('ZALO')) totals['ZALO'] += amount;
      else if (rawSrc.includes('TIKTOK')) totals['TIKTOK'] += amount;
      else if (rawSrc.includes('INSTA') || rawSrc.includes('IG')) totals['INSTAGRAM'] += amount;
      else totals['DIRECT / KHÁC'] += amount;
    }
    return Object.entries(totals)
      .map(([name, value]) => ({
        name, value,
        color: CHANNEL_BRAND_COLORS[name] ?? '#64748B',
        pct: periodRevenue > 0 ? Math.round((value / periodRevenue) * 100) : 0,
      }))
      .filter(c => c.value > 0);
  }, [periodBookings, customerSourceMap, periodRevenue, darkMode]);

  // Period-based Occupancy Rate %
  const periodOccupancyRate = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const pStart = new Date(startDate);
    const pEnd = new Date(endDate);
    const diffDays = Math.round((pEnd.getTime() - pStart.getTime()) / 86400000);
    const totalDays = isNaN(diffDays) ? 30 : Math.max(1, diffDays + 1);
    const totalAvailableRoomDays = Math.max(1, (totalRoomsCount || 6) * totalDays);

    if (!periodBookings || periodBookings.length === 0) return 0;

    const occupiedRoomDays = new Set<string>();
    for (let i = 0; i < totalDays; i++) {
      const cur = new Date(pStart);
      cur.setDate(cur.getDate() + i);
      const dayStr = formatDateStr(cur);

      for (const b of periodBookings) {
        if (!b.roomId || !b.checkInAt) continue;
        const cinDate = b.checkInAt.slice(0, 10);
        const coutDate = (b.expectedCheckOutAt || b.checkInAt).slice(0, 10);
        const isOccupied = (cinDate <= dayStr && coutDate > dayStr) || (cinDate === dayStr && coutDate === dayStr);
        if (isOccupied) {
          occupiedRoomDays.add(`${b.roomId}:${dayStr}`);
        }
      }
    }

    const rate = Math.round((occupiedRoomDays.size / totalAvailableRoomDays) * 100);
    return Math.min(100, Math.max(rate, periodBookings.length > 0 && rate === 0 ? 1 : rate));
  }, [startDate, endDate, totalRoomsCount, periodBookings]);

  // Room-by-room Occupancy Breakdown in Selected Period
  const roomOccupancyData = useMemo(() => {
    if (!startDate || !endDate) return [];
    const pStart = new Date(startDate);
    const pEnd = new Date(endDate);
    const diffDays = Math.round((pEnd.getTime() - pStart.getTime()) / 86400000);
    const totalDays = isNaN(diffDays) ? 30 : Math.max(1, diffDays + 1);

    const activeRooms = rooms.filter(r => r.active !== false && r.status !== 'inactive');
    const roomList = activeRooms.length > 0 ? activeRooms : rooms;

    return roomList.map(r => {
      let occupiedDays = 0;
      for (let i = 0; i < totalDays; i++) {
        const cur = new Date(pStart);
        cur.setDate(cur.getDate() + i);
        const dayStr = formatDateStr(cur);

        const hasGuest = periodBookings.some(b => {
          if (b.roomId !== r.roomId || !b.checkInAt) return false;
          const cinDate = b.checkInAt.slice(0, 10);
          const coutDate = (b.expectedCheckOutAt || b.checkInAt).slice(0, 10);
          return (cinDate <= dayStr && coutDate > dayStr) || (cinDate === dayStr && coutDate === dayStr);
        });

        if (hasGuest) occupiedDays++;
      }

      const rate = Math.min(100, Math.round((occupiedDays / totalDays) * 100));
      return {
        roomId: r.roomId,
        name: r.name || r.roomId,
        rate,
        occupiedDays,
        totalDays,
      };
    });
  }, [startDate, endDate, rooms, periodBookings]);

  // 6-Month Trend Data
  const formatShortVnd = (v: number) => {
    if (v === 0) return '0 ₫';
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} tr`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${v} ₫`;
  };

  const revenueByMonth: Record<string, number> = {};
  for (const b of revenueBookings) {
    if (!b.checkInAt) continue;
    const m = b.checkInAt.slice(0, 7);
    revenueByMonth[m] = (revenueByMonth[m] ?? 0) + getBookingTotal(b);
  }

  const expensesByMonth: Record<string, number> = {};
  for (const e of (expenses || [])) {
    if (!e.date || !e.amount) continue;
    const m = e.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    expensesByMonth[m] = (expensesByMonth[m] ?? 0) + (Number(e.amount) || 0);
  }

  const trailing6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trailing6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const revenueTrend = trailing6Months.map((mKey) => {
    const [y, m] = mKey.split('-');
    const isCurrent = mKey === currentMonthStr;
    const label = isMobile ? `T${Number(m)}${isCurrent ? '*' : ''}` : `Thg ${Number(m)}/${y}${isCurrent ? ' *' : ''}`;
    const fullLabel = `Tháng ${Number(m)}/${y}${isCurrent ? ' (Hiện tại)' : ''}`;
    const rev = revenueByMonth[mKey] ?? 0;
    const exp = expensesByMonth[mKey] ?? 0;
    const profit = rev - exp;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : null;
    return {
      month: label,
      fullLabel,
      revenue: rev,
      expenses: exp,
      profit,
      margin,
      isCurrent,
    };
  });

  // 2. Top 4 KPI Metric Cards
  const summaryStats = [
    {
      title: 'Doanh thu trong kỳ',
      tag: isOngoingPeriod ? 'Tạm tính' : 'Đã chốt',
      tagBg: darkMode ? '#1E3A8A' : '#DBEAFE',
      tagColor: '#2563EB',
      value: formatVnd(periodRevenue),
      sub: periodLabel,
      label: `${periodBookings.length} đơn đặt phòng`,
      icon: '🗓',
      color: '#2563EB',
    },
    {
      title: 'Tổng chi phí',
      tag: isOngoingPeriod ? 'Chưa đủ kỳ' : 'Đã đủ',
      tagBg: darkMode ? '#7F1D1D' : '#FEE2E2',
      tagColor: '#EF4444',
      value: formatVnd(periodExpensesTotal),
      sub: periodLabel,
      label: `${periodExpenses.length} khoản chi đã ghi nhận`,
      icon: '🧾',
      color: '#EF4444',
    },
    {
      title: 'Lợi nhuận ròng',
      tag: isOngoingPeriod ? 'Tạm tính' : 'Chính thức',
      tagBg: darkMode ? '#064E3B' : '#DCFCE7',
      tagColor: '#10B981',
      value: `${isProfitPositive ? '+' : ''}${formatVnd(periodNetProfit)}`,
      sub: isProfitPositive ? 'Kinh doanh có lãi' : 'Đang thâm hụt',
      label: `Thu ${formatVnd(periodRevenue)} · Chi ${formatVnd(periodExpensesTotal)}`,
      icon: '💵',
      color: isProfitPositive ? '#10B981' : '#EF4444',
    },
    {
      title: 'Biên lợi nhuận (Margin)',
      tag: `${periodProfitMargin}%`,
      tagBg: darkMode ? '#4C1D95' : '#EDE9FE',
      tagColor: '#8B5CF6',
      value: `${periodProfitMargin}%`,
      sub: isOngoingPeriod ? 'Tạm tính (Cost Lag)' : 'Tỷ suất sinh lời ròng',
      label: isProfitPositive ? 'Hiệu quả tài chính tốt' : 'Cần tối ưu chi phí',
      icon: '📈',
      color: '#8B5CF6',
    },
  ];

  // CSV Export Handler
  const handleExportCsv = () => {
    const rows = [
      ['BÁO CÁO KẾT QUẢ KINH DOANH & TÀI CHÍNH (P&L STATEMENT)'],
      ['Kỳ báo cáo:', periodLabel],
      ['Từ ngày:', startDate, 'Đến ngày:', endDate],
      ['Ngày xuất:', new Date().toLocaleString('vi-VN')],
      [],
      ['HẠNG MỤC TÀI CHÍNH', 'SỐ TIỀN (VNĐ)', 'TỶ TRỌNG (%)'],
      ['I. DOANH THU HOẠT ĐỘNG (REVENUE)', periodRevenue.toString(), '100%'],
      ['  1. Doanh thu tiền phòng tiêu chuẩn', baseRoomRevenue.toString(), `${periodRevenue > 0 ? Math.round((baseRoomRevenue / periodRevenue) * 100) : 0}%`],
      ['  2. Phụ thu (Quá giờ / thêm khách)', totalSurcharges.toString(), `${periodRevenue > 0 ? Math.round((totalSurcharges / periodRevenue) * 100) : 0}%`],
      [],
      ['II. CHI PHÍ VẬN HÀNH (OPEX)', periodExpensesTotal.toString(), `${periodRevenue > 0 ? Math.round((periodExpensesTotal / periodRevenue) * 100) : 0}%`],
      ...periodExpenseByCategory.map(c => [
        `  - ${c.name}`,
        c.value.toString(),
        `${periodRevenue > 0 ? Math.round((c.value / periodRevenue) * 100) : 0}%`,
      ]),
      [],
      ['III. LỢI NHUẬN RÒNG (NET PROFIT)', periodNetProfit.toString(), `${periodProfitMargin}%`],
      [],
      ['--- CHI TIẾT DANH SÁCH ĐƠN ĐẶT PHÒNG ---'],
      ['Mã Booking', 'Phòng', 'Khách hàng', 'Check-in', 'Check-out', 'Tổng tiền (VNĐ)', 'Trạng thái'],
      ...periodBookings.map(b => [
        b.bookingId,
        b.roomId,
        (b as any).guestName || b.customerId,
        b.checkInAt,
        b.expectedCheckOutAt,
        getBookingTotal(b).toString(),
        b.status,
      ]),
      [],
      ['--- CHI TIẾT DANH SÁCH KHOẢN CHI ---'],
      ['Mã Chi phí', 'Danh mục', 'Số tiền (VNĐ)', 'Ngày chi', 'Mô tả', 'Nhà cung cấp'],
      ...periodExpenses.map(e => [
        e.expenseId,
        e.category,
        e.amount.toString(),
        e.date,
        e.description,
        e.vendor || '',
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map(e => e.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `P&L_BaoCao_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bdr = darkMode ? '#334155' : '#E2E8F0';
  const card = {
    background: darkMode ? '#1E293B' : '#fff',
    borderRadius: 12,
    border: `1px solid ${bdr}`,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8'  : '#64748B';
  const gridColor  = darkMode ? '#334155'  : '#F1F5F9';
  const tickStyle  = { fontSize: 11, fill: textMuted };
  const tooltipStyle = {
    borderRadius: 8, fontSize: 12,
    background: darkMode ? '#1E293B' : '#fff',
    border: `1px solid ${bdr}`,
  };

  const isLoading = bookingsLoading && bookings.length === 0 && expensesLoading && expenses.length === 0;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── 1. HEADER & BỘ LỌC THỜI GIAN ─────────────────────────────────── */}
      <div style={{
        ...card, padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📅 Kỳ báo cáo:
          </div>
          <div style={{ display: 'flex', gap: 6, background: darkMode ? '#0F172A' : '#F1F5F9', padding: 4, borderRadius: 8 }}>
            {[
              { key: 'this_month', label: 'Tháng này' },
              { key: 'last_month', label: 'Tháng trước' },
              { key: 'this_quarter', label: 'Quý này' },
              { key: 'this_year', label: 'Năm nay' },
              { key: 'custom', label: 'Tùy chỉnh' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setTimeRange(tab.key as TimeRange)}
                style={{
                  background: timeRange === tab.key ? (darkMode ? '#334155' : '#fff') : 'transparent',
                  color: timeRange === tab.key ? (darkMode ? '#F1F5F9' : '#2563EB') : textMuted,
                  border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', boxShadow: timeRange === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {timeRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: `1px solid ${bdr}`,
                  background: darkMode ? '#0F172A' : '#F8FAFC', color: textPrimary, fontSize: 12, outline: 'none',
                }}
              />
              <span style={{ color: textMuted, fontSize: 12 }}>➔</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: `1px solid ${bdr}`,
                  background: darkMode ? '#0F172A' : '#F8FAFC', color: textPrimary, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Export Excel / CSV Button */}
        <button
          onClick={handleExportCsv}
          style={{
            background: '#10B981', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
          }}
        >
          <span>📥</span>
          <span>Xuất Báo cáo Excel (CSV)</span>
        </button>
      </div>

      {/* ─── 2. HÀNG 4 THẺ KPI TỔNG QUAN ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...card, padding: '16px 18px', minHeight: 80 }} />
          ))
        ) : summaryStats.map(s => (
          <div key={s.title} style={{ ...card, padding: '16px 18px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>{s.title}</span>
                {s.tag && (
                  <span style={{ fontSize: 10, background: s.tagBg, color: s.tagColor, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                    {s.tag}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'DM Serif Display', serif", marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>{s.sub}</div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── 3. BIỂU ĐỒ XU HƯỚNG 6 THÁNG (Doanh thu vs Chi phí & Biên LN) ─── */}
      <div style={card}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>Doanh thu & Chi phí (6 tháng)</span>
              <span style={{ fontSize: 10, fontWeight: 600, background: darkMode ? '#78350F40' : '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: 4, border: '1px solid #FCD34D' }}>
                (*) Tháng hiện tại là tạm tính (Cost Lag)
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>Doanh thu (Xanh) vs Chi phí (Đỏ) & Biên lợi nhuận (%)</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#2563EB' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Doanh thu</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#EF4444' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Chi phí</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Biên LN (%)</span>
            </div>
          </div>
        </div>
        {revenueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={revenueTrend} margin={{ top: 15, right: isMobile ? 0 : 10, left: isMobile ? -10 : 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" width={isMobile ? 48 : 64} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={formatShortVnd} />
              <YAxis yAxisId="right" width={isMobile ? 38 : 46} orientation="right" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={tooltipStyle}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload;
                  const isCur = data?.isCurrent;
                  const profit = data?.profit ?? 0;
                  const margin = data?.margin;
                  return (
                    <div style={{ ...tooltipStyle, padding: '8px 12px', minWidth: 190 }}>
                      <div style={{ fontWeight: 700, color: textPrimary, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{data?.fullLabel || label}</span>
                        {isCur && (
                          <span style={{ fontSize: 9, background: '#FEF3C7', color: '#B45309', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                            Đang chạy
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#2563EB', fontSize: 11, marginBottom: 2 }}>
                        <span>Doanh thu:</span>
                        <span style={{ fontWeight: 700 }}>{formatVnd(data?.revenue ?? 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#EF4444', fontSize: 11, marginBottom: 2 }}>
                        <span>Chi phí:</span>
                        <span style={{ fontWeight: 700 }}>{formatVnd(data?.expenses ?? 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: profit >= 0 ? '#10B981' : '#EF4444', fontSize: 11, marginBottom: 2 }}>
                        <span>Lợi nhuận ròng:</span>
                        <span style={{ fontWeight: 700 }}>{profit >= 0 ? '+' : ''}{formatVnd(profit)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#8B5CF6', fontWeight: 700, fontSize: 11, paddingTop: 3, borderTop: `1px solid ${bdr}` }}>
                        <span>Biên lợi nhuận:</span>
                        <span>{margin !== null && margin !== undefined ? `${margin}%` : '—'}</span>
                      </div>
                      {isCur && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${bdr}`, fontSize: 10, color: '#F59E0B', lineHeight: 1.2 }}>
                          ⚠️ Chưa kết toán hết tiền nhà, điện nước
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={isMobile ? 12 : 22} />
              <Bar yAxisId="left" dataKey="expenses" name="Chi phí" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={isMobile ? 12 : 22} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin"
                name="Biên lợi nhuận"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                connectNulls={true}
                dot={{ r: 4, fill: '#8B5CF6', stroke: darkMode ? '#1E293B' : '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
            Chưa có dữ liệu đặt phòng
          </div>
        )}
      </div>

      {/* ─── 4. HÀNG 3 BIỂU ĐỒ CƠ CẤU (CÙNG KỲ ĐƯỢC CHỌN) ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* 1. Công suất theo từng phòng trong kỳ */}
        <div style={card}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Công suất từng phòng</div>
              <div style={{ fontSize: 12, color: textMuted }}>Tỷ lệ lấp đầy trong {periodLabel}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: darkMode ? '#064E3B' : '#DCFCE7', color: '#10B981', padding: '2px 8px', borderRadius: 6 }}>
              TB: {periodOccupancyRate}%
            </span>
          </div>
          {roomOccupancyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={roomOccupancyData} barSize={20} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: unknown, _: unknown, item: any) => [
                    `${v}% (${item?.payload?.occupiedDays || 0}/${item?.payload?.totalDays || 0} ngày)`,
                    'Công suất',
                  ]}
                />
                <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              Chưa có dữ liệu phòng
            </div>
          )}
        </div>

        {/* 2. Doanh thu theo Kênh bán (Revenue by Channel in Period) */}
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Nguồn khách theo Kênh</div>
            <div style={{ fontSize: 12, color: textMuted }}>Nguồn khách trong {periodLabel}</div>
          </div>
          {periodRevenueByChannel.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={periodRevenueByChannel} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value">
                      {periodRevenueByChannel.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {periodRevenueByChannel.map((ch) => (
                  <div key={ch.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: ch.color, flexShrink: 0 }} />
                      <span style={{ color: textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, color: textPrimary }}>{formatVnd(ch.value)}</span>
                      <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: darkMode ? '#334155' : '#F1F5F9', color: textMuted, fontWeight: 700 }}>{ch.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              Chưa có doanh thu trong kỳ này
            </div>
          )}
        </div>

        {/* 3. Cơ cấu chi phí trong kỳ (Expense Breakdown in Period) */}
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Cơ cấu chi phí trong kỳ</div>
            <div style={{ fontSize: 12, color: textMuted }}>Tổng chi: {formatVnd(periodExpensesTotal)}</div>
          </div>
          {periodExpenseByCategory.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={periodExpenseByCategory} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value">
                      {periodExpenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {periodExpenseByCategory.map((cat, i) => {
                  const pct = periodExpensesTotal > 0 ? Math.round((cat.value / periodExpensesTotal) * 100) : 0;
                  return (
                    <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: textPrimary }}>{formatVnd(cat.value)}</span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: darkMode ? '#334155' : '#F1F5F9', color: textMuted, fontWeight: 700 }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              Chưa có chi phí nào trong kỳ này
            </div>
          )}
        </div>
      </div>

      {/* ─── 5. BẢNG BÁO CÁO LỜI / LỖ THỰC TẾ (P&L STATEMENT) ───────────────── */}
      <div style={card}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊 Báo cáo Kết quả Kinh doanh Lời / Lỗ (P&L Statement)</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: darkMode ? '#1E3A8A' : '#DBEAFE', color: '#2563EB', padding: '2px 8px', borderRadius: 6 }}>
                {periodLabel}
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>
              Bảng đối soát doanh thu, chi phí vận hành và lợi nhuận ròng chuẩn kế toán quản trị
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: textMuted }}>Lợi nhuận ròng trong kỳ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: isProfitPositive ? '#10B981' : '#EF4444', fontFamily: "'DM Serif Display', serif" }}>
              {isProfitPositive ? '+' : ''}{formatVnd(periodNetProfit)}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderBottom: `2px solid ${bdr}` }}>
                <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted }}>HẠNG MỤC TÀI CHÍNH</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>SỐ TIỀN (VNĐ)</th>
                <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>TỶ TRỌNG (%)</th>
              </tr>
            </thead>
            <tbody>
              {/* I. DOANH THU */}
              <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '10px 16px', color: '#2563EB' }}>I. TỔNG DOANH THU HOẠT ĐỘNG</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>{formatVnd(periodRevenue)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>100%</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>1. Doanh thu tiền phòng tiêu chuẩn</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(baseRoomRevenue)}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>
                  {periodRevenue > 0 ? Math.round((baseRoomRevenue / periodRevenue) * 100) : 0}%
                </td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>2. Phụ thu (Quá giờ / thêm khách)</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(totalSurcharges)}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>
                  {periodRevenue > 0 ? Math.round((totalSurcharges / periodRevenue) * 100) : 0}%
                </td>
              </tr>

              {/* II. CHI PHÍ BIẾN ĐỔI */}
              <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '10px 16px', color: '#F59E0B' }}>II. CHI PHÍ BIẾN ĐỔI (VARIABLE COSTS)</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#F59E0B' }}>{formatVnd(variableCostTotal)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#F59E0B' }}>
                  {periodRevenue > 0 ? Math.round((variableCostTotal / periodRevenue) * 100) : 0}%
                </td>
              </tr>
              {periodVariableExpenses.length > 0 ? (
                periodVariableExpenses.map(e => (
                  <tr key={e.expenseId} style={{ borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>- {e.category} ({e.description})</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(e.amount)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>
                      {periodRevenue > 0 ? Math.round((e.amount / periodRevenue) * 100) : 0}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                  <td colSpan={3} style={{ padding: '8px 16px 8px 32px', color: textMuted, fontStyle: 'italic' }}>
                    Chưa có khoản chi biến đổi nào trong kỳ này
                  </td>
                </tr>
              )}

              {/* III. BIÊN ĐÓNG GÓP / LỢI NHUẬN GỘP (CONTRIBUTION MARGIN) */}
              <tr style={{ background: darkMode ? '#1E3A8A33' : '#EFF6FF', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '10px 16px', color: '#2563EB' }}>III. BIÊN ĐÓNG GÓP (CONTRIBUTION MARGIN = I - II)</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>{formatVnd(contributionMargin)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>
                  {contributionMarginPct}%
                </td>
              </tr>

              {/* IV. CHI PHÍ CỐ ĐỊNH (FIXED OVERHEAD) */}
              <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                <td style={{ padding: '10px 16px', color: '#EF4444' }}>IV. CHI PHÍ CỐ ĐỊNH (FIXED OVERHEAD)</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#EF4444' }}>{formatVnd(fixedCostTotal)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#EF4444' }}>
                  {periodRevenue > 0 ? Math.round((fixedCostTotal / periodRevenue) * 100) : 0}%
                </td>
              </tr>
              {periodFixedExpenses.length > 0 ? (
                periodFixedExpenses.map(e => (
                  <tr key={e.expenseId} style={{ borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>- {e.category} ({e.description})</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(e.amount)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>
                      {periodRevenue > 0 ? Math.round((e.amount / periodRevenue) * 100) : 0}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                  <td colSpan={3} style={{ padding: '8px 16px 8px 32px', color: textMuted, fontStyle: 'italic' }}>
                    Chưa có khoản chi cố định nào trong kỳ này
                  </td>
                </tr>
              )}

              {/* V. LỢI NHUẬN RÒNG */}
              <tr style={{ background: darkMode ? (isProfitPositive ? '#064E3B40' : '#7F1D1D40') : (isProfitPositive ? '#ECFDF5' : '#FEF2F2'), fontWeight: 800, borderTop: `2px solid ${bdr}` }}>
                <td style={{ padding: '12px 16px', color: isProfitPositive ? '#10B981' : '#EF4444', fontSize: 14 }}>
                  V. LỢI NHUẬN RÒNG (NET PROFIT = III - IV)
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: isProfitPositive ? '#10B981' : '#EF4444', fontSize: 15 }}>
                  {isProfitPositive ? '+' : ''}{formatVnd(periodNetProfit)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: isProfitPositive ? '#10B981' : '#EF4444', fontSize: 14 }}>
                  {periodProfitMargin}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
