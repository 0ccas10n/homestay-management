// ─── Dashboard.tsx ────────────────────────────────────────────────────────────────────
//
// Uses useDashboard for stat cards, Today's Activity sections, and chart data.
// Modals make real API calls instead of just updating local state.
//
// Pages rendered inside AppShell receive darkMode via useOutletContext().
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';
import { useBookings } from '@/hooks/useBookings';
import { bookingsApi, roomsApi, cleaningApi, expensesApi } from '@/services/api';
import type { Booking, CleaningTask } from '@/types/index';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getBookingStatus, getStatusColor, getStatusBg, minutesUntilCheckout, formatMinutes } from '@/utils/pricing';
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
  const { bookings, refetch: refetchBookings } = useBookings({ autoFetch: false });
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
    roomsApi.getInternal()
      .then(r => setRooms(r))
      .catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([
      roomsApi.getInternal().catch(() => []),
      cleaningApi.get({ active: 'true' }).catch(() => []),
    ]).then(([r, c]) => {
      setRooms(r);
      setCleaningTasks(c);
    });
    refetchBookings().catch(() => {});
  }, [refetchBookings, refetchLocalRooms]);

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
  const checkingIn = bookings.filter(b =>
    b.checkInAt.startsWith(today) &&
    b.status !== 'cancelled' &&
    (b.status === 'confirmed' || b.status === 'inquiry'),
  );
  const checkingOut = bookings.filter(b =>
    b.expectedCheckOutAt.startsWith(today) &&
    b.status !== 'cancelled' &&
    b.status === 'checked_in',
  );

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
    : `${monthlyDelta >= 0 ? '+' : ''}${monthlyDelta}% vs last month`;

  const statColors = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];
  const statCards = [
    { label: 'Total Rooms', value: totalRooms || '—', sub: `${available} available`, color: statColors[0], icon: '🛏' },
    { label: 'Occupied', value: occupied || '—', sub: `${totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0}% occupancy`, color: statColors[1], icon: '👤' },
    { label: 'Cleaning Needed', value: needsCleaning || '—', sub: `${activeCleaning.length} in queue`, color: statColors[2], icon: '🧹' },
    { label: 'Monthly Revenue', value: formatVnd(monthlyRevenueTotal), sub: monthlyDeltaText, color: statColors[3], icon: '💰' },
  ];

  const getGuestName = (booking: Booking): string => {
    // Real data: customer name not included in the booking object.
    // For now display a placeholder — this will be improved when the API
    // returns customer info inline or a join is fetched.
    return `Guest ${booking.customerId.slice(-4)}`;
  };

  const getRoomNumber = (booking: Booking): string => {
    const r = roomMap[booking.roomId];
    return r?.name ?? booking.roomId;
  };

  // ── Modal actions ──────────────────────────────────────────────────────────────

  const handleCheckIn = async (bookingId: string) => {
    try {
      await bookingsApi.update(bookingId, { status: 'checked_in' });
      await refetchBookings();
      setModal(null);
      showToast('Guest checked in successfully');
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
              fontFamily: "'Outfit', sans-serif",
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${btn.color}25`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >{btn.label}</button>
        ))}
      </div>

      {/* Charts Row */}
      {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={card(darkMode)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Revenue vs Expenses</div>
            <div style={{ fontSize: 12, color: textMuted }}>Last 6 months</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} />
              {/* Y-axis ticks and tooltip both render values through formatVnd
                  so the scale shows formatted VND (e.g. "15.000.000 ₫") rather
                  than raw numeric magnitudes. */}
              <YAxis tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} tickFormatter={v => formatVnd(v as number)} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }} formatter={(v: unknown) => [formatVnd(v as number), '']} />
              <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#rev)" name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#exp)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={card(darkMode)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Weekly Occupancy</div>
            <div style={{ fontSize: 12, color: textMuted }}>This week %</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyOccupancy} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#F1F5F9'} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: textMuted }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, background: darkMode ? '#1E293B' : '#fff', border: `1px solid ${borderColor}` }} formatter={(v: unknown) => [`${v}%`, 'Occupancy']} />
              <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {/* Today's Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        {/* Checking In */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Checking In Today</div>
            <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{checkingIn.length}</span>
          </div>
          {checkingIn.length === 0 ? (
            <p style={{ color: textMuted, fontSize: 13 }}>No arrivals today</p>
          ) : checkingIn.map(b => (
            <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 11, color: textMuted }}>Room {getRoomNumber(b)} · {b.numGuests ?? 1} guest{(b.numGuests ?? 1) > 1 ? 's' : ''}</div>
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
            <p style={{ color: textMuted, fontSize: 13 }}>No departures today</p>
          ) : checkingOut.map(b => (
            <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{getGuestName(b)}</div>
                <div style={{ fontSize: 11, color: textMuted }}>Room {getRoomNumber(b)} · Balance: {formatVnd(getBookingTotal(b))}</div>
              </div>
              <StatusBadge status="Checked In" />
            </div>
          ))}
        </div>

        {/* Urgent Cleaning */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Cleaning Queue</div>
            <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{activeCleaning.length}</span>
          </div>
            {activeCleaning.length === 0 ? (
              <p style={{ color: textMuted, fontSize: 13 }}>No rooms waiting for cleaning</p>
            ) : activeCleaning.map(t => (
            <div key={t.cleaningId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                  Room {roomMap[t.roomId]?.name ?? t.roomId}
                </div>
                <div style={{ fontSize: 11, color: textMuted }}>
                  Scheduled {t.scheduledAt.slice(0, 10)} · {t.assignedTo ?? 'Unassigned'}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>

        {/* Notifications placeholder */}
        <div style={card(darkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>Notifications</div>
          </div>
          <p style={{ color: textMuted, fontSize: 13 }}>Sign in to see notifications</p>
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
          <p style={{ margin: 0, color: darkMode ? '#94A3B8' : '#64748B', fontSize: 13 }}>Select a confirmed booking to check in.</p>
          {checkingIn.map(b => (
            <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`, cursor: 'pointer' }}
              onClick={() => handleCheckIn(b.bookingId)}>
              <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
              <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B' }}>Room {getRoomNumber(b)} · {b.checkInAt.slice(0, 10)} → {b.expectedCheckOutAt.slice(0, 10)}</div>
            </div>
          ))}
          {checkingIn.length === 0 && <p style={{ color: '#64748B', fontSize: 13 }}>No guests to check in today.</p>}
        </div>
      </Modal>

      <Modal open={modal === 'check-out'} onClose={() => setModal(null)} title="Check Out Guest" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {checkingOut.map(b => (
            <div key={b.bookingId} style={{ padding: '12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}` }}>
              <div style={{ fontWeight: 600, color: darkMode ? '#F1F5F9' : '#1E293B' }}>{getGuestName(b)}</div>
              <div style={{ fontSize: 12, color: darkMode ? '#94A3B8' : '#64748B', marginBottom: 8 }}>Room {getRoomNumber(b)} · Balance: {formatVnd(getBookingTotal(b))}</div>
              <button onClick={() => handleCheckOut(b.bookingId)} style={{ background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                Process Check-out
              </button>
            </div>
          ))}
          {checkingOut.length === 0 && <p style={{ color: '#64748B', fontSize: 13 }}>No guests checking out today.</p>}
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
                style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
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
    fontSize: 13, fontFamily: "'Outfit', sans-serif", outline: 'none',
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
        style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
        Save Expense
      </button>
    </div>
  );
}
