// ─── App.tsx ──────────────────────────────────────────────────────────────────────────────
//
// Root application router using react-router-dom v7.
//
// Route structure:
//   /login              — public login page (no auth required)
//   /app/*              — all authenticated routes, wrapped in RequireAuth + AppShell
//
// Each app route mounts the corresponding page component directly (no page-level
// data fetching — each page fetches its own data via its custom hook).
// ──────────────────────────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from '@/contexts/AuthContext.tsx';
import RequireAuth from '@/RequireAuth';
import AppShell from '@/AppShell';
import LoginPage from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Bookings from '@/pages/Bookings';
import Rooms from '@/pages/Rooms';
import CalendarView from '@/pages/CalendarView';
import Timeline from '@/pages/Timeline';
import Guests from '@/pages/Guests';
import Housekeeping from '@/pages/Housekeeping';
import Reports from '@/pages/Reports';
import Expenses from '@/pages/Expenses';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated app routes */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="bookings"     element={<Bookings />} />
            <Route path="rooms"        element={<Rooms />} />
            <Route path="calendar"     element={<CalendarView />} />
            <Route path="timeline"     element={<Timeline />} />
            <Route path="guests"       element={<Guests />} />
            <Route path="housekeeping" element={<Housekeeping />} />
            <Route path="reports"     element={<Reports />} />
            <Route path="expenses"     element={<Expenses />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings"     element={<Settings />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
