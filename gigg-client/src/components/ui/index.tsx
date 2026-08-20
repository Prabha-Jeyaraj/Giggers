import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// ============================================================
// BUTTON
// ============================================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, fullWidth,
  leftIcon, rightIcon, children, className, disabled, ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 active:scale-95 select-none';
  const variants = {
    primary:   'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary hover:shadow-glow',
    secondary: 'bg-slate-100 dark:bg-dark-500 text-slate-700 dark:text-slate-200',
    outline:   'border-2 border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10',
    ghost:     'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-600',
    danger:    'bg-red-500 text-white hover:bg-red-600',
  };
  const sizes = {
    sm:  'px-3 py-2 text-xs',
    md:  'px-5 py-3 text-sm',
    lg:  'px-6 py-3.5 text-base',
    xl:  'px-8 py-4 text-base',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </motion.button>
  );
};

// ============================================================
// INPUT
// ============================================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, leftIcon, rightIcon, className, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}</label>}
    <div className="relative">
      {leftIcon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</div>}
      <input
        className={clsx(
          'input-field',
          leftIcon && 'pl-10',
          rightIcon && 'pr-10',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          className
        )}
        {...props}
      />
      {rightIcon && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">{rightIcon}</div>}
    </div>
    {error && <p className="text-xs text-red-500 mt-1 ml-1 font-medium">{error}</p>}
  </div>
);

// ============================================================
// TIME INPUT (12-hour, stores/emits 24-hour "HH:MM")
// ============================================================
interface TimeInputProps {
  label?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  required?: boolean;
}

export const TimeInput: React.FC<TimeInputProps> = ({ label, value, onChange, required }) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
  const hours24 = match ? parseInt(match[1], 10) : null;
  const minutes = match ? match[2] : '00';
  const period = hours24 === null ? 'AM' : hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === null ? '' : String(hours24 % 12 || 12);

  const emit = (nextHours12: string, nextMinutes: string, nextPeriod: string) => {
    if (!nextHours12) { onChange(''); return; }
    let h = parseInt(nextHours12, 10) % 12;
    if (nextPeriod === 'PM') h += 12;
    onChange(`${String(h).padStart(2, '0')}:${nextMinutes}`);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}{required && ' *'}</label>}
      <div className="grid grid-cols-3 gap-2">
        <select
          className="input-field appearance-none"
          value={hours12}
          onChange={(e) => emit(e.target.value, minutes, period)}
        >
          <option value="" disabled>HH</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          className="input-field appearance-none"
          value={hours24 === null ? '' : minutes}
          onChange={(e) => emit(hours12 || '12', e.target.value, period)}
        >
          <option value="" disabled>MM</option>
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          className="input-field appearance-none"
          value={period}
          onChange={(e) => emit(hours12 || '12', minutes, e.target.value)}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};

// ============================================================
// TEXTAREA
// ============================================================
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, className, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}</label>}
    <textarea
      className={clsx('input-field resize-none', error && 'border-red-400', className)}
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1 ml-1 font-medium">{error}</p>}
  </div>
);

// ============================================================
// SELECT
// ============================================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}</label>}
    <div className="relative">
      <select className={clsx('input-field appearance-none pr-9', className)} {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
    </div>
  </div>
);

// ============================================================
// BADGE
// ============================================================
interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'primary' | 'gray';
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'primary', children, className, dot }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-400',
    danger:  'bg-red-50 text-red-600 dark:bg-red-600/20 dark:text-red-400',
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-700/20 dark:text-primary-300',
    gray:    'bg-slate-100 text-slate-600 dark:bg-dark-400 dark:text-slate-400',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold', variants[variant], className)}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', { 'bg-emerald-500': variant === 'success', 'bg-amber-500': variant === 'warning', 'bg-red-500': variant === 'danger', 'bg-primary-500': variant === 'primary', 'bg-slate-400': variant === 'gray' })} />}
      {children}
    </span>
  );
};

// ============================================================
// CARD
// ============================================================
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, glass, padding = 'md' }) => {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };
  return (
    <motion.div
      whileHover={onClick ? { y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={clsx(
        glass ? 'glass rounded-2xl' : 'card',
        paddings[padding],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

// ============================================================
// TOGGLE
// ============================================================
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, size = 'md' }) => {
  const sizes = { sm: 'w-9 h-5', md: 'w-12 h-6' };
  const thumbSizes = { sm: 'w-3.5 h-3.5', md: 'w-4.5 h-4.5' };
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative rounded-full transition-colors duration-200',
          sizes[size],
          checked ? 'bg-primary-500' : 'bg-slate-200 dark:bg-dark-400'
        )}
      >
        <motion.div
          animate={{ x: checked ? (size === 'sm' ? 16 : 24) : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={clsx('absolute top-1/2 -translate-y-1/2 bg-white rounded-full shadow', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')}
        />
      </div>
      {label && <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>}
    </label>
  );
};

// ============================================================
// AVATAR
// ============================================================
interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  verified?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', online, verified }) => {
  const sizes = { xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl', xl: 'w-20 h-20 text-2xl' };
  const dotSizes = { xs: 'w-2 h-2', sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-3.5 h-3.5', xl: 'w-4 h-4' };
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  return (
    <div className={clsx('relative flex-shrink-0', sizes[size])}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-extrabold">
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span className={clsx('absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-dark-700', dotSizes[size], online ? 'bg-emerald-500' : 'bg-slate-400')} />
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 bg-primary-500 rounded-full p-0.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
        </span>
      )}
    </div>
  );
};

// ============================================================
// SKELETON
// ============================================================
interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, rounded = 'md' }) => {
  const roundeds = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-2xl', full: 'rounded-full' };
  return <div className={clsx('skeleton', roundeds[rounded], className)} />;
};

// ============================================================
// RATING STARS
// ============================================================
interface RatingProps {
  value: number;
  size?: 'sm' | 'md';
  showCount?: number;
}

export const Rating: React.FC<RatingProps> = ({ value, size = 'sm', showCount }) => {
  const starSize = size === 'sm' ? 12 : 16;
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={starSize} height={starSize} viewBox="0 0 24 24" fill={i <= Math.round(value) ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className={clsx('font-bold text-slate-700 dark:text-slate-300', size === 'sm' ? 'text-xs' : 'text-sm')}>{value.toFixed(1)}</span>
      {showCount && <span className="text-xs text-slate-400">({showCount})</span>}
    </div>
  );
};

// ============================================================
// MODAL
// ============================================================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, className }) => {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={clsx('w-full max-w-lg bg-white dark:bg-dark-700 rounded-t-3xl p-6 pb-safe-area shadow-card-lg', className)}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-dark-400 rounded-full mx-auto mb-5" />
        {title && <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-5">{title}</h3>}
        {children}
      </motion.div>
    </motion.div>
  );
};

// ============================================================
// CHIP / FILTER TAG
// ============================================================
interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({ active, onClick, children, className }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={clsx(
      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 whitespace-nowrap',
      active
        ? 'bg-primary-500 text-white border-primary-500 shadow-glow-sm'
        : 'bg-white dark:bg-dark-600 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-dark-400',
      className
    )}
  >
    {children}
  </motion.button>
);

// ============================================================
// TAB BAR
// ============================================================
interface TabBarProps {
  tabs: string[];
  active: number;
  onChange: (i: number) => void;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange, className }) => (
  <div className={clsx('flex gap-1 bg-slate-100 dark:bg-dark-600 p-1 rounded-xl', className)}>
    {tabs.map((tab, i) => (
      <motion.button
        key={tab}
        onClick={() => onChange(i)}
        className={clsx(
          'flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200',
          active === i
            ? 'bg-white dark:bg-dark-400 text-primary-600 dark:text-primary-400 shadow-sm'
            : 'text-slate-500 dark:text-slate-500'
        )}
        whileTap={{ scale: 0.97 }}
      >
        {tab}
      </motion.button>
    ))}
  </div>
);

// ============================================================
// STAT CARD
// ============================================================
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  bgColor?: string;
  trend?: string;
  trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = '#6366f1', bgColor = '#e0e7ff', trend, trendUp }) => (
  <Card className="flex flex-col gap-3">
    {icon && (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgColor, color }}>
        {icon}
      </div>
    )}
    <div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
    {trend && (
      <p className={clsx('text-xs font-bold', trendUp ? 'text-emerald-600' : 'text-red-500')}>
        {trendUp ? '↑' : '↓'} {trend}
      </p>
    )}
  </Card>
);

// ============================================================
// SECTION HEADER
// ============================================================
interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, action, onAction, className }) => (
  <div className={clsx('flex items-center justify-between mb-4', className)}>
    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
    {action && (
      <button onClick={onAction} className="text-xs font-bold text-primary-600 dark:text-primary-400">
        {action}
      </button>
    )}
  </div>
);

// ============================================================
// EMPTY STATE
// ============================================================
interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ emoji = '🔍', title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <span className="text-5xl mb-4">{emoji}</span>
    <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-2">{title}</h3>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">{description}</p>}
    {action}
  </div>
);

// ============================================================
// TOAST CONTAINER
// ============================================================
interface ToastContainerProps {
  toasts: { id: string; message: string; type: string }[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 w-[90vw] max-w-sm">
    {toasts.map(toast => (
      <motion.div
        key={toast.id}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        onClick={() => onRemove(toast.id)}
        className={clsx(
          'px-4 py-3 rounded-2xl shadow-card-lg text-sm font-bold text-white flex items-center gap-3 cursor-pointer',
          toast.type === 'success' && 'bg-emerald-500',
          toast.type === 'error' && 'bg-red-500',
          toast.type === 'info' && 'bg-primary-500',
          toast.type === 'warning' && 'bg-amber-500',
        )}
      >
        <span>
          {toast.type === 'success' && '✅'}
          {toast.type === 'error' && '❌'}
          {toast.type === 'info' && 'ℹ️'}
          {toast.type === 'warning' && '⚠️'}
        </span>
        {toast.message}
      </motion.div>
    ))}
  </div>
);

// ============================================================
// OTP INPUT
// ============================================================
interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (v: string) => void;
}

export const OtpInput: React.FC<OtpInputProps> = ({ length = 4, value, onChange }) => {
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (i: number, v: string) => {
    const next = digits.map((d, idx) => idx === i ? v.slice(-1) : d).join('');
    onChange(next);
    if (v && i < length - 1) {
      const nextInput = document.getElementById(`otp-${i + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const prev = document.getElementById(`otp-${i - 1}`);
      prev?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((d, i) => (
        <motion.input
          key={i}
          id={`otp-${i}`}
          type="tel"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="otp-input"
          whileFocus={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        />
      ))}
    </div>
  );
};

// ============================================================
// MAP PLACEHOLDER
// ============================================================
interface MapPlaceholderProps {
  height?: string;
  className?: string;
}

export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ height = 'h-64', className }) => (
  <div className={clsx('map-placeholder w-full relative overflow-hidden', height, className)}>
    {/* Grid lines */}
    <div className="absolute inset-0 opacity-20">
      <div className="w-full h-full" style={{
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />
    </div>
    {/* Simulated roads */}
    <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <line x1="0" y1="150" x2="400" y2="150" stroke="#6366f1" strokeWidth="3" />
      <line x1="200" y1="0" x2="200" y2="300" stroke="#6366f1" strokeWidth="3" />
      <line x1="0" y1="80" x2="400" y2="120" stroke="#6366f1" strokeWidth="2" />
      <line x1="0" y1="200" x2="400" y2="220" stroke="#6366f1" strokeWidth="2" />
      <line x1="100" y1="0" x2="80" y2="300" stroke="#6366f1" strokeWidth="1.5" />
      <line x1="300" y1="0" x2="320" y2="300" stroke="#6366f1" strokeWidth="1.5" />
    </svg>
    {/* Pin marker */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="flex flex-col items-center"
      >
        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center shadow-glow text-white text-lg">📍</div>
        <div className="w-3 h-3 bg-primary-500 rotate-45 -mt-1.5 shadow-sm" />
      </motion.div>
    </div>
    {/* Badge */}
    <div className="absolute bottom-3 left-3 bg-white dark:bg-dark-700 rounded-xl px-3 py-1.5 shadow-card text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
      <span>📍</span> Google Maps Integration Placeholder
    </div>
    {/* Zoom controls */}
    <div className="absolute top-3 right-3 flex flex-col gap-1">
      <button className="w-8 h-8 bg-white dark:bg-dark-700 rounded-lg shadow-card text-slate-600 dark:text-slate-300 font-bold text-lg flex items-center justify-center">+</button>
      <button className="w-8 h-8 bg-white dark:bg-dark-700 rounded-lg shadow-card text-slate-600 dark:text-slate-300 font-bold text-lg flex items-center justify-center">−</button>
    </div>
  </div>
);
