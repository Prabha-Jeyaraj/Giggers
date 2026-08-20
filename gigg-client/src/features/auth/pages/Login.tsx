// @refresh reset
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, User, Briefcase, ArrowRight, CheckCircle, LogIn, UserPlus } from 'lucide-react';
import { useUIStore } from '../../../store/uiStore';
import { useAuthStore } from '../../../store/authStore';
import OnboardingQuestions, { OnboardingData } from '../components/OnboardingQuestions';

// ── Role Selection Modal ("Login As") ─────────────────────────
function RoleSelector({ onSelect }: { onSelect: (role: 'worker' | 'employer') => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(1,19,59,0.95)' }}
    >
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #22C55E, transparent)', transform: 'translate(40%, -40%)' }} />
      <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2563EB, transparent)', transform: 'translate(-40%, 40%)' }} />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6, delay: 0.1 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="Giggers" className="w-20 h-20 rounded-2xl mb-4" />
          <h1 className="text-3xl font-black text-white tracking-tight">Login As</h1>
          <p className="text-white/50 text-sm font-medium mt-1">Choose how you want to continue</p>
        </div>

        {/* Role Cards */}
        <div className="flex flex-col gap-4">
          {/* Worker Card */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect('worker')}
            className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all"
            style={{
              backgroundColor: 'rgba(34,197,94,0.08)',
              border: '2px solid rgba(34,197,94,0.25)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#22C55E' }}>
              <User size={26} color="#FFFFFF" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-extrabold text-white">Worker</h3>
              <p className="text-white/50 text-xs font-medium mt-0.5">Work. Earn. Grow.</p>
            </div>
            <ArrowRight size={20} color="#22C55E" />
          </motion.button>

          {/* Employer Card */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect('employer')}
            className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all"
            style={{
              backgroundColor: 'rgba(37,99,235,0.08)',
              border: '2px solid rgba(37,99,235,0.25)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#2563EB' }}>
              <Briefcase size={26} color="#FFFFFF" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-extrabold text-white">Employer</h3>
              <p className="text-white/50 text-xs font-medium mt-0.5">Hire. Track. Get Work Done.</p>
            </div>
            <ArrowRight size={20} color="#2563EB" />
          </motion.button>
        </div>

        {/* Bottom trust */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
            <CheckCircle size={12} />
            <span>Secure. Verified. Reliable.</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Action Choice Modal ("Sign In" vs "Create Account") ───────
function ActionChoiceModal({
  role,
  onBack,
  onChooseSignIn,
  onChooseCreateAccount,
}: {
  role: 'worker' | 'employer';
  onBack: () => void;
  onChooseSignIn: () => void;
  onChooseCreateAccount: () => void;
}) {
  const isEmployer = role === 'employer';
  const accentColor = isEmployer ? '#2563EB' : '#22C55E';
  const accentRgb = isEmployer ? '37,99,235' : '34,197,94';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(1,19,59,0.95)' }}
    >
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, transform: 'translate(40%, -40%)' }} />
      <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, transform: 'translate(-40%, 40%)' }} />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Header & Back */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/20 active:scale-95"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </button>
          <div className="px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-1.5"
            style={{
              backgroundColor: isEmployer ? 'rgba(37,99,235,0.15)' : 'rgba(34,197,94,0.15)',
              border: `1px solid ${accentColor}`,
              color: accentColor
            }}>
            {isEmployer ? <Briefcase size={13} /> : <User size={13} />}
            <span>{isEmployer ? 'Employer' : 'Worker'}</span>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo.png" alt="Giggers" className="w-16 h-16 rounded-2xl mb-3" />
          <h2 className="text-2xl font-black text-white tracking-tight">How would you like to proceed?</h2>
          <p className="text-white/50 text-xs font-medium mt-1">
            Choose Sign In for existing accounts or Create Account for new users
          </p>
        </div>

        {/* Action Cards */}
        <div className="flex flex-col gap-4">
          {/* Sign In Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onChooseSignIn}
            className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor }}>
              <LogIn size={22} color="#FFFFFF" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-white">Sign In</h3>
              <p className="text-white/50 text-xs font-medium mt-0.5">Existing account? Quick log in</p>
            </div>
            <ArrowRight size={18} color="rgba(255,255,255,0.6)" />
          </motion.button>

          {/* Create Account Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onChooseCreateAccount}
            className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all relative overflow-hidden"
            style={{
              backgroundColor: `rgba(${accentRgb}, 0.12)`,
              border: `2px solid ${accentColor}`,
              boxShadow: `0 4px 20px rgba(${accentRgb}, 0.2)`
            }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor }}>
              <UserPlus size={22} color="#FFFFFF" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-white">Create Account</h3>
              <p className="text-white/50 text-xs font-medium mt-0.5">New to Giggers? 3-question setup</p>
            </div>
            <ArrowRight size={18} color={accentColor} />
          </motion.button>
        </div>

        {/* Trust Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
            <CheckCircle size={12} />
            <span>Secure. Verified. Reliable.</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Login Component ──────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  // Always start from step 1 (role selection) — never persist across mounts
  const [role, setRole] = useState<'worker' | 'employer' | null>(null);
  const [authAction, setAuthAction] = useState<'login' | 'register' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { addToast } = useUIStore();
  const { sendOtp, isAuthenticated, hasHydrated, refreshUser } = useAuthStore();
  const [sending, setSending] = useState(false);

  // On every mount, clear any stale login-step state and refresh user status
  useEffect(() => {
    setRole(null);
    setAuthAction(null);
    setShowOnboarding(false);
    setPhone('');
    if (isAuthenticated) {
      refreshUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <- intentionally empty: runs ONCE on mount

  // If user is already logged in, send them home
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      refreshUser();
      navigate('/home', { replace: true });
    }
  }, [hasHydrated, isAuthenticated, navigate, refreshUser]);


  const isEmployer = role === 'employer';
  const accentColor = isEmployer ? '#2563EB' : '#22C55E';
  const accentColorLight = isEmployer ? 'rgba(37,99,235,0.1)' : 'rgba(34,197,94,0.1)';
  const accentColorBorder = isEmployer ? 'rgba(37,99,235,0.2)' : 'rgba(34,197,94,0.2)';
  const tagline = isEmployer ? 'Hire. Track. Get Work Done.' : 'Work. Earn. Grow.';
  const trustText = isEmployer ? 'Secure. Verified. Reliable.' : 'Safe. Secure. Always with you.';
  const portalLabel = isEmployer ? 'Employer Portal' : 'Worker Portal';

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 10) { addToast('Enter a valid 10-digit phone number', 'error'); return; }
    setSending(true);
    try {
      await sendOtp(phone);
      addToast('OTP sent to your phone 📲', 'success');
      navigate(`/otp?phone=${encodeURIComponent(phone)}&role=${role}&mode=login`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      addToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleOnboardingComplete = (data: OnboardingData) => {
    setShowOnboarding(false);
    navigate(`/register?role=${role}&status=${encodeURIComponent(data.status || '')}&commitment=${encodeURIComponent(data.commitment || '')}`);
  };

  // ── Step 1: Role Selection Popup ("Login As") ──────────────────
  if (!role) {
    return (
      <AnimatePresence>
        <RoleSelector onSelect={(r) => {
          setRole(r);
          setAuthAction('login');
          setShowOnboarding(false);
        }} />
      </AnimatePresence>
    );
  }

  // ── Step 2: Onboarding Questions (Only for Create Account) ──────
  if (authAction === 'register' && showOnboarding) {
    return (
      <OnboardingQuestions
        role={role}
        onBack={() => {
          setAuthAction('login');
          setShowOnboarding(false);
        }}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // ── Step 3: Login Phone Form (Directly for Sign In) ────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ── Dark Navy Header ── */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#01133b' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, transform: 'translate(30%, -30%)' }} />

        <div className="px-6 pt-10 pb-16">
          {/* Back button */}
          <button
            onClick={() => {
              setRole(null);
              setAuthAction(null);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </button>

          {/* Logo + Brand */}
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="Giggers" className="w-14 h-14 rounded-xl" />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-tight">Giggers</h1>
              <p className="text-white/50 text-xs font-semibold">{tagline}</p>
            </div>
          </div>

          {/* Portal badge */}
          <div className="mt-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: accentColor }}>
              {isEmployer ? <Briefcase size={13} color="#fff" /> : <User size={13} color="#fff" />}
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: accentColor }}>{portalLabel}</span>
          </div>
        </div>
      </div>

      {/* ── White Form Area ── */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 20 }}
        className="flex-1 rounded-t-3xl -mt-6 px-6 pt-8 pb-8 z-10 bg-white"
      >
        {/* Heading */}
        <h2 className="text-lg font-extrabold mb-1" style={{ color: '#0F172A' }}>
          {isEmployer ? 'Sign in to manage your workforce' : 'Sign in to find your next gig'}
        </h2>
        <p className="text-xs font-medium mb-6" style={{ color: '#94A3B8' }}>
          We'll send you a 4-digit OTP to verify your number
        </p>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: '#0F172A' }}>Phone Number</label>
            <div className="flex items-center rounded-xl px-4 py-3.5 gap-3 transition-all"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF' }}
              onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
            >
              <Phone size={18} color="#94A3B8" />
              <input
                type="tel"
                placeholder="Enter your 10-digit number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 outline-none text-sm font-medium bg-transparent"
                style={{ color: '#0F172A' }}
              />
            </div>
            <p className="text-xs mt-1.5 ml-1 font-medium" style={{ color: '#F59E0B' }}>
              Any 10-digit number works. OTP will be <strong>1234</strong>.
            </p>
          </div>

          {/* OTP info */}
          <div className="rounded-xl p-3" style={{ backgroundColor: accentColorLight, border: `1px solid ${accentColorBorder}` }}>
            <p className="text-[11px] font-medium leading-relaxed" style={{ color: accentColor }}>
              📲 We'll send a 4-digit OTP to verify your phone number. No password needed.
            </p>
          </div>

          {/* Send OTP Button */}
          <button
            onClick={handleSendOtp}
            disabled={sending}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              backgroundColor: accentColor,
              color: '#FFFFFF',
              opacity: sending ? 0.7 : 1,
              boxShadow: `0 8px 24px ${isEmployer ? 'rgba(37,99,235,0.35)' : 'rgba(34,197,94,0.35)'}`,
            }}
          >
            {sending ? 'Sending…' : <>Send OTP <ArrowRight size={18} /></>}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Google Sign In */}
          <button
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.97]"
            style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#334155' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.9 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.5-.4-3.8z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 15.8 18.8 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.5-11.2-8.2l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.7 39.4 44 34 44 24c0-1.3-.1-2.5-.4-3.8z" />
            </svg>
            Continue with Google
          </button>

          {/* Sign up link */}
          <p className="text-center text-sm font-medium mt-1" style={{ color: '#64748B' }}>
            Don't have an account?{' '}
            <button
              onClick={() => {
                setAuthAction('register');
                setShowOnboarding(true);
              }}
              className="font-extrabold"
              style={{ color: accentColor }}
            >
              Create Account
            </button>
          </p>
        </div>

        {/* Trust Footer */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium" style={{ color: accentColor }}>
            <CheckCircle size={13} />
            <span>{trustText}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
