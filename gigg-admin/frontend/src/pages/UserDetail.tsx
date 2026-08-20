import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Star, Briefcase, Wallet, UserX, UserCheck,
  Shield, CheckCircle, XCircle, ZoomIn, X, FileCheck, Clock,
} from 'lucide-react';
import { Header } from '../components/Header';
import apiClient from '../api/client';
import { Profile, Job, Transaction, KYCDocument } from '../types';

interface UserDetailData {
  profile: Profile;
  recentJobs: Job[];
  recentTransactions: Transaction[];
  kycSubmission: KYCDocument | null;
}

// ─────────────────────────────────────────────────────────────
// Image Lightbox
// ─────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <img
        src={src}
        alt="Document"
        className="max-w-full max-h-[90vh] rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.1)' }}
      >
        <X size={18} style={{ color: '#fff' }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Document Image Tile
// ─────────────────────────────────────────────────────────────

function DocImg({
  label,
  src,
  onZoom,
  round = false,
}: {
  label: string;
  src?: string;
  onZoom: (s: string) => void;
  round?: boolean;
}) {
  if (!src) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</p>
        <div
          style={{
            height: round ? 60 : 56,
            width: round ? 60 : '100%',
            borderRadius: round ? '50%' : 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#475569',
            fontSize: 11,
          }}
        >
          —
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</p>
      <div
        onClick={() => onZoom(src)}
        className="relative cursor-pointer overflow-hidden group"
        style={{
          height: round ? 60 : 56,
          width: round ? 60 : '100%',
          borderRadius: round ? '50%' : 10,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <ZoomIn size={16} style={{ color: '#fff' }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main User Detail Page
// ─────────────────────────────────────────────────────────────

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const reload = () => {
    if (!id) return;
    apiClient.get<UserDetailData>(`/users/${id}`).then((res) => {
      setData(res.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  const handleBan = async () => {
    if (!data || !id) return;
    const isBanned = data.profile.is_banned;
    if (!confirm(`${isBanned ? 'Unban' : 'Ban'} this user?`)) return;
    await apiClient.patch(`/users/${id}/ban`, { banned: !isBanned });
    reload();
  };

  const handleVerify = async () => {
    if (!data || !id) return;
    await apiClient.patch(`/users/${id}`, { is_verified: !data.profile.is_verified });
    reload();
  };

  const handleApproveAccount = async (approve: boolean) => {
    if (!data || !id) return;
    const label = approve ? 'Approve' : 'Reject';
    if (!confirm(`${label} account for ${data.profile.name}?`)) return;
    await apiClient.patch(`/users/${id}/approve`, { approved: approve });
    reload();
  };

  const handleApproveKyc = async () => {
    if (!data?.kycSubmission) return;
    if (!confirm(`Approve KYC for ${data.profile.name}?`)) return;
    try {
      await apiClient.patch(`/kyc/${data.kycSubmission.id}/approve`);
      reload();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Approval failed');
    }
  };

  const handleRejectKyc = async () => {
    if (!data?.kycSubmission) return;
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await apiClient.patch(`/kyc/${data.kycSubmission.id}/reject`, {
        reason: reason || 'Does not meet requirements',
      });
      reload();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Rejection failed');
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="User Detail" />
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Header title="User Not Found" />
        <div className="p-8 text-center" style={{ color: '#64748b' }}>
          User not found or you don't have permission.
        </div>
      </div>
    );
  }

  const { profile, recentJobs, recentTransactions, kycSubmission } = data;

  const kycStatusColor = {
    not_started: '#64748b',
    submitted: '#f59e0b',
    approved: '#34d399',
    rejected: '#f87171',
  }[profile.kyc_status || 'not_started'];

  const kycStatusBadge = {
    not_started: 'badge-neutral',
    submitted: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  }[profile.kyc_status || 'not_started'];

  return (
    <div>
      <Header title="User Detail" subtitle={profile.name} />
      <div className="p-8 max-w-5xl">
        {/* Back */}
        <button onClick={() => navigate('/users')} className="btn-secondary mb-6 py-2 px-4 text-sm">
          <ArrowLeft size={14} /> Back to Users
        </button>

        {/* Profile Card */}
        <div
          className="rounded-2xl p-6 mb-6 flex items-start gap-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Avatar / selfie */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {profile.selfie_url ? (
              <img src={profile.selfie_url} alt="" className="w-full h-full object-cover" />
            ) : (
              profile.name?.[0]?.toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{profile.name}</h2>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                  {profile.email || profile.phone}
                  {profile.company_name && (
                    <span style={{ color: '#818cf8' }}> · {profile.company_name}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`badge ${profile.role === 'worker' ? 'badge-info' : 'badge-success'}`}>
                    {profile.role}
                  </span>
                  <span className={`badge ${kycStatusBadge}`}>
                    KYC: {profile.kyc_status || 'not_started'}
                  </span>
                  {profile.is_approved && <span className="badge badge-success">✓ Approved</span>}
                  {profile.is_banned && <span className="badge badge-danger">Banned</span>}
                  {profile.aadhaar_verified && <span className="badge badge-info">Aadhaar ✓</span>}
                  {profile.selfie_verified && <span className="badge badge-info">Selfie ✓</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {!profile.is_approved && !profile.is_banned && profile.kyc_status !== 'submitted' && (
                  <>
                    <button onClick={() => handleApproveAccount(true)} className="btn-success py-2 px-4">
                      <CheckCircle size={14} /> Approve Account
                    </button>
                    <button onClick={() => handleApproveAccount(false)} className="btn-danger py-2 px-4">
                      <XCircle size={14} /> Reject Account
                    </button>
                  </>
                )}
                {profile.is_banned && (
                  <button onClick={() => handleApproveAccount(true)} className="btn-success py-2 px-4">
                    <CheckCircle size={14} /> Approve & Unban
                  </button>
                )}
                {profile.is_approved && (
                  <button
                    onClick={handleVerify}
                    className={`btn-${profile.is_verified ? 'secondary' : 'success'} py-2 px-4`}
                  >
                    <UserCheck size={14} />
                    {profile.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                  </button>
                )}
                <button onClick={handleBan} className={`btn-danger py-2 px-4 ${profile.is_banned ? 'bg-amber-600 hover:bg-amber-700' : ''}`}>
                  <UserX size={14} />
                  {profile.is_banned ? 'Unban User' : 'Ban User'}
                </button>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { icon: MapPin, label: 'Location', value: `${profile.city}${profile.area ? `, ${profile.area}` : ''}` },
                { icon: Star, label: 'Rating', value: `${profile.rating || 0} ★ (${profile.review_count || 0})` },
                { icon: Briefcase, label: 'Jobs', value: profile.role === 'worker' ? profile.completed_jobs : profile.total_jobs_posted },
                { icon: Wallet, label: 'Earnings', value: `₹${(profile.total_earnings || 0).toLocaleString()}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <Icon size={16} style={{ color: '#818cf8' }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#64748b' }}>{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column: Jobs + Transactions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Recent Jobs */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Briefcase size={15} style={{ color: '#818cf8' }} />
              Recent Jobs ({recentJobs.length})
            </h3>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#475569' }}>No jobs yet</p>
            ) : (
              <ul className="space-y-2">
                {recentJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{job.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                        {new Date(job.created_at).toLocaleDateString()} · {job.category}
                      </p>
                    </div>
                    <span
                      className={`badge badge-${
                        job.status === 'active' ? 'success' :
                        job.status === 'completed' ? 'info' :
                        job.status === 'cancelled' ? 'danger' : 'neutral'
                      }`}
                    >
                      {job.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Transactions */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet size={15} style={{ color: '#34d399' }} />
              Recent Transactions ({recentTransactions.length})
            </h3>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: '#475569' }}>No transactions yet</p>
            ) : (
              <ul className="space-y-2">
                {recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: tx.type === 'credit' ? '#4ade80' : '#f87171' }}>
                        {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{tx.description}</p>
                    </div>
                    <span
                      className={`badge badge-${
                        tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── KYC Submission Section ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield size={15} style={{ color: kycStatusColor }} />
              KYC Submission
            </h3>
            {profile.kyc_status && (
              <span className={`badge ${kycStatusBadge}`}>
                {profile.kyc_status === 'submitted' && <Clock size={11} />}
                {profile.kyc_status === 'approved' && <CheckCircle size={11} />}
                {profile.kyc_status === 'rejected' && <XCircle size={11} />}
                {profile.kyc_status}
              </span>
            )}
          </div>

          {!kycSubmission ? (
            <div className="text-center py-8" style={{ color: '#475569' }}>
              <FileCheck size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No KYC documents submitted yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Personal info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Full Name', value: kycSubmission.full_name },
                  { label: 'City', value: kycSubmission.city },
                  { label: 'Area', value: kycSubmission.area },
                  { label: 'Company', value: kycSubmission.company_name },
                  { label: 'Aadhaar No.', value: kycSubmission.aadhaar_number ? `XXXX XXXX ${kycSubmission.aadhaar_number.slice(-4)}` : undefined },
                  { label: 'PAN No.', value: kycSubmission.pan_number },
                  { label: 'Submitted', value: new Date(kycSubmission.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                  ...(kycSubmission.reviewed_at ? [{ label: 'Reviewed', value: new Date(kycSubmission.reviewed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }] : []),
                ].filter(r => r.value).map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* Document images */}
              <div className="space-y-4">
                {/* Aadhaar */}
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#f59e0b' }}>🪪 Aadhaar Card</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DocImg label="Front" src={kycSubmission.front_url} onZoom={setLightboxSrc} />
                    <DocImg label="Back" src={kycSubmission.back_url} onZoom={setLightboxSrc} />
                  </div>
                </div>
                {/* PAN */}
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#60a5fa' }}>🗂️ PAN Card</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DocImg label="Front" src={kycSubmission.pan_front_url} onZoom={setLightboxSrc} />
                    <DocImg label="Back" src={kycSubmission.pan_back_url} onZoom={setLightboxSrc} />
                  </div>
                </div>
                {/* Selfie */}
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#34d399' }}>🤳 Live Selfie</p>
                  <div className="flex items-center gap-4">
                    <DocImg label="Selfie" src={kycSubmission.selfie_url} onZoom={setLightboxSrc} round />
                    {!kycSubmission.selfie_url && (
                      <p className="text-xs" style={{ color: '#475569' }}>No selfie submitted</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rejection reason */}
              {kycSubmission.rejection_reason && (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <p className="text-xs font-bold text-red-400 mb-1">Rejection Reason</p>
                  <p className="text-sm" style={{ color: '#fca5a5' }}>{kycSubmission.rejection_reason}</p>
                </div>
              )}

              {/* Approve / Reject buttons */}
              {kycSubmission.status === 'pending' && (
                <div className="flex gap-3 pt-1">
                  <button onClick={handleApproveKyc} className="btn-success flex-1 justify-center py-3">
                    <CheckCircle size={15} /> Approve KYC
                  </button>
                  <button onClick={handleRejectKyc} className="btn-danger flex-1 justify-center py-3">
                    <XCircle size={15} /> Reject KYC
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
};

export default UserDetail;
