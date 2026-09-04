// ─── Reports.tsx ─────────────────────────────────────────────────────────────────────
//
// Financial Analytics, P&L Statement & Cash Flow / Accounts Receivable Dashboard
// Dual-Module Executive Architecture:
//   Tab 1: 📊 Báo cáo Kết quả Kinh doanh (P&L Statement - Kế toán Dồn tích)
//   Tab 2: 💰 Báo cáo Dòng tiền & Công nợ (Cash Flow & Accounts Receivable - Kế toán Tiền mặt)
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
import type { Booking, BookingStatus } from '@/types/index';
import QuickEditModal from '@/components/QuickEditModal';

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
type ReportTab = 'pl' | 'cashflow';

export default function Reports() {
  const outletCtx = useOutletContext<{ darkMode?: boolean }>() || {};
  const darkMode = Boolean(outletCtx.darkMode);

  const { bookings = [], loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const { expenses = [], loading: expensesLoading, refetch: refetchExpenses } = useExpenses();
  const { customers = [] } = useCustomers();
  const { rooms = [] } = useRooms();
  const totalRoomsCount = rooms.length > 0 ? rooms.length : 6;

  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('pl');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [receivableFilter, setReceivableFilter] = useState<'all' | 'unpaid' | 'partial'>('all');
  const [receivableSearch, setReceivableSearch] = useState('');

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

  // Derive active date boundaries
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

  // Financial calculations for Selected Period (P&L Accrual)
  const periodRevenue = useMemo(() => periodBookings.reduce((s, b) => s + getBookingTotal(b), 0), [periodBookings]);
  const periodExpensesTotal = useMemo(() => periodExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [periodExpenses]);
  const periodNetProfit = periodRevenue - periodExpensesTotal;
  const periodProfitMargin = periodRevenue > 0 ? Math.round((periodNetProfit / periodRevenue) * 100) : 0;
  const isProfitPositive = periodNetProfit >= 0;

  // Cash Flow & Receivables calculations
  const periodCashInflow = useMemo(() => {
    return periodBookings.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
  }, [periodBookings]);
  const periodCashOutflow = periodExpensesTotal;
  const periodNetCash = periodCashInflow - periodCashOutflow;
  const isNetCashPositive = periodNetCash >= 0;

  // Receivables (Unpaid balances in period)
  const roomMap = useMemo(() => new Map(rooms.map(r => [r.roomId, r.name])), [rooms]);
  const customerMap = useMemo(() => new Map(customers.map(c => [c.customerId, c.name])), [customers]);

  const periodReceivablesList = useMemo(() => {
    return periodBookings
      .map(b => {
        const total = getBookingTotal(b);
        const paid = Number(b.paidAmount) || 0;
        const balance = Math.max(0, total - paid);
        const guest = (b as any).guestName || customerMap.get(b.customerId) || b.customerId;
        const roomName = roomMap.get(b.roomId) || b.roomId;
        return {
          booking: b,
          bookingId: b.bookingId,
          guestName: guest,
          roomName,
          roomId: b.roomId,
          checkInAt: b.checkInAt,
          expectedCheckOutAt: b.expectedCheckOutAt,
          totalAmount: total,
          paidAmount: paid,
          balanceDue: balance,
          status: b.status,
          paymentStatus: b.paymentStatus || (paid >= total ? 'paid' : (paid > 0 ? 'partial' : 'unpaid')),
        };
      })
      .filter(item => item.balanceDue > 0)
      .sort((a, b) => b.balanceDue - a.balanceDue);
  }, [periodBookings, customerMap, roomMap]);

  const totalReceivablesAmount = useMemo(() => {
    return periodReceivablesList.reduce((s, r) => s + r.balanceDue, 0);
  }, [periodReceivablesList]);

  const filteredReceivablesList = useMemo(() => {
    return periodReceivablesList.filter(item => {
      if (receivableFilter === 'unpaid' && item.paidAmount > 0) return false;
      if (receivableFilter === 'partial' && item.paidAmount === 0) return false;
      if (receivableSearch.trim()) {
        const q = receivableSearch.toLowerCase();
        return (
          item.guestName.toLowerCase().includes(q) ||
          item.roomName.toLowerCase().includes(q) ||
          item.bookingId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [periodReceivablesList, receivableFilter, receivableSearch]);

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

  // Fixed vs Variable breakdown for Period
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

  // 6-Month Trend Data (P&L and Cash Flow)
  const formatShortVnd = (v: number) => {
    if (v === 0) return '0 ₫';
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} tr`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${v} ₫`;
  };

  const revenueByMonth: Record<string, number> = {};
  const cashInByMonth: Record<string, number> = {};
  for (const b of revenueBookings) {
    if (!b.checkInAt) continue;
    const m = b.checkInAt.slice(0, 7);
    revenueByMonth[m] = (revenueByMonth[m] ?? 0) + getBookingTotal(b);
    cashInByMonth[m] = (cashInByMonth[m] ?? 0) + (Number(b.paidAmount) || 0);
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

  const cashFlowTrend = trailing6Months.map((mKey) => {
    const [y, m] = mKey.split('-');
    const isCurrent = mKey === currentMonthStr;
    const label = isMobile ? `T${Number(m)}` : `Thg ${Number(m)}/${y}`;
    const cashIn = cashInByMonth[mKey] ?? 0;
    const cashOut = expensesByMonth[mKey] ?? 0;
    const netCash = cashIn - cashOut;
    return {
      month: label,
      fullLabel: `Tháng ${Number(m)}/${y}`,
      cashIn,
      cashOut,
      netCash,
      isCurrent,
    };
  });

  // Top 4 KPI Metric Cards (P&L Tab)
  const summaryStatsPL = [
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
      title: 'Biên lợi nhuận ròng',
      tag: 'Hiệu suất',
      tagBg: darkMode ? '#312E81' : '#EDE9FE',
      tagColor: '#8B5CF6',
      value: `${periodProfitMargin}%`,
      sub: periodProfitMargin >= 20 ? 'Tốt (>=20%)' : (periodProfitMargin > 0 ? 'Mỏng (<20%)' : 'Lỗ'),
      label: `Biên đóng góp ${contributionMarginPct}%`,
      icon: '📈',
      color: '#8B5CF6',
    },
  ];

  // Top 4 KPI Metric Cards (Cash Flow Tab)
  const summaryStatsCashFlow = [
    {
      title: 'Tiền thực thu (Cash In)',
      tag: 'Thực nhận',
      tagBg: darkMode ? '#064E3B' : '#DCFCE7',
      tagColor: '#10B981',
      value: formatVnd(periodCashInflow),
      sub: `Đạt ${periodRevenue > 0 ? Math.round((periodCashInflow / periodRevenue) * 100) : 0}% doanh thu`,
      label: `${periodBookings.filter(b => (b.paidAmount || 0) > 0).length} đơn đã nộp tiền`,
      icon: '💵',
      color: '#10B981',
    },
    {
      title: 'Tiền thực chi (Cash Out)',
      tag: 'Đã xuất quỹ',
      tagBg: darkMode ? '#7F1D1D' : '#FEE2E2',
      tagColor: '#EF4444',
      value: formatVnd(periodCashOutflow),
      sub: periodLabel,
      label: `${periodExpenses.length} phiếu chi đã thanh toán`,
      icon: '💸',
      color: '#EF4444',
    },
    {
      title: 'Dòng tiền ròng (Net Cash)',
      tag: isNetCashPositive ? 'Dương tiền' : 'Âm tiền',
      tagBg: darkMode ? (isNetCashPositive ? '#064E3B' : '#7F1D1D') : (isNetCashPositive ? '#DCFCE7' : '#FEE2E2'),
      tagColor: isNetCashPositive ? '#10B981' : '#EF4444',
      value: `${isNetCashPositive ? '+' : ''}${formatVnd(periodNetCash)}`,
      sub: isNetCashPositive ? 'Quỹ dôi dư an toàn' : '⚠️ Thâm hụt quỹ tiền mặt',
      label: `Vào ${formatVnd(periodCashInflow)} · Ra ${formatVnd(periodCashOutflow)}`,
      icon: '🏦',
      color: isNetCashPositive ? '#10B981' : '#EF4444',
    },
    {
      title: 'Công nợ phải thu (Receivables)',
      tag: 'Chưa thu nốt',
      tagBg: darkMode ? '#78350F' : '#FEF3C7',
      tagColor: '#D97706',
      value: formatVnd(totalReceivablesAmount),
      sub: `${periodReceivablesList.length} đơn chưa trả đủ`,
      label: 'Cần theo dõi thu hồi',
      icon: '⚠️',
      color: '#D97706',
    },
  ];

  // CSV Export logic
  const handleExportCsv = () => {
    let rows: string[][] = [];

    if (activeReportTab === 'pl') {
      rows = [
        ['BÁO CÁO KẾT QUẢ KINH DOANH (P&L STATEMENT)'],
        ['Kỳ báo cáo:', periodLabel],
        ['Thời gian trích xuất:', new Date().toLocaleString('vi-VN')],
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
      ];
    } else {
      // Cash Flow & Receivables CSV
      rows = [
        ['BÁO CÁO DÒNG TIỀN & SỔ THEO DÕI CÔNG NỢ PHẢI THU'],
        ['Kỳ báo cáo:', periodLabel],
        ['Thời gian trích xuất:', new Date().toLocaleString('vi-VN')],
        [],
        ['TỔNG QUAN DÒNG TIỀN THỰC TẾ', 'SỐ TIỀN (VNĐ)'],
        ['1. Tiền thực thu vào (Cash Inflow)', periodCashInflow.toString()],
        ['2. Tiền thực chi ra (Cash Outflow)', periodCashOutflow.toString()],
        ['3. Dòng tiền thuần trong kỳ (Net Cash Flow)', periodNetCash.toString()],
        ['4. Tổng công nợ khách còn nợ (Total Receivables)', totalReceivablesAmount.toString()],
        [],
        ['--- SỔ CHI TIẾT CÔNG NỢ PHẢI THU KHÁCH HÀNG ---'],
        ['Mã Đơn', 'Tên Khách', 'Phòng', 'Check-in', 'Check-out', 'Tổng Hóa Đơn (VNĐ)', 'Đã Thanh Toán (VNĐ)', 'Còn Nợ (VNĐ)', 'Trạng Thái'],
        ...periodReceivablesList.map(r => [
          r.bookingId,
          r.guestName,
          r.roomName,
          r.checkInAt,
          r.expectedCheckOutAt,
          r.totalAmount.toString(),
          r.paidAmount.toString(),
          r.balanceDue.toString(),
          r.paymentStatus === 'unpaid' ? 'Chưa thanh toán' : 'Đã cọc một phần',
        ]),
      ];
    }

    const csvContent = '\uFEFF' + rows.map(e => e.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeReportTab === 'pl' ? 'P&L_BaoCao' : 'DongTien_CongNo'}_${startDate}_${endDate}.csv`);
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

  const isLoading = bookingsLoading && bookings.length === 0 && expensesLoading && expenses.length === 0;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── 0. EXECUTIVE DUAL-TAB SWITCHER ─────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        borderBottom: `2px solid ${bdr}`, paddingBottom: 12,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveReportTab('pl')}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: activeReportTab === 'pl' ? 'none' : `1px solid ${bdr}`,
              background: activeReportTab === 'pl' ? '#2563EB' : (darkMode ? '#1E293B' : '#fff'),
              color: activeReportTab === 'pl' ? '#fff' : textPrimary,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: activeReportTab === 'pl' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📊</span>
            <span>Báo cáo Lời / Lỗ (P&L)</span>
          </button>

          <button
            onClick={() => setActiveReportTab('cashflow')}
            style={{
              padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: activeReportTab === 'cashflow' ? 'none' : `1px solid ${bdr}`,
              background: activeReportTab === 'cashflow' ? '#10B981' : (darkMode ? '#1E293B' : '#fff'),
              color: activeReportTab === 'cashflow' ? '#fff' : textPrimary,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: activeReportTab === 'cashflow' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>💰</span>
            <span>Báo cáo Dòng tiền & Công nợ</span>
            {totalReceivablesAmount > 0 && (
              <span style={{
                fontSize: 10, background: '#EF4444', color: '#fff',
                padding: '2px 6px', borderRadius: 10, fontWeight: 800,
              }}>
                {periodReceivablesList.length}
              </span>
            )}
          </button>
        </div>

        {/* Export Excel / CSV Button */}
        <button
          onClick={handleExportCsv}
          style={{
            background: activeReportTab === 'pl' ? '#2563EB' : '#10B981',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <span>📥</span>
          <span>Xuất {activeReportTab === 'pl' ? 'Báo cáo P&L' : 'Sổ Công Nợ'} (CSV)</span>
        </button>
      </div>

      {/* ─── 1. BỘ LỌC THỜI GIAN CHUNG ─────────────────────────────────────── */}
      <div style={{
        ...card, padding: '14px 20px',
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

        <div style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>
          Thời gian: <span style={{ color: textPrimary }}>{periodLabel}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: BÁO CÁO LỜI / LỖ (P&L STATEMENT)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'pl' && (
        <>
          {/* 4 Thẻ KPI P&L */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ ...card, padding: '16px 18px', minHeight: 80 }} />
              ))
            ) : summaryStatsPL.map(s => (
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

          {/* Biểu đồ Xu hướng 6 tháng P&L */}
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
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="left"
                    tick={tickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatShortVnd}
                    width={isMobile ? 45 : 55}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={tickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 100]}
                    width={isMobile ? 35 : 40}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${bdr}` }}
                    formatter={(v: any, name: any) => {
                      if (name === 'Biên LN (%)') return [`${v}%`, name];
                      return [formatVnd(Number(v) || 0), name];
                    }}
                    labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullLabel || label}
                  />
                  <Bar yAxisId="left" dataKey="revenue" fill="#2563EB" name="Doanh thu" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="left" dataKey="expenses" fill="#EF4444" name="Chi phí" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: '#8B5CF6' }} name="Biên LN (%)" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>

          {/* 3 Biểu đồ Cơ cấu */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            {/* Công suất từng phòng */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Công suất từng phòng</div>
                  <div style={{ fontSize: 11, color: textMuted }}>Tỷ lệ lấp đầy trong {periodLabel}</div>
                </div>
                <span style={{ fontSize: 11, background: darkMode ? '#064E3B' : '#DCFCE7', color: '#10B981', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  TB: {Math.round(roomOccupancyData.reduce((s, r) => s + r.rate, 0) / (roomOccupancyData.length || 1))}%
                </span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={roomOccupancyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 11, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${bdr}` }}
                    formatter={(v: any) => [`${v}%`, 'Công suất']}
                  />
                  <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Nguồn khách */}
            <div style={card}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Doanh thu theo Kênh bán</div>
                <div style={{ fontSize: 11, color: textMuted }}>Nguồn khách trong {periodLabel}</div>
              </div>
              {periodRevenueByChannel.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={periodRevenueByChannel} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value">
                          {periodRevenueByChannel.map((entry, idx) => (
                            <Cell key={entry.name} fill={entry.color || PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 11, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${bdr}` }}
                          formatter={(v: any, name: any) => [formatVnd(Number(v) || 0), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {periodRevenueByChannel.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                          <span style={{ color: textPrimary, fontWeight: 500 }}>{c.name}</span>
                        </div>
                        <span style={{ color: textMuted, fontWeight: 700 }}>{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, fontSize: 12 }}>
                  Chưa có dữ liệu
                </div>
              )}
            </div>

            {/* Cơ cấu chi phí */}
            <div style={card}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Cơ cấu chi phí trong kỳ</div>
                <div style={{ fontSize: 11, color: textMuted }}>Tổng chi: {formatVnd(periodExpensesTotal)}</div>
              </div>
              {periodExpenseByCategory.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={periodExpenseByCategory} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value">
                          {periodExpenseByCategory.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 11, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${bdr}` }}
                          formatter={(v: any, name: any) => [formatVnd(Number(v) || 0), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {periodExpenseByCategory.slice(0, 4).map((c, idx) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span style={{ color: textPrimary, fontWeight: 500, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                        </div>
                        <span style={{ color: textMuted, fontWeight: 700 }}>
                          {periodExpensesTotal > 0 ? Math.round((c.value / periodExpensesTotal) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, fontSize: 12 }}>
                  Chưa có chi phí
                </div>
              )}
            </div>
          </div>

          {/* Bảng Kế toán P&L Statement */}
          <div style={card}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📑 Báo cáo Kết quả Kinh doanh Lời / Lỗ (P&L Statement)</span>
                  <span style={{ fontSize: 11, background: darkMode ? '#1E3A8A' : '#DBEAFE', color: '#2563EB', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
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

                  {/* III. BIÊN ĐÓNG GÓP */}
                  <tr style={{ background: darkMode ? '#1E3A8A33' : '#EFF6FF', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '10px 16px', color: '#2563EB' }}>III. BIÊN ĐÓNG GÓP (CONTRIBUTION MARGIN = I - II)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>{formatVnd(contributionMargin)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2563EB' }}>
                      {contributionMarginPct}%
                    </td>
                  </tr>

                  {/* IV. CHI PHÍ CỐ ĐỊNH */}
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2: BÁO CÁO DÒNG TIỀN & SỔ THEO DÕI CÔNG NỢ (CASH FLOW & RECEIVABLES)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'cashflow' && (
        <>
          {/* 4 Thẻ KPI Dòng Tiền & Công Nợ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ ...card, padding: '16px 18px', minHeight: 80 }} />
              ))
            ) : summaryStatsCashFlow.map(s => (
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

          {/* Biểu đồ Dòng tiền 6 tháng (Thực thu vs Thực chi & Dòng tiền ròng) */}
          <div style={card}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Dòng tiền Lưu chuyển 6 tháng (Cash Inflow vs Outflow)</span>
                </div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
                  Tiền thực thu (Xanh lá) vs Tiền thực chi (Đỏ) & Dòng tiền ròng dôi dư (Tím)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10B981' }} />
                  <span style={{ color: textPrimary, fontWeight: 600 }}>Thực thu (Cash In)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#EF4444' }} />
                  <span style={{ color: textPrimary, fontWeight: 600 }}>Thực chi (Cash Out)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
                  <span style={{ color: textPrimary, fontWeight: 600 }}>Dòng tiền ròng</span>
                </div>
              </div>
            </div>

            {cashFlowTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={cashFlowTrend} margin={{ top: 15, right: isMobile ? 0 : 10, left: isMobile ? -10 : 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={tickStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatShortVnd}
                    width={isMobile ? 45 : 55}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${bdr}` }}
                    formatter={(v: any, name: any) => [formatVnd(Number(v) || 0), name]}
                    labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullLabel || label}
                  />
                  <Bar dataKey="cashIn" fill="#10B981" name="Thực thu (Cash In)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="cashOut" fill="#EF4444" name="Thực chi (Cash Out)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line type="monotone" dataKey="netCash" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: '#8B5CF6' }} name="Dòng tiền ròng" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>

          {/* SỔ THEO DÕI & THU HỒI CÔNG NỢ KHÁCH HÀNG */}
          <div style={card}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
              marginBottom: 16, borderBottom: `1px solid ${bdr}`, paddingBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📋 Sổ Theo dõi & Thu hồi Công nợ Khách hàng</span>
                  <span style={{ fontSize: 11, background: darkMode ? '#78350F' : '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    {periodReceivablesList.length} đơn chưa trả đủ
                  </span>
                </div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
                  Danh sách khách hàng đang còn nợ tiền phòng hoặc cọc một phần cần thu hồi
                </div>
              </div>

              {/* Bộ lọc & Tìm kiếm công nợ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="🔍 Tìm tên khách, phòng, mã đơn..."
                  value={receivableSearch}
                  onChange={e => setReceivableSearch(e.target.value)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: `1px solid ${bdr}`,
                    background: darkMode ? '#0F172A' : '#F8FAFC', color: textPrimary, fontSize: 12, outline: 'none',
                    minWidth: 200,
                  }}
                />
                <div style={{ display: 'flex', gap: 4, background: darkMode ? '#0F172A' : '#F1F5F9', padding: 3, borderRadius: 6 }}>
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'unpaid', label: 'Chưa trả 100%' },
                    { key: 'partial', label: 'Đã cọc 1 phần' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setReceivableFilter(f.key as any)}
                      style={{
                        background: receivableFilter === f.key ? (darkMode ? '#334155' : '#fff') : 'transparent',
                        color: receivableFilter === f.key ? (darkMode ? '#F1F5F9' : '#2563EB') : textMuted,
                        border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bảng Danh sách Công nợ */}
            {filteredReceivablesList.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderBottom: `2px solid ${bdr}` }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted }}>MÃ ĐƠN</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted }}>KHÁCH HÀNG</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted }}>PHÒNG</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted }}>LƯU TRÚ</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>TỔNG HÓA ĐƠN</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>ĐÃ THANH TOÁN</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: '#EF4444', textAlign: 'right' }}>CÒN NỢ (PHẢI THU)</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted, textAlign: 'center' }}>TRẠNG THÁI</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: textMuted, textAlign: 'center' }}>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceivablesList.map(r => (
                      <tr key={r.bookingId} style={{ borderBottom: `1px solid ${bdr}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#2563EB' }}>{r.bookingId}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: textPrimary }}>{r.guestName}</td>
                        <td style={{ padding: '10px 14px', color: textPrimary }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#E2E8F0', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                          }}>
                            {r.roomName}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: textMuted }}>
                          {r.checkInAt ? r.checkInAt.slice(5, 10) : ''} ➔ {r.expectedCheckOutAt ? r.expectedCheckOutAt.slice(5, 10) : ''}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: textPrimary }}>
                          {formatVnd(r.totalAmount)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#10B981' }}>
                          {formatVnd(r.paidAmount)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#EF4444', fontSize: 14 }}>
                          {formatVnd(r.balanceDue)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                            background: r.paidAmount > 0 ? (darkMode ? '#78350F40' : '#FEF3C7') : (darkMode ? '#7F1D1D40' : '#FEE2E2'),
                            color: r.paidAmount > 0 ? '#D97706' : '#EF4444',
                            border: `1px solid ${r.paidAmount > 0 ? '#FCD34D' : '#FCA5A5'}`,
                          }}>
                            {r.paidAmount > 0 ? 'Đã cọc 1 phần' : 'Chưa thanh toán'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => setEditingBooking(r.booking)}
                            style={{
                              background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6,
                              padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                            }}
                          >
                            ✏️ Cập nhật tiền
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 800, borderTop: `2px solid ${bdr}` }}>
                      <td colSpan={6} style={{ padding: '12px 14px', color: textPrimary, fontSize: 14 }}>
                        TỔNG CÔNG NỢ ĐANG CÒN PHẢI THU TRONG KỲ
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#EF4444', fontSize: 16 }}>
                        {formatVnd(totalReceivablesAmount)}
                      </td>
                      <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'center', color: textMuted, fontSize: 12 }}>
                        {periodReceivablesList.length} đơn nợ
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: textMuted }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Không có khoản công nợ nào cần thu hồi!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Tất cả các đơn đặt phòng trong kỳ này đã được thanh toán đủ $100\%$.</div>
              </div>
            )}
          </div>

          {/* BẢNG ĐỐI SOÁT LƯU CHUYỂN TIỀN TỆ (CASH FLOW STATEMENT) */}
          <div style={card}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💵 Báo cáo Lưu chuyển Dòng tiền Thực tế (Cash Flow Statement)</span>
                  <span style={{ fontSize: 11, background: darkMode ? '#064E3B' : '#DCFCE7', color: '#10B981', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                    {periodLabel}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>
                  Đối soát dòng tiền mặt / ngân hàng thực tế vào và ra khỏi homestay
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: textMuted }}>Dòng tiền thuần trong kỳ (Net Cash)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: isNetCashPositive ? '#10B981' : '#EF4444', fontFamily: "'DM Serif Display', serif" }}>
                  {isNetCashPositive ? '+' : ''}{formatVnd(periodNetCash)}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderBottom: `2px solid ${bdr}` }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted }}>KHOẢN MỤC DÒNG TIỀN</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>SỐ TIỀN THỰC TẾ (VNĐ)</th>
                    <th style={{ padding: '10px 16px', fontWeight: 700, color: textMuted, textAlign: 'right' }}>TỶ LỆ</th>
                  </tr>
                </thead>
                <tbody>
                  {/* I. DÒNG TIỀN VÀO */}
                  <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '10px 16px', color: '#10B981' }}>I. DÒNG TIỀN THỰC THU VÀO (CASH INFLOW)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#10B981' }}>{formatVnd(periodCashInflow)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#10B981' }}>100%</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>1. Tiền phòng thực thu (Tiền cọc + Thanh toán hoàn tất)</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(periodCashInflow)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>100%</td>
                  </tr>

                  {/* II. DÒNG TIỀN RA */}
                  <tr style={{ background: darkMode ? '#1E293B' : '#F1F5F9', fontWeight: 700, borderBottom: `1px solid ${bdr}` }}>
                    <td style={{ padding: '10px 16px', color: '#EF4444' }}>II. DÒNG TIỀN THỰC CHI RA (CASH OUTFLOW)</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#EF4444' }}>{formatVnd(periodCashOutflow)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#EF4444' }}>
                      {periodCashInflow > 0 ? Math.round((periodCashOutflow / periodCashInflow) * 100) : 0}%
                    </td>
                  </tr>
                  {periodExpenseByCategory.map(c => (
                    <tr key={c.name} style={{ borderBottom: `1px solid ${bdr}` }}>
                      <td style={{ padding: '8px 16px 8px 32px', color: textPrimary }}>- {c.name}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: textPrimary }}>{formatVnd(c.value)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: textMuted }}>
                        {periodCashInflow > 0 ? Math.round((c.value / periodCashInflow) * 100) : 0}%
                      </td>
                    </tr>
                  ))}

                  {/* III. DÒNG TIỀN THUẦN */}
                  <tr style={{ background: darkMode ? (isNetCashPositive ? '#064E3B40' : '#7F1D1D40') : (isNetCashPositive ? '#ECFDF5' : '#FEF2F2'), fontWeight: 800, borderTop: `2px solid ${bdr}` }}>
                    <td style={{ padding: '12px 16px', color: isNetCashPositive ? '#10B981' : '#EF4444', fontSize: 14 }}>
                      III. DÒNG TIỀN THUẦN TỒN QUỸ (NET CASH FLOW = I - II)
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: isNetCashPositive ? '#10B981' : '#EF4444', fontSize: 15 }}>
                      {isNetCashPositive ? '+' : ''}{formatVnd(periodNetCash)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: isNetCashPositive ? '#10B981' : '#EF4444', fontSize: 14 }}>
                      {periodCashInflow > 0 ? Math.round((periodNetCash / periodCashInflow) * 100) : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Quick Edit Modal for Receivables collection */}
      <QuickEditModal
        booking={editingBooking}
        guestName={editingBooking ? (editingBooking as any).guestName || customerMap.get(editingBooking.customerId) : undefined}
        roomName={editingBooking ? roomMap.get(editingBooking.roomId) : undefined}
        onClose={() => setEditingBooking(null)}
        onSuccess={() => {
          setEditingBooking(null);
          refetchBookings();
        }}
        darkMode={darkMode}
      />
    </div>
  );
}
