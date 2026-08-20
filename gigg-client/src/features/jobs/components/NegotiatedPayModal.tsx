import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { useUIStore } from '../../../store/uiStore';
import { Coins, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface NegotiatedPayModalProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  workerName: string;
  defaultPay: number;
  currentNegotiatedPay?: number | null;
  onSuccess?: (newPay: number | null) => void;
}

export const NegotiatedPayModal: React.FC<NegotiatedPayModalProps> = ({
  open,
  onClose,
  applicationId,
  workerName,
  defaultPay,
  currentNegotiatedPay,
  onSuccess,
}) => {
  const { updateNegotiatedPay } = useJobStore();
  const { addToast } = useUIStore();
  const [payInput, setPayInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPayInput(currentNegotiatedPay != null ? String(currentNegotiatedPay) : String(defaultPay));
      setError('');
    }
  }, [open, currentNegotiatedPay, defaultPay]);

  const handleSave = async () => {
    const parsed = Number(payInput);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid positive pay amount.');
      return;
    }

    // If entered amount is exactly the default, we can store it as null (standard rate) or the exact number
    const finalPay = parsed === defaultPay ? null : parsed;

    setIsSubmitting(true);
    try {
      await updateNegotiatedPay(applicationId, finalPay);
      addToast(
        finalPay !== null
          ? `Negotiated pay set to ₹${finalPay} for ${workerName}`
          : `Reset pay to standard job rate (₹${defaultPay}) for ${workerName}`,
        'success'
      );
      if (onSuccess) onSuccess(finalPay);
      onClose();
    } catch (err: any) {
      console.error('Failed to update pay override:', err);
      addToast('Failed to update negotiated pay. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToStandard = async () => {
    setIsSubmitting(true);
    try {
      await updateNegotiatedPay(applicationId, null);
      addToast(`Reset pay to standard rate (₹${defaultPay}) for ${workerName}`, 'info');
      if (onSuccess) onSuccess(null);
      onClose();
    } catch (err: any) {
      console.error('Failed to reset pay override:', err);
      addToast('Failed to reset pay rate.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentEnteredNumber = Number(payInput);
  const diff = !isNaN(currentEnteredNumber) ? currentEnteredNumber - defaultPay : 0;

  return (
    <Modal open={open} onClose={onClose} title="Custom Pay Rate">
      <div className="space-y-4 pt-1">
        {/* Worker & Default Info */}
        <div className="bg-slate-50 dark:bg-dark-700 p-3.5 rounded-2xl border border-slate-100 dark:border-dark-600 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Worker</p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">{workerName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Job Base Rate</p>
            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">₹{defaultPay}</p>
          </div>
        </div>

        {/* Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Agreed Pay for {workerName} (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">₹</span>
            <input
              type="number"
              min="1"
              step="1"
              value={payInput}
              onChange={(e) => {
                setPayInput(e.target.value);
                if (error) setError('');
              }}
              placeholder={String(defaultPay)}
              className="w-full pl-8 pr-4 py-3 bg-white dark:bg-dark-800 border-2 border-slate-200 dark:border-dark-600 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          {error ? (
            <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {diff > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">+₹{diff} above base rate</span>
              ) : diff < 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">₹{Math.abs(diff)} below base rate</span>
              ) : (
                <span>Matches job standard rate</span>
              )}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="primary"
            fullWidth
            loading={isSubmitting}
            onClick={handleSave}
            leftIcon={<Check size={16} />}
          >
            Save Negotiated Pay
          </Button>

          {currentNegotiatedPay != null && (
            <Button
              variant="outline"
              fullWidth
              size="sm"
              loading={isSubmitting}
              onClick={handleResetToStandard}
              leftIcon={<RotateCcw size={14} />}
              className="border-slate-300 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-700"
            >
              Reset to Base Rate (₹{defaultPay})
            </Button>
          )}

          <Button
            variant="ghost"
            fullWidth
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
