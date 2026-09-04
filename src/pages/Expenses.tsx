// ─── Expenses.tsx ──────────────────────────────────────────────────────────────
//
// Quản lý Chi phí Vận hành Homestay (Expenses Management)
// Phân loại MECE chuẩn Kế toán Quản trị:
//   1. Chi phí Cố định (Fixed Costs): Mặt bằng, Internet/Wifi, Lương cứng...
//   2. Chi phí Biến đổi (Variable Costs): Điện, Nước, Giặt ủi, Đồ tiêu hao Homestay...
//   3. Chi phí Định kỳ (Recurring Expenses): Tự động hóa tạo chi phí hàng tháng
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useExpenses } from '@/hooks/useExpenses';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '@/components/Modal';
import { formatVnd } from '@/utils/format';
import type { ExpenseCostType, Expense } from '@/types/index';

const CATEGORIES = [
  'Tiền thuê nhà / Mặt bằng',
  'Tiền điện',
  'Tiền nước',
  'Internet / Wifi',
  'Dụng cụ dọn dẹp',
  'Sửa chữa & Bảo trì',
  'Đồ dùng Homestay (Nước giặt, gia vị...)',
  'Lương nhân viên / Quản lý',
  'Hoa hồng OTA & Marketing',
  'Chi phí khác',
];

const PIE_COLORS = ['#8B5CF6', '#2563EB', '#06B6D4', '#10B981', '#EF4444', '#F59E0B', '#EC4899', '#64748B'];

const CAT_COLORS: Record<string, string> = {
  'Tiền thuê nhà / Mặt bằng': '#8B5CF6',
  'Tiền phòng': '#8B5CF6',
  'Tiền điện': '#2563EB',
  'Tiền nước': '#06B6D4',
  'Internet / Wifi': '#EC4899',
  'Dụng cụ dọn dẹp': '#10B981',
  'Sửa chữa & Bảo trì': '#EF4444',
  'Đồ dùng Homestay (Nước giặt, gia vị...)': '#F59E0B',
  'Lương nhân viên / Quản lý': '#6366F1',
  'Hoa hồng OTA & Marketing': '#F97316',
  'Chi phí khác': '#64748B',
  'Điện': '#2563EB',
  'Nước': '#06B6D4',
  'Internet': '#EC4899',
  'Staff': '#6366F1',
  'Repair': '#EF4444',
};

export function getExpenseCostType(e: Partial<Expense> | { category?: string; costType?: string }): ExpenseCostType {
  if (e.costType === 'fixed' || e.costType === 'variable') {
    return e.costType;
  }
  const cat = (e.category || '').toLowerCase();
  if (
    cat.includes('thuê') ||
    cat.includes('mặt bằng') ||
    cat.includes('phòng') ||
    cat.includes('nhà') ||
    cat.includes('wifi') ||
    cat.includes('internet') ||
    cat.includes('lương') ||
    cat.includes('staff') ||
    cat.includes('bảo hiểm')
  ) {
    return 'fixed';
  }
  return 'variable';
}

type TimeRange = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all';
type CostTypeFilter = 'all' | 'fixed' | 'variable' | 'recurring';

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Expenses() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { expenses = [], loading, refetch, createExpense } = useExpenses();

  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
  const [costFilter, setCostFilter] = useState<CostTypeFilter>('all');
  const [filterCat, setFilterCat] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);

  const [form, setForm] = useState<{
    category: string;
    costType: ExpenseCostType;
    isRecurring: boolean;
    amount: string;
    description: string;
    vendor: string;
    date: string;
  }>({
    category: 'Đồ dùng Homestay (Nước giặt, gia vị...)',
    costType: 'variable',
    isRecurring: false,
    amount: '',
    description: '',
    vendor: '',
    date: formatDateStr(new Date()),
  });

  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Xác định khoảng thời gian lọc
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (timeRange === 'this_month') {
      return {
        startDate: formatDateStr(new Date(y, m, 1)),
        endDate: formatDateStr(new Date(y, m + 1, 0)),
        periodLabel: `Tháng này (Thg ${m + 1}/${y})`,
      };
    }
    if (timeRange === 'last_month') {
      const lastMonthNum = m === 0 ? 12 : m;
      const lastMonthYear = m === 0 ? y - 1 : y;
      return {
        startDate: formatDateStr(new Date(y, m - 1, 1)),
        endDate: formatDateStr(new Date(y, m, 0)),
        periodLabel: `Tháng trước (Thg ${lastMonthNum}/${lastMonthYear})`,
      };
    }
    if (timeRange === 'this_quarter') {
      const q = Math.floor(m / 3);
      return {
        startDate: formatDateStr(new Date(y, q * 3, 1)),
        endDate: formatDateStr(new Date(y, (q + 1) * 3, 0)),
        periodLabel: `Quý ${q + 1}/${y}`,
      };
    }
    if (timeRange === 'this_year') {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        periodLabel: `Năm ${y}`,
      };
    }
    return {
      startDate: '2000-01-01',
      endDate: '2099-12-31',
      periodLabel: 'Tất cả thời gian',
    };
  }, [timeRange, y, m]);

  // Lọc chi phí theo Kỳ thời gian
  const periodExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!e.date) return false;
      const d = e.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // Lọc tiếp theo Phân loại chi phí (Cố định / Biến đổi / Định kỳ), Danh mục và Tìm kiếm
  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter(e => {
      const itemCostType = getExpenseCostType(e);
      const matchCostType =
        costFilter === 'all' ||
        (costFilter === 'fixed' && itemCostType === 'fixed') ||
        (costFilter === 'variable' && itemCostType === 'variable') ||
        (costFilter === 'recurring' && (e.isRecurring || itemCostType === 'fixed'));

      const matchCat = filterCat === 'Tất cả' || e.category === filterCat;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q);

      return matchCostType && matchCat && matchSearch;
    });
  }, [periodExpenses, costFilter, filterCat, searchQuery]);

  // Thống kê tổng quan trong kỳ theo MECE
  const totalAmount = useMemo(() => periodExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [periodExpenses]);

  const fixedTotal = useMemo(() => {
    return periodExpenses
      .filter(e => getExpenseCostType(e) === 'fixed')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [periodExpenses]);

  const variableTotal = useMemo(() => {
    return periodExpenses
      .filter(e => getExpenseCostType(e) === 'variable')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [periodExpenses]);

  const fixedPct = totalAmount > 0 ? Math.round((fixedTotal / totalAmount) * 100) : 0;
  const variablePct = totalAmount > 0 ? Math.round((variableTotal / totalAmount) * 100) : 0;

  const maxExpense = useMemo(() => {
    if (periodExpenses.length === 0) return null;
    return [...periodExpenses].sort((a, b) => b.amount - a.amount)[0];
  }, [periodExpenses]);

  // Cơ cấu chi phí theo danh mục trong kỳ
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of periodExpenses) {
      const cat = e.category || 'Chi phí khác';
      map.set(cat, (map.get(cat) ?? 0) + (Number(e.amount) || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: totalAmount > 0 ? Math.round((value / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodExpenses, totalAmount]);

  // Handle Category Change in Form
  const handleFormCategoryChange = (category: string) => {
    const defaultType = getExpenseCostType({ category });
    setForm(prev => ({
      ...prev,
      category,
      costType: defaultType,
      isRecurring: defaultType === 'fixed',
    }));
  };

  // Thêm khoản chi mới
  const handleAdd = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('Vui lòng nhập số tiền chi phí hợp lệ');
      return;
    }
    setSubmitting(true);
    try {
      const desc = form.description.trim() || form.category;
      await createExpense({
        category: form.category,
        costType: form.costType,
        isRecurring: form.isRecurring,
        amount: parseFloat(form.amount),
        description: desc,
        date: form.date,
        vendor: form.vendor.trim() || undefined,
      });
      setAddOpen(false);
      setForm({
        category: 'Đồ dùng Homestay (Nước giặt, gia vị...)',
        costType: 'variable',
        isRecurring: false,
        amount: '',
        description: '',
        vendor: '',
        date: formatDateStr(new Date()),
      });
      showToast('✅ Đã thêm khoản chi thành công');
    } catch {
      showToast('❌ Lưu chi phí thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Preset Recurring Templates for 1-Click Generation
  const RECURRING_PRESETS = [
    { category: 'Tiền thuê nhà / Mặt bằng', amount: 15000000, description: 'Tiền thuê nhà nguyên căn / Mặt bằng tháng này', costType: 'fixed' as const, vendor: 'Chủ nhà' },
    { category: 'Internet / Wifi', amount: 350000, description: 'Gói cáp quang Homestay FPT / Viettel', costType: 'fixed' as const, vendor: 'Nhà mạng' },
    { category: 'Lương nhân viên / Quản lý', amount: 6000000, description: 'Lương cứng quản lý homestay', costType: 'fixed' as const, vendor: 'Nhân sự' },
  ];

  const handleApplyRecurringPreset = async (preset: typeof RECURRING_PRESETS[0]) => {
    try {
      await createExpense({
        category: preset.category,
        costType: preset.costType,
        isRecurring: true,
        amount: preset.amount,
        description: preset.description,
        date: formatDateStr(new Date(y, m, 5)), // Ghi nhận ngày 5 hàng tháng
        vendor: preset.vendor,
      });
      showToast(`✅ Đã ghi nhận chi phí định kỳ: ${preset.category}`);
    } catch {
      showToast('❌ Thêm chi phí thất bại');
    }
  };

  const bg = darkMode ? '#1E293B' : '#fff';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';

  const cardStyle = {
    background: bg,
    borderRadius: 12,
    border: `1px solid ${border}`,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: textPrimary,
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: '#0F172A', color: '#fff', padding: '12px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid #334155',
        }}>
          {toast}
        </div>
      )}

      {/* ─── 1. BỘ LỌC THỜI GIAN & NÚT THÊM CHI PHÍ ────────────────────────── */}
      <div style={{
        ...cardStyle, padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📅 Kỳ chi phí:
          </div>
          <div style={{ display: 'flex', gap: 6, background: darkMode ? '#0F172A' : '#F1F5F9', padding: 4, borderRadius: 8 }}>
            {[
              { key: 'this_month', label: 'Tháng này' },
              { key: 'last_month', label: 'Tháng trước' },
              { key: 'this_quarter', label: 'Quý này' },
              { key: 'this_year', label: 'Năm nay' },
              { key: 'all', label: 'Tất cả' },
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
        </div>

        {/* Nút tác vụ nhanh */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setRecurringModalOpen(true)}
            style={{
              background: darkMode ? '#312E81' : '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE',
              borderRadius: 8,
              padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>🔁</span>
            <span>Chi phí định kỳ</span>
          </button>

          <button
            onClick={() => setAddOpen(true)}
            style={{
              background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}
          >
            <span>➕</span>
            <span>Thêm khoản chi</span>
          </button>
        </div>
      </div>

      {/* ─── 2. HÀNG 4 THẺ KPI TỔNG QUAN (MECE COST STRUCTURE) ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* Thẻ 1: Tổng chi phí */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>Tổng chi phí trong kỳ</span>
            <span style={{ fontSize: 18 }}>🧾</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', fontFamily: "'DM Serif Display', serif", marginBottom: 2 }}>
            {formatVnd(totalAmount)}
          </div>
          <div style={{ fontSize: 12, color: textMuted }}>
            {periodExpenses.length} khoản chi ({periodLabel})
          </div>
        </div>

        {/* Thẻ 2: Chi phí Cố định (Fixed Costs) */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>Chi phí Cố định (Fixed)</span>
            <span style={{ fontSize: 11, background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{fixedPct}%</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2563EB', fontFamily: "'DM Serif Display', serif", marginBottom: 2 }}>
            {formatVnd(fixedTotal)}
          </div>
          <div style={{ fontSize: 12, color: textMuted }}>
            Mặt bằng, Wifi, Lương quản lý...
          </div>
        </div>

        {/* Thẻ 3: Chi phí Biến đổi (Variable Costs) */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>Chi phí Biến đổi (Variable)</span>
            <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{variablePct}%</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981', fontFamily: "'DM Serif Display', serif", marginBottom: 2 }}>
            {formatVnd(variableTotal)}
          </div>
          <div style={{ fontSize: 12, color: textMuted }}>
            Điện, Nước, Giặt ủi, Đồ tiêu hao...
          </div>
        </div>

        {/* Thẻ 4: Khoản chi lớn nhất */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>Khoản chi lớn nhất</span>
            <span style={{ fontSize: 18 }}>💎</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8B5CF6', fontFamily: "'DM Serif Display', serif", marginBottom: 2 }}>
            {maxExpense ? formatVnd(maxExpense.amount) : '0 ₫'}
          </div>
          <div style={{ fontSize: 12, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {maxExpense ? `${maxExpense.category} (${maxExpense.description})` : 'Chưa có dữ liệu'}
          </div>
        </div>
      </div>

      {/* ─── 3. BẢNG CHI PHÍ & BIỂU ĐỒ CƠ CẤU (ĐỒNG BỘ THEO KỲ) ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Bảng danh sách chi phí */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Thanh công cụ lọc trên bảng */}
          <div style={{
            padding: '14px 18px', borderBottom: `1px solid ${border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                Danh sách chi phí ({filteredExpenses.length})
              </span>

              {/* Bộ lọc loại chi phí: Tất cả / Cố định / Biến đổi */}
              <div style={{ display: 'flex', gap: 4, background: darkMode ? '#0F172A' : '#F1F5F9', padding: 3, borderRadius: 6 }}>
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'fixed', label: '🏷️ Cố định' },
                  { key: 'variable', label: '🔄 Biến đổi' },
                  { key: 'recurring', label: '🔁 Định kỳ' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCostFilter(f.key as CostTypeFilter)}
                    style={{
                      background: costFilter === f.key ? (darkMode ? '#334155' : '#fff') : 'transparent',
                      color: costFilter === f.key ? (darkMode ? '#F1F5F9' : '#2563EB') : textMuted,
                      border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Lọc danh mục */}
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
              >
                <option value="Tất cả">Tất cả danh mục</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Ô tìm kiếm */}
              <input
                type="text"
                placeholder="🔍 Tìm nội dung, nơi mua..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, width: 160 }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${border}`, background: darkMode ? '#0F172A' : '#F8FAFC' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 12 }}>Ngày chi</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 12 }}>Phân loại</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 12 }}>Danh mục</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 12 }}>Nội dung / Mô tả</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 12 }}>Nơi mua / NCC</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', color: textMuted, fontWeight: 600, fontSize: 12 }}>Số tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody>
                {loading && expenses.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: textMuted }}>Đang tải dữ liệu...</td></tr>
                ) : filteredExpenses.map(e => {
                  const nature = getExpenseCostType(e);
                  return (
                    <tr
                      key={e.expenseId}
                      style={{ borderBottom: `1px solid ${border}` }}
                      onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = darkMode ? '#0F172A40' : '#F8FAFC'}
                      onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' }}>
                        {e.date}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: nature === 'fixed' ? (darkMode ? '#1E3A8A' : '#DBEAFE') : (darkMode ? '#064E3B' : '#D1FAE5'),
                            color: nature === 'fixed' ? '#2563EB' : '#059669',
                          }}>
                            {nature === 'fixed' ? 'CỐ ĐỊNH' : 'BIẾN ĐỔI'}
                          </span>
                          {e.isRecurring && (
                            <span style={{ fontSize: 11 }} title="Chi phí định kỳ">🔁</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: `${CAT_COLORS[e.category] ?? '#94A3B8'}18`,
                          color: CAT_COLORS[e.category] ?? '#94A3B8',
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: textPrimary, fontWeight: 500 }}>
                        {e.description}
                      </td>
                      <td style={{ padding: '12px 16px', color: textMuted }}>
                        {e.vendor ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#EF4444', fontWeight: 700, textAlign: 'right' }}>
                        {formatVnd(e.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && !loading && (
              <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>
                Không tìm thấy khoản chi nào trong kỳ này
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ Cơ cấu Chi phí (Pie Donut) */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginBottom: 2 }}>
            Cơ cấu chi phí trong kỳ
          </div>
          <div style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>
            {periodLabel} · Tổng: {formatVnd(totalAmount)}
          </div>

          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {byCategory.map((entry, i) => (
                      <Cell key={i} fill={CAT_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, background: bg, border: `1px solid ${border}` }}
                    formatter={(v: unknown) => [formatVnd(v as number), 'Số tiền']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {byCategory.map((cat, i) => (
                  <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat.name] ?? PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, color: textPrimary }}>{formatVnd(cat.value)}</span>
                      <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: darkMode ? '#334155' : '#F1F5F9', color: textMuted, fontWeight: 700 }}>
                        {cat.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted }}>
              Chưa có chi phí nào trong kỳ này
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL TỰ ĐỘNG GHI NHẬN CHI PHÍ ĐỊNH KỲ ────────────────────────── */}
      <Modal open={recurringModalOpen} onClose={() => setRecurringModalOpen(false)} title="🔁 Quản lý & Tự động ghi nhận Chi phí Định kỳ" darkMode={darkMode} width={540}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: textMuted, lineHeight: 1.5 }}>
            Các chi phí cố định hàng tháng (Mặt bằng, Internet, Lương). Bạn có thể bấm 1-click để ghi nhận nhanh vào sổ chi tiêu tháng này:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RECURRING_PRESETS.map((p, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 14px', borderRadius: 10, border: `1px solid ${border}`,
                  background: darkMode ? '#0F172A' : '#F8FAFC',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: textPrimary, fontSize: 13 }}>{p.category}</div>
                  <div style={{ fontSize: 12, color: textMuted }}>{p.description} (NCC: {p.vendor})</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>{formatVnd(p.amount)}</div>
                </div>
                <button
                  onClick={() => {
                    handleApplyRecurringPreset(p);
                    setRecurringModalOpen(false);
                  }}
                  style={{
                    background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Ghi nhận tháng này
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ─── MODAL THÊM KHOẢN CHI ───────────────────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Thêm khoản chi mới" darkMode={darkMode} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
              Danh mục chi phí *
            </label>
            <select
              value={form.category}
              onChange={e => handleFormCategoryChange(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
                Bản chất chi phí (MECE) *
              </label>
              <select
                value={form.costType}
                onChange={e => setForm(prev => ({ ...prev, costType: e.target.value as ExpenseCostType }))}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="variable">🔄 Biến đổi (Variable)</option>
                <option value="fixed">🏷️ Cố định (Fixed)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
                Khoản chi định kỳ?
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer', fontSize: 13, color: textPrimary, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={e => setForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span>Hàng tháng 🔁</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
              Số tiền (VNĐ) *
            </label>
            <input
              type="number"
              step={10000}
              placeholder="Ví dụ: 455000"
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
              Nội dung / Mô tả chi tiết (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Nước giặt, dầu gội, gia vị..."
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
              Nơi mua / Nhà cung cấp (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Siêu thị Go, Tạp hóa..."
              value={form.vendor}
              onChange={e => setForm(prev => ({ ...prev, vendor: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>
              Ngày chi *
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={() => setAddOpen(false)}
              style={{
                background: 'transparent', color: textMuted, border: `1px solid ${border}`,
                borderRadius: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              onClick={handleAdd}
              disabled={submitting}
              style={{
                background: submitting ? '#93C5FD' : '#2563EB',
                color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px',
                fontWeight: 600, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              {submitting ? 'Đang lưu...' : 'Lưu khoản chi'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
