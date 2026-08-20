import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Edit2, LogOut, ChevronRight, Shield, Award, Settings,
  HelpCircle, MapPin, Star, Briefcase, X, Save, Moon, Sun,
  Phone, Mail, User as UserIcon, ChefHat, Newspaper, MessageSquare,
  Bell, CheckCircle, Info, Camera, Upload, Volume2, Languages, Trash2, Smartphone
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { api } from '../../../lib/api';
import { useUIStore } from '../../../store/uiStore';
import { Avatar, Card, Badge, Button, Input, Toggle, Select, Modal } from '../../../components/ui';
import { displayIdForRole } from '../../../lib/displayId';
import { supabase } from '../../../lib/supabase';

// ─── Edit Profile Modal ──────────────────────────────────────
function EditProfileModal({ user, open, onClose, onSave }: any) {
  const [name, setName] = useState(user.name || '');
  const [city, setCity] = useState(user.city || '');
  const [area, setArea] = useState(user.area || '');
  const [bio, setBio] = useState(user.bio || '');
  const [oneLiner, setOneLiner] = useState(user.oneLiner || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [selfie, setSelfie] = useState(user.selfie || '');

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col items-center mb-4">
          <div className="relative group cursor-pointer" onClick={() => setSelfie('https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&h=256&auto=format&fit=crop')}>
            <Avatar src={selfie} name={name} size="xl" />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit2 size={20} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wider">Tap to Mock Selfie Upload</p>
        </div>

        {[
          { label: 'Full Name', value: name, onChange: setName, icon: <UserIcon size={16} />, placeholder: 'Your name' },
          { label: 'Phone', value: phone, onChange: setPhone, icon: <Phone size={16} />, placeholder: '+91 XXXXX XXXXX' },
          { label: 'City', value: city, onChange: setCity, icon: <MapPin size={16} />, placeholder: 'e.g. Mumbai' },
          { label: 'Area / Locality', value: area, onChange: setArea, icon: <MapPin size={16} />, placeholder: 'e.g. Andheri West' },
        ].map(field => (
          <div key={field.label}>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">{field.label}</label>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-dark-700 border border-slate-200 dark:border-dark-500 rounded-xl px-4 py-3">
              <span className="text-slate-400">{field.icon}</span>
              <input
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
                placeholder={field.placeholder}
                className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        ))}

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">One-liner</label>
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-dark-700 border border-slate-200 dark:border-dark-500 rounded-xl px-4 py-3">
            <input
              value={oneLiner}
              onChange={e => e.target.value.length <= 80 && setOneLiner(e.target.value)}
              placeholder="A short tagline about you"
              maxLength={80}
              className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            placeholder="Tell employers about yourself..."
            className="w-full bg-slate-50 dark:bg-dark-700 border border-slate-200 dark:border-dark-500 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400 resize-none"
          />
        </div>

        <button
          onClick={() => onSave({ name, city, area, bio, oneLiner, phone, selfie })}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-primary-500/30 active:scale-95 transition-transform"
        >
          <Save size={18} /> Save Changes
        </button>
      </div>
    </Modal>
  );
}

// ─── Skills & Categories Modal ───────────────────────────────
function SkillsModal({ user, open, onClose }: any) {
  const allSkills = [
    'Food Serving', 'Table Setup', 'Crowd Management', 'Cleaning',
    'Route Planning', 'Area Coverage', 'Time Management', 'Customer Service',
    'Heavy Lifting', 'Driving', 'Communication',
  ];
  const [selected, setSelected] = useState<string[]>(user.skills || []);
  const [activeCategory, setActiveCategory] = useState<string>(user.categories?.[0] || 'Catering');

  const toggle = (skill: string) =>
    setSelected(s => s.includes(skill) ? s.filter(x => x !== skill) : [...s, skill]);

  return (
    <Modal open={open} onClose={onClose} title="Skills & Categories">
      <div className="flex flex-col pb-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">Work Category</p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { id: 'Catering', icon: <ChefHat size={18} />, color: 'border-amber-400 bg-amber-50 text-amber-800' },
            { id: 'Pamphlet Dist.', icon: <Newspaper size={18} />, color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                activeCategory === cat.id ? cat.color : 'border-slate-200 dark:border-dark-500 text-slate-500'
              }`}
            >
              {cat.icon} {cat.id}
            </button>
          ))}
        </div>

        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">Your Skills</p>
        <div className="flex flex-wrap gap-2">
          {allSkills.map(skill => (
            <button
              key={skill}
              onClick={() => toggle(skill)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                selected.includes(skill)
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-slate-200 dark:border-dark-500 text-slate-600 dark:text-slate-400'
              }`}
            >
              {selected.includes(skill) && '✓ '}{skill}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-primary-500/30 active:scale-95 transition-transform"
        >
          <Save size={18} /> Save Skills
        </button>
      </div>
    </Modal>
  );
}

// ─── Settings Modal ──────────────────────────────────────────
function SettingsModal({ open, onClose }: any) {
  const {
    theme,
    toggleTheme,
    pushNotificationsEnabled,
    togglePushNotifications,
    smsAlertsEnabled,
    toggleSmsAlerts,
    soundEnabled,
    toggleSound,
    appLanguage,
    setAppLanguage,
    addToast
  } = useUIStore();

  const handleClearCache = () => {
    localStorage.clear();
    addToast('Cache cleared! Restarting...', 'info');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  };

  return (
    <Modal open={open} onClose={onClose} title="App Settings">
      <div className="flex flex-col gap-4 pb-6 max-h-[70vh] overflow-y-auto no-scrollbar">
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{theme === 'dark' ? 'Currently on' : 'Currently off'}</p>
            </div>
          </div>
          <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Job alerts & messages</p>
            </div>
          </div>
          <Toggle checked={pushNotificationsEnabled} onChange={togglePushNotifications} />
        </div>

        {/* SMS Alerts */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">SMS Alerts</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Critical gig updates</p>
            </div>
          </div>
          <Toggle checked={smsAlertsEnabled} onChange={toggleSmsAlerts} />
        </div>

        {/* Sounds */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-semibold">
              <Volume2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Sounds & Haptics</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">In-app tones & vibration</p>
            </div>
          </div>
          <Toggle checked={soundEnabled} onChange={toggleSound} />
        </div>

        {/* Language Selection */}
        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
              <Languages size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">App Language</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Select interface language</p>
            </div>
          </div>
          <Select
            value={appLanguage}
            onChange={(e) => setAppLanguage(e.target.value)}
            options={[
              { value: 'English', label: 'English' },
              { value: 'Hindi', label: 'Hindi (हिन्दी)' },
              { value: 'Marathi', label: 'Marathi (मराठी)' },
              { value: 'Tamil', label: 'Tamil (தமிழ்)' }
            ]}
          />
        </div>

        {/* Reset App */}
        <button
          onClick={handleClearCache}
          className="flex items-center justify-center gap-2 w-full py-4 border border-dashed border-red-200 dark:border-red-900/50 rounded-2xl text-xs font-bold text-red-600 bg-red-50/50 dark:bg-red-950/10 active:scale-95 transition-all"
        >
          <Trash2 size={16} />
          Clear Cache & Reset App
        </button>

        {/* App Version */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-dark-700 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-dark-600 flex items-center justify-center text-slate-500">
              <Info size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">App Version</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">v1.0.0 — Giggers</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Latest</span>
        </div>
      </div>
    </Modal>
  );
}

// ─── Help Modal ──────────────────────────────────────────────
function HelpModal({ open, onClose }: any) {
  const faqs = [
    { q: 'How do I get hired?', a: 'Apply to jobs in the Jobs tab. Employers will review and accept your application. You\'ll be notified instantly.' },
    { q: 'When do I get paid?', a: 'Payment is released to your wallet after the employer verifies your work via OTP at the end of your shift.' },
    { q: 'How does OTP work?', a: 'At the start of your shift, the employer gives you a Start OTP. At the end, an End OTP confirms work completion and triggers payment.' },
    { q: 'Can I cancel a job?', a: 'Yes, but repeated cancellations affect your rating. Cancel at least 12 hours before the shift to avoid penalties.' },
    { q: 'How do I withdraw money?', a: 'Go to Wallet, tap Withdraw, and enter your bank details. Transfers take 1–2 business days.' },
  ];
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Help & Support">
      <div className="flex flex-col pb-4">
        <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-2xl mb-5 flex items-center gap-3 border border-primary-100 dark:border-primary-800/40">
          <MessageSquare size={20} className="text-primary-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-primary-900 dark:text-primary-300">Chat with Support</p>
            <p className="text-xs text-primary-600 dark:text-primary-400">We reply within 2 hours</p>
          </div>
          <span className="ml-auto text-xs font-black text-primary-600 bg-primary-100 dark:bg-primary-800/50 px-3 py-1 rounded-full">Chat</span>
        </div>

        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">Frequently Asked Questions</p>
        <div className="flex flex-col gap-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-100 dark:border-dark-600 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-white">{faq.q}</span>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4"
                  >
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function VerificationModal({ user, open, onClose, onVerify, onReset }: any) {
  const [step, setStep] = useState(user.isVerified ? 4 : 1);
  const [aadhaar, setAadhaar] = useState('');
  const [frontImg, setFrontImg] = useState<string | null>(user.aadhaarFront || null);
  const [backImg, setBackImg] = useState<string | null>(user.aadhaarBack || null);
  const [selfieImg, setSelfieImg] = useState<string | null>(user.selfie || null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!open || step !== 3) {
      stopCamera();
      setCameraError(null);
    }
  }, [open, step]);

  useEffect(() => {
    if (!cameraOpen || step !== 3) return;

    let cancelled = false;

    const startCamera = async () => {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError('Unable to open the camera. Please allow camera access and try again.');
        setCameraOpen(false);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraOpen, step]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifying(true);
    setTimeout(() => {
      const url = URL.createObjectURL(file);
      if (type === 'front') setFrontImg(url);
      if (type === 'back') setBackImg(url);
      if (type === 'selfie') setSelfieImg(url);

      setIsVerifying(false);
    }, 1000);
  };

  const openSelfieCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This device does not support camera capture in the browser.');
      return;
    }

    setSelfieImg(null);
    setCameraOpen(true);
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is still loading. Please wait a moment and try again.');
      return;
    }

    setIsVerifying(true);
    setCameraError(null);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsVerifying(false);
      setCameraError('Could not capture the selfie. Please try again.');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.92);

    if (!image || image === 'data:,') {
      setIsVerifying(false);
      setCameraError('Please capture a clearer selfie and try again.');
      return;
    }

    setTimeout(() => {
      setSelfieImg(image);
      setIsVerifying(false);
      stopCamera();
    }, 500);
  };

  const handleNext = () => {
    if (step < 3) setStep((s) => s + 1);
    else if (step === 3) {
      onVerify({
        aadhaarVerified: true,
        selfieVerified: true,
        isVerified: true,
        aadhaarNumber: `XXXX XXXX ${aadhaar.slice(-4)}`,
        aadhaarFront: frontImg,
        aadhaarBack: backImg,
        selfie: selfieImg,
      });
      setStep(4);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={step < 4 ? 'ID Verification' : 'Verified'}>
      <div className="pb-4">
        {step < 4 && (
          <div className="flex gap-1 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-slate-200 dark:bg-dark-600'}`} />
            ))}
          </div>
        )}

        {step === 4 ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 mb-4">
              <Shield size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Identity Verified!</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">Your Aadhaar and Selfie matching is complete. You have Level 3 access to all jobs.</p>

            <div className="w-full bg-slate-50 dark:bg-dark-700 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-dark-600 flex flex-col gap-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400 uppercase">Aadhaar</span>
                <span className="text-slate-900 dark:text-white">{user.aadhaarNumber || 'Verified'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400 uppercase">Status</span>
                <span className="text-emerald-600">Active</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <Button fullWidth onClick={onClose}>Done</Button>
              <button
                onClick={onReset}
                className="text-xs font-bold text-red-500 hover:text-red-600 py-3 border border-dashed border-red-200 dark:border-red-900/50 rounded-xl mt-2 transition-colors active:scale-98"
              >
                Reset Verification (Demo Mode)
              </button>
            </div>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100">
                  <p className="text-xs font-bold text-primary-900 dark:text-primary-300">Step 1: Aadhaar Front</p>
                  <p className="text-[11px] text-primary-600 mt-0.5">Enter Aadhaar number and upload front side.</p>
                </div>
                <Input
                  label="Aadhaar Number"
                  placeholder="0000 0000 0000"
                  maxLength={12}
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                />
                <div className="aspect-[1.6/1] w-full bg-slate-50 dark:bg-dark-700 rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-600 flex flex-col items-center justify-center overflow-hidden group">
                  {frontImg ? (
                    <img src={frontImg} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="text-slate-400 group-hover:text-primary-500 transition-colors" size={32} />
                      <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Upload Aadhaar Front</p>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'front')} disabled={isVerifying} />
                    <Button variant="outline" fullWidth className="pointer-events-none flex items-center justify-center gap-2"><Camera size={16} /> Camera</Button>
                  </div>
                  <div className="relative flex-1">
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'front')} disabled={isVerifying} />
                    <Button variant="outline" fullWidth className="pointer-events-none flex items-center justify-center gap-2"><Upload size={16} /> Storage</Button>
                  </div>
                </div>
                <Button fullWidth onClick={handleNext} disabled={aadhaar.length !== 12 || !frontImg || isVerifying}>
                  {isVerifying ? 'Uploading...' : 'Continue'}
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100">
                  <p className="text-xs font-bold text-primary-900 dark:text-primary-300">Step 2: Aadhaar Back</p>
                  <p className="text-[11px] text-primary-600 mt-0.5">Upload the reverse side of your Aadhaar card.</p>
                </div>
                <div className="aspect-[1.6/1] w-full bg-slate-50 dark:bg-dark-700 rounded-2xl border-2 border-dashed border-slate-200 dark:border-dark-600 flex flex-col items-center justify-center overflow-hidden group">
                  {backImg ? (
                    <img src={backImg} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="text-slate-400 group-hover:text-primary-500 transition-colors" size={32} />
                      <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Upload Aadhaar Back</p>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'back')} disabled={isVerifying} />
                    <Button variant="outline" fullWidth className="pointer-events-none flex items-center justify-center gap-2"><Camera size={16} /> Camera</Button>
                  </div>
                  <div className="relative flex-1">
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileChange(e, 'back')} disabled={isVerifying} />
                    <Button variant="outline" fullWidth className="pointer-events-none flex items-center justify-center gap-2"><Upload size={16} /> Storage</Button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setStep(1)}>Back</Button>
                  <Button fullWidth onClick={handleNext} disabled={!backImg || isVerifying}>
                    {isVerifying ? 'Uploading...' : 'Continue'}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Step 3: Live Selfie</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Open the front camera and capture a clear selfie to match your ID photo.</p>
                </div>
                <div className="aspect-square w-48 mx-auto bg-slate-50 dark:bg-dark-700 rounded-full border-2 border-dashed border-slate-200 dark:border-dark-600 flex flex-col items-center justify-center overflow-hidden group">
                  {cameraOpen ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  ) : selfieImg ? (
                    <img src={selfieImg} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="text-slate-400 group-hover:text-primary-500 transition-colors" size={32} />
                      <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase">Take Selfie</p>
                    </>
                  )}
                </div>
                {cameraError && (
                  <p className="text-xs font-bold text-red-500 text-center">{cameraError}</p>
                )}
                <div className="flex gap-3 mt-2">
                  {!cameraOpen ? (
                    <Button variant="outline" fullWidth onClick={openSelfieCamera} disabled={isVerifying} className="flex items-center justify-center gap-2">
                      <Camera size={16} />
                      {selfieImg ? 'Retake Selfie' : 'Camera'}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" fullWidth onClick={stopCamera}>Close Camera</Button>
                      <Button fullWidth onClick={captureSelfie} disabled={isVerifying}>Capture Selfie</Button>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setStep(2)}>Back</Button>
                  <Button fullWidth onClick={handleNext} disabled={!selfieImg || isVerifying || cameraOpen}>
                    {isVerifying ? 'Finalizing...' : 'Complete KYC'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
// Main Profile Page
export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout, setUser, refreshUser, updateProfile } = useAuthStore();
  const { addToast } = useUIStore();

  const [modal, setModal] = useState<null | 'edit' | 'skills' | 'settings' | 'help' | 'verify'>(null);

  // Live profile stats states (Items 6, 7, 8, 10)
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [jobsPostedCount, setJobsPostedCount] = useState<number | null>(null);
  const [gigsDone, setGigsDone] = useState<number | null>(null);
  const [totalEarned, setTotalEarned] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (!user) return false;
    try {
      return localStorage.getItem(`kyc_banner_dismissed_${user.id}`) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      // Item 8: Check kyc_notification_seen from DB profile
      try {
        const { data: profData } = await supabase
          .from('profiles')
          .select('kyc_notification_seen')
          .eq('id', user.id)
          .maybeSingle();
        if (profData?.kyc_notification_seen) {
          setBannerDismissed(true);
        }
      } catch {}

      if (user.role === 'employer') {
        // Item 6: Employer "JOBS POSTED" count
        try {
          const { count } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('employer_id', user.id);
          setJobsPostedCount(count ?? 0);
        } catch {}

        // Item 7: Employer Average Rating from employer_ratings
        try {
          const { data } = await supabase
            .from('employer_ratings')
            .select('rating')
            .eq('employer_id', user.id);
          if (data && data.length > 0) {
            const avg = data.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / data.length;
            setLiveRating(Number(avg.toFixed(1)));
          } else {
            setLiveRating(null);
          }
        } catch {}
      } else {
        // Item 10: Worker Average Rating from job_ratings
        try {
          const { data } = await supabase
            .from('job_ratings')
            .select('rating')
            .eq('worker_id', user.id);
          if (data && data.length > 0) {
            const avg = data.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / data.length;
            setLiveRating(Number(avg.toFixed(1)));
          } else {
            setLiveRating(null);
          }
        } catch {}

        // Item 7: Gigs Done Count
        try {
          const { data } = await supabase
            .from('applications')
            .select('id, jobs!inner(status)')
            .eq('worker_id', user.id)
            .in('status', ['hired', 'confirmed', 'completed'])
            .eq('jobs.status', 'completed');
          if (data) setGigsDone(data.length);
        } catch {}

        // Item 8: Earned amount
        try {
          const { data } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user.id)
            .eq('type', 'credit')
            .eq('status', 'success');
          if (data) {
            const sum = data.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
            setTotalEarned(sum);
          }
        } catch {}
      }
    })();
  }, [user?.id, user?.role]);

  if (!user) return null;

  const handleSaveProfile = async (data: any) => {
    try {
      await updateProfile(data);
      setModal(null);
      addToast('Profile updated successfully! ✓', 'success');
    } catch {
      addToast('Failed to update profile', 'error');
    }
  };

  const handleVerification = async () => {
    await refreshUser();
    setModal(null);
    setSearchParams({});
    addToast('KYC submitted successfully. Waiting for admin approval.', 'success');
  };

  const handleResetVerification = () => {
    setUser({
      ...user,
      isVerified: false,
      isApproved: false,
      aadhaarVerified: false,
      selfieVerified: false,
      aadhaarNumber: undefined,
      aadhaarFront: undefined,
      aadhaarBack: undefined,
      panNumber: undefined,
      panFront: undefined,
      panBack: undefined,
      selfie: undefined,
      kycStatus: 'not_started',
      kycSubmittedAt: undefined,
      kycReviewedAt: undefined,
      kycRejectionReason: undefined
    });
    setModal(null);
    addToast('KYC verification reset for demo! 🛡️', 'info');
  };

  return (
    <div className="pb-24">
      {/* Profile Header Block */}
      <div className="bg-gradient-to-br from-primary-600 to-indigo-700 pt-12 pb-24 px-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
        <h1 className="text-2xl font-black text-white relative z-10">Profile</h1>
      </div>

      <div className="px-5 -mt-16 relative z-10">

        {/* ── KYC Status Banner ── */}
        {!(user.isApproved && bannerDismissed) && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            onClick={() => {
              if (user.kycStatus === 'not_started' || user.kycStatus === 'rejected') navigate('/kyc');
            }}
            className={`mb-4 rounded-2xl p-4 flex items-center gap-4 ${
              user.kycStatus === 'not_started' || user.kycStatus === 'rejected' ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
            } ${
              user.isApproved
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50'
                : user.kycStatus === 'submitted'
                ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/50'
                : user.kycStatus === 'rejected'
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              user.isApproved ? 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600'
              : user.kycStatus === 'submitted' ? 'bg-sky-100 dark:bg-sky-800/50 text-sky-600'
              : user.kycStatus === 'rejected' ? 'bg-red-100 dark:bg-red-800/50 text-red-600'
              : 'bg-amber-100 dark:bg-amber-800/50 text-amber-600'
            }`}>
              <Shield size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm ${
                user.isApproved ? 'text-emerald-900 dark:text-emerald-300'
                : user.kycStatus === 'submitted' ? 'text-sky-900 dark:text-sky-300'
                : user.kycStatus === 'rejected' ? 'text-red-900 dark:text-red-300'
                : 'text-amber-900 dark:text-amber-300'
              }`}>
                {user.isApproved ? 'Identity Verified'
                  : user.kycStatus === 'submitted' ? 'KYC Under Review'
                  : user.kycStatus === 'rejected' ? 'KYC Rejected — Retry'
                  : 'Complete KYC to Unlock Jobs'}
              </p>
              <p className={`text-[11px] font-medium mt-0.5 ${
                user.isApproved ? 'text-emerald-700 dark:text-emerald-500'
                : user.kycStatus === 'submitted' ? 'text-sky-700 dark:text-sky-500'
                : user.kycStatus === 'rejected' ? 'text-red-700 dark:text-red-500'
                : 'text-amber-700 dark:text-amber-500'
              }`}>
                {user.isApproved ? 'Aadhaar & selfie approved — full access unlocked'
                  : user.kycStatus === 'submitted' ? 'Awaiting admin approval, usually within 24 hours'
                  : user.kycStatus === 'rejected' ? (user.kycRejectionReason || 'Tap to correct and resubmit documents')
                  : 'Tap here to submit your Aadhaar & take a selfie'}
              </p>
            </div>
            {(user.kycStatus === 'not_started' || user.kycStatus === 'rejected') && (
              <ChevronRight size={18} className={user.kycStatus === 'rejected' ? 'text-red-400' : 'text-amber-400'} />
            )}
            {user.kycStatus === 'submitted' && (
              <span className="text-[10px] font-black text-sky-600 bg-sky-100 dark:bg-sky-800/50 px-2.5 py-1 rounded-full flex-shrink-0">Pending</span>
            )}
            {user.isApproved && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    localStorage.setItem(`kyc_banner_dismissed_${user.id}`, 'true');
                    await supabase.from('profiles').update({ kyc_notification_seen: true }).eq('id', user.id);
                  } catch {}
                  setBannerDismissed(true);
                }}
                className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center hover:bg-emerald-200 transition-colors flex-shrink-0"
                title="Dismiss notification"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-dark-700 rounded-3xl p-5 shadow-card-lg border border-slate-100 dark:border-dark-600 mb-6">
          <div className="flex gap-4">
            <Avatar src={user.selfie} name={user.name} size="xl" verified={user.isVerified} />
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{user.name}</h2>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {user.role === 'employer' ? (user.companyName || 'Business Owner') : (user.categories?.length ? user.categories[0] : 'Member')}
                  </p>
                  <p className="text-[10px] font-mono font-bold text-slate-400 mb-1">{displayIdForRole(user.id, user.role)}</p>
                </div>
                <button
                  onClick={() => setModal('edit')}
                  className="w-8 h-8 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 hover:bg-primary-100 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold mt-2">
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300"><MapPin size={12} /> {user.city}</span>
                <span className="flex items-center gap-1 text-amber-500"><Star size={12} fill="currentColor" /> {liveRating !== null ? `★ ${liveRating}` : 'No ratings yet'}</span>
              </div>
            </div>
          </div>

          {/* Bio if available */}
          {user.bio && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-dark-600 leading-relaxed">
              {user.bio}
            </p>
          )}

          <div className={`grid ${user.role === 'employer' ? 'grid-cols-3' : 'grid-cols-4'} gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-dark-600`}>
            {user.role === 'employer' ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{jobsPostedCount !== null ? jobsPostedCount : (user.totalJobsPosted ?? 0)}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Jobs Posted</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{liveRating !== null ? `★ ${liveRating}` : 'No ratings yet'}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{user.creditPoint}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Credit Points</p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{gigsDone !== null ? gigsDone : (user.completedJobs ?? 0)}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gigs Done</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{liveRating !== null ? `★ ${liveRating}` : 'No ratings yet'}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{(totalEarned !== null ? totalEarned : (user.totalEarnings || 0)) >= 1000 ? `${((totalEarned !== null ? totalEarned : (user.totalEarnings || 0)) / 1000).toFixed(1)}k` : (totalEarned !== null ? totalEarned : (user.totalEarnings || 0))}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Earned</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900 dark:text-white">{user.creditPoint}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Credit Points</p>
                </div>
              </>
            )}
          </div>
        </motion.div>


        {/* Menu Items */}
        <div className="flex flex-col gap-3 mb-8">
          {[
            {
              id: 'my-jobs', label: user.role === 'employer' ? 'My Job Postings' : 'My Jobs & Applications', icon: Briefcase,
              color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-500/10',
              sub: user.role === 'employer' ? 'Manage posted requirements' : 'View active & past jobs',
              onClick: () => navigate(user.role === 'employer' ? '/jobs?tab=postings' : '/jobs?tab=applications')
            },
            ...(user.role === 'worker' ? [{
              id: 'skills', label: 'Skills & Categories', icon: Award,
              color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10',
              sub: user.skills?.slice(0, 2).join(', ') || 'Add your skills',
              onClick: () => setModal('skills')
            }] : []),
            {
              id: 'wallet', label: 'Wallet & Bank Details', icon: Shield,
              color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10',
              sub: 'View balance & transactions',
              onClick: () => navigate('/wallet')
            },
            {
              id: 'notifications', label: 'Notifications', icon: Bell,
              color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10',
              sub: 'Job alerts & updates',
              onClick: () => navigate('/notifications')
            },
            {
              id: 'settings', label: 'App Settings', icon: Settings,
              color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-500/10',
              sub: 'Dark mode, notifications',
              onClick: () => setModal('settings')
            },
            {
              id: 'help', label: 'Help & Support', icon: HelpCircle,
              color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10',
              sub: 'FAQs & live chat',
              onClick: () => setModal('help')
            },
          ].map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.onClick}
              className="flex items-center gap-4 bg-white dark:bg-dark-700 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-600 w-full text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg} ${item.color} flex-shrink-0`}>
                <item.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block font-bold text-slate-800 dark:text-white text-sm">{item.label}</span>
                <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{item.sub}</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
            </motion.button>
          ))}
        </div>

        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-extrabold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors active:scale-95"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence mode="wait">
        {modal === 'edit' && (
          <EditProfileModal 
            key="edit" 
            user={user} 
            open={modal === 'edit'} 
            onClose={() => setModal(null)} 
            onSave={handleSaveProfile} 
          />
        )}
        {modal === 'skills' && (
          <SkillsModal 
            key="skills" 
            user={user} 
            open={modal === 'skills'} 
            onClose={() => setModal(null)} 
          />
        )}
        {modal === 'settings' && (
          <SettingsModal key="settings" open={modal === 'settings'} onClose={() => setModal(null)} />
        )}
        {modal === 'help' && (
          <HelpModal key="help" open={modal === 'help'} onClose={() => setModal(null)} />
        )}
        {modal === 'verify' && (
          <VerificationModal 
            key="verify" 
            user={user} 
            open={modal === 'verify'} 
            onClose={() => setModal(null)} 
            onVerify={handleVerification} 
            onReset={handleResetVerification}
          />
        )}
      </AnimatePresence>
    </div>
  );
}





