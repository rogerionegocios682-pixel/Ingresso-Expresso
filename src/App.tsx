import React, { useState, useEffect } from 'react';
import { User } from './types';
import { StorageService } from './services/storage';
import { Layout, NavigationTab } from './components/Layout';
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

export default function App() {
  // Session / Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ingressos_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to initial admin
      }
    }
    const users = StorageService.getUsers();
    return users[0] || null;
  });

  // Current active navigation tab
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');

  // Currently focused event (for event dashboard or direct selling)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  // Selected event for batch management or POS pre-selection
  const [targetBatchEventId, setTargetBatchEventId] = useState<string | undefined>(undefined);
  const [targetPOSEventId, setTargetPOSEventId] = useState<string | undefined>(undefined);

  // Sync current user to local storage
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('ingressos_current_user', JSON.stringify(user));

    // Redirect to natural landing tab according to role
    if (user.role === 'SELLER') {
      setActiveTab('pos');
    } else if (user.role === 'DOORMAN' || user.role === 'CHECKIN') {
      setActiveTab('checkin');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ingressos_current_user');
  };

  // Switch tab safely ensuring role permissions
  const handleSelectTab = (tab: NavigationTab) => {
    setFocusedEventId(null);
    setActiveTab(tab);
  };

  // Drilldown to specific event dashboard
  const handleOpenEventDashboard = (eventId: string) => {
    setFocusedEventId(eventId);
  };

  // Quick navigation helpers from event cards
  const handleNavigateToBatches = (eventId?: string) => {
    setTargetBatchEventId(eventId);
    setActiveTab('batches');
    setFocusedEventId(null);
  };

  const handleNavigateToPOS = (eventId?: string) => {
    setTargetPOSEventId(eventId);
    setActiveTab('pos');
    setFocusedEventId(null);
  };

  const handleNavigateToCheckIn = (eventId?: string) => {
    setActiveTab('checkin');
    setFocusedEventId(null);
  };

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
      {/* If focused on a specific event, show the Event Dashboard as requested in #32 */}
      {focusedEventId ? (
        <EventDashboardView
          eventId={focusedEventId}
          currentUser={currentUser}
          onBack={() => setFocusedEventId(null)}
          onNavigateToPOS={() => handleNavigateToPOS(focusedEventId)}
          onNavigateToCheckIn={() => handleNavigateToCheckIn(focusedEventId)}
          onNavigateToBatches={() => handleNavigateToBatches(focusedEventId)}
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
    </Layout>
  );
}
