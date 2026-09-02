// ─── Rooms.tsx ────────────────────────────────────────────────────────────────────
//
// Uses useRooms for real data from the API.
// All CRUD actions call the API and update local state via the hook.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRooms } from '@/hooks/useRooms';
import { ApiError } from '@/services/api';
import type { Room, RoomStatus } from '@/types/index';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const STATUS_FILTERS = ['All', 'available', 'occupied', 'cleaning', 'needs_cleaning', 'maintenance', 'inactive'] as const;
type FilterTab = typeof STATUS_FILTERS[number];

const STATUS_COLOR: Record<string, string> = {
  available: '#10B981', occupied: '#2563EB', cleaning: '#F59E0B',
  needs_cleaning: '#EA580C', maintenance: '#EF4444',
};
const STATUS_BG: Record<string, string> = {
  available: '#ECFDF5', occupied: '#EFF6FF', cleaning: '#FFFBEB',
  needs_cleaning: '#FFF7ED', maintenance: '#FEF2F2',
};

export default function Rooms() {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { rooms, loading, refetch, createRoom, updateRoom, deleteRoom } = useRooms();
  const [filterTab, setFilterTab] = useState<FilterTab>('All');
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { refetch(); }, [refetch]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Sync selected when data changes
  useEffect(() => {
    if (selectedRoom) {
      const updated = rooms.find(r => r.roomId === selectedRoom.roomId);
      if (updated) setSelectedRoom(updated);
      else setSelectedRoom(null);
    }
  }, [rooms]);

  const filtered = rooms.filter(r => {
    const isRoomInactive = !r.active || r.status === 'inactive';
    if (filterTab === 'inactive') {
      if (!isRoomInactive) return false;
    } else if (filterTab === 'All') {
      if (isRoomInactive) return false;
    } else {
      if (r.status !== filterTab || isRoomInactive) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !(r.description ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statCounts: Record<FilterTab, number> = {
    All: rooms.filter(r => r.active && r.status !== 'inactive').length,
    available: rooms.filter(r => r.status === 'available' && r.active).length,
    occupied: rooms.filter(r => r.status === 'occupied' && r.active).length,
    cleaning: rooms.filter(r => r.status === 'cleaning' && r.active).length,
    needs_cleaning: rooms.filter(r => r.status === 'needs_cleaning' && r.active).length,
    maintenance: rooms.filter(r => r.status === 'maintenance' && r.active).length,
    inactive: rooms.filter(r => !r.active || r.status === 'inactive').length,
  };

  const handleAdd = async (data: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createRoom(data);
      setFormOpen(false);
      showToast(`Room added`);
    } catch {
      showToast('Failed to add room');
    }
  };

  const handleEdit = async (data: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>) => {
    if (!editingRoom) return;
    try {
      await updateRoom(editingRoom.roomId, data);
      setFormOpen(false);
      setEditingRoom(null);
      showToast('Room updated');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update room');
    }
  };

  const handleToggleMaintenance = async (room: Room) => {
    const next: RoomStatus = room.status === 'maintenance' ? 'available' : 'maintenance';
    try {
      await updateRoom(room.roomId, { status: next });
      showToast(next === 'maintenance' ? `Room ${room.name} marked out of order` : `Room ${room.name} cleared`);
    } catch {
      showToast('Failed to update room');
    }
  };

  const handleDelete = async (room: Room) => {
    try {
      await deleteRoom(room.roomId);
      showToast(`Room ${room.name} disabled`);
    } catch {
      showToast('Failed to disable room');
    }
  };

  const handleRestore = async (room: Room) => {
    try {
      await updateRoom(room.roomId, { active: true, status: 'available' });
      showToast(`Room ${room.name} restored to Available`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to restore room');
    }
  };

  const bg = darkMode ? '#1E293B' : '#fff';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = darkMode ? '#94A3B8' : '#64748B';
  const border = darkMode ? '#334155' : '#E2E8F0';

  const inputStyle = (err?: boolean) => ({
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${err ? '#EF4444' : border}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: textPrimary, fontSize: 13, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const,
  });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: '#1E293B', color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 28px rgba(0,0,0,0.22)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {STATUS_FILTERS.map(s => {
          const color = s === 'All' ? '#64748B' : STATUS_COLOR[s] ?? '#64748B';
          return (
            <button key={s} onClick={() => setFilterTab(s)}
              style={{
                background: filterTab === s ? `${color}15` : bg,
                border: `1px solid ${filterTab === s ? color : border}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: filterTab === s ? color : textPrimary, fontFamily: "'DM Serif Display', serif" }}>{statCounts[s]}</div>
              <div style={{ fontSize: 12, color: filterTab === s ? color : textMuted, fontWeight: 600 }}>{s}</div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: darkMode ? '#0F172A' : '#F1F5F9', borderRadius: 8, padding: 3 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilterTab(f)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: filterTab === f ? (darkMode ? '#1E293B' : '#fff') : 'transparent',
                color: filterTab === f ? textPrimary : textMuted,
                boxShadow: filterTab === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Room name…"
            style={{ padding: '6px 10px 6px 28px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0F172A' : '#F8FAFC', color: textPrimary, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 140 }} />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: textMuted }}>{filtered.length} room{filtered.length !== 1 ? 's' : ''}</div>
        <button
          onClick={() => { setEditingRoom(null); setFormOpen(true); }}
          style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
          + Add Room
        </button>
      </div>

      {/* Loading */}
      {loading && rooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: textMuted }}>Loading rooms…</div>
      )}

      {/* Room grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map(r => {
          const color = STATUS_COLOR[r.status] ?? '#64748B';
          const isActive = r.active && r.status !== 'inactive';
          return (
            <div key={r.roomId}
              onClick={() => setSelectedRoom(r)}
              style={{
                background: bg,
                borderRadius: 14,
                border: `1.5px solid ${isActive ? color : border}`,
                padding: '18px 18px 14px',
                cursor: 'pointer',
                opacity: !r.active ? 0.6 : 1,
                transition: 'all 0.15s',
              }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'DM Serif Display', serif", color: textPrimary }}>{r.name}</span>
                {isActive && <StatusBadge status={r.status} />}
                {!r.active && <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>INACTIVE</span>}
              </div>
              <div style={{ fontSize: 13, color: textMuted, marginBottom: 4 }}>{r.description}</div>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>Floor {r.floor} · Capacity {r.capacity}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#2563EB' }}>{r.priceDisplay ?? '—'}</span>
                {isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleMaintenance(r); }}
                    style={{
                      background: r.status === 'maintenance' ? '#ECFDF5' : '#FEF2F2',
                      color: r.status === 'maintenance' ? '#065F46' : '#991B1B',
                      border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {r.status === 'maintenance' ? 'Restore' : '🔧 OOO'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: textMuted }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛏</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No rooms match filters</div>
          </div>
        )}
      </div>

      {/* Room detail panel */}
      {selectedRoom && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setSelectedRoom(null)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 100, width: 400, background: bg,
            borderLeft: `1px solid ${border}`, boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column', animation: 'slideIn 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ padding: '20px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'inherit', color: textPrimary }}>Room {selectedRoom.name}</div>
                  <div style={{ marginTop: 8 }}><StatusBadge status={selectedRoom.status} /></div>
                </div>
                <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 22 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => { setEditingRoom(selectedRoom); setFormOpen(true); }}
                  style={{ flex: 1, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✏️ Edit Room
                </button>
                {(!selectedRoom.active || selectedRoom.status === 'inactive') ? (
                  <button onClick={() => handleRestore(selectedRoom)}
                    style={{ flex: 1, background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✅ Enable Room
                  </button>
                ) : (
                  <button onClick={() => handleDelete(selectedRoom)}
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    🚫 Disable
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>Capacity</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{selectedRoom.capacity} guests</div>
                </div>
                <div style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>Floor</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{selectedRoom.floor}</div>
                </div>
                <div style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>Price</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>{selectedRoom.priceDisplay ?? '—'}</div>
                </div>
                <div style={{ background: darkMode ? '#0F172A' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>Location</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{selectedRoom.locationId}</div>
                </div>
              </div>
              {selectedRoom.notes && (
                <div style={{ marginTop: 16, background: '#FEF3C7', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', marginBottom: 4 }}>NOTES</div>
                  <div style={{ fontSize: 13, color: '#78350F' }}>{selectedRoom.notes}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Room Modal */}
      {formOpen && (
        <RoomFormModal
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingRoom(null); }}
          onSave={editingRoom ? handleEdit : handleAdd}
          initial={editingRoom}
          darkMode={darkMode}
          inputStyle={inputStyle}
          textMuted={textMuted}
          border={border}
          bg={bg}
          textPrimary={textPrimary}
        />
      )}
    </div>
  );
}

// ─── Room Form Modal ─────────────────────────────────────────────────────────

interface RoomFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'>) => void;
  initial: Room | null;
  darkMode: boolean;
  inputStyle: (err?: boolean) => React.CSSProperties;
  textMuted: string;
  border: string;
  bg: string;
  textPrimary: string;
}

function RoomFormModal({ onClose, onSave, initial, darkMode, inputStyle, textMuted, border, bg, textPrimary }: RoomFormModalProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    locationId: initial?.locationId ?? 'LOC-0001',
    capacity: initial?.capacity ?? 2,
    priceDisplay: initial?.priceDisplay ?? '',
    status: initial?.status ?? 'available',
    active: initial?.active ?? true,
    floor: initial?.floor ?? 1,
    amenities: initial?.amenities ?? [],
    notes: initial?.notes ?? '',
    imageUrl: initial?.imageUrl ?? '',
  });
  const [amenitiesReplaced, setAmenitiesReplaced] = useState(!initial);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const AMENITIES = ['Sofa','Smart TV', 'Máy chiếu', 'Ban công','Cửa Sổ', 'Bếp',  'Microwave', 'Nồi Chiên Không Dầu','Bồn Tắm'];  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: `1px solid ${border}` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>{initial ? `Edit Room ${initial.name}` : 'Add New Room'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 22 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Room Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Room 101" style={inputStyle()} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Floor</label>
              <input type="number" value={form.floor} onChange={e => set('floor', parseInt(e.target.value) || 1)} style={inputStyle()} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Description</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description" style={inputStyle()} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Capacity</label>
              <input type="number" value={form.capacity} onChange={e => set('capacity', parseInt(e.target.value) || 1)} style={inputStyle()} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Price Display</label>
              <input value={form.priceDisplay} onChange={e => set('priceDisplay', e.target.value)} placeholder="e.g. 250.000 VND/đêm" style={inputStyle()} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: textMuted }}>Amenities</label>
              <button
                type="button"
                onClick={() => { set('amenities', []); setAmenitiesReplaced(true); }}
                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}
              >
                Clear all
              </button>
            </div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 5 }}>Lần chọn đầu tiên sẽ thay thế danh sách cũ. Chọn thêm để bổ sung.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AMENITIES.map(a => {
                const on = form.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      if (!amenitiesReplaced && !on) {
                        set('amenities', [a]);
                      } else {
                        set('amenities', on ? form.amenities.filter(x => x !== a) : [...form.amenities, a]);
                      }
                      setAmenitiesReplaced(true);
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: on ? '#2563EB' : (darkMode ? '#1E293B' : '#F1F5F9'),
                      color: on ? '#fff' : textMuted,
                      border: `1px solid ${on ? '#2563EB' : border}`,
                    }}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textMuted, display: 'block', marginBottom: 5 }}>Internal Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Maintenance notes…"
              style={{ ...inputStyle(), resize: 'vertical', minHeight: 72 } as React.CSSProperties} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '10px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: textMuted, fontFamily: "var(--font-sans)" }}>Cancel</button>
            <button onClick={handleSave} style={{ flex: 2, background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "var(--font-sans)" }}>
              {initial ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
