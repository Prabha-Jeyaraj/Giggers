import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, User, Briefcase, ArrowRight, CheckCircle, LogIn, UserPlus } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/ui';
import { OnboardingQuestions, OnboardingData } from '../../components/auth/OnboardingQuestions';

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
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #22C55E, transparent)', transform: 'translate(40%, -40%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2563EB, transparent)', transform: 'translate(-40%, 40%)' }}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6, delay: 0.1 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-4">
            <span className="text-primary-600 font-black text-4xl">G</span>
          </div>
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
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#22C55E' }}
            >
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
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#2563EB' }}
            >
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
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, transform: 'translate(40%, -40%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent)`, transform: 'translate(-40%, 40%)' }}
      />

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
          <div
            className="px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-1.5"
            style={{
              backgroundColor: isEmployer ? 'rgba(37,99,235,0.15)' : 'rgba(34,197,94,0.15)',
              border: `1px solid ${accentColor}`,
              color: accentColor,
            }}
          >
            {isEmployer ? <Briefcase size={13} /> : <User size={13} />}
            <span>{isEmployer ? 'Employer' : 'Worker'}</span>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-3">
            <span className="text-primary-600 font-black text-3xl">G</span>
          </div>
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
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
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
              boxShadow: `0 4px 20px rgba(${accentRgb}, 0.2)`,
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
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

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'worker' | 'employer' | null>(null);
  const [authAction, setAuthAction] = useState<'login' | 'register' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { addToast } = useUIStore();
  const { sendOtp, isAuthenticated } = useAuthStore();
  const [sending, setSending] = useState(false);

  // If user is already logged in, send them home
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const isEmployer = role === 'employer';
  const accentColor = isEmployer ? '#2563EB' : '#22C55E';

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

  // Step 1: Role Selection ("Login As")
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

  // Step 2: Onboarding Questions (Only for Create Account)
  if (authAction === 'register' && showOnboarding) {
    return (
      <AnimatePresence>
        <OnboardingQuestions
          role={role}
          onBack={() => {
            setAuthAction('login');
            setShowOnboarding(false);
          }}
          onComplete={handleOnboardingComplete}
        />
      </AnimatePresence>
    );
  }

  // Step 4: Login Form (Directly for Sign In)
  return (
    <div className="min-h-screen bg-white dark:bg-dark-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-indigo-700 px-5 pt-12 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <button onClick={() => setAuthAction(null)} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-6">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-3xl font-black text-white mb-2">Welcome Back 👋</h1>
        <p className="text-white/70 font-medium">Sign in with your phone number ({role === 'employer' ? 'Employer' : 'Worker'})</p>
      </div>

      {/* Form card */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 20 }}
        className="flex-1 bg-white dark:bg-dark-900 rounded-t-3xl -mt-8 px-6 pt-8 pb-6 z-10"
      >
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Phone Number"
              type="tel"
              placeholder="Enter your 10-digit number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              leftIcon={<Phone size={16} />}
            />
            <p className="text-xs text-amber-600 mt-1 ml-1">Any 10-digit number works. OTP will be <strong>1234</strong>.</p>
          </div>

          <div className="bg-primary-50 dark:bg-primary-900/10 p-3.5 rounded-2xl border border-primary-100 dark:border-primary-800/30">
            <p className="text-[11px] font-medium text-primary-700 dark:text-primary-400 leading-relaxed">
              We'll send a 4-digit OTP to verify your phone number. No password needed.
            </p>
          </div>

          <Button fullWidth size="lg" loading={sending} onClick={handleSendOtp} rightIcon={<ArrowRight size={18} />}>
            Send OTP
          </Button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            Don't have an account?{' '}
            <button
              onClick={() => {
                setAuthAction('register');
                setShowOnboarding(true);
              }}
              className="text-primary-600 dark:text-primary-400 font-extrabold"
            >
              Create Account
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
