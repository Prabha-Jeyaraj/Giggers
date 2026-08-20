import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Phone, MapPin, Briefcase } from 'lucide-react';
import { useUIStore } from '../../../store/uiStore';
import { useAuthStore } from '../../../store/authStore';
import { Button, Input } from '../../../components/ui';
import { InteractiveLocationPicker } from '../components/InteractiveLocationPicker';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') || 'worker') as 'worker' | 'employer';
  const initialPhone = searchParams.get('phone') || '';

  const [step, setStep] = useState(1);
  const { addToast } = useUIStore();
  const { sendOtp } = useAuthStore();
  const [sending, setSending] = useState(false);

  // Form state
  const [role, setRole] = useState<'worker' | 'employer'>(initialRole);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('Chennai');
  const [area, setArea] = useState('');

  const totalSteps = 2;

  const handleNext = () => {
    if (step === 1) {
      if (!name || !phone) {
        addToast('Please fill all required fields', 'error'); return;
      }
      const cleaned = phone.replace(/\s/g, '');
      if (cleaned.length < 10) { addToast('Enter a valid phone number', 'error'); return; }
      if (role === 'employer' && !companyName) {
        addToast('Please enter your Company Name', 'error'); return;
      }
    }
    if (step < totalSteps) setStep(s => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSending(true);
    try {
      await sendOtp(phone);
      addToast('OTP sent to your phone 📲', 'success');
      // Navigate to OTP page with all registration data
      const params = new URLSearchParams({
        phone,
        role,
        mode: 'register',
        name,
        city,
        area,
        skipOnboarding: 'true',
        ...(role === 'employer' && companyName ? { companyName } : {}),
      });
      navigate(`/otp?${params.toString()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      addToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-900 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-20 relative overflow-hidden" style={{ backgroundColor: '#01133b' }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center mb-6 z-10 relative" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="mb-3 relative z-10">
          <span className="text-white/60 text-xs font-bold">Step {step} of {totalSteps}</span>
          <div className="flex gap-1.5 mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i < step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <img src="/logo.png" alt="Giggers" className="w-10 h-10 rounded-xl" />
          <h1 className="text-2xl font-black text-white">
            {step === 1 ? 'Create Account' : 'Your Location'}
          </h1>
        </div>
        <p className="text-white/60 font-medium text-sm relative z-10">Join the Giggers marketplace</p>
      </div>

      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 bg-white dark:bg-dark-900 rounded-t-3xl -mt-8 px-6 pt-8 pb-8 z-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
            {step === 1 && (
              <>
                {/* Role Selector Toggle */}
                <div className="bg-slate-100 dark:bg-dark-800 p-1.5 rounded-2xl flex relative mb-2">
                  <button
                    type="button"
                    onClick={() => setRole('worker')}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all z-10 flex items-center justify-center gap-2 ${role === 'worker'
                        ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                  >
                    <User size={15} />
                    Worker Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('employer')}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all z-10 flex items-center justify-center gap-2 ${role === 'employer'
                        ? 'bg-white dark:bg-dark-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                  >
                    <Briefcase size={15} />
                    Employer Account
                  </button>
                </div>

                <Input label="Full Name *" placeholder="Enter your full name" value={name} onChange={e => setName(e.target.value)} leftIcon={<User size={16} />} />
                <div>
                  <Input label="Phone Number *" type="tel" placeholder="9999999999" value={phone} onChange={e => setPhone(e.target.value)} leftIcon={<Phone size={16} />} />
                  <p className="text-xs text-amber-600 mt-1 ml-1">Any 10-digit number works. OTP will be <strong>1234</strong>.</p>
                </div>

                {role === 'employer' && (
                  <Input
                    label="Company Name *"
                    placeholder="Enter your business/employer name"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    leftIcon={<Briefcase size={16} />}
                  />
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">By creating an account, you agree to our <span className="text-primary-600">Terms of Service</span> and <span className="text-primary-600">Privacy Policy</span>.</p>
              </>
            )}

            {step === 2 && (
              <>
                <InteractiveLocationPicker
                  city={city}
                  area={area}
                  onChange={(data) => {
                    setCity(data.city);
                    setArea(data.area);
                  }}
                />
                <div className="bg-primary-50 dark:bg-primary-900/10 rounded-2xl p-4 mt-4 border border-primary-100 dark:border-primary-800/30">
                  <p className="text-xs font-bold text-primary-700 dark:text-primary-400 flex items-center gap-2">📲 Phone Verification</p>
                  <p className="text-xs text-primary-600 dark:text-primary-500 mt-1 font-medium">We'll send a 4-digit OTP to <span className="font-extrabold">{phone}</span> to verify your number.</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">🛡️ KYC Required</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-medium">After signup, complete Aadhaar & Selfie verification on your Profile page to {role === 'employer' ? 'post jobs' : 'apply for jobs'}.</p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex flex-col gap-3">
          <Button fullWidth size="lg" loading={sending} onClick={handleNext} rightIcon={step < totalSteps ? <ArrowRight size={18} /> : undefined}>
            {step < totalSteps ? 'Continue' : 'Send OTP & Create Account'}
          </Button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 font-medium">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-primary-600 dark:text-primary-400 font-extrabold">Sign In</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
