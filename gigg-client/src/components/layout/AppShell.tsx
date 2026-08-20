import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from './Navigation';
import { DesktopSidebar } from './DesktopSidebar';
import { ToastContainer } from '../ui';
import { useAuthStore } from '../../store/authStore';
import { useWalletStore } from '../../store/walletStore';
import { useUIStore } from '../../store/uiStore';
import PendingApproval from '../../features/auth/pages/PendingApproval';
import { useNotificationStore } from '../../store/notificationStore';
import { clsx } from 'clsx';

// Paths that don't need auth and are always accessible
const PUBLIC_PATHS = ['/', '/welcome', '/login', '/register', '/otp', '/forgot-password'];
// Paths that are part of the onboarding flow (auth required, but app features not required)
const ONBOARDING_PATHS = ['/kyc', '/pending'];
// Paths that hide the bottom navigation
const HIDE_NAV_PATHS = ['/welcome', '/login', '/register', '/otp', '/post-job', '/forgot-password', '/kyc', '/pending'];
// Client invite links self-authenticate via token — never gated behind the normal auth check
const isClientInvitePath = (pathname: string) => pathname.startsWith('/client/invite/');
// Public pipeline share links require no auth
const isPublicSharePath = (pathname: string) => pathname.startsWith('/pipeline/share');
// Read-only client role — no bottom nav (that's Worker/Employer-oriented) or desktop sidebar
const isClientPath = (pathname: string) => pathname.startsWith('/client/');

export const AppShell: React.FC = () => {
  const { isAuthenticated, user, refreshUser, hasHydrated } = useAuthStore();
  const { fetchWallet } = useWalletStore();
  const { toasts, removeToast, theme } = useUIStore();
  const { subscribeToNotifications } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname) || isClientInvitePath(location.pathname) || isPublicSharePath(location.pathname);
  const isOnboardingPath = ONBOARDING_PATHS.includes(location.pathname);

  // 1. Not logged in + trying to access protected route → go to welcome
  // Gated on hasHydrated: the persisted session loads asynchronously after
  // this store's initial (unauthenticated) state, so on a fresh page
  // load/refresh isAuthenticated briefly reads false even for an already
  // logged-in user. Checking it before hydration finishes would bounce
  // them to /welcome despite having a valid session.
  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !isPublicPath && !isOnboardingPath) {
      navigate('/welcome');
    }
  }, [hasHydrated, isAuthenticated, isPublicPath, isOnboardingPath, navigate]);

  // 2. Logged in → always refresh user status silently on route entry
  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
  }, [isAuthenticated, location.pathname, refreshUser]);

  // 3. KYC gate removed — users can browse home freely, jobs are gated individually

  // 4. Already submitted but on /kyc → push to /pending
  useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      user.kycStatus === 'submitted' &&
      !user.isApproved &&
      location.pathname === '/kyc'
    ) {
      navigate('/pending', { replace: true });
    }
  }, [isAuthenticated, user, location.pathname, navigate]);

  // 5. Approved → don't allow sitting on /pending or /kyc
  useEffect(() => {
    if (isAuthenticated && user?.isApproved && isOnboardingPath) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, user?.isApproved, isOnboardingPath, navigate]);

  // Show the pending overlay for submitted-but-not-approved users on protected routes
  const isPendingApproval =
    isAuthenticated &&
    user &&
    !user.isApproved &&
    user.kycStatus === 'submitted' &&
    !isPublicPath &&
    !isOnboardingPath;

  // Wallet + notifications
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchWallet();
    }
  }, [isAuthenticated, user, fetchWallet]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const unsubscribe = subscribeToNotifications(user.id);
      return unsubscribe;
    }
  }, [isAuthenticated, user?.id, subscribeToNotifications]);

  // Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const isDetailsPage =
    location.pathname.includes('/jobs/') ||
    location.pathname.includes('/applications/') ||
    location.pathname.includes('/chat/');

  const showNav =
    isAuthenticated &&
    !HIDE_NAV_PATHS.includes(location.pathname) &&
    !isDetailsPage &&
    location.pathname !== '/' &&
    !isPendingApproval &&
    !isClientPath(location.pathname) &&
    !isPublicPath;

  const themeClass = user?.role === 'employer' ? 'theme-employer' : '';

  const showSidebar =
    isAuthenticated &&
    !isPublicPath &&
    !isOnboardingPath &&
    !isPendingApproval &&
    !isClientPath(location.pathname) &&
    location.pathname !== '/';

  // Block rendering until the persisted session has loaded, on protected
  // routes only — otherwise a not-yet-hydrated (falsely unauthenticated)
  // state would flash the wrong content before the redirect-guard effect
  // above gets a chance to run. Public routes render immediately since
  // they don't depend on auth state.
  if (!hasHydrated && !isPublicPath && !isOnboardingPath) {
    return <div className="min-h-screen bg-slate-50 dark:bg-dark-900" />;
  }

  if (isPendingApproval) {
    return (
      <div className={`min-h-screen bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white font-sans transition-colors duration-200 ${themeClass}`}>
        <div className="max-w-lg mx-auto bg-white dark:bg-dark-900 min-h-screen relative shadow-2xl overflow-x-hidden">
          <PendingApproval />
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-dark-900 text-slate-900 dark:text-white font-sans transition-colors duration-200 ${themeClass}`}>
      {showSidebar && <DesktopSidebar />}
      
      <div className={clsx("min-h-screen flex flex-col", showSidebar && "lg:pl-64")}>
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname + location.search}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
            className={clsx(
              "bg-white dark:bg-dark-900 min-h-screen relative shadow-2xl overflow-x-hidden w-full",
              showSidebar 
                ? "max-w-lg lg:max-w-4xl mx-auto lg:my-6 lg:min-h-[calc(100vh-48px)] lg:rounded-3xl lg:shadow-xl lg:border lg:border-slate-100 lg:dark:border-dark-700" 
                : "max-w-lg mx-auto"
            )}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
        
        {showNav && (
          <>
            <BottomNav />
            {user?.role === 'employer' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/post-job')}
                className="lg:hidden fixed bottom-[90px] right-6 w-14 h-14 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(26,115,232,0.4)] z-50"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </motion.button>
            )}
          </>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
