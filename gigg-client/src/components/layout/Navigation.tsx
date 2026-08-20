import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Briefcase, MessageSquare, Wallet, User, Bell, Plus, LayoutDashboard, Search, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useChatStore } from '../../store/chatStore';

export const WORKER_TABS = [
  { path: '/home',     icon: Home,          label: 'Home' },
  { path: '/jobs',     icon: Briefcase,     label: 'My Jobs' },
  { path: '/wallet',   icon: Wallet,        label: 'Earnings' },
  { path: '/chat',     icon: MessageSquare, label: 'Messages' },
  { path: '/profile',  icon: User,          label: 'Profile' },
];

export const EMPLOYER_TABS = [
  { path: '/home',     icon: Home,          label: 'Dashboard' },
  { path: '/jobs',     icon: Briefcase,     label: 'Jobs' },
  { path: '/workers',  icon: User,          label: 'Workers' },
  { path: '/wallet',   icon: Wallet,        label: 'Wallet' },
  { path: '/chat',     icon: MessageSquare, label: 'Messages' },
  { path: '/profile',  icon: User,          label: 'Profile' },
];

export const BottomNav: React.FC = () => {
  const { unreadCount: notifUnread } = useNotificationStore();
  const { threads } = useChatStore();
  const { user } = useAuthStore();
  const location = useLocation();

  const chatUnreadCount = threads.reduce((sum, t) => sum + (t.unreadCount > 0 ? 1 : 0), 0);
  const totalChatBadge = chatUnreadCount > 0 ? chatUnreadCount : notifUnread;

  const tabs = user?.role === 'employer' ? EMPLOYER_TABS : WORKER_TABS;

  return (
    <nav className="bottom-nav lg:hidden h-[72px] bg-white dark:bg-dark-800 border-t border-slate-100 dark:border-dark-600 fixed bottom-0 w-full z-50">
      <div className="flex justify-around items-center h-full max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;

          return (
            <NavLink key={tab.path} to={tab.path} className="flex flex-col items-center gap-1.5 relative py-1 px-3">
              {({ isActive: navActive }) => {
                const active = navActive || isActive;
                return (
                  <>
                    <div className="relative">
                      <Icon
                        size={22}
                        strokeWidth={active ? 2.5 : 2}
                        className={clsx('transition-colors duration-200', active ? (user?.role === 'employer' ? 'text-blue-600' : 'text-green-600') : 'text-slate-400 dark:text-slate-500')}
                      />
                      {tab.path === '/chat' && totalChatBadge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white shadow-sm">
                          {totalChatBadge > 9 ? '9+' : totalChatBadge}
                        </span>
                      )}
                    </div>
                    <span className={clsx('text-[10px] font-bold transition-colors duration-200', active ? (user?.role === 'employer' ? 'text-blue-600' : 'text-green-600') : 'text-slate-400 dark:text-slate-500')}>
                      {tab.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

// ============================================================
// APP HEADER
// ============================================================
interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  dark?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title, showBack, onBack, rightAction, transparent, dark
}) => {
  return (
    <header className={clsx(
      'sticky top-0 z-40 flex items-center justify-between px-4 py-3',
      transparent ? 'bg-transparent' : dark
        ? 'bg-gradient-to-r from-primary-600 to-primary-700'
        : 'bg-white dark:bg-dark-800 border-b border-slate-100 dark:border-dark-600',
    )}>
      <div className="flex items-center gap-3">
        {showBack && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', dark ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-dark-600 text-slate-700 dark:text-slate-300')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </motion.button>
        )}
        {title && <h1 className={clsx('text-lg font-extrabold', dark ? 'text-white' : 'text-slate-900 dark:text-white')}>{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        {rightAction}
      </div>
    </header>
  );
};

// ============================================================
// HOME HEADER (matching app.html)
// ============================================================
export const HomeHeader: React.FC<{ name: string; city: string; avatar?: string }> = ({ name, city, avatar }) => {
  return (
    <header className="min-h-[120px] px-[25px] pt-[35px] pb-[50px] text-white flex justify-between items-center rounded-b-[32px] shrink-0 relative z-40 shadow-sm" style={{ backgroundColor: '#01133b' }}>
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Giggers" className="w-10 h-10 rounded-xl" />
        <div className="flex flex-col">
          <h1 className="text-[1.5rem] font-extrabold leading-tight">Giggers</h1>
          <p className="text-[0.75rem] font-semibold opacity-60 mt-0.5">📍 {city}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NavLink to="/profile" className="w-[42px] h-[42px] rounded-full border-[3px] border-white/40 overflow-hidden bg-white shadow-sm flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-black text-[1.2rem]" style={{ color: '#01133b' }}>{name.charAt(0)}</span>
          )}
        </NavLink>
      </div>
    </header>
  );
};
