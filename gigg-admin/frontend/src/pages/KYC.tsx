import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Eye,
  FileCheck,
  User,
  MapPin,
  Briefcase,
  Phone,
  Image as ImageIcon,
  ZoomIn,
  X,
  Shield,
  Camera,
} from 'lucide-react';
import { Header } from '../components/Header';
import { DataTable, Column } from '../components/DataTable';
import apiClient from '../api/client';
import { KYCDocument, PaginatedResponse } from '../types';

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
        className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
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

function DocTile({
  label,
  src,
  onZoom,
  round = false,
}: {
  label: string;
  src?: string;
  onZoom: (src: string) => void;
  round?: boolean;
}) {
  if (!src) {
    return (
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>
          {label}
        </p>
        <div
          className="flex items-center justify-center gap-2 rounded-xl"
          style={{
            height: round ? 80 : 70,
            width: round ? 80 : '100%',
            borderRadius: round ? '50%' : 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            color: '#475569',
            fontSize: 12,
          }}
        >
          <ImageIcon size={16} /> —
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5" style={{ color: '#64748b' }}>
        {label}
      </p>
      <div
        onClick={() => onZoom(src)}
        className="relative cursor-pointer overflow-hidden group"
        style={{
          height: round ? 80 : 70,
          width: round ? 80 : '100%',
          borderRadius: round ? '50%' : 12,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <ZoomIn size={20} style={{ color: '#fff' }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────────────────

function KycDetailModal({
  doc,
  onClose,
  onApprove,
  onReject,
}: {
  doc: KYCDocument;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const infoRows = [
    { icon: User, label: 'Full Name', value: doc.full_name || doc.profiles?.name },
    { icon: Phone, label: 'Phone', value: doc.profiles?.phone },
    { icon: MapPin, label: 'City', value: doc.city || doc.profiles?.city },
    { icon: MapPin, label: 'Area / Locality', value: doc.area || doc.profiles?.area },
    ...(doc.company_name || doc.profiles?.company_name
      ? [{ icon: Briefcase, label: 'Company', value: doc.company_name || doc.profiles?.company_name }]
      : []),
    { icon: Shield, label: 'Aadhaar No.', value: doc.aadhaar_number ? `XXXX XXXX ${doc.aadhaar_number.slice(-4)}` : undefined },
    { icon: Shield, label: 'PAN No.', value: doc.pan_number },
    {
      icon: FileCheck,
      label: 'Submitted',
      value: new Date(doc.submitted_at).toLocaleString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      }),
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          className="rounded-2xl w-full max-w-2xl animate-fade-in"
          style={{
            background: '#0f1220',
            border: '1px solid rgba(99,102,241,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
            style={{ background: '#0f1220', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <h3 className="text-lg font-bold text-white">KYC Review</h3>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                {doc.profiles?.name} ·{' '}
                <span
                  className={`badge badge-${
                    doc.status === 'approved'
                      ? 'success'
                      : doc.status === 'pending'
                      ? 'warning'
                      : 'danger'
                  }`}
                >
                  {doc.status}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <X size={16} style={{ color: '#94a3b8' }} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Info grid */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: '#6366f1' }}
              >
                Applicant Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                {infoRows.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} style={{ color: '#818cf8' }} />
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#64748b' }}>
                        {label}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aadhaar images */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: '#f59e0b' }}
              >
                🪪 Aadhaar Card
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DocTile label="Front" src={doc.front_url} onZoom={setLightboxSrc} />
                <DocTile label="Back" src={doc.back_url} onZoom={setLightboxSrc} />
              </div>
            </div>

            {/* PAN images */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: '#60a5fa' }}
              >
                🗂️ PAN Card
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DocTile label="Front" src={doc.pan_front_url} onZoom={setLightboxSrc} />
                <DocTile label="Back" src={doc.pan_back_url} onZoom={setLightboxSrc} />
              </div>
            </div>

            {/* Selfie */}
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: '#34d399' }}
              >
                🤳 Live Selfie
              </p>
              <div className="flex items-center gap-4">
                <DocTile label="Selfie" src={doc.selfie_url} onZoom={setLightboxSrc} round />
                {doc.selfie_url && (
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Tap the image to view full size and compare with Aadhaar photo.
                  </p>
                )}
              </div>
            </div>

            {/* Rejection reason */}
            {doc.status === 'rejected' && doc.rejection_reason && (
              <div
                className="p-4 rounded-xl"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <p className="text-xs font-bold text-red-400 mb-1">Rejection Reason</p>
                <p className="text-sm" style={{ color: '#fca5a5' }}>
                  {doc.rejection_reason}
                </p>
              </div>
            )}

            {/* Actions */}
            {doc.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <button onClick={onApprove} className="btn-success flex-1 justify-center py-3">
                  <CheckCircle size={16} /> Approve KYC
                </button>
                <button onClick={onReject} className="btn-danger flex-1 justify-center py-3">
                  <XCircle size={16} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Main KYC Page
// ─────────────────────────────────────────────────────────────

const KYC: React.FC = () => {
  const [data, setData] = useState<KYCDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedDoc, setSelectedDoc] = useState<KYCDocument | null>(null);

  const fetchKYC = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponse<KYCDocument>>('/kyc', {
        params: { status: statusFilter, page, limit: 20 },
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchKYC(); }, [fetchKYC]);

  const handleApprove = async (doc: KYCDocument) => {
    if (!confirm(`Approve KYC for ${doc.profiles?.name || doc.full_name}?`)) return;
    try {
      await apiClient.patch(`/kyc/${doc.id}/approve`);
      setSelectedDoc(null);
      fetchKYC();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Approval failed');
    }
  };

  const handleReject = async (doc: KYCDocument) => {
    const reason = prompt('Enter rejection reason (shown to the user):');
    if (reason === null) return;
    try {
      await apiClient.patch(`/kyc/${doc.id}/reject`, { reason: reason || 'Does not meet requirements' });
      setSelectedDoc(null);
      fetchKYC();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Rejection failed');
    }
  };

  const columns: Column<KYCDocument>[] = [
    {
      key: 'user',
      header: 'Applicant',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.selfie_url ? (
            <img
              src={row.selfie_url}
              alt=""
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {(row.full_name || row.profiles?.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">
              {row.full_name || row.profiles?.name || 'Unknown'}
            </p>
            <p className="text-xs" style={{ color: '#64748b' }}>
              {row.profiles?.phone || row.profiles?.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span className={`badge ${row.profiles?.role === 'employer' ? 'badge-success' : 'badge-info'}`}>
          {row.profiles?.role === 'employer' ? '🏢 Employer' : '👷 Worker'}
        </span>
      ),
    },
    {
      key: 'aadhaar_number',
      header: 'Aadhaar',
      render: (row) => (
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          {row.aadhaar_number ? `XXXX XXXX ${row.aadhaar_number.slice(-4)}` : '—'}
        </span>
      ),
    },
    {
      key: 'pan_number',
      header: 'PAN',
      render: (row) => (
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{row.pan_number || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`badge badge-${
            row.status === 'approved' ? 'success' : row.status === 'pending' ? 'warning' : 'danger'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      render: (row) => (
        <span style={{ color: '#64748b', fontSize: 12 }}>
          {new Date(row.submitted_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedDoc(row)}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Eye size={11} /> View Docs
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(row)}
                className="btn-success py-1.5 px-3 text-xs"
              >
                <CheckCircle size={11} /> Approve
              </button>
              <button
                onClick={() => handleReject(row)}
                className="btn-danger py-1.5 px-3 text-xs"
              >
                <XCircle size={11} /> Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Header title="KYC Verification" subtitle="Review identity document submissions" />
      <div className="p-8">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize"
              style={{
                background: statusFilter === s ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                color: statusFilter === s ? '#a5b4fc' : '#64748b',
                border: `1px solid ${statusFilter === s ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {s === 'pending' ? '🟡' : s === 'approved' ? '🟢' : '🔴'} {s}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
            <FileCheck size={14} />
            {total} {statusFilter} {total === 1 ? 'submission' : 'submissions'}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          total={total}
          page={page}
          limit={20}
          onPageChange={setPage}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedDoc(row)}
          emptyMessage={`No ${statusFilter} KYC submissions`}
        />
      </div>

      {selectedDoc && (
        <KycDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onApprove={() => handleApprove(selectedDoc)}
          onReject={() => handleReject(selectedDoc)}
        />
      )}
    </div>
  );
};

export default KYC;
