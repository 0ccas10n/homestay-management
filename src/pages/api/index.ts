// Re-export all API route handlers so esbuild can bundle them.
// Each handler exports GET, POST, PATCH, DELETE, OPTIONS, PUT, or HEAD functions.
// Dynamic route segments like [id] are imported as-is (TypeScript accepts [id] in paths).
export * as availability from './availability';
export * as dashboard from './dashboard';
export * as locations from './locations';
export * as roomsRoot from './rooms';
export * as authLogin from './auth/login';
export * as authLogout from './auth/logout';
export * as authMe from './auth/me';
export * as bookingsIndex from './bookings/index';
export * as bookingsStatus from './bookings/status';
export * as bookingsId from './bookings/[id]';
export * as cleaningIndex from './cleaning/index';
export * as cleaningId from './cleaning/[id]';
export * as customersIndex from './customers/index';
export * as expensesIndex from './expenses/index';
export * as notificationsIndex from './notifications/index';
export * as notificationsMarkAllRead from './notifications/mark-all-read';
export * as notificationsId from './notifications/[id]';
export * as ratePlanPricesIndex from './rate-plan-prices/index';
export * as ratePlansIndex from './rate-plans/index';
export * as roomsIndex from './rooms/index';
export * as roomsId from './rooms/[id]';
