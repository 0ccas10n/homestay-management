// ─── BookingFormModal.tsx ──────────────────────────────────────────────────────
//
// Full booking creation form, presented inside the shared <Modal>.
//
// The form builds checkInAt / expectedCheckOutAt as full ISO 8601 datetime
// strings (with the business timezone offset) from separate date + time
// inputs. This matches what the server expects via createBookingSchema and
// what the Google Sheets booking columns already store.
//
// Rate Plan dropdown:
//   - A "Theo giờ" (Custom Hourly) sentinel option is prepended so the user
//     can opt out of any predefined plan and enter the price manually. When
//     this option is selected, a required Total Amount input is shown. The
//     value is sent to the server as the booking's totalAmount verbatim —
//     no rate-plan lookup or auto-pricing is performed server-side.
//   - When the user picks a real plan that has overnightStart + overnightEnd
//     defined (e.g. "Overnight" with 21:00 → 10:00), the check-in/out times
//     auto-fill from those values. If the overnight window wraps midnight
//     (start >= end numerically), the check-out date rolls forward by one day.
//   - The user is free to edit the date/time pickers afterwards — auto-fill
//     only fires on the rate-plan change event.
//
// The pricing/duration math lives on the server (bookings.repository.create).
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { bookingsApi, roomsApi, ratePlansApi, ratePlanPricesApi } from '@/services/api';
import { ApiError } from '@/services/api';
import type { Booking, RatePlan } from '@/types/index';

const LOC_TZ_OFFSET = '+07:00';

/** Frontend sentinel for the "Theo giờ" / Custom Hourly dropdown option. */
const CUSTOM_HOURLY_ID = '__custom__';
/** Wire value sent to the API when the receptionist enters a custom price. */
const CUSTOM_HOURLY_WIRE_ID = 'custom';

interface BookingFormModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  /** Called after a successful create so the parent can refresh its data. */
  onCreated?: (booking: Booking) => void;
  /** Optional toast callback for error feedback. */
  onError?: (message: string) => void;
}

interface FormState {
  guestName: string;
  phone: string;
  email: string;
  note: string;
  roomId: string;
  ratePlanId: string;
  source: 'phone' | 'walk_in' | 'online' | 'partner' | 'other';
  numGuests: string; // kept as a string so the input can be blank
  totalAmount: string; // only used when ratePlanId === CUSTOM_HOURLY_ID
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
}

// Round a Date up to the next whole hour (so default check-in isn't 12:37).
function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/** Pad to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD in local time. */
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Format a Date as HH:MM in local time. */
function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Combine a "YYYY-MM-DD" date and "HH:MM" time into an ISO 8601 string with the business offset. */
function combineToIso(date: string, time: string): string {
  return `${date}T${time}:00${LOC_TZ_OFFSET}`;
}

/**
 * Given a date string (YYYY-MM-DD) and an HH:MM time, return a new YYYY-MM-DD.
 * If endTime <= startTime numerically, roll forward by one day (overnight window).
 */
function resolveCheckOutDate(
  checkInDate: string,
  startTime: string,
  endTime: string,
): string {
  const wrapsMidnight = endTime <= startTime;
  if (!wrapsMidnight) return checkInDate;
  const d = new Date(`${checkInDate}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
}

/**
 * Produce the auto-filled check-in/out date+time strings for a rate plan.
 * Returns null when the plan has no overnight window — in that case the user
 * keeps whatever values the form already had.
 */
function autoFillTimesForPlan(
  plan: RatePlan | undefined,
  currentCheckInDate: string,
): { checkInDate: string; checkInTime: string; checkOutDate: string; checkOutTime: string } | null {
  if (!plan || !plan.overnightStart || !plan.overnightEnd) return null;
  return {
    checkInDate: currentCheckInDate,
    checkInTime: plan.overnightStart,
    checkOutDate: resolveCheckOutDate(currentCheckInDate, plan.overnightStart, plan.overnightEnd),
    checkOutTime: plan.overnightEnd,
  };
}

/** Reset the date/time fields to "now" (for the Custom Hourly option). */
function freshNowTimes(): { checkInDate: string; checkInTime: string; checkOutDate: string; checkOutTime: string } {
  const now = new Date();
  const checkOut = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    checkInDate: toDateInputValue(now),
    checkInTime: toTimeInputValue(now),
    checkOutDate: toDateInputValue(checkOut),
    checkOutTime: toTimeInputValue(checkOut),
  };
}

/** Validate inputs locally — mirrors createBookingSchema on the server. */
function validate(state: FormState): string | null {
  if (!state.guestName.trim()) return 'Guest name is required';
  if (!state.roomId) return 'Please select a room';
  if (!state.ratePlanId) return 'Please select a rate plan';

  const isCustom = state.ratePlanId === CUSTOM_HOURLY_ID;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.checkInDate)) return 'Invalid check-in date';
  if (!/^\d{2}:\d{2}$/.test(state.checkInTime)) return 'Invalid check-in time';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.checkOutDate)) return 'Invalid check-out date';
  if (!/^\d{2}:\d{2}$/.test(state.checkOutTime)) return 'Invalid check-out time';

  const checkIn = combineToIso(state.checkInDate, state.checkInTime);
  const checkOut = combineToIso(state.checkOutDate, state.checkOutTime);
  if (new Date(checkIn) >= new Date(checkOut)) {
    return 'Check-out must be after check-in';
  }

  if (state.numGuests) {
    const n = Number(state.numGuests);
    if (!Number.isInteger(n) || n < 1) return 'Guests must be a positive whole number';
  }

  if (isCustom) {
    const amount = Number(state.totalAmount);
    if (!state.totalAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      return 'Total amount is required for custom hourly bookings';
    }
  }

  return null;
}

/** Translate the form's frontend sentinel into the wire value the server expects. */
function toWireRatePlanId(formPlanId: string): string {
  return formPlanId === CUSTOM_HOURLY_ID ? CUSTOM_HOURLY_WIRE_ID : formPlanId;
}

export default function BookingFormModal({
  open,
  onClose,
  darkMode,
  onCreated,
  onError,
}: BookingFormModalProps) {
  const initial = useMemo(() => {
    const checkIn = nextHour();
    const checkOut = new Date(checkIn.getTime() + 4 * 60 * 60 * 1000);
    return {
      guestName: '',
      phone: '',
      email: '',
      note: '',
      roomId: '',
      ratePlanId: CUSTOM_HOURLY_ID,
      source: 'phone' as FormState['source'],
      numGuests: '1',
      totalAmount: '',
      checkInDate: toDateInputValue(checkIn),
      checkInTime: toTimeInputValue(checkIn),
      checkOutDate: toDateInputValue(checkOut),
      checkOutTime: toTimeInputValue(checkOut),
    };
  }, []);

  const [state, setState] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof roomsApi.getInternal>>>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);

  const isCustom = state.ratePlanId === CUSTOM_HOURLY_ID;

  // Reset the form every time the modal opens.
  useEffect(() => {
    if (open) {
      setState(initial);
      setError(null);
      setSubmitting(false);
    }
  }, [open, initial]);

  // Lazily fetch rooms + rate plans when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      roomsApi.getInternal().catch(() => []),
      ratePlansApi.getAll().catch(() => []),
    ]).then(([r, p]) => {
      if (cancelled) return;
      setRooms(r);
      setRatePlans(p);
      setState(prev => ({
        ...prev,
        roomId: prev.roomId || r[0]?.roomId || '',
        // Keep the default CUSTOM_HOURLY_ID unless the user already chose something.
        ratePlanId:
          prev.ratePlanId && prev.ratePlanId !== ''
            ? prev.ratePlanId
            : CUSTOM_HOURLY_ID,
      }));
    });
    return () => { cancelled = true; };
  }, [open]);

  // Keep check-out date in sync with check-in date when the user only edits time,
  // so a half-finished form never has check-out < check-in by accident.
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'checkInDate' && prev.checkOutDate < value) next.checkOutDate = value;
      if (key === 'checkOutDate' && value < prev.checkInDate) next.checkInDate = value;
      return next;
    });
  }

  /**
   * Auto-fill `totalAmount` from the RatePlanPrices sheet when:
   *   - the user picked a real (predefined) rate plan, AND
   *   - a room is selected.
   * Custom hourly bookings always leave the field empty — the receptionist
   * types the price by hand.
   */
  async function autoFillTotalFromPriceTable(
    roomId: string,
    wirePlanId: string,
  ) {
    if (wirePlanId === CUSTOM_HOURLY_WIRE_ID || !roomId || !wirePlanId) return;
    try {
      const price = await ratePlanPricesApi.find(wirePlanId, roomId);
      if (price && price.priceVnd > 0) {
        setState(prev => ({ ...prev, totalAmount: String(price.priceVnd) }));
      } else {
        // No configured price for this pair — leave the field empty so the
        // receptionist knows they need to enter it manually.
        setState(prev => ({ ...prev, totalAmount: '' }));
      }
    } catch {
      // Network/server failure shouldn't block the form; the user can type a
      // price manually. We silently swallow — same behaviour as before.
    }
  }

  /**
   * Handle rate-plan selection. Three branches:
   *   - "Theo giờ" → reset date/time to current wall-clock.
   *   - A plan with overnightStart + overnightEnd → auto-fill those values.
   *   - A plan without an overnight window → leave the times alone (user can edit).
   *
   * After the plan switch, also tries to auto-fill totalAmount from the
   * RatePlanPrices sheet (no-op for the custom hourly plan).
   */
  function handleRatePlanChange(newPlanId: string) {
    setState(prev => {
      const next = { ...prev, ratePlanId: newPlanId };
      if (newPlanId === CUSTOM_HOURLY_ID) {
        return { ...next, ...freshNowTimes() };
      }
      // Switching away from custom clears the manual total so it doesn't leak.
      const cleared = prev.ratePlanId === CUSTOM_HOURLY_ID
        ? { ...next, totalAmount: '' }
        : next;
      const plan = ratePlans.find(p => p.ratePlanId === newPlanId);
      const filled = autoFillTimesForPlan(plan, prev.checkInDate);
      return filled ? { ...cleared, ...filled } : cleared;
    });

    // Fire the price lookup using the latest roomId + the just-selected plan.
    const wireId = toWireRatePlanId(newPlanId);
    setState(prev => {
      void autoFillTotalFromPriceTable(prev.roomId, wireId);
      return prev;
    });
  }

  /**
   * React to room changes too: switching rooms for the same plan may resolve
   * to a different price in the RatePlanPrices sheet.
   */
  function handleRoomChange(newRoomId: string) {
    setState(prev => ({ ...prev, roomId: newRoomId }));
    const wireId = toWireRatePlanId(state.ratePlanId);
    void autoFillTotalFromPriceTable(newRoomId, wireId);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validationError = validate(state);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const created = await bookingsApi.create({
        roomId: state.roomId,
        checkInAt: combineToIso(state.checkInDate, state.checkInTime),
        expectedCheckOutAt: combineToIso(state.checkOutDate, state.checkOutTime),
        source: state.source,
        ratePlanId: toWireRatePlanId(state.ratePlanId),
        totalAmount: isCustom ? Number(state.totalAmount) : undefined,
        numGuests: state.numGuests ? Number(state.numGuests) : undefined,
        note: state.note.trim() || undefined,
        customer: {
          name: state.guestName.trim(),
          phone: state.phone.trim() || undefined,
          email: state.email.trim() || undefined,
          note: undefined,
        },
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      let message: string;
      if (err instanceof ApiError) {
        // Surface the most actionable server-side errors verbatim.
        if (err.code === 'BOOKING_CONFLICT') {
          message = 'This room is already booked for the selected time window.';
        } else if (err.code === 'VALIDATION_ERROR') {
          message = err.message;
        } else {
          message = err.message;
        }
      } else {
        message = 'Failed to create booking. Please try again.';
      }
      setError(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
    background: darkMode ? '#0F172A' : '#F8FAFC',
    color: darkMode ? '#E2E8F0' : '#1E293B',
    fontSize: 13, fontFamily: "'Outfit', sans-serif", outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600,
    color: darkMode ? '#94A3B8' : '#64748B',
    display: 'block', marginBottom: 4,
  };

  const activeRatePlans = ratePlans.filter(p => p.active);

  return (
    <Modal open={open} onClose={onClose} title="Add New Booking" width={560} darkMode={darkMode}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Guest Name *</label>
            <input
              required value={state.guestName}
              onChange={e => update('guestName', e.target.value)}
              placeholder="e.g. John Smith" style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel" value={state.phone}
              onChange={e => update('phone', e.target.value)}
              placeholder="+84 ..." style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={state.email}
              onChange={e => update('email', e.target.value)}
              placeholder="optional" style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Room *</label>
            <select
              required value={state.roomId}
              onChange={e => handleRoomChange(e.target.value)}
              style={inputStyle}
            >
              <option value="" disabled>Select a room</option>
              {rooms.map(r => (
                <option key={r.roomId} value={r.roomId}>
                  {r.name} · {r.capacity} guests
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Rate Plan *</label>
            <select
              required value={state.ratePlanId}
              onChange={e => handleRatePlanChange(e.target.value)}
              style={inputStyle}
            >
              <option value={CUSTOM_HOURLY_ID}>Theo giờ (Custom Hourly)</option>
              {activeRatePlans.length > 0 && (
                <optgroup label="Predefined plans">
                  {activeRatePlans.map(p => (
                    <option key={p.ratePlanId} value={p.ratePlanId}>
                      {p.name}
                      {p.overnightStart && p.overnightEnd
                        ? ` (${p.overnightStart}–${p.overnightEnd})`
                        : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {isCustom && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Total Amount (VND) *</label>
              <input
                required
                type="number"
                min={1}
                step={1000}
                value={state.totalAmount}
                onChange={e => update('totalAmount', e.target.value)}
                placeholder="e.g. 250000"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: darkMode ? '#64748B' : '#94A3B8', marginTop: 4 }}>
                Custom hourly price in VND. The server stores this value as the booking total and skips rate-plan pricing.
              </div>
            </div>
          </div>
        )}
        {!isCustom && state.totalAmount && (
          <div style={{
            fontSize: 11, color: darkMode ? '#94A3B8' : '#64748B',
            background: darkMode ? '#0F172A' : '#F8FAFC',
            padding: '6px 10px', borderRadius: 6,
            border: `1px dashed ${darkMode ? '#334155' : '#E2E8F0'}`,
          }}>
            Price auto-filled from RatePlanPrices — adjust manually if needed.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Check-in Date *</label>
            <input
              required type="date" value={state.checkInDate}
              onChange={e => update('checkInDate', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Check-in Time *</label>
            <input
              required type="time" value={state.checkInTime}
              onChange={e => update('checkInTime', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Check-out Date *</label>
            <input
              required type="date" value={state.checkOutDate}
              onChange={e => update('checkOutDate', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Check-out Time *</label>
            <input
              required type="time" value={state.checkOutTime}
              onChange={e => update('checkOutTime', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Source</label>
            <select
              value={state.source}
              onChange={e => update('source', e.target.value as FormState['source'])}
              style={inputStyle}
            >
              <option value="phone">Phone</option>
              <option value="walk_in">Walk-in</option>
              <option value="online">Online</option>
              <option value="partner">Partner</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Guests</label>
            <input
              type="number" min={1} max={20} value={state.numGuests}
              onChange={e => update('numGuests', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Note</label>
          <textarea
            value={state.note}
            onChange={e => update('note', e.target.value)}
            placeholder="optional" rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: "'Outfit', sans-serif" }}
          />
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: darkMode ? '#7F1D1D40' : '#FEF2F2',
            color: darkMode ? '#FCA5A5' : '#991B1B',
            border: `1px solid ${darkMode ? '#7F1D1D' : '#FECACA'}`,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button" onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
              borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', color: darkMode ? '#94A3B8' : '#64748B',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting}
            style={{
              background: submitting ? '#93C5FD' : '#2563EB',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontWeight: 600, fontSize: 14,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {submitting ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
