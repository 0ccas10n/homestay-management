// ─── Reports.tsx ─────────────────────────────────────────────────────────────────────
//
// Derives all report data from real API calls:
//   - useBookings  → summary stats + chart data
//   - useExpenses  → expense breakdown
//
// No sampleData imports.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useBookings } from '@/hooks/useBookings';
import { useExpenses } from '@/hooks/useExpenses';
import { formatVnd, getBookingTotal } from '@/utils/format';
import type { BookingStatus } from '@/types/index';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

const REVENUE_STATUSES = new Set<BookingStatus>(['confirmed', 'checked_in', 'checked_out']);

function isRevenueStatus(status: BookingStatus): boolean {
  return REVENUE_STATUSES.has(status);
}

function toDateLocal(iso: string): string {
  // "2026-08-07T14:00:00+07:00" → "2026-08-07" in local time
  return iso.slice(0, 10);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  // ISO / Vietnam business week: Monday is the first day (getDay() === 1)
  // so a Monday-aligned week start is `date - (getDay() === 0 ? 6 : getDay() - 1)` days.
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

  // "now" already represents the user's local time (browser TZ, e.g. +07:00 for VN).
  // Building YYYY-MM-DD from local components avoids the date shift caused by
  // converting to UTC via toISOString() in the early-morning hours.
  const now = new Date();
  const todayStr =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue-eligible bookings: confirmed, checked_in, or checked_out only.
  const revenueBookings = bookings.filter(b => isRevenueStatus(b.status));

  // Today's revenue
  const todayRevenue = revenueBookings
    .filter(b => toDateLocal(b.checkInAt) === todayStr)
    .reduce((s, b) => s + getBookingTotal(b), 0);

  // This week's bookings
  const weekBookings = revenueBookings.filter(b => {
    const d = new Date(b.checkInAt);
    return d >= weekStart && d < weekEnd;
  });
  const weekRevenue = weekBookings.reduce((s, b) => s + getBookingTotal(b), 0);

  // This month
  const monthBookings = revenueBookings.filter(b => {
    const d = new Date(b.checkInAt);
    return d >= monthStart;
  });
  const monthRevenue = monthBookings.reduce((s, b) => s + getBookingTotal(b), 0);

  // Average stay (nights) — uses all non-cancelled bookings for context
  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const avgStay = activeBookings.length > 0
    ? (activeBookings.reduce((s, b) => {
        const cin = new Date(b.checkInAt);
        const cout = new Date(b.expectedCheckOutAt);
        return s + (cout.getTime() - cin.getTime()) / 86400000;
      }, 0) / activeBookings.length).toFixed(1)
    : '0.0';

  // Occupancy: checked_in rooms / total active rooms (approximation)
  const occupiedCount = activeBookings.filter(b => b.status === 'checked_in').length;
  const uniqueRooms = new Set(activeBookings.map(b => b.roomId));
  const occupancyRate = uniqueRooms.size > 0
    ? Math.round((occupiedCount / uniqueRooms.size) * 100)
    : 0;

  // Revenue trend: group by month from bookings (revenue-eligible only)
  const revenueByMonth: Record<string, number> = {};
  for (const b of revenueBookings) {
    const month = b.checkInAt.slice(0, 7); // "2026-08"
    revenueByMonth[month] = (revenueByMonth[month] ?? 0) + getBookingTotal(b);
  }

  // Real monthly expense aggregations from the `expenses` array.
  // Expense.date is "YYYY-MM-DD" (see Expense type); bucket by the same YYYY-MM key.
  const expensesByMonth: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.date || !e.amount) continue;
    const month = e.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    expensesByMonth[month] = (expensesByMonth[month] ?? 0) + e.amount;
  }

  // Build a unified set of months spanning the last 6 months including any
  // months that have expenses but no revenue, so the expense line is real.
  const sortedMonths = Array.from(
    new Set([...Object.keys(revenueByMonth), ...Object.keys(expensesByMonth)])
  ).sort();

  const revenueTrend = sortedMonths
    .slice(-6)
    .map((month) => {
      const [y, m] = month.split('-');
      const label = new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleString('en', { month: 'short', year: 'numeric' });
      return {
        month: label,
        revenue: revenueByMonth[month] ?? 0,
        expenses: expensesByMonth[month] ?? 0,
      };
    });

  // Daily occupancy for this week.
  // A booking occupies a room on day D when D falls within the half-open
  // interval [checkInDate, expectedCheckOutDate), so multi-day stays correctly
  // contribute occupancy on every day of their stay (not just check-in day).
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toLocaleString('en', { weekday: 'short' });
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
      // Half-open: [checkInDate, expectedCheckOutDate)
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

  // Expense breakdown — aggregate only the current month's expenses so the
  // pie chart reflects recent activity rather than all-time history.
  const currentMonthKey =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    if (!e.date || !e.amount) continue;
    if (e.date.slice(0, 7) !== currentMonthKey) continue;
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }
  const expenseByCategory = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .filter(c => c.value > 0);

  const summaryStats = [
    { label: 'Today',     value: formatVnd(todayRevenue),      sub: 'Revenue', icon: '📅', color: '#2563EB' },
    { label: 'This Week', value: formatVnd(weekRevenue),      sub: 'Revenue', icon: '📆', color: '#10B981' },
    { label: 'This Month',value: formatVnd(monthRevenue),     sub: 'Revenue', icon: '🗓', color: '#8B5CF6' },
    { label: 'Avg Stay',  value: `${avgStay} nights`,          sub: 'Duration', icon: '🌙', color: '#F59E0B' },
    { label: 'Occupancy', value: `${occupancyRate}%`,           sub: 'This month', icon: '🏠', color: '#EC4899' },
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

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ ...card, padding: '16px 18px', minHeight: 80 }} />
          ))
        ) : summaryStats.map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'DM Serif Display', serif" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: textPrimary, fontWeight: 600 }}>{s.sub}</div>
            <div style={{ fontSize: 11, color: textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Revenue Trend</div>
          <div style={{ fontSize: 12, color: textMuted }}>Based on booking check-in dates from the last 6 months</div>
        </div>
        {revenueTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => formatVnd(v as number)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue"  stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }}  name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
            No booking data available
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Occupancy */}
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Daily Occupancy</div>
            <div style={{ fontSize: 12, color: textMuted }}>This week by day of week</div>
          </div>
          {dailyOccupancy.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyOccupancy} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Occupancy']} />
                <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Expense breakdown */}
      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Expense Breakdown</div>
          <div style={{ fontSize: 12, color: textMuted }}>By category from the current month</div>
        </div>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>
          {expenseByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width={220} height={200}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expenseByCategory.map((cat, i) => (
                  <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13, color: textPrimary }}>{cat.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{formatVnd(cat.value)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted, flex: 1 }}>No expenses recorded this month</div>
          )}
        </div>
      </div>
    </div>
  );
}
