import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Clock,
  Sparkles,
  Utensils,
  ChefHat,
  FileText,
  Layers,
  Trash2,
  CheckCircle,
  AlertCircle,
  Check
} from 'lucide-react';

export interface OnboardingData {
  status: 'Student' | 'Working Professional' | null;
  commitment: 'Full-time' | 'Part-time' | null;
  categories: string[];
}

interface OnboardingQuestionsProps {
  role: 'worker' | 'employer';
  onBack: () => void;
  onComplete: (data: OnboardingData) => void;
}

const CATEGORY_OPTIONS = [
  {
    id: 'catering',
    title: 'Catering Staff',
    subtitle: 'Buffet management, food serving & event dining support',
    icon: Utensils,
  },
  {
    id: 'kitchen_help',
    title: 'Kitchen Help / Cooking Assistant',
    subtitle: 'Prepping ingredients, cooking assistance & kitchen maintenance',
    icon: ChefHat,
  },
  {
    id: 'pamphlet',
    title: 'Pamphlet/Flyer Distribution',
    subtitle: 'Field marketing, flyer handing out & promotion campaign support',
    icon: FileText,
  },
  {
    id: 'event_setup',
    title: 'Event Setup & Decoration',
    subtitle: 'Stage assembly, lighting decoration & venue arrangement',
    icon: Layers,
  },
  {
    id: 'event_cleanup',
    title: 'Event Cleanup Crew',
    subtitle: 'Post-event dismantle, waste sorting & venue restoration',
    icon: Trash2,
  },
];

export function OnboardingQuestions({ role, onBack, onComplete }: OnboardingQuestionsProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<'Student' | 'Working Professional' | null>(null);
  const [commitment, setCommitment] = useState<'Full-time' | 'Part-time' | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEmployer = role === 'employer';
  const accentColor = isEmployer ? '#2563EB' : '#22C55E';
  const accentRgb = isEmployer ? '37,99,235' : '34,197,94';

  const handleNextStep1 = (selectedStatus: 'Student' | 'Working Professional') => {
    setStatus(selectedStatus);
    setValidationError(null);
    setStep(2);
  };

  const handleNextStep2 = (selectedCommitment: 'Full-time' | 'Part-time') => {
    setCommitment(selectedCommitment);
    setValidationError(null);
    setStep(3);
  };

  const toggleCategory = (catTitle: string) => {
    if (selectedCategories.includes(catTitle)) {
      setValidationError(null);
      setSelectedCategories(selectedCategories.filter((c) => c !== catTitle));
    } else {
      if (selectedCategories.length >= 3) {
        setValidationError('You can select up to 3 categories only. Deselect one to choose another.');
        return;
      }
      setValidationError(null);
      setSelectedCategories([...selectedCategories, catTitle]);
    }
  };

  const handleFinish = () => {
    if (selectedCategories.length !== 3) {
      setValidationError(`Please select exactly 3 categories to continue (currently ${selectedCategories.length} selected).`);
      return;
    }
    setValidationError(null);
    onComplete({
      status,
      commitment,
      categories: selectedCategories,
    });
  };

  const handleHeaderBack = () => {
    setValidationError(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else onBack();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
      style={{ backgroundColor: '#01133b' }}
    >
      {/* Decorative background glow circles matching Login As screen */}
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor}, transparent)`,
          transform: 'translate(30%, -30%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor}, transparent)`,
          transform: 'translate(-30%, 30%)',
        }}
      />

      <div className="w-full max-w-md mx-auto relative z-10 flex-1 flex flex-col justify-between">
        {/* Top Bar with Back button & Stepper Progress */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleHeaderBack}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/20 active:scale-95"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest uppercase text-white/60">
                Step {step} of 3
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-6 flex">
            <motion.div
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: accentColor,
                width: step === 1 ? '33.3%' : step === 2 ? '66.6%' : '100%',
              }}
            />
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="my-auto py-4"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                  Are you a Student or a Working Professional?
                </h2>
                <p className="text-white/60 text-xs sm:text-sm font-medium">
                  Select your current occupational status
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Option 1: Student */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNextStep1('Student')}
                  className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: status === 'Student' ? `rgba(${accentRgb}, 0.15)` : 'rgba(255,255,255,0.05)',
                    border: status === 'Student' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: status === 'Student' ? `0 4px 20px rgba(${accentRgb}, 0.25)` : 'none',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ backgroundColor: status === 'Student' ? accentColor : 'rgba(255,255,255,0.1)' }}
                  >
                    <GraduationCap size={26} color={status === 'Student' ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-white">Student</h3>
                    <p className="text-white/50 text-xs font-medium mt-0.5">
                      Enrolled in school, college, or university
                    </p>
                  </div>
                  {status === 'Student' ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Check size={16} color="#FFFFFF" />
                    </div>
                  ) : (
                    <ArrowRight size={20} color="rgba(255,255,255,0.3)" />
                  )}
                </motion.button>

                {/* Option 2: Working Professional */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNextStep1('Working Professional')}
                  className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: status === 'Working Professional' ? `rgba(${accentRgb}, 0.15)` : 'rgba(255,255,255,0.05)',
                    border: status === 'Working Professional' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: status === 'Working Professional' ? `0 4px 20px rgba(${accentRgb}, 0.25)` : 'none',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ backgroundColor: status === 'Working Professional' ? accentColor : 'rgba(255,255,255,0.1)' }}
                  >
                    <Briefcase size={26} color={status === 'Working Professional' ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-white">Working Professional</h3>
                    <p className="text-white/50 text-xs font-medium mt-0.5">
                      Employed or working in a job / enterprise
                    </p>
                  </div>
                  {status === 'Working Professional' ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Check size={16} color="#FFFFFF" />
                    </div>
                  ) : (
                    <ArrowRight size={20} color="rgba(255,255,255,0.3)" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="my-auto py-4"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                  Full-time or Part-time?
                </h2>
                <p className="text-white/60 text-xs sm:text-sm font-medium">
                  Select your work commitment preference
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Option 1: Full-time */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNextStep2('Full-time')}
                  className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: commitment === 'Full-time' ? `rgba(${accentRgb}, 0.15)` : 'rgba(255,255,255,0.05)',
                    border: commitment === 'Full-time' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: commitment === 'Full-time' ? `0 4px 20px rgba(${accentRgb}, 0.25)` : 'none',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ backgroundColor: commitment === 'Full-time' ? accentColor : 'rgba(255,255,255,0.1)' }}
                  >
                    <Clock size={26} color={commitment === 'Full-time' ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-white">Full-time</h3>
                    <p className="text-white/50 text-xs font-medium mt-0.5">
                      Dedicated full-time shifts and engagement
                    </p>
                  </div>
                  {commitment === 'Full-time' ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Check size={16} color="#FFFFFF" />
                    </div>
                  ) : (
                    <ArrowRight size={20} color="rgba(255,255,255,0.3)" />
                  )}
                </motion.button>

                {/* Option 2: Part-time */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNextStep2('Part-time')}
                  className="w-full p-5 rounded-2xl text-left flex items-center gap-4 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: commitment === 'Part-time' ? `rgba(${accentRgb}, 0.15)` : 'rgba(255,255,255,0.05)',
                    border: commitment === 'Part-time' ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: commitment === 'Part-time' ? `0 4px 20px rgba(${accentRgb}, 0.25)` : 'none',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ backgroundColor: commitment === 'Part-time' ? accentColor : 'rgba(255,255,255,0.1)' }}
                  >
                    <Sparkles size={26} color={commitment === 'Part-time' ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-white">Part-time</h3>
                    <p className="text-white/50 text-xs font-medium mt-0.5">
                      Flexible hours, per-gig work, or weekend shifts
                    </p>
                  </div>
                  {commitment === 'Part-time' ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Check size={16} color="#FFFFFF" />
                    </div>
                  ) : (
                    <ArrowRight size={20} color="rgba(255,255,255,0.3)" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="my-auto py-2"
            >
              <div className="text-center mb-5">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1.5">
                  Select your skills/category (choose 3)
                </h2>
                <p className="text-white/60 text-xs sm:text-sm font-medium">
                  Choose <strong className="text-white">exactly 3</strong> categories to continue
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-white">
                  <span>Selected: {selectedCategories.length} / 3</span>
                  {selectedCategories.length === 3 && <CheckCircle size={14} className="text-emerald-400" />}
                </div>
              </div>

              {/* Validation warning banner */}
              {validationError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-2.5"
                >
                  <AlertCircle size={18} className="text-amber-400 flex-shrink-0" />
                  <span>{validationError}</span>
                </motion.div>
              )}

              {/* 5 Categories Grid */}
              <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {CATEGORY_OPTIONS.map((cat) => {
                  const IconComp = cat.icon;
                  const isSelected = selectedCategories.includes(cat.title);
                  const isDisabled = !isSelected && selectedCategories.length >= 3;

                  return (
                    <motion.button
                      key={cat.id}
                      whileHover={isDisabled ? {} : { scale: 1.01 }}
                      whileTap={isDisabled ? {} : { scale: 0.98 }}
                      onClick={() => toggleCategory(cat.title)}
                      disabled={isDisabled}
                      className="w-full p-4 rounded-2xl text-left flex items-center gap-3.5 transition-all relative overflow-hidden"
                      style={{
                        backgroundColor: isSelected ? `rgba(${accentRgb}, 0.15)` : 'rgba(255,255,255,0.05)',
                        border: isSelected ? `2px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.12)',
                        boxShadow: isSelected ? `0 4px 16px rgba(${accentRgb}, 0.2)` : 'none',
                        opacity: isDisabled ? 0.4 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ backgroundColor: isSelected ? accentColor : 'rgba(255,255,255,0.1)' }}
                      >
                        <IconComp size={22} color={isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.8)'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-extrabold text-white truncate">{cat.title}</h4>
                        <p className="text-white/50 text-[11px] font-medium leading-tight mt-0.5 truncate">
                          {cat.subtitle}
                        </p>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center border transition-all flex-shrink-0"
                        style={{
                          backgroundColor: isSelected ? accentColor : 'transparent',
                          borderColor: isSelected ? accentColor : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {isSelected && <Check size={14} color="#FFFFFF" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={handleFinish}
                  className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{
                    backgroundColor: accentColor,
                    color: '#FFFFFF',
                    boxShadow: `0 8px 24px rgba(${accentRgb}, 0.4)`,
                  }}
                >
                  Continue <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer trust tagline */}
        <div className="mt-4 text-center py-2">
          <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
            <CheckCircle size={12} />
            <span>Secure. Verified. Reliable.</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
export default OnboardingQuestions;
