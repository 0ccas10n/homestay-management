// ─── Typed API client ────────────────────────────────────────────────────────────────
//
// Thin fetch wrapper that:
//   - Sends credentials (HTTP-only session cookie) automatically
//   - Validates the standard envelope { success, data } | { success: false, error }
//   - Returns typed data on success, throws ApiError on failure
//
// This module is CLIENT-SIDE ONLY — never import server-only code here.
//
// Usage:
//   const rooms = await api.get<Room[]>('/api/rooms');
//   const booking = await api.post<Booking>('/api/bookings', { ... });
//   const result = await api.patch('/api/bookings/BOOK-0001', { status: 'cancelled' });
// ──────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Standard error shape returned by every failed API call. */
export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; timestamp?: string };
}

interface EnvelopeSuccess<T> {
  success: true;
  data: T;
}

type Envelope<T> = EnvelopeSuccess<T> | ApiErrorBody;

const BASE_URL = (
  typeof window !== 'undefined'
    ? `${window.location.origin}`
    : ''
);

/** Build the full URL — supports relative paths (auto-prefixed with BASE_URL). */
function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = resolveUrl(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = localStorage.getItem('homestay_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // localStorage not accessible
  }

  const init: RequestInit = {
    method,
    credentials: 'include', // send + receive HTTP-only cookies
    headers,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', `Network request to ${path} failed`, 0);
  }

  let parsed: Envelope<T>;
  try {
    parsed = await response.json() as Envelope<T>;
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Server returned invalid JSON for ${method} ${path}`,
      response.status,
    );
  }

  if (!response.ok || parsed.success === false) {
    const err = parsed as ApiErrorBody;
    throw new ApiError(
      err.error?.code ?? 'UNKNOWN_ERROR',
      err.error?.message ?? `Request to ${path} failed with HTTP ${response.status}`,
      response.status,
    );
  }

  return (parsed as EnvelopeSuccess<T>).data;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body);
  },

  async delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};

// ─── Convenience: typed resource fetchers ──────────────────────────────────────
// These are thin wrappers around api.get/post/patch/delete for ergonomics.

export const locationsApi = {
  getAll: () => api.get<import('@/types/index').Location[]>('/api/locations'),
};

export const roomsApi = {
  getPublic: (locationId?: string) =>
    api.get<import('@/types/index').Room[]>(
      `/api/rooms${locationId ? `?locationId=${locationId}` : ''}`,
    ),
  getInternal: (locationId?: string) =>
    api.get<import('@/types/index').Room[]>(
      `/api/rooms${locationId ? `?locationId=${locationId}` : ''}`,
    ),
  create: (data: Omit<import('@/types/index').Room, 'roomId' | 'createdAt' | 'updatedAt'>) =>
    api.post<import('@/types/index').Room>('/api/rooms', data),
  update: (id: string, data: Partial<import('@/types/index').Room>) =>
    api.patch<import('@/types/index').Room>(`/api/rooms/${id}`, data),
  delete: (id: string) =>
    api.delete<void>(`/api/rooms/${id}`),
};

export const bookingsApi = {
  get: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<import('@/types/index').Booking[]>(`/api/bookings${qs}`);
  },
  getOne: (id: string) =>
    api.get<{ booking: import('@/types/index').Booking; customer: { customerId: string; name: string } | null }>(
      `/api/bookings/${id}`,
    ),
  create: (data: Parameters<typeof api.post>[1]) =>
    api.post<import('@/types/index').Booking>('/api/bookings', data),
  update: (id: string, data: Parameters<typeof api.patch>[1]) =>
    api.patch<import('@/types/index').Booking>(`/api/bookings/${id}`, data),
  /**
   * Check-out — sends `actualCheckOutAt`, which routes the PATCH handler through
   * the checkout path (computes overtime) instead of the general update path.
   * Response shape differs from `update()`, hence the separate method.
   */
  checkout: (id: string, actualCheckOutAt: string) =>
    api.patch<{ booking: import('@/types/index').Booking; overtimeMinutes: number; overtimeAmount: number; message: string }>(
      `/api/bookings/${id}`,
      { actualCheckOutAt },
    ),
  /** Lifecycle-only update — used for cancel, check-in, confirm, etc. */
  updateStatus: (id: string, status: import('@/types/index').BookingStatus) =>
    api.patch<{ booking: import('@/types/index').Booking; changed: boolean; message: string }>(
      `/api/bookings/${id}/status`,
      { status },
    ),
  /**
   * @deprecated Prefer `updateStatus(id, 'cancelled')` — it goes through the
   * dedicated lifecycle endpoint which also frees the room and cancels any
   * linked cleaning task. Kept for backward compatibility.
   */
  cancel: (id: string) =>
    api.delete<void>(`/api/bookings/${id}`),
};

export const availabilityApi = {
  check: (roomId: string, checkIn: string, checkOut: string) =>
    api.get<{ roomId: string; checkIn: string; checkOut: string; available: boolean }>(
      `/api/availability?roomId=${encodeURIComponent(roomId)}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`,
    ),
};

export const cleaningApi = {
  get: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<import('@/types/index').CleaningTask[]>(`/api/cleaning${qs}`);
  },
  create: (data: Parameters<typeof api.post>[1]) =>
    api.post<import('@/types/index').CleaningTask>('/api/cleaning', data),
  transition: (id: string, data: { status: import('@/types/index').CleaningStatus }) =>
    api.patch<import('@/types/index').CleaningTask>(`/api/cleaning/${id}`, data),
};

export const ratePlansApi = {
  getAll: () => api.get<import('@/types/index').RatePlan[]>('/api/rate-plans'),
};

export const ratePlanPricesApi = {
  getAll: () =>
    api.get<import('@/types/index').RatePlanPrice[]>('/api/rate-plan-prices'),
  /**
   * Find the configured VND price for a single (ratePlanId, roomId) pair.
   * Returns null when no active row exists — the form should then fall back
   * to manual entry.
   */
  find: (ratePlanId: string, roomId: string) =>
    api.get<import('@/types/index').RatePlanPrice | null>(
      `/api/rate-plan-prices?ratePlanId=${encodeURIComponent(ratePlanId)}&roomId=${encodeURIComponent(roomId)}`,
    ),
};

export const expensesApi = {
  get: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<import('@/types/index').Expense[]>(`/api/expenses${qs}`);
  },
  create: (data: Parameters<typeof api.post>[1]) =>
    api.post<import('@/types/index').Expense>('/api/expenses', data),
};

export const dashboardApi = {
  get: () =>
    api.get<{
      todayCheckIns: number;
      todayCheckOuts: number;
      availableRooms: number;
      occupiedRooms: number;
      roomsToClean: number;
      upcomingBookings: { bookingId: string; roomId: string; checkInAt: string; expectedCheckOutAt: string; status: string }[];
      monthlyRevenue: { month: string; revenue: number; expenses: number }[];
      weeklyOccupancy: { day: string; rate: number }[];
      monthlyRevenueTotal: number;
    }>('/api/dashboard'),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: import('@/types/index').User }>('/api/auth/login', { email, password }),
  logout: () => api.post<void>('/api/auth/logout', {}),
  me: () => api.get<import('@/types/index').User>('/api/auth/me'),
};

export const customersApi = {
  getAll: () => api.get<import('@/types/index').Customer[]>('/api/customers'),
};

export const notificationsApi = {
  getAll: () => api.get<import('@/types/index').Notification[]>('/api/notifications'),
  markRead: (id: string) =>
    api.patch<import('@/types/index').Notification>(`/api/notifications/${id}`, { read: true }),
  markAllRead: () => api.post<void>('/api/notifications/mark-all-read', {}),
};
