// ─── Settings.tsx ────────────────────────────────────────────────────────────────────
//
// Fetches rooms from the API via useRooms (Rooms tab).
// Other tabs are still local-only (no backend for settings/business-info yet).
// darkMode is sourced from useOutletContext.
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRooms } from '@/hooks/useRooms';

const TABS = ['Business Info', 'Rooms', 'Room Types', 'Staff', 'Pricing'];

export default function Settings() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { rooms, loading: roomsLoading, refetch } = useRooms();
  const [activeTab, setActiveTab] = useState('Business Info');
  const [toast, setToast] = useState<string | null>(null);
  const [bizInfo, setBizInfo] = useState({
    name: 'Homestay Bình Lợi Trung',
    address: 'Bình Lợi Trung, Bình Chánh, Hồ Chí Minh',
    phone: '+84 28 0000 0001',
    email: 'hello@binhloitrung.vn',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    currency: 'VND',
    website: 'www.binhloitrung.vn',
  });

  useEffect(() => { refetch(); }, [refetch]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted   = darkMode ? '#94A3B8'  : '#64748B';
  const border     = darkMode ? '#334155'  : '#E2E8F0';
  const bg          = darkMode ? '#1E293B' : '#fff';

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${border}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: textPrimary, fontSize: 13,
    fontFamily: "'Outfit', sans-serif", outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: '#1E293B', color: '#fff', padding: '12px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '4px', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'Outfit', sans-serif", border: 'none',
            background: activeTab === t ? '#2563EB' : 'transparent',
            color: activeTab === t ? '#fff' : textMuted,
            transition: 'all 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Business Info tab */}
      {activeTab === 'Business Info' && (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 20 }}>Business Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Object.entries(bizInfo).map(([key, val]) => {
              const isAddress = key === 'address';
              return (
                <div key={key} style={isAddress ? { gridColumn: '1 / -1' } : {}}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <input
                    type={key === 'checkInTime' || key === 'checkOutTime' ? 'time' : 'text'}
                    value={val}
                    onChange={e => setBizInfo(prev => ({ ...prev, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              );
            })}
          </div>
          <button
            onClick={() => showToast('Business info saved (local)')}
            style={{
              marginTop: 20, background: '#2563EB', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Rooms tab — real data from API */}
      {activeTab === 'Rooms' && (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Room Management</div>
          </div>
          {roomsLoading && rooms.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: textMuted }}>Loading rooms…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${border}`, background: darkMode ? '#0F172A' : '#F8FAFC' }}>
                  {['Room #', 'Type', 'Floor', 'Capacity', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: textMuted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.roomId} style={{ borderBottom: `1px solid ${border}` }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: textPrimary }}>{r.name}</td>
                    <td style={{ padding: '10px 16px', color: textMuted }}>{r.description ?? '—'}</td>
                    <td style={{ padding: '10px 16px', color: textMuted }}>{r.floor ?? '—'}</td>
                    <td style={{ padding: '10px 16px', color: textMuted }}>{r.capacity}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                        background:
                          r.status === 'available' ? '#D1FAE5' :
                          r.status === 'occupied'  ? '#DBEAFE' :
                          r.status === 'cleaning'  ? '#FEF3C7' :
                          r.status === 'maintenance' ? '#FEF3C7' : '#FEE2E2',
                        color:
                          r.status === 'available' ? '#065F46' :
                          r.status === 'occupied'  ? '#1E40AF' :
                          r.status === 'cleaning'  ? '#92400E' :
                          r.status === 'maintenance' ? '#92400E' : '#991B1B',
                      }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Room Types tab */}
      {activeTab === 'Room Types' && (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 20 }}>Room Types & Base Pricing</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { type: 'Hiên (Standard)', basePrice: 350_000, desc: 'Tối đa 4 khách, tiện nghi cơ bản' },
              { type: 'Yên (Deluxe)',    basePrice: 450_000, desc: 'Tối đa 5 khách, bồn tắm + ban công' },
              { type: 'Yên Jacuzzi',      basePrice: 650_000, desc: 'Tối đa 5 khách, bếp + jacuzzi' },
            ].map(rt => (
              <div key={rt.type} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 10, border: `1px solid ${border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: textPrimary, fontSize: 14 }}>{rt.type}</div>
                  <div style={{ fontSize: 12, color: textMuted }}>{rt.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input defaultValue={rt.basePrice} type="number" style={{ ...inputStyle, width: 120, textAlign: 'right' as const }} />
                  <span style={{ fontSize: 12, color: textMuted }}>₫/đêm</span>
                  <button onClick={() => showToast(`${rt.type} pricing updated (local)`)} style={{
                    background: '#10B981', color: '#fff', border: 'none', borderRadius: 7,
                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                  }}>
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff tab */}
      {activeTab === 'Staff' && (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Staff Accounts</div>
            <button onClick={() => showToast('Invite staff feature coming soon')} style={{
              background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}>
              + Invite Staff
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Admin (Bạn)', role: 'Chủ homestay', email: 'admin@binhloitrung.vn' },
              { name: 'Maria Santos', role: 'Nhân viên vệ sinh', email: 'maria@binhloitrung.vn' },
              { name: 'John Dao', role: 'Lễ tân', email: 'john@binhloitrung.vn' },
            ].map(staff => (
              <div key={staff.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, border: `1px solid ${border}` }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 99,
                  background: `hsl(${staff.name.charCodeAt(0) * 37 % 360}, 60%, 55%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {staff.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: textPrimary, fontSize: 13 }}>{staff.name}</div>
                  <div style={{ fontSize: 12, color: textMuted }}>{staff.email}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                  background: staff.role === 'Chủ homestay' ? '#DBEAFE' : (darkMode ? '#1E293B' : '#F1F5F9'),
                  color: staff.role === 'Chủ homestay' ? '#1E40AF' : textMuted,
                }}>
                  {staff.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing tab */}
      {activeTab === 'Pricing' && (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 20 }}>Pricing Rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Weekend Surcharge', value: '15', unit: '%' },
              { label: 'Long Stay Discount (7+ nights)', value: '10', unit: '%' },
              { label: 'Early Bird Discount (30+ days)', value: '12', unit: '%' },
              { label: 'Min Deposit Required', value: '50', unit: '%' },
            ].map(rule => (
              <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: `1px solid ${border}` }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: textPrimary }}>{rule.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input defaultValue={rule.value} type="number" style={{ ...inputStyle, width: 70, textAlign: 'right' as const }} />
                  <span style={{ fontSize: 13, color: textMuted }}>{rule.unit}</span>
                </div>
              </div>
            ))}
            <button onClick={() => showToast('Pricing rules saved (local)') } style={{
              alignSelf: 'flex-start', background: '#2563EB', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}>
              Save Pricing Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
