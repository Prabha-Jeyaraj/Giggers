import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Badge, Modal, Input } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';
import { useWalletStore } from '../../../store/walletStore';
import { useUIStore } from '../../../store/uiStore';
import { supabase } from '../../../lib/supabase';
import { ArrowUpRight, ArrowDownLeft, Shield, Landmark, History } from 'lucide-react';
import { formatTime12h } from '../../../lib/time';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function Wallet() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { wallet, fetchWallet, createTopUpOrder, verifyTopUp, isLoading } = useWalletStore();
  const { addToast } = useUIStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const { updateProfile } = useAuthStore();

  useEffect(() => {
    if (user) fetchWallet();
  }, [user]);

  const handleAddMoney = async () => {
    const val = Number(amount);
    if (!val || val < 1) { addToast('Enter a valid amount', 'error'); return; }

    setPaying(true);
    try {
      if (!user) throw new Error("Not logged in");

      // Backend now handles the Test Mode top-up directly and securely
      await createTopUpOrder(val);

      // Simulate a small delay for realistic UX
      setTimeout(() => {
        addToast(`₹${val} added to wallet (Test Mode)!`, 'success');
        setShowAddModal(false);
        setAmount('');
        fetchWallet();
        setPaying(false);
      }, 800);
      
    } catch (err: any) {
      addToast(err.message || 'Failed to initiate payment', 'error');
      setPaying(false);
    }
  };

  const handleOpenBankModal = () => {
    setUpiId(user?.upiId || '');
    setBankAccount(user?.bankAccount || '');
    setShowBankModal(true);
  };

  const handleSaveBankDetails = async () => {
    setSavingBank(true);
    try {
      await updateProfile({ upiId: upiId.trim() || undefined, bankAccount: bankAccount.trim() || undefined });
      addToast('Payout details saved', 'success');
      setShowBankModal(false);
    } catch {
      addToast('Failed to save payout details', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  if (!user) return null;

  const balance = wallet?.currentBalance ?? 0;

  return (
    <div className="pb-24 font-sans">
      <AppHeader title="Wallet & Payments" showBack onBack={() => navigate(-1)} />

      <div className="px-5 pt-6 flex flex-col gap-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary-600 to-indigo-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-primary-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="relative z-10">
            <p className="text-white/70 font-bold text-sm mb-1">Available Balance</p>
            <h2 className="text-4xl font-black mb-6">₹{balance.toLocaleString('en-IN')}</h2>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
                onClick={() => { setShowAddModal(true); setAmount(''); }}
              >
                <ArrowDownLeft size={18} /> Add Money
              </Button>
            </div>
          </div>
        </div>

        {/* Linked Account Info */}
        {user.role === 'worker' && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-dark-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 dark:bg-dark-600 rounded-xl flex items-center justify-center text-slate-500">
                <Landmark size={20} />
              </div>
              <div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {user.upiId || user.bankAccount ? 'Payout Details' : 'Linked Bank Account'}
                </p>
                <p className="text-xs font-semibold text-slate-400">
                  {user.upiId ? user.upiId : user.bankAccount ? `A/c ending ${user.bankAccount.slice(-4)}` : 'Add your account for withdrawals'}
                </p>
              </div>
            </div>
            <button onClick={handleOpenBankModal} className="text-xs font-bold text-primary-600 dark:text-primary-400">
              {user.upiId || user.bankAccount ? 'Edit' : 'Setup'}
            </button>
          </div>
        )}

        {/* Transactions */}
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <History size={20} className="text-slate-400" /> Recent Transactions
          </h3>
          {isLoading ? (
            <p className="text-slate-500 text-center py-8">Loading...</p>
          ) : wallet?.transactions?.length ? (
            <div className="flex flex-col gap-3">
              {wallet.transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-dark-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-dark-600 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'credit' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                    }`}>
                      {tx.type === 'credit' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-slate-900 dark:text-white mb-0.5 leading-tight">{tx.description}</p>
                      <p className="text-[10px] font-bold text-slate-400">
                         {tx.date ? new Date(tx.date).toLocaleDateString() : ''} · {tx.date ? formatTime12h(new Date(tx.date)) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-sm ${tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                      {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                    </p>
                    <Badge variant={tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'} className="mt-1 text-[9px] px-1.5 py-0">
                      {tx.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-600">
              <div className="text-4xl mb-3">💳</div>
              <p className="text-sm font-bold text-slate-500">No transactions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Money Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Money">
        <div className="py-2 flex flex-col gap-4">
          <Input
            label="Amount (₹)"
            type="number"
            placeholder="100"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            {[100, 500, 1000, 2000].map(v => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className={`flex-1 min-w-[60px] py-2 rounded-xl text-sm font-bold border transition-all ${
                  amount === String(v)
                    ? 'bg-primary-50 border-primary-500 text-primary-600'
                    : 'border-slate-200 dark:border-dark-500 text-slate-600 dark:text-slate-400'
                }`}
              >
                ₹{v}
              </button>
            ))}
          </div>
          <Button fullWidth size="lg" onClick={handleAddMoney} disabled={paying || !amount}>
            {paying ? 'Processing...' : `Pay ₹${amount || '0'} (Test Mode)`}
          </Button>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-semibold flex items-center justify-center gap-1">
            <Shield size={12} /> Test Payment Mode Enabled
          </p>
        </div>
      </Modal>

      {/* Payout Details Modal (worker only) */}
      <Modal open={showBankModal} onClose={() => setShowBankModal(false)} title="Payout Details">
        <div className="py-2 flex flex-col gap-4">
          <Input
            label="UPI ID"
            placeholder="yourname@bank"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
          />
          <Input
            label="Bank Account Number"
            placeholder="Optional, if no UPI"
            value={bankAccount}
            onChange={e => setBankAccount(e.target.value)}
          />
          <Button fullWidth size="lg" onClick={handleSaveBankDetails} loading={savingBank}>
            Save Payout Details
          </Button>
        </div>
      </Modal>
    </div>
  );
}
