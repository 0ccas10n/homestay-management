// ─── App Shell — shared layout for all authenticated routes ──────────────────────────────────
//
// Renders Sidebar + TopBar + child routes.
// Dark mode state lives here (shared across the entire app shell).
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const PAGE_TITLES: Record<string, string> = {
  dashboard:    'Dashboard',
  bookings:     'Bookings',
  rooms:        'Rooms',
  calendar:     'Calendar',
  timeline:     'Daily Timeline',
  guests:       'Guests',
  housekeeping: 'Housekeeping',
  reports:      'Reports',
  expenses:     'Expenses',
  notifications:'Notifications',
  settings:     'Settings',
};

export default function AppShell() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();

  const segment = location.pathname.split('/').pop() ?? 'dashboard';
  const activePage = (PAGE_TITLES[segment] ? segment : 'dashboard') as keyof typeof PAGE_TITLES;

  const bg = darkMode ? '#0F172A' : '#F1F5F9';
  const textPrimary = darkMode ? '#F1F5F9' : '#1E293B';

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  const handleNavigate = (id: string) => {
    navigate(`/app/${id}`);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: bg, color: textPrimary,
      fontFamily: 'inherit',
    }}>
      {isMobile && mobileMenuOpen && (
        <button
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            border: 'none', background: 'rgba(15,23,42,0.55)', cursor: 'pointer',
          }}
        />
      )}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          activePage={activePage}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
          onNavigate={handleNavigate}
          isMobile={isMobile}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet context={{ darkMode }} />
        </main>
      </div>
    </div>
  );
}
