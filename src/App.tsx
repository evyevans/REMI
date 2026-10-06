/* ═══════════════════════════════════════════════════════════
   APP ROOT — React Router + Layout + Providers
   ═══════════════════════════════════════════════════════════ */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { FilterProvider } from './contexts/FilterContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header, TabBar, RecentMarketsBar } from './components/layout';
import { PageTransition } from './components/layout/PageTransition';
import './voice-avatar.css';
import SplashScreen from './components/SplashScreen';
import VoiceAvatar from './components/VoiceAvatar';

import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Properties from './pages/Properties';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import Login from './pages/Login';
import PlatformHealth from './pages/PlatformHealth';
import FullMarketIntel from './pages/FullMarketIntel';
import MarketSimulator from './pages/MarketSimulator';
import AgentMemory from './pages/AgentMemory';
import Billing from './pages/Billing';
import PropertyBriefPage from './pages/PropertyBrief';
import QuickOfferCard from './pages/QuickOfferCard';
import { useMarket } from './stores/marketStore';
import { useThemeStore } from './stores/themeStore';

import GlobalErrorBoundary from './components/GlobalErrorBoundary';

export const GUEST_KEY = 'remi_guest_access';

// Auth-gated route wrapper — redirects to /login if not authenticated.
// Guest visitors (localStorage flag) bypass auth entirely.
const AuthRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const isGuest = localStorage.getItem(GUEST_KEY) === 'true';

  if (isGuest) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-tertiary text-sm">Loading...</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Market-gated route wrapper — waits for Zustand hydration before redirecting
// to avoid a false redirect to /setup on every hard refresh.
// Guests always pass through (market is pre-seeded on the Login page).
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isMarketSelected, isHydrated } = useMarket();
  const isGuest = localStorage.getItem(GUEST_KEY) === 'true';

  if (isGuest) return <>{children}</>;
  if (!isHydrated) return null;
  return isMarketSelected ? <>{children}</> : <Navigate to="/setup" replace />;
};

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Remove all theme classes first
    document.documentElement.classList.remove('theme-night', 'theme-colorblind', 'theme-system');
    
    // Apply new theme class if not default
    if (theme !== 'default') {
      document.documentElement.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  return (
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <FilterProvider>
            <ToastProvider>
              {/* Global voice widget — fixed bottom-right, persists across all routes */}
              <VoiceAvatar />
              <Routes>
                {/* Public routes — no auth required */}
                <Route path="/login" element={<Login />} />
                <Route path="/brief/:id" element={<PropertyBriefPage />} />
                <Route path="/quick/:id" element={<QuickOfferCard />} />

                {/* Setup/Initial Route */}
                <Route path="/setup" element={
                  <AuthRoute>
                    <SplashScreen />
                  </AuthRoute>
                } />

                {/* Protected Routes - Require Auth + Market Selection */}
                <Route element={
                  <AuthRoute>
                    <div className="flex flex-col h-screen bg-bg-primary">
                      <Header />
                      <TabBar />
                      <RecentMarketsBar />
                      <main className="flex-1 flex overflow-hidden">
                        <PageTransition>
                          <Outlet />
                        </PageTransition>
                      </main>
                    </div>
                  </AuthRoute>
                }>
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/map" element={
                    <ProtectedRoute>
                      <MapView />
                    </ProtectedRoute>
                  } />
                  <Route path="/properties" element={
                    <ProtectedRoute>
                      <Properties />
                    </ProtectedRoute>
                  } />
                  <Route path="/agent-memory" element={
                    <ProtectedRoute>
                      <AgentMemory />
                    </ProtectedRoute>
                  } />
                  <Route path="/analytics" element={
                    <ProtectedRoute>
                      <Analytics />
                    </ProtectedRoute>
                  } />
                  <Route path="/alerts" element={
                    <ProtectedRoute>
                      <Alerts />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  <Route path="/health" element={
                    <ProtectedRoute>
                      <PlatformHealth />
                    </ProtectedRoute>
                  } />
                  <Route path="/full-market-intel" element={
                    <ProtectedRoute>
                      <FullMarketIntel />
                    </ProtectedRoute>
                  } />
                  <Route path="/simulator" element={
                    <ProtectedRoute>
                      <MarketSimulator />
                    </ProtectedRoute>
                  } />
                  <Route path="/billing" element={
                    <ProtectedRoute>
                      <Billing />
                    </ProtectedRoute>
                  } />
                  <Route path="/billing" element={
                    <ProtectedRoute>
                      <Billing />
                    </ProtectedRoute>
                  } />
                </Route>
                
                {/* Redirect any unmatched routes */}
                <Route path="*" element={
                  <AuthRoute>
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  </AuthRoute>
                } />
              </Routes>
            </ToastProvider>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  );
}