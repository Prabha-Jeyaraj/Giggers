import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True once the persisted session has been read back from sessionStorage.
   * Route guards (see AppShell) must wait for this before treating
   * isAuthenticated as authoritative — persist rehydration happens
   * asynchronously after the store's initial (unauthenticated) state, so
   * checking isAuthenticated too early on a fresh page load/refresh always
   * reads false and incorrectly bounces a logged-in user to /welcome. */
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, role?: 'worker' | 'employer') => Promise<boolean>;
  register: (data: Partial<UserProfile> & { role: 'worker' | 'employer'; otp: string }) => Promise<void>;
  redeemClientInvite: (inviteToken: string) => Promise<string>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

function mapApiUser(u: Record<string, unknown>): UserProfile {
  return {
    id: u.id as string,
    name: (u.name as string) || '',
    email: (u.email as string) || '',
    phone: (u.phone as string) || '',
    role: (u.role as UserProfile['role']) || 'worker',
    avatar: u.avatar as string | undefined,
    selfie: (u.selfie as string | undefined) ?? (u.selfie_url as string | undefined),
    isVerified: Boolean(u.isVerified ?? u.is_verified),
    isApproved: Boolean(u.isApproved ?? u.is_approved),
    isBanned: Boolean(u.isBanned ?? u.is_banned),
    bannedReason: (u.bannedReason as string | undefined) ?? (u.banned_reason as string | undefined) ?? (u.ban_reason as string | undefined),
    aadhaarVerified: Boolean(u.aadhaarVerified ?? u.aadhaar_verified),
    selfieVerified: Boolean(u.selfieVerified ?? u.selfie_verified),
    aadhaarNumber: (u.aadhaarNumber as string | undefined) ?? (u.aadhaar_number as string | undefined),
    aadhaarFront: (u.aadhaarFront as string | undefined) ?? (u.aadhaar_front_url as string | undefined),
    aadhaarBack: (u.aadhaarBack as string | undefined) ?? (u.aadhaar_back_url as string | undefined),
    panNumber: (u.panNumber as string | undefined) ?? (u.pan_number as string | undefined),
    panFront: (u.panFront as string | undefined) ?? (u.pan_front_url as string | undefined),
    panBack: (u.panBack as string | undefined) ?? (u.pan_back_url as string | undefined),
    city: (u.city as string) || '',
    area: (u.area as string) || '',
    createdAt: (u.createdAt as string) || (u.created_at as string) || new Date().toISOString(),
    kycStatus: ((u.kycStatus as UserProfile['kycStatus']) || (u.kyc_status as UserProfile['kycStatus']) || 'not_started'),
    kycSubmittedAt: (u.kycSubmittedAt as string | undefined) ?? (u.kyc_submitted_at as string | undefined),
    kycReviewedAt: (u.kycReviewedAt as string | undefined) ?? (u.kyc_reviewed_at as string | undefined),
    kycRejectionReason: (u.kycRejectionReason as string | undefined) ?? (u.kyc_rejection_reason as string | undefined),
    completedJobs: Number(u.completedJobs ?? u.completed_jobs) || 0,
    totalJobsPosted: Number(u.totalJobsPosted ?? u.total_jobs_posted) || 0,
    rating: Number(u.rating) || 0,
    reviewCount: Number(u.reviewCount ?? u.review_count) || 0,
    totalEarnings: Number(u.totalEarnings ?? u.total_earnings) || 0,
    attendanceRate: Number(u.attendanceRate ?? u.attendance_rate) || 100,
    companyName: (u.companyName as string | undefined) ?? (u.company_name as string | undefined),
    isVerifiedEmployer: Boolean(u.isVerifiedEmployer ?? u.is_verified_employer),
    bio: u.bio as string | undefined,
    skills: u.skills as string[] | undefined,
    languages: u.languages as string[] | undefined,
    categories: u.categories as string[] | undefined,
    gender: u.gender as 'male' | 'female' | 'other' | undefined,
    age: u.age as number | undefined,
    creditPoint: Number(u.creditPoint ?? u.credit_point) || 0,
    isOnboarded: Boolean(u.isOnboarded ?? u.is_onboarded),
    oneLiner: (u.oneLiner as string | undefined) ?? (u.one_liner as string | undefined),
    upiId: (u.upiId as string | undefined) ?? (u.upi_id as string | undefined),
    bankAccount: (u.bankAccount as string | undefined) ?? (u.bank_account as string | undefined),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      sendOtp: async (phone: string) => {
        set({ isLoading: true });
        try {
          await api.post('/api/auth/send-otp', { phone: phone.replace(/\s/g, '') });
        } catch (err) {
          console.warn('Backend send-otp service call warning, proceeding with default dev OTP 1234:', err);
        } finally {
          set({ isLoading: false });
        }
      },
      verifyOtp: async (phone: string, otp: string, role?: 'worker' | 'employer') => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ token: string; user: Record<string, unknown>; isNewUser?: boolean }>('/api/auth/verify-otp', {
            phone: phone.replace(/\s/g, ''), otp, ...(role ? { role } : {}),
          });
          const mappedUser = mapApiUser(res.user);
          if (role && mappedUser.role !== role) {
            mappedUser.role = role;
          }
          set({ token: res.token, user: mappedUser, isAuthenticated: true, isLoading: false });
          return true;
        } catch (err: any) {
          set({ isLoading: false });
          throw err;
        }
      },
      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ token: string; user: Record<string, unknown> }>('/api/auth/verify-otp', {
            phone: (data.phone || '').replace(/\s/g, ''),
            otp: data.otp,
            name: data.name,
            role: data.role,
            city: data.city,
            area: data.area,
            companyName: data.role === 'employer' ? data.companyName : undefined,
          });
          const mappedUser = mapApiUser(res.user);
          if (data.role && mappedUser.role !== data.role) {
            mappedUser.role = data.role;
          }
          set({ token: res.token, user: mappedUser, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          throw err;
        }
      },
      redeemClientInvite: async (inviteToken: string) => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ token: string; user: Record<string, unknown>; jobId: string }>('/api/clients/redeem', { inviteToken });
          set({ token: res.token, user: mapApiUser(res.user), isAuthenticated: true, isLoading: false });
          return res.jobId;
        } catch (err: any) {
          set({ isLoading: false });
          throw err;
        }
      },
      refreshUser: async () => {
        const { token, isAuthenticated } = get();
        if (!token || !isAuthenticated) return;
        try {
          const res = await api.get<{ user: Record<string, unknown> }>('/api/auth/me');
          set({ user: mapApiUser(res.user) });
        } catch {
        }
      },
      logout: async () => {
        await supabase.auth.signOut().catch(() => { });
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) return;
        set({ isLoading: true });
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.city !== undefined) dbUpdates.city = updates.city;
        if (updates.area !== undefined) dbUpdates.area = updates.area;
        if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
        if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
        if (updates.languages !== undefined) dbUpdates.languages = updates.languages;
        if (updates.categories !== undefined) dbUpdates.categories = updates.categories;
        if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
        if (updates.age !== undefined) dbUpdates.age = updates.age;
        if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
        if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
        if (updates.oneLiner !== undefined) dbUpdates.one_liner = updates.oneLiner;
        if (updates.upiId !== undefined) dbUpdates.upi_id = updates.upiId;
        if (updates.bankAccount !== undefined) dbUpdates.bank_account = updates.bankAccount;
        const { data: updated, error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id).select().single();
        if (!error && updated) {
          set({ user: mapApiUser(updated as Record<string, unknown>) });
        }
        set({ isLoading: false });
      },
    }),
    {
      name: 'giggers-auth',
      // sessionStorage, not localStorage: each browser tab gets its own
      // independent session. localStorage is shared across every tab of
      // the browser, so logging in as employer in one tab and worker in
      // another overwrites the same key — a refresh in either tab then
      // re-reads whichever login happened last, silently switching roles.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
