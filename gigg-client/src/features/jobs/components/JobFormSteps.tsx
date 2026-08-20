import React from 'react';
import { Input, Select, Toggle, Textarea, TimeInput } from '../../../components/ui';
import { Info, MapPin, Calculator } from 'lucide-react';
import { JOB_CATEGORIES, parseDosAndDonts, formatDosAndDonts } from '../constants';
import { LocationPicker } from './LocationPicker';

export interface JobFormState {
  title: string;
  category: string;
  workersNeeded: number;
  payPerWorker: string;
  date: string;
  reportingTime: string;
  endTime: string;
  location: string;
  address: string;
  description: string;
  food: boolean;
  dressCode: string;
  gender: string;
  natureOfWork: string;
  clientName: string;
  clientId: string;
  needLocationBasedWorkers: boolean;
  modeOfPayment: string;
  paymentDate: string;
  dosAndDonts: string;
}

export interface JobFormSetters {
  setTitle: (v: string) => void;
  setCategory: (v: string) => void;
  setWorkersNeeded: (v: number) => void;
  setPayPerWorker: (v: string) => void;
  setDate: (v: string) => void;
  setReportingTime: (v: string) => void;
  setEndTime: (v: string) => void;
  setLocation: (v: string) => void;
  setAddress: (v: string) => void;
  setDescription: (v: string) => void;
  setFood: (v: boolean) => void;
  setDressCode: (v: string) => void;
  setGender: (v: string) => void;
  setNatureOfWork: (v: string) => void;
  setClientName: (v: string) => void;
  setClientId: (v: string) => void;
  setNeedLocationBasedWorkers: (v: boolean) => void;
  setModeOfPayment: (v: string) => void;
  setPaymentDate: (v: string) => void;
  setDosAndDonts: (v: string) => void;
}

interface JobFormStepsProps {
  step: 1 | 2 | 3;
  state: JobFormState;
  setters: JobFormSetters;
}

const CATEGORY_HINTS: Record<string, string> = {
  'Catering': 'e.g. Wedding servers, buffet waitstaff, banquet crew',
  'Pamphlet Dist.': 'e.g. Flyer team, area distributors, ground deployment',
  'Survey': 'e.g. Door-to-door surveyors, feedback collection',
  'Event Staff': 'e.g. Ushers, crowd management, registration desk',
  'Promotion': 'e.g. Brand ambassadors, product sampling, roadshows',
  'Delivery': 'e.g. Last-mile delivery, courier runs',
  'Data Entry': 'e.g. Form digitization, spreadsheet entry',
};

const CATEGORY_DRESS_CODE: Record<string, string> = {
  'Catering': 'Formal (White shirt, Black trousers)',
  'Pamphlet Dist.': 'Casual',
};

export function JobFormSteps({ step, state, setters }: JobFormStepsProps) {
  const categoryHint = CATEGORY_HINTS[state.category] || '';

  const handleCategoryChange = (val: string) => {
    setters.setCategory(val);
    if (CATEGORY_DRESS_CODE[val]) setters.setDressCode(CATEGORY_DRESS_CODE[val]);
  };

  const totalCost = state.workersNeeded * (Number(state.payPerWorker) || 0);
  const platformFee = totalCost * 0.10;
  const totalPayable = totalCost + platformFee;

  if (step === 1) {
    return (
      <>
        <Input label="Job Title *" placeholder={state.category ? categoryHint : 'e.g. Wedding Catering Staff'} value={state.title} onChange={e => setters.setTitle(e.target.value)} />
        <Input label="Nature of work *" placeholder="e.g. Serving food to guests" value={state.natureOfWork} onChange={e => setters.setNatureOfWork(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Client Name" placeholder="e.g. Rajesh Kumar" value={state.clientName} onChange={e => setters.setClientName(e.target.value)} />
          <Input label="Client ID" placeholder="e.g. CLI-9021" value={state.clientId} onChange={e => setters.setClientId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Select
            label="Category *"
            value={state.category}
            onChange={e => handleCategoryChange(e.target.value)}
            options={[
              { value: '', label: 'Select a category' },
              ...JOB_CATEGORIES.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` })),
            ]}
          />
          {categoryHint && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-1">{categoryHint}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Workers Needed *" type="number" min="1" value={state.workersNeeded} onChange={e => setters.setWorkersNeeded(Number(e.target.value))} />
          <Input label="Pay per Worker (₹) *" type="number" placeholder="500" value={state.payPerWorker} onChange={e => setters.setPayPerWorker(e.target.value)} />
        </div>

        <div className="bg-primary-50 dark:bg-primary-900/10 rounded-2xl p-4 border border-primary-100 dark:border-primary-900/30">
          <div className="flex items-center gap-2 mb-2 text-primary-700 dark:text-primary-400 font-bold text-sm">
            <Calculator size={16} /> Estimated Cost
          </div>
          <div className="flex justify-between items-center text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span>{state.workersNeeded} workers × ₹{state.payPerWorker || 0}</span>
            <span>₹{totalCost}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            <span>Platform Fee (10%)</span>
            <span>₹{platformFee}</span>
          </div>
          <div className="h-px bg-primary-200 dark:bg-primary-800/50 my-2" />
          <div className="flex justify-between items-center font-black">
            <span className="text-slate-900 dark:text-white">Total Payable</span>
            <span className="text-lg text-primary-600 dark:text-primary-400">₹{totalPayable}</span>
          </div>
        </div>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <Input label="Date *" type="date" value={state.date} onChange={e => setters.setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <TimeInput label="Reporting Time" required value={state.reportingTime} onChange={v => setters.setReportingTime(v)} />
          <TimeInput label="End Time" value={state.endTime} onChange={v => setters.setEndTime(v)} />
        </div>
        <Input label="City/Area *" placeholder="e.g. Bandra West, Mumbai" value={state.location} onChange={e => setters.setLocation(e.target.value)} leftIcon={<MapPin size={16} />} />
        <LocationPicker value={state.address} onChange={setters.setAddress} />
        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-100 dark:border-dark-600 mt-2">
          <Toggle checked={state.needLocationBasedWorkers} onChange={setters.setNeedLocationBasedWorkers} label="Need Location based workers?" />
        </div>
      </>
    );
  }

  return (
    <>
      <Textarea label="Job Description *" placeholder="Detail what the workers need to do..." rows={5} value={state.description} onChange={e => setters.setDescription(e.target.value)} />
      {(() => {
        const { dos, donts } = parseDosAndDonts(state.dosAndDonts);
        return (
          <>
            <Textarea label="Do's" placeholder="e.g. Arrive 15 mins early. Wear the provided uniform." rows={3} value={dos} onChange={e => setters.setDosAndDonts(formatDosAndDonts(e.target.value, donts))} />
            <Textarea label="Don'ts" placeholder="e.g. Don't use phones during service. Don't leave the venue without checkout." rows={3} value={donts} onChange={e => setters.setDosAndDonts(formatDosAndDonts(dos, e.target.value))} />
          </>
        );
      })()}
      <Select label="Mode of Payment" value={state.modeOfPayment} onChange={e => setters.setModeOfPayment(e.target.value)} options={[
        { value: 'Online', label: 'Online' },
        { value: 'Cash', label: 'Cash' },
        { value: 'Wallet', label: 'Wallet' },
      ]} />
      <Input label="Payment Date" type="date" value={state.paymentDate} onChange={e => setters.setPaymentDate(e.target.value)} />
      <Select label="Dress Code" value={state.dressCode} onChange={e => setters.setDressCode(e.target.value)} options={[
        { value: 'Casual', label: 'Casual' },
        { value: 'Formal (Black & White)', label: 'Formal (Black & White)' },
        { value: 'Uniform Provided', label: 'Uniform Provided at venue' },
      ]} />
      <Select label="Gender Preference" value={state.gender} onChange={e => setters.setGender(e.target.value)} options={[
        { value: 'any', label: 'Any' },
        { value: 'male', label: 'Male Only' },
        { value: 'female', label: 'Female Only' },
      ]} />
      <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
        <Toggle checked={state.food} onChange={setters.setFood} label="Food provided at venue" />
      </div>
      <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
        <Info size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs font-medium text-amber-800 dark:text-amber-400">Payment will be held in escrow and released to workers only after successful completion verified via OTP.</p>
      </div>
    </>
  );
}
