import React, { useState, useEffect } from 'react';
import { User } from './types';
import { StorageService, initFirestoreSync } from './services/storage';
import { Layout } from './components/Layout';
import { NavigationTab, isTabAllowedForRole, getDefaultTabForRole } from './services/permissions';
import { AccessDeniedView } from './components/AccessDeniedView';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { EventDashboardView } from './components/EventDashboardView';
import { EventsView } from './components/EventsView';
import { LotsAndTicketsView } from './components/LotsAndTicketsView';
import { POSView } from './components/POSView';
import { CheckInView } from './components/CheckInView';
import { SalesListView } from './components/SalesListView';
import { TicketsListView } from './components/TicketsListView';
import { CustomersView } from './components/CustomersView';
import { UsersView } from './components/UsersView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SaleToastNotification } from './components/SaleToastNotification';
import { PublicEventPageView } from './components/PublicEventPageView';
import { EventNotFound404View } from './components/EventNotFound404View';

interface EventRouteInfo {
  isEventRoute: boolean;
  slug: string | null;
}

function detectEventRoute(): EventRouteInfo {
  if (typeof window === 'undefined') return { isEventRoute: false, slug: null };

  const path = window.location.pathname;
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  // 1. Pathname check: /evento, /evento/, /evento/:slug, /e, /e/, /e/:slug, /event, /event/, /event/:slug
  const pathMatch = path.match(/^\/(?:evento|e|event)(?:\/([^/?#]*))?$/i);
  if (pathMatch) {
    let raw = pathMatch[1] ? pathMatch[1].trim() : '';
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {
      // Keep as-is
    }
    raw = raw.replace(/^\/+|\/+$/g, '').trim();
    return {
      isEventRoute: true,
      slug: raw || null
    };
  }

  // 2. Hash check: #/evento, #/evento/, #/evento/:slug, etc.
  const hashMatch = hash.match(/^#\/?(?:evento|e|event)(?:\/([^/?#]*))?$/i);
  if (hashMatch) {
    let raw = hashMatch[1] ? hashMatch[1].trim() : '';
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {
      // Keep as-is
    }
    raw = raw.replace(/^\/+|\/+$/g, '').trim();
    return {
      isEventRoute: true,
      slug: raw || null
    };
  }

  // 3. Search query check: ?evento=slug or ?evento or ?event=slug or ?e=slug
  if (searchParams.has('evento') || searchParams.has('event') || searchParams.has('e')) {
    let raw = searchParams.get('evento') || searchParams.get('event') || searchParams.get('e') || '';
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {
      // Keep as-is
    }
    raw = raw.replace(/^\/+|\/+$/g, '').trim();
    return {
      isEventRoute: true,
      slug: raw || null
    };
  }

  return { isEventRoute: false, slug: null };
}

export default function App() {
  // Public Event URL State (e.g., /evento/meu-evento)
  const [eventRoute, setEventRoute] = useState<EventRouteInfo>(detectEventRoute);

  useEffect(() => {
    const handleLocationChange = () => {
      setEventRoute(detectEventRoute());
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleOpenPublicPage = (slugOrId: string) => {
    setEventRoute({ isEventRoute: true, slug: slugOrId });
    try {
      window.history.pushState(null, '', `/evento/${slugOrId}`);
    } catch (e) {
      // Fallback
    }
  };

  const handleClosePublicPage = () => {
    setEventRoute({ isEventRoute: false, slug: null });
    try {
      window.history.pushState(null, '', '/');
    } catch (e) {
      // Fallback
    }
  };
  // Session / Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ingressos_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    const users = StorageService.getUsers();
    // Default to admin for initial state
    return users.find(u => u.role === 'ADMIN') || users[0] || null;
  });

  // Current active navigation tab (safely matching user role)
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    const saved = localStorage.getItem('ingressos_current_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u?.role) {
          return getDefaultTabForRole(u.role);
        }
      } catch (e) {
        // Fallback
      }
    }
    return 'dashboard';
  });

  // Initialize Firestore real-time cloud sync
  useEffect(() => {
    initFirestoreSync();
  }, []);

  // Guard: if current user or role changes, make sure active tab is strictly allowed
  useEffect(() => {
    if (currentUser) {
      if (!isTabAllowedForRole(currentUser.role, activeTab)) {
        setActiveTab(getDefaultTabForRole(currentUser.role));
        setFocusedEventId(null);
      }
    }
  }, [currentUser, activeTab]);

  // Currently focused event (for event dashboard or direct selling)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  // Selected event for batch management or POS pre-selection
  const [targetBatchEventId, setTargetBatchEventId] = useState<string | undefined>(undefined);
  const [targetPOSEventId, setTargetPOSEventId] = useState<string | undefined>(undefined);

  // Sync current user to local storage and route to their natural workspace
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('ingressos_current_user', JSON.stringify(user));
    StorageService.setCurrentUser(user);

    // Redirect strictly to allowed initial tab
    const initialTab = getDefaultTabForRole(user.role);
    setActiveTab(initialTab);
    setFocusedEventId(null);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ingressos_current_user');
    StorageService.setCurrentUser(null);
  };

  // Switch tab safely ensuring role permissions
  const handleSelectTab = (tab: NavigationTab) => {
    if (!currentUser || !isTabAllowedForRole(currentUser.role, tab)) {
      return;
    }
    setFocusedEventId(null);
    setActiveTab(tab);
  };

  // Drilldown to specific event dashboard (restricted to Master and Admin)
  const handleOpenEventDashboard = (eventId: string) => {
    if (!currentUser || (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN')) {
      return;
    }
    setFocusedEventId(eventId);
  };

  // Quick navigation helpers from event cards (restricted to permitted roles)
  const handleNavigateToBatches = (eventId?: string) => {
    if (!currentUser || (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN')) {
      return;
    }
    setTargetBatchEventId(eventId);
    setActiveTab('batches');
    setFocusedEventId(null);
  };

  const handleNavigateToPOS = (eventId?: string) => {
    if (!currentUser || !isTabAllowedForRole(currentUser.role, 'pos')) {
      return;
    }
    setTargetPOSEventId(eventId);
    setActiveTab('pos');
    setFocusedEventId(null);
  };

  const handleNavigateToCheckIn = (eventId?: string) => {
    if (!currentUser || !isTabAllowedForRole(currentUser.role, 'checkin')) {
      return;
    }
    setActiveTab('checkin');
    setFocusedEventId(null);
  };

  // Public Event Route resolution with unified audit logging and 404 fallback
  if (eventRoute.isEventRoute) {
    return (
      <PublicEventPageView
        slugOrId={eventRoute.slug || ''}
        currentUser={currentUser}
        onBackToAdmin={currentUser ? handleClosePublicPage : undefined}
        onSelectEvent={handleOpenPublicPage}
      />
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <Layout
      currentUser={currentUser}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      onLogout={handleLogout}
    >
      {/* Real-time PDV sales toast notification system */}
      <SaleToastNotification />

      {/* If focused on a specific event, show the Event Dashboard as requested in #32 (restricted to Master and Admin) */}
      {focusedEventId && (currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') ? (
        <EventDashboardView
          eventId={focusedEventId}
          currentUser={currentUser}
          onBack={() => setFocusedEventId(null)}
          onNavigateToPOS={() => handleNavigateToPOS(focusedEventId)}
          onNavigateToCheckIn={() => handleNavigateToCheckIn(focusedEventId)}
          onNavigateToBatches={() => handleNavigateToBatches(focusedEventId)}
          onOpenPublicPage={handleOpenPublicPage}
        />
      ) : (
        <>
          {!isTabAllowedForRole(currentUser.role, activeTab) ? (
            <AccessDeniedView
              currentUser={currentUser}
              onNavigateToAllowedTab={handleSelectTab}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  currentUser={currentUser}
                  onSelectEvent={handleOpenEventDashboard}
                  onNavigateToPOS={() => handleNavigateToPOS()}
                  onNavigateToCheckIn={() => handleNavigateToCheckIn()}
                />
              )}

              {activeTab === 'events' && (
                <EventsView
                  currentUser={currentUser}
                  onSelectEvent={handleOpenEventDashboard}
                  onManageBatches={handleNavigateToBatches}
                  onOpenPOS={handleNavigateToPOS}
                  onOpenPublicPage={handleOpenPublicPage}
                />
              )}

              {activeTab === 'batches' && (
                <LotsAndTicketsView
                  currentUser={currentUser}
                  initialEventId={targetBatchEventId}
                  onOpenPOS={handleNavigateToPOS}
                />
              )}

              {activeTab === 'pos' && (
                <POSView
                  currentUser={currentUser}
                  initialEventId={targetPOSEventId}
                />
              )}

              {activeTab === 'checkin' && (
                <CheckInView
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'sales' && (
                <SalesListView
                  currentUser={currentUser}
                  onOpenPOS={() => handleNavigateToPOS()}
                />
              )}

              {activeTab === 'tickets' && (
                <TicketsListView
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'customers' && (
                <CustomersView
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'users' && (
                <UsersView
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  currentUser={currentUser}
                />
              )}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
