// ─── Reports.tsx ─────────────────────────────────────────────────────────────────────
//
// Derives all report data from real API calls:
//   - useBookings  → summary stats + chart data
//   - useExpenses  → expense breakdown
//
// No sampleData imports.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useBookings } from '@/hooks/useBookings';
import { useExpenses } from '@/hooks/useExpenses';
import { useCustomers } from '@/hooks/useCustomers';
import { formatVnd, getBookingTotal } from '@/utils/format';
import type { BookingStatus } from '@/types/index';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

const REVENUE_STATUSES = new Set<BookingStatus>(['confirmed', 'checked_in', 'checked_out']);

function isRevenueStatus(status: BookingStatus): boolean {
  return REVENUE_STATUSES.has(status);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = d.getDay();
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - offsetToMonday);
  return d;
}

export default function Reports() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();

  const { bookings, loading: bookingsLoading, refetch: refetchBookings } = useBookings();
  const { expenses, loading: expensesLoading, refetch: refetchExpenses } = useExpenses();

  useEffect(() => { refetchBookings(); refetchExpenses(); }, [refetchBookings, refetchExpenses]);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue-eligible bookings: confirmed, checked_in, or checked_out only.
  const revenueBookings = bookings.filter(b => isRevenueStatus(b.status));

  // This week's bookings
  const weekBookings = revenueBookings.filter(b => {
    const d = new Date(b.checkInAt);
    return d >= weekStart && d < weekEnd;
  });
  const weekRevenue = weekBookings.reduce((s, b) => s + getBookingTotal(b), 0);

  // This month's revenue
  const monthBookings = revenueBookings.filter(b => {
    const d = new Date(b.checkInAt);
    return d >= monthStart;
  });
  const monthRevenue = monthBookings.reduce((s, b) => s + getBookingTotal(b), 0);

  // Average stay (nights)
  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const avgStay = activeBookings.length > 0
    ? (activeBookings.reduce((s, b) => {
        const cin = new Date(b.checkInAt);
        const cout = new Date(b.expectedCheckOutAt);
        return s + (cout.getTime() - cin.getTime()) / 86400000;
      }, 0) / activeBookings.length).toFixed(1)
    : '0.0';

  // Occupancy rate
  const occupiedCount = activeBookings.filter(b => b.status === 'checked_in').length;
  const uniqueRooms = new Set(activeBookings.map(b => b.roomId));
  const occupancyRate = uniqueRooms.size > 0
    ? Math.round((occupiedCount / uniqueRooms.size) * 100)
    : 0;

  // Monthly revenue aggregations
  const revenueByMonth: Record<string, number> = {};
  for (const b of revenueBookings) {
    const month = b.checkInAt.slice(0, 7);
    revenueByMonth[month] = (revenueByMonth[month] ?? 0) + getBookingTotal(b);
  }

  // Monthly expense aggregations
  const expensesByMonth: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.date || !e.amount) continue;
    const month = e.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    expensesByMonth[month] = (expensesByMonth[month] ?? 0) + e.amount;
  }

  // Current month expense breakdown and total
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.date || !e.amount) continue;
    if (e.date.slice(0, 7) !== currentMonthKey) continue;
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }
  const currentMonthExpensesTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const currentMonthNetProfit = monthRevenue - currentMonthExpensesTotal;
  const currentMonthProfitMargin = monthRevenue > 0
    ? Math.round((currentMonthNetProfit / monthRevenue) * 100)
    : 0;

  const expenseByCategory = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .filter(c => c.value > 0);

  // Generate continuous trailing 6 calendar months (oldest to newest)
  const trailing6Months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trailing6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const formatShortVnd = (v: number) => {
    if (v === 0) return '0 ₫';
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
    if (v >= 1_000_000) return `${Math.round(v / 1_000_000)} tr`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${v} ₫`;
  };

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const revenueTrend = trailing6Months.map((month) => {
    const [y, m] = month.split('-');
    const isCurrent = month === currentMonthStr;
    const label = `Thg ${Number(m)}/${y}${isCurrent ? ' *' : ''}`;
    const rev = revenueByMonth[month] ?? 0;
    const exp = expensesByMonth[month] ?? 0;
    const profit = rev - exp;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : null;
    return {
      month: label,
      revenue: rev,
      expenses: exp,
      profit,
      margin,
      isCurrent,
    };
  });

  // Daily occupancy for this week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toLocaleString('vi-VN', { weekday: 'short' });
  });
  const dailyOccupancy = weekDays.map((day, i) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const occupiedRoomIds = new Set<string>();
    for (const b of activeBookings) {
      if (!b.roomId) continue;
      const checkInDate = new Date(b.checkInAt);
      const checkOutDate = new Date(b.expectedCheckOutAt);
      if (checkInDate < dayEnd && checkOutDate > dayStart) {
        occupiedRoomIds.add(b.roomId);
      }
    }
    return {
      day,
      rate: uniqueRooms.size > 0
        ? Math.round((occupiedRoomIds.size / uniqueRooms.size) * 100)
        : 0,
    };
  });

  const { customers } = useCustomers();
  const customerSourceMap = useMemo(() => new Map(customers.map(c => [c.customerId, c.source])), [customers]);

  const CHANNEL_BRAND_COLORS: Record<string, string> = {
    'FACEBOOK': '#1877F2',
    'ZALO': '#38BDF8',
    'TIKTOK': darkMode ? '#F1F5F9' : '#000000',
    'INSTAGRAM': '#F56040',
    'DIRECT / KHÁC': '#64748B',
  };

  const channelRevenueTotals: Record<string, number> = {
    'FACEBOOK': 0,
    'ZALO': 0,
    'TIKTOK': 0,
    'INSTAGRAM': 0,
    'DIRECT / KHÁC': 0,
  };

  for (const b of monthBookings) {
    const rawSrc = (customerSourceMap.get(b.customerId) || (b as any).source || 'DIRECT').toUpperCase();
    const amount = getBookingTotal(b);
    if (rawSrc.includes('FACEBOOK') || rawSrc === 'FB') {
      channelRevenueTotals['FACEBOOK'] += amount;
    } else if (rawSrc.includes('ZALO')) {
      channelRevenueTotals['ZALO'] += amount;
    } else if (rawSrc.includes('TIKTOK')) {
      channelRevenueTotals['TIKTOK'] += amount;
    } else if (rawSrc.includes('INSTA') || rawSrc.includes('IG')) {
      channelRevenueTotals['INSTAGRAM'] += amount;
    } else {
      channelRevenueTotals['DIRECT / KHÁC'] += amount;
    }
  }

  const revenueByChannel = Object.entries(channelRevenueTotals)
    .map(([name, value]) => ({
      name,
      value,
      color: CHANNEL_BRAND_COLORS[name] ?? '#64748B',
      pct: monthRevenue > 0 ? Math.round((value / monthRevenue) * 100) : 0,
    }))
    .filter(c => c.value > 0);

  const isProfitPositive = currentMonthNetProfit >= 0;
  const summaryStats = [
    {
      title: 'Doanh thu tháng',
      tag: 'Tạm tính',
      tagBg: darkMode ? '#1E3A8A' : '#DBEAFE',
      tagColor: '#2563EB',
      value: formatVnd(monthRevenue),
      sub: 'Doanh thu tháng này',
      label: 'Thu thực tế MTD',
      icon: '🗓',
      color: '#2563EB',
    },
    {
      title: 'Tổng chi phí',
      tag: 'Chưa đủ kỳ',
      tagBg: darkMode ? '#7F1D1D' : '#FEE2E2',
      tagColor: '#EF4444',
      value: formatVnd(currentMonthExpensesTotal),
      sub: 'Đã chi tháng này',
      label: 'Chưa tới hạn tiền phòng, điện',
      icon: '🧾',
      color: '#EF4444',
    },
    {
      title: 'Lợi nhuận tháng',
      tag: 'Tạm tính',
      tagBg: darkMode ? '#064E3B' : '#DCFCE7',
      tagColor: '#10B981',
      value: `${isProfitPositive ? '+' : ''}${formatVnd(currentMonthNetProfit)}`,
      sub: `${currentMonthProfitMargin}% Margin (Tạm tính)`,
      label: `Thu ${formatVnd(monthRevenue)} · Chi ${formatVnd(currentMonthExpensesTotal)}`,
      icon: '💵',
      color: isProfitPositive ? '#10B981' : '#EF4444',
    },
    {
      title: 'Công suất phòng',
      value: `${occupancyRate}%`,
      sub: 'Công suất phòng',
      label: 'Tháng này',
      icon: '🏠',
      color: '#EC4899',
    },
    {
      title: 'Thời gian ở TB',
      value: `${avgStay} đêm`,
      sub: 'Thời gian ở TB',
      label: 'Khách lưu trú',
      icon: '🌙',
      color: '#F59E0B',
    },
  ];

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

      {/* Top 5 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
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

      {/* 6-Month Revenue, Expenses & Profit Trend */}
      <div style={card}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Báo cáo Doanh thu & Chi phí (6 tháng)</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: darkMode ? '#78350F40' : '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 6, border: '1px solid #FCD34D' }}>
                (*) Tháng hiện tại là số liệu tạm tính (Cost Lag)
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>So sánh Doanh thu (Xanh) vs Chi phí (Đỏ) & Đường Biên lợi nhuận ròng (%)</div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#2563EB' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Doanh thu (Cột xanh)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Chi phí (Cột đỏ)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ color: textPrimary, fontWeight: 600 }}>Biên LN (%) (Đường)</span>
            </div>
          </div>
        </div>
        {revenueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={revenueTrend} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" width={65} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={formatShortVnd} />
              <YAxis yAxisId="right" width={45} orientation="right" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={tooltipStyle}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0]?.payload;
                  const isCur = data?.isCurrent;
                  const profit = data?.profit ?? 0;
                  const margin = data?.margin;
                  return (
                    <div style={{ ...tooltipStyle, padding: '10px 14px', minWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: textPrimary, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{label}</span>
                        {isCur && (
                          <span style={{ fontSize: 10, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                            Đang diễn ra
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: '#2563EB', marginBottom: 2 }}>
                        <span>Doanh thu:</span>
                        <span style={{ fontWeight: 700 }}>{formatVnd(data?.revenue ?? 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: '#EF4444', marginBottom: 2 }}>
                        <span>Chi phí:</span>
                        <span style={{ fontWeight: 700 }}>{formatVnd(data?.expenses ?? 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: profit >= 0 ? '#10B981' : '#EF4444', marginBottom: 2 }}>
                        <span>Lợi nhuận ròng:</span>
                        <span style={{ fontWeight: 700 }}>{profit >= 0 ? '+' : ''}{formatVnd(profit)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: '#10B981', fontWeight: 700, paddingTop: 4, borderTop: `1px solid ${bdr}` }}>
                        <span>Biên lợi nhuận:</span>
                        <span>{margin !== null && margin !== undefined ? `${margin}%` : '—'}</span>
                      </div>
                      {isCur && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${bdr}`, fontSize: 11, color: '#F59E0B', lineHeight: 1.3 }}>
                          ⚠️ Tháng chưa chốt sổ (Chi phí cố định tiền nhà, điện nước chưa kết toán hết)
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={16} />
              <Bar yAxisId="left" dataKey="expenses" name="Chi phí" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={16} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin"
                name="Biên lợi nhuận"
                stroke="#10B981"
                strokeWidth={3}
                connectNulls={true}
                dot={{ r: 5, fill: '#10B981', stroke: darkMode ? '#1E293B' : '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
            Chưa có dữ liệu đặt phòng
          </div>
        )}
      </div>

      {/* Row 2: 3 Balanced Analytics Cards (Occupancy, Channel Revenue, Expense Breakdown) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* 1. Công suất phòng theo tuần */}
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Công suất phòng theo tuần</div>
            <div style={{ fontSize: 12, color: textMuted }}>Tỷ lệ lấp đầy các ngày trong tuần này</div>
          </div>
          {dailyOccupancy.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyOccupancy} barSize={20} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Công suất']} />
                <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              Chưa có dữ liệu
            </div>
          )}
        </div>

        {/* 2. Doanh thu theo Kênh bán (Revenue by Channel) */}
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Doanh thu theo Kênh bán</div>
            <div style={{ fontSize: 12, color: textMuted }}>Nguồn khách đem lại doanh thu tháng này</div>
          </div>
          {revenueByChannel.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueByChannel} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value">
                      {revenueByChannel.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {revenueByChannel.map((ch) => (
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
              Chưa có doanh thu tháng này
            </div>
          )}
        </div>

        {/* 3. Cơ cấu chi phí tháng này (Expense Breakdown) */}
        <div style={card}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Cơ cấu chi phí tháng này</div>
            <div style={{ fontSize: 12, color: textMuted }}>Tổng chi: {formatVnd(currentMonthExpensesTotal)}</div>
          </div>
          {expenseByCategory.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value">
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                {expenseByCategory.map((cat, i) => {
                  const pct = currentMonthExpensesTotal > 0 ? Math.round((cat.value / currentMonthExpensesTotal) * 100) : 0;
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
              Chưa có chi phí nào trong tháng này
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
