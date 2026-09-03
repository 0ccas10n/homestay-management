// ─── BookingFormModal.tsx ──────────────────────────────────────────────────────
//
// Full booking creation form, presented inside the shared <Modal>.
//
// The form builds checkInAt / expectedCheckOutAt as full ISO 8601 datetime
// strings (with the business timezone offset) from separate date + time
// inputs. This matches what the server expects via createBookingSchema and
// what the Google Sheets booking columns already store.
//
// Booking Type toggle (Daily / Hourly):
//   - Daily: server auto-calculates the totalAmount from RatePlanPrices when a
//     predefined rate plan is selected.
//   - Hourly: the receptionist enters the total price manually in VND; the
//     auto-fill from RatePlanPrices is bypassed and the supplied value is
//     passed through to POST /api/bookings verbatim along with
//     bookingType: 'hourly'.
//
// Rate Plan dropdown:
//   - When bookingType === 'hourly' a "Theo giờ" (Custom Hourly) sentinel
//     option is prepended so the user can either pick a real plan and override
//     the price, or pick the sentinel and enter a price for an unmapped plan.
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
import type { Booking, BookingSource, RatePlan } from '@/types/index';
import { ratePlans as fallbackRatePlans } from '@/data/sampleData';
import { formatVnd } from '@/utils/format';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const LOC_TZ_OFFSET = '+07:00';

/** Frontend sentinel for the "Theo giờ" / Custom Hourly dropdown option. */
// The old UI sentinel `__custom__` for the "Hourly (Custom Hourly)" dropdown
// option has been removed. Hourly mode is chosen via the top Loại toggle, and
// the rate plan dropdown always shows real plan ids so the sheet's
// `rate_plan_id` column reflects what was actually picked.

interface BookingFormModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  initialRoomId?: string;
  initialDate?: string;
  /** Called after a successful create so the parent can refresh its data. */
  onCreated?: (booking: Booking) => void;
  /** Optional toast callback for error feedback. */
  onError?: (message: string) => void;
}

type BookingType = 'daily' | 'hourly';

interface FormState {
  bookingType: BookingType;
  guestName: string;
  source: BookingSource | '';
  note: string;
  roomId: string;
  ratePlanId: string;
  numGuests: string; // kept as a string so the input can be blank
  totalAmount: string; // required when bookingType === 'hourly'
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
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
 * Lấy số phút chuẩn theo từng gói cước:
 * - RP-0001 (Combo 4H): 4 tiếng = 240 phút
 * - RP-0002 (Combo 6H): 6 tiếng = 360 phút
 * - RP-0003 (Overnight): 13 tiếng = 780 phút (từ 21:00 -> 10:00 hôm sau)
 * - RP-0004 (Full Day): 22 tiếng = 1320 phút (từ 14:00 -> 12:00 trưa hôm sau)
 */
function getPlanDurationMinutes(plan: RatePlan | undefined): number | null {
  if (!plan) return null;
  if (plan.ratePlanId === 'RP-0001') return 4 * 60;
  if (plan.ratePlanId === 'RP-0002') return 6 * 60;
  if (plan.ratePlanId === 'RP-0003' || plan.type === 'overnight') return 13 * 60;
  if (plan.ratePlanId === 'RP-0004' || plan.type === 'daily') return 22 * 60;
  return plan.baseMinutes || null;
}

/**
 * Produce the auto-filled check-in/out date+time strings for a rate plan.
 * - Overnight (RP-0003): 21:00 → 10:00 (checkout on next day, +13h)
 * - Full Day (RP-0004 / daily): 14:00 → 12:00 (checkout on next day, +22h)
 * - Or any plan with overnightStart & overnightEnd configured in CSDL.
 */
function autoFillTimesForPlan(
  plan: RatePlan | undefined,
  currentCheckInDate: string,
): { checkInDate: string; checkInTime: string; checkOutDate: string; checkOutTime: string } | null {
  if (!plan) return null;

  const isOvernight = plan.type === 'overnight' || plan.ratePlanId === 'RP-0003';
  const isDaily = plan.type === 'daily' || plan.ratePlanId === 'RP-0004';

  // Chỉ tự động điền giờ cố định cho Overnight và Full Day
  if (!isOvernight && !isDaily && (!plan.overnightStart || !plan.overnightEnd)) {
    return null;
  }

  let startTime = (plan.overnightStart && /^\d{1,2}:\d{2}$/.test(plan.overnightStart.trim()))
    ? plan.overnightStart.trim()
    : undefined;
  let endTime = (plan.overnightEnd && /^\d{1,2}:\d{2}$/.test(plan.overnightEnd.trim()))
    ? plan.overnightEnd.trim()
    : undefined;

  if (isOvernight) {
    startTime = startTime || '21:00';
    endTime = endTime || '10:00';
  } else if (isDaily) {
    startTime = startTime || '14:00';
    endTime = endTime || '12:00';
  }

  if (!startTime || !endTime) return null;

  if (startTime.length === 4 && startTime[1] === ':') startTime = '0' + startTime;
  if (endTime.length === 4 && endTime[1] === ':') endTime = '0' + endTime;

  return {
    checkInDate: currentCheckInDate,
    checkInTime: startTime,
    checkOutDate: resolveCheckOutDate(currentCheckInDate, startTime, endTime),
    checkOutTime: endTime,
  };
}


/** Validate inputs locally — mirrors createBookingSchema on the server. */
function validate(
  state: FormState,
  rooms: Awaited<ReturnType<typeof roomsApi.getInternal>>,
): string | null {
  if (!state.guestName.trim()) return 'Guest name is required';
  if (!state.roomId) return 'Please select a room';
  if (!state.ratePlanId) {
    return 'Please select a rate plan';
  }
  // The chosen plan id is recorded in the sheet's `rate_plan_id` column for
  // both daily and hourly bookings. The server controls pricing math via
  // `bookingType: 'hourly'` (manual totalAmount) vs default daily lookup.

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
    if (!Number.isInteger(n) || n < 1) return 'Số lượng khách phải là số nguyên dương';
    const selectedRoom = rooms.find(r => r.roomId === state.roomId);
    const rawCap = selectedRoom?.capacity ? Number(selectedRoom.capacity) : 4;
    const maxCapacity = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : 4;
    if (n > maxCapacity) {
      return `Phòng ${selectedRoom?.name || ''} chỉ chứa tối đa ${maxCapacity} khách (bạn đang chọn ${n} khách)`;
    }
  }


  if (state.bookingType === 'hourly') {
    const amount = Number(state.totalAmount);
    if (!state.totalAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      return 'Custom price is required for hourly bookings';
    }
  }

  return null;
}


/**
 /**
 * The form forwards the selected rate plan id verbatim — the server uses
 * `bookingType: 'hourly'` to decide between RatePlanPrices lookup and the
 * receptionist's manual `totalAmount`, but the chosen plan id is recorded
 * in the sheet either way.
 */

export default function BookingFormModal({
  open,
  onClose,
  darkMode,
  initialRoomId,
  initialDate,
  onCreated,
  onError,
}: BookingFormModalProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const initial = useMemo(() => {
    const checkIn = initialDate ? new Date(initialDate + 'T14:00:00') : new Date();
    const checkOut = new Date(checkIn.getTime() + 4 * 60 * 60 * 1000);
    return {
      bookingType: 'daily' as BookingType,
      guestName: '',
      source: '' as BookingSource | '',
      note: '',
      roomId: initialRoomId ?? '',
      ratePlanId: '',
      numGuests: '2',
      totalAmount: '',
      checkInDate: toDateInputValue(checkIn),
      checkInTime: toTimeInputValue(checkIn),
      checkOutDate: toDateInputValue(checkOut),
      checkOutTime: toTimeInputValue(checkOut),
    };
  }, [initialDate, initialRoomId]);

  const [state, setState] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Awaited<ReturnType<typeof roomsApi.getInternal>>>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);

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
      roomsApi.getInternal().catch((err) => {
        console.error('[BookingFormModal] Error fetching rooms:', err);
        return [];
      }),
      ratePlansApi.getAll().catch((err) => {
        console.error('[BookingFormModal] Error fetching rate plans:', err);
        return [];
      }),
    ]).then(([r, p]) => {
      if (cancelled) return;
      setRooms(r);
      const plans = (p && p.length > 0) ? p : fallbackRatePlans;
      setRatePlans(plans);

      const defaultRoomId = r[0]?.roomId || '';
      const activePlan = plans.find(plan => plan.active !== false && String(plan.active).toUpperCase() !== 'FALSE') || plans[0];
      const defaultPlanId = activePlan?.ratePlanId || '';

      setState(prev => {
        const next = {
          ...prev,
          roomId: prev.roomId || defaultRoomId,
          ratePlanId: prev.ratePlanId || defaultPlanId,
        };
        // Auto fill overnight times if default plan selected and times are untouched
        if (!prev.ratePlanId && activePlan) {
          const filled = autoFillTimesForPlan(activePlan, next.checkInDate);
          if (filled) Object.assign(next, filled);
        }
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [open]);

  // Recalculate totalAmount whenever any pricing input changes.
  // This covers room selection, rate plan changes, date/time edits, and guest count.
  useEffect(() => {
    if (!open || !state.roomId || !state.ratePlanId) return;
    void recalculateTotal(
      state.roomId,
      state.ratePlanId,
      state.bookingType,
      state.checkInDate,
      state.checkInTime,
      state.checkOutDate,
      state.checkOutTime,
      state.numGuests,
      setState,
    );
  }, [open, state.bookingType, state.roomId, state.ratePlanId, state.checkInDate, state.checkInTime,
      state.checkOutDate, state.checkOutTime, state.numGuests]);

  // Keep check-out date & time in sync with check-in and rate plan duration
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState(prev => {
      const next = { ...prev, [key]: value };
      const currentPlan = ratePlans.find(p => p.ratePlanId === prev.ratePlanId);

      // Tự động tính lại checkOutDate & checkOutTime khi thay đổi checkInTime hoặc checkInDate
      if (key === 'checkInTime' || key === 'checkInDate') {
        const inDate = key === 'checkInDate' ? (value as string) : prev.checkInDate;
        const inTime = key === 'checkInTime' ? (value as string) : prev.checkInTime;
        const durationMinutes = getPlanDurationMinutes(currentPlan);

        if (durationMinutes && inDate && inTime && /^\d{2}:\d{2}$/.test(inTime)) {
          const checkIn = new Date(`${inDate}T${inTime}:00`);
          if (!isNaN(checkIn.getTime())) {
            const checkOut = new Date(checkIn.getTime() + durationMinutes * 60 * 1000);
            next.checkOutDate = toDateInputValue(checkOut);
            next.checkOutTime = toTimeInputValue(checkOut);
          }
        }
      }

      if (key === 'checkOutDate' && (value as string) < prev.checkInDate) {
        next.checkInDate = value as string;
      }
      return next;
    });
  }



/** Extra guest surcharge per extra guest per billing period (VND). */
const EXTRA_GUEST_CHARGE_VND = 100_000;

/**
 * Recalculate `totalAmount` from the current form state and update it via setState.
 *
 * Runs whenever roomId, ratePlanId, checkInDate/checkOutDate/checkOutTime,
 * checkInTime, or numGuests changes (driven by a useEffect in the component body).
 *
 * - Skips for custom/hourly sentinel plan IDs (no pre-configured price).
 * - Looks up `priceVnd` from RatePlanPrices for the selected (room, rate plan).
 * - Daily bookings: `priceVnd × stay nights` + optional extra-guest surcharge.
 * - Hourly bookings: `priceVnd × stay hours` + optional extra-guest surcharge.
 * - If no price row exists, clears totalAmount (receptionist enters it manually).
 */
async function recalculateTotal(
  roomId: string,
  ratePlanId: string,
  bookingType: BookingType,
  checkInDate: string,
  checkInTime: string,
  checkOutDate: string,
  checkOutTime: string,
  numGuests: string,
  setState: React.Dispatch<React.SetStateAction<FormState>>,
) {
  // Skip auto-calculation for hourly bookings (price entered manually)
  // or when no plan/room has been chosen yet.
  if (
    bookingType === 'hourly' ||
    !roomId ||
    !ratePlanId
  ) return;

  try {
    const price = await ratePlanPricesApi.find(ratePlanId, roomId);

    console.log('[DEBUG recalculate] ratePlanId:', ratePlanId, 'roomId:', roomId, 'bookingType:', bookingType, '→ priceVnd:', price?.priceVnd);

    if (!price || price.priceVnd <= 0) {
      setState(prev => ({ ...prev, totalAmount: '' }));
      return;
    }

    const checkIn = combineToIso(checkInDate, checkInTime);
    const checkOut = combineToIso(checkOutDate, checkOutTime);

    // Sync với server calculateBasePricing: Math.ceil(minutes / 1440), min 1.
    // Math.ceil ensures a 25h stay previews as 2 nights — matching the server.
    const durationMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const durationMinutes = durationMs / 60_000;
    const nights = Math.max(1, Math.ceil(durationMinutes / 1440));

    // bookingType đã được guard ở trên (hourly → return sớm)
    // Ở đây luôn là daily
    const duration = nights;
    let total = price.priceVnd * duration;

    // Extra guest surcharge: each guest beyond 2 adds EXTRA_GUEST_CHARGE_VND
    // per night (mirrors bookings.repository.ts dòng 424-426).
    if (Number(numGuests) > 2) {
      total += (Number(numGuests) - 2) * EXTRA_GUEST_CHARGE_VND * duration;
    }

    setState(prev => ({ ...prev, totalAmount: String(total) }));
  } catch {
    // Network/server errors: leave totalAmount unchanged so the receptionist
    // can still enter it manually.
  }
}

  /**
   * Handle booking-type changes (Daily ↔ Hourly).
   */
  function handleBookingTypeChange(newType: BookingType) {
    setState(prev => {
      if (newType === 'hourly') {
        const hourlyPlan = ratePlans.find(p => p.type === 'hourly') || ratePlans[0];
        const next = {
          ...prev,
          bookingType: 'hourly' as BookingType,
          totalAmount: '',
          ratePlanId: hourlyPlan?.ratePlanId || prev.ratePlanId,
        };
        const durationMinutes = getPlanDurationMinutes(hourlyPlan);
        if (durationMinutes && prev.checkInDate && prev.checkInTime) {
          const checkIn = new Date(`${prev.checkInDate}T${prev.checkInTime}:00`);
          if (!isNaN(checkIn.getTime())) {
            const checkOut = new Date(checkIn.getTime() + durationMinutes * 60 * 1000);
            next.checkOutDate = toDateInputValue(checkOut);
            next.checkOutTime = toTimeInputValue(checkOut);
          }
        }
        return next;
      }
      // Daily: switch to Full Day plan if not already daily/overnight
      const dailyPlan = ratePlans.find(p => p.type === 'daily' || p.ratePlanId === 'RP-0004') || ratePlans.find(p => p.ratePlanId === prev.ratePlanId);
      const next = {
        ...prev,
        bookingType: 'daily' as BookingType,
        ratePlanId: dailyPlan?.ratePlanId || prev.ratePlanId,
      };
      if (dailyPlan) {
        const filled = autoFillTimesForPlan(dailyPlan, prev.checkInDate);
        if (filled) Object.assign(next, filled);
      }
      return next;
    });
  }

  /**
   * Handle rate-plan selection.
   * - Tự động điền ngày giờ Check-in / Check-out theo thời lượng chuẩn của gói cước.
   * - Sau đó tự động tính toán lại totalAmount.
   */
  function handleRatePlanChange(newPlanId: string) {
    setState(prev => {
      const next = { ...prev, ratePlanId: newPlanId };
      const plan = ratePlans.find(p => p.ratePlanId === newPlanId);
      const filled = autoFillTimesForPlan(plan, prev.checkInDate);
      if (filled) {
        return { ...next, ...filled };
      } else if (plan) {
        const durationMinutes = getPlanDurationMinutes(plan);
        if (durationMinutes) {
          const inTime = prev.checkInTime || toTimeInputValue(new Date());
          const checkIn = new Date(`${prev.checkInDate}T${inTime}:00`);
          if (!isNaN(checkIn.getTime())) {
            const checkOut = new Date(checkIn.getTime() + durationMinutes * 60 * 1000);
            return {
              ...next,
              checkInTime: inTime,
              checkOutDate: toDateInputValue(checkOut),
              checkOutTime: toTimeInputValue(checkOut),
            };
          }
        }
      }
      return next;
    });
    // recalculateTotal fires via the useEffect whenever state.ratePlanId changes.
  }


  /**
   * React to room changes too: switching rooms for the same plan may resolve
   * to a different price in the RatePlanPrices sheet.
   */
  function handleRoomChange(newRoomId: string) {
    setState(prev => ({ ...prev, roomId: newRoomId }));
    // recalculateTotal fires via the useEffect whenever state.roomId changes.
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validationError = validate(state, rooms);
    if (validationError) {
      setError(validationError);
      return;
    }


    setSubmitting(true);
    try {
      const created = await bookingsApi.create({
        roomId: state.roomId,
        guestName: state.guestName.trim(),
        checkInAt: combineToIso(state.checkInDate, state.checkInTime),
        expectedCheckOutAt: combineToIso(state.checkOutDate, state.checkOutTime),
        ratePlanId: state.ratePlanId,
        bookingType: state.bookingType,
        // ❗ Chỉ gửi totalAmount khi hourly (nhập tay).
        // Với daily, để undefined → server tự tính từ RatePlanPrices sheet.
        ...(state.bookingType === 'hourly'
          ? { totalAmount: Number(state.totalAmount) }
          : {}),
        numGuests: state.numGuests ? Number(state.numGuests) : undefined,
        note: state.note.trim() || undefined,
        customer: {
          name:   state.guestName.trim(),
          source: state.source || undefined,
        },
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      let message: string;
      if (err instanceof ApiError) {
        if (err.code === 'BOOKING_CONFLICT') {
          message = 'Phòng đã được đặt trong khoảng thời gian này.';
        } else if (err.code === 'VALIDATION_ERROR') {
          message = err.message;
        } else {
          message = err.message;
        }
      } else {
        message = 'Tạo booking thất bại. Vui lòng thử lại.';
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
    fontSize: 13, fontFamily: "var(--font-sans)", outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600,
    color: darkMode ? '#94A3B8' : '#64748B',
    display: 'block', marginBottom: 4,
  };

  const activeRatePlans = useMemo(() => {
    const active = ratePlans.filter(p => p.active !== false && String(p.active).toUpperCase() !== 'FALSE');
    return active.length > 0 ? active : ratePlans;
  }, [ratePlans]);

  const optionBg = darkMode ? '#0F172A' : '#FFFFFF';
  const optionColor = darkMode ? '#E2E8F0' : '#1E293B';
  const gridColumns = isMobile ? '1fr' : '1fr 1fr';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Booking"
      width={560}
      darkMode={darkMode}
      footer={
        <>
          <button
            type="button" onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
              borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', color: darkMode ? '#94A3B8' : '#64748B',
              fontFamily: "var(--font-sans)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit" form="booking-form" disabled={submitting}
            style={{
              background: submitting ? '#93C5FD' : '#2563EB',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontWeight: 600, fontSize: 14,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: "var(--font-sans)",
            }}
          >
            {submitting ? 'Creating…' : 'Create Booking'}
          </button>
        </>
      }
    >
      <form id="booking-form" noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 12 }}>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Guest Name - ID *</label>
            <input
              required value={state.guestName}
              onChange={e => update('guestName', e.target.value)}
              placeholder="e.g. John Smith" style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <select
              value={state.source}
              onChange={e => update('source', e.target.value as BookingSource | '')}
              style={inputStyle}
            >
              <option value="">— Select source —</option>
              <option value="INSTAGRAM">INSTAGRAM</option>
              <option value="TIKTOK">TIKTOK</option>
              <option value="ZALO">ZALO</option>
              <option value="FACEBOOK">FACEBOOK</option>
              <option value="KHAC">KHÁC</option>
            </select>
          </div>
        </div>

        {/* Booking Type toggle — Daily / Hourly */}
        <div>
          <label style={labelStyle}>Booking Type *</label>
          <div style={{
            display: 'inline-flex', gap: 4, padding: 3, borderRadius: 10,
            background: darkMode ? '#0F172A' : '#F1F5F9',
            border: `1px solid ${darkMode ? '#334155' : '#E2E8F0'}`,
          }}>
            {(['daily', 'hourly'] as const).map(t => {
              const selected = state.bookingType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleBookingTypeChange(t)}
                  style={{
                    padding: '7px 18px', borderRadius: 7,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "var(--font-sans)",
                    border: 'none',
                    background: selected ? '#2563EB' : 'transparent',
                    color: selected ? '#fff' : (darkMode ? '#94A3B8' : '#64748B'),
                    transition: 'all 0.15s',
                    boxShadow: selected ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
                  }}
                >
                  {t === 'daily' ? 'Combo cố định' : 'Combo Linh Hoạt'}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 12 }}>
          <div>
            <label style={labelStyle}>Room *</label>
            <select
              required value={state.roomId}
              onChange={e => handleRoomChange(e.target.value)}
              style={inputStyle}
            >
              <option value="" disabled style={{ background: optionBg, color: optionColor }}>Chọn phòng</option>
              {rooms.map(r => (
                <option key={r.roomId} value={r.roomId} style={{ background: optionBg, color: optionColor }}>
                  {`${r.name} `}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Rate Plan *
              <span style={{ color: darkMode ? '#475569' : '#94A3B8', fontWeight: 400, marginLeft: 6 }}>
              </span>
            </label>
            <select
              required
              value={state.ratePlanId}
              onChange={e => handleRatePlanChange(e.target.value)}
              style={inputStyle}
            >
              <option value="" disabled style={{ background: optionBg, color: optionColor }}>Khung giờ</option>
              {activeRatePlans.map(p => (
                <option key={p.ratePlanId} value={p.ratePlanId} style={{ background: optionBg, color: optionColor }}>
                  {p.name}
                  {p.overnightStart && p.overnightEnd
                    ? ` (${p.overnightStart}–${p.overnightEnd})`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Price field — labelled as auto-fill for Daily, manual for Hourly. */}
        {state.bookingType === 'hourly' && (
          <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Giá (VND) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  required
                  type="number"
                  min={1}
                  step="any"
                  value={state.totalAmount}
                  onChange={e => update('totalAmount', e.target.value)}
                  placeholder="VD: 250000"
                  style={inputStyle}
                />
                {state.totalAmount && Number(state.totalAmount) > 0 && (
                  <div style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, fontWeight: 700, color: '#10B981',
                    background: darkMode ? '#0F172A' : '#F8FAFC',
                    padding: '2px 10px', borderRadius: 6,
                    pointerEvents: 'none',
                  }}>
                    {formatVnd(Number(state.totalAmount))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: darkMode ? '#64748B' : '#94A3B8', marginTop: 4 }}>
                Nhập giá thủ công (tùy chỉnh).
              </div>
            </div>
          </div>
        )}
        {state.bookingType === 'daily' && (
          <div>
            <label style={labelStyle}>Giá ước tính (VND) — tham khảo, server tự tính chính xác</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min={0}
                step="any"
                value={state.totalAmount}
                onChange={e => update('totalAmount', e.target.value)}
                placeholder="Đang tính..."
                style={{ ...inputStyle, color: darkMode ? '#94A3B8' : '#64748B' }}
                readOnly
              />
              {state.totalAmount && Number(state.totalAmount) > 0 && (
                <div style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 12, fontWeight: 700, color: '#10B981',
                  background: darkMode ? '#0F172A' : '#F8FAFC',
                  padding: '2px 10px', borderRadius: 6,
                  pointerEvents: 'none',
                }}>
                  {formatVnd(Number(state.totalAmount))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: darkMode ? '#64748B' : '#94A3B8', marginTop: 4 }}>
              Tự động tra từ bảng giá (theo khung giờ cố định).
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 12 }}>
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

        {(() => {
          const selectedRoom = rooms.find(r => r.roomId === state.roomId);
          const rawCap = selectedRoom?.capacity ? Number(selectedRoom.capacity) : 4;
          const maxCapacity = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : 4;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 12 }}>
              <div>
                <label style={labelStyle}>
                  Số lượng khách {selectedRoom ? `(Tối đa ${maxCapacity} khách)` : ''}
                </label>
                <input
                  type="number"
                  min={1}
                  value={state.numGuests}
                  onChange={e => update('numGuests', e.target.value)}
                  style={inputStyle}
                  placeholder="VD: 2"
                />
              </div>
            </div>
          );
        })()}



        <div>
          <label style={labelStyle}>Note</label>
          <textarea
            value={state.note}
            onChange={e => update('note', e.target.value)}
            placeholder="optional" rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: "var(--font-sans)" }}
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

      </form>
    </Modal>
  );
}
