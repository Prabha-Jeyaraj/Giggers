import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, UserX, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '../components/Header';
import { DataTable, Column } from '../components/DataTable';
import apiClient from '../api/client';
import { Profile, PaginatedResponse } from '../types';

const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, string> = {
    worker: 'badge-info',
    employer: 'badge-success',
    admin: 'badge-warning',
  };
  return <span className={`badge ${map[role] || 'badge-neutral'}`}>{role}</span>;
};

const ApprovalBadge = ({ approved, isBanned }: { approved: boolean; isBanned?: boolean }) => {
  if (isBanned) {
    return <span className="badge badge-danger">✕ Rejected</span>;
  }
  return (
    <span className={`badge ${approved ? 'badge-success' : 'badge-warning'}`}>
      {approved ? '✓ Approved' : '⏳ Pending'}
    </span>
  );
};

const Users: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (approvalFilter) params.approved = approvalFilter;

      const res = await apiClient.get<PaginatedResponse<Profile>>('/users', { params });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, approvalFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleApprove = async (e: React.MouseEvent, user: Profile, approve: boolean) => {
    e.stopPropagation();
    const label = approve ? 'Approve' : 'Reject';
    if (!confirm(`${label} account for ${user.name}?`)) return;
    await apiClient.patch(`/users/${user.id}/approve`, { approved: approve });
    fetchUsers();
  };

  const handleBan = async (e: React.MouseEvent, user: Profile) => {
    e.stopPropagation();
    const isBanned = user.is_banned;
    if (!confirm(`${isBanned ? 'Unban' : 'Ban'} ${user.name}?`)) return;
    await apiClient.patch(`/users/${user.id}/ban`, { banned: !isBanned });
    fetchUsers();
  };



  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {row.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{row.name}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{row.email || row.phone}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => <RoleBadge role={row.role} /> },
    { key: 'city', header: 'Location', render: (row) => <span style={{ color: '#94a3b8' }}>{row.city}, {row.area}</span> },
    {
      key: 'is_approved',
      header: 'Account',
      render: (row) => <ApprovalBadge approved={row.is_approved} isBanned={row.is_banned} />,
    },
    {
      key: 'is_verified',
      header: 'KYC',
      render: (row) => (
        <span className={`badge ${row.is_verified ? 'badge-success' : 'badge-neutral'}`}>
          {row.is_verified ? '✓ Verified' : 'Unverified'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        row.is_banned
          ? <span className="badge badge-danger">Banned</span>
          : <span className="badge badge-success">Active</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => (
        <span style={{ color: '#64748b', fontSize: 12 }}>
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {!row.is_approved && !row.is_banned && (
            <>
              <button
                onClick={(e) => handleApprove(e, row, true)}
                className="btn-success py-1.5 px-2.5 text-xs"
                title="Approve account"
              >
                <CheckCircle size={11} /> Approve
              </button>
              <button
                onClick={(e) => handleApprove(e, row, false)}
                className="btn-danger py-1.5 px-2.5 text-xs"
                title="Reject account"
              >
                <XCircle size={11} /> Reject
              </button>
            </>
          )}

          {row.is_banned && (
            <button
              onClick={(e) => handleApprove(e, row, true)}
              className="btn-success py-1.5 px-2.5 text-xs"
              title="Approve and restore account"
            >
              <CheckCircle size={11} /> Approve
            </button>
          )}

          <button
            onClick={(e) => handleBan(e, row)}
            className={`btn-danger py-1.5 px-2.5 text-xs ${row.is_banned ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            title={row.is_banned ? 'Unban user' : 'Ban user'}
          >
            <UserX size={11} />
            {row.is_banned ? 'Unban' : 'Ban'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Header title="Users" subtitle="Manage all workers and employers" />
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or email..."
                className="admin-input pl-10"
              />
            </div>
            <button type="submit" className="btn-primary py-2.5 px-4">
              <Search size={14} /> Search
            </button>
          </form>

          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="admin-input pr-10 appearance-none cursor-pointer"
              style={{ width: 'auto', paddingRight: '36px' }}
            >
              <option value="">All Roles</option>
              <option value="worker">Worker</option>
              <option value="employer">Employer</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#475569' }} />
          </div>

          <div className="relative">
            <select
              value={approvalFilter}
              onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}
              className="admin-input pr-10 appearance-none cursor-pointer"
              style={{ width: 'auto', paddingRight: '36px' }}
            >
              <option value="">All Accounts</option>
              <option value="false">⏳ Pending Approval</option>
              <option value="true">✓ Approved</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#475569' }} />
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
            <Filter size={14} />
            {total.toLocaleString()} users
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
          onRowClick={(row) => navigate(`/users/${row.id}`)}
          emptyMessage="No users found"
        />
      </div>
    </div>
  );
};

export default Users;
