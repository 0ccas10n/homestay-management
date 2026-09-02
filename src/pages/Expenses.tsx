// ─── Expenses.tsx ──────────────────────────────────────────────────────────────
//
// Uses useExpenses for real data from the API.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useExpenses } from '@/hooks/useExpenses';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Expense } from '@/types/index';
import Modal from '@/components/Modal';
import { formatVnd } from '@/utils/format';

const CATEGORIES = ['Cleaning Supplies', 'Electricity', 'Water', 'Internet', 'Repairs', 'Staff', 'Other'];
const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

type FormFieldKey = 'category' | 'amount' | 'description' | 'vendor' | 'date';
type FormFieldType = 'select' | 'number' | 'text' | 'date';

interface ExpenseFormField {
  label: string;
  key: FormFieldKey;
  type: FormFieldType;
  step?: number;
  placeholder?: string;
}

const fields: ExpenseFormField[] = [
  { label: 'Category', key: 'category', type: 'select' },
  { label: 'Amount (VND)', key: 'amount', type: 'number', step: 10000, placeholder: '1500000' },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Vendor (optional)', key: 'vendor', type: 'text' },
  { label: 'Date', key: 'date', type: 'date' },
];

export default function Expenses() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { expenses, loading, refetch, createExpense } = useExpenses();
  const [filterCat, setFilterCat] = useState('All');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Cleaning Supplies', amount: '', description: '', vendor: '', date: new Date().toISOString().slice(0, 10) });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { refetch(); }, [refetch]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const total = expenses
    .filter(e => e.date && e.date.startsWith(currentMonth))
    .reduce((s, e) => s + e.amount, 0);
  const filtered = filterCat === 'All' ? expenses : expenses.filter(e => e.category === filterCat);

  const handleAdd = async () => {
    if (!form.amount || !form.description) return;
    try {
      await createExpense({ category: form.category, amount: parseFloat(form.amount), description: form.description, date: form.date, vendor: form.vendor || undefined });
      setAddOpen(false);
      setForm({ category: 'Cleaning Supplies', amount: '', description: '', vendor: '', date: new Date().toISOString().slice(0, 10) });
      showToast('Expense added');
    } catch {
      showToast('Failed to save expense');
    }
  };

  // Build pie chart data from real expenses
  const byCategory = CATEGORIES.map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.value > 0);

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#F1F5F9' : '#1E293B', fontSize: 13, fontFamily: "var(--font-sans)", outline: 'none',
  };

  const catColors: Record<string, string> = {
    'Cleaning Supplies': '#06B6D4', 'Electricity': '#F59E0B', 'Water': '#2563EB',
    'Internet': '#8B5CF6', 'Repairs': '#EF4444', 'Staff': '#10B981', 'Other': '#94A3B8',
  };

  const bg = darkMode ? '#1E293B' : '#fff';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: '#1E293B', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: textMuted, fontWeight: 600 }}>Total This Month</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: textPrimary, fontFamily: "'DM Serif Display', serif" }}>{formatVnd(total)}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option>All</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => setAddOpen(true)} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
            + Add Expense
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Table */}
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {['Date', 'Category', 'Description', 'Vendor', 'Amount'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: textMuted, fontWeight: 600, fontSize: 11, background: darkMode ? '#1E293B' : '#F8FAFC' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && expenses.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading…</td></tr>
              ) : filtered.map(e => (
                <tr key={e.expenseId} style={{ borderBottom: `1px solid ${border}` }}
                  onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = darkMode ? '#0F172A40' : '#F8FAFC'}
                  onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', color: textMuted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: `${catColors[e.category] ?? '#94A3B8'}15`, color: catColors[e.category] ?? '#94A3B8', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{e.category}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: textPrimary }}>{e.description}</td>
                  <td style={{ padding: '12px 16px', color: textMuted }}>{e.vendor ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: textPrimary, fontWeight: 700 }}>{formatVnd(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted, fontSize: 13 }}>No expenses found</div>
          )}
        </div>

        {/* Pie */}
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginBottom: 4 }}>By Category</div>
          <div style={{ fontSize: 12, color: textMuted, marginBottom: 16 }}>Monthly breakdown</div>
          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, background: bg, border: `1px solid ${border}` }} formatter={(v: unknown) => [formatVnd(v as number), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {byCategory.map((cat, i) => (
                  <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: textMuted }}>{cat.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{formatVnd(cat.value)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>No expense data</div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Expense" darkMode={darkMode}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 4 }}>{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type={f.type}
                  step={f.step}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
          <button onClick={handleAdd} style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
            Save Expense
          </button>
        </div>
      </Modal>
    </div>
  );
}
