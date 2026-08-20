import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, role: 'worker' | 'employer' | 'admin', name?: string) => Promise<boolean>;
  login: (phone: string, role: 'worker' | 'employer' | 'admin') => Promise<void>;
  register: (data: Partial<UserProfile> & { role: 'worker' | 'employer' | 'admin' }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

/** Map Supabase profile row → our UserProfile type */
function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    email: (row.email as string) || '',
    phone: (row.phone as string) || '',
    role: ((row.role as string) === 'admin' ? 'worker' : (row.role as 'worker' | 'employer')) || 'worker',
    avatar: row.avatar as string | undefined,
    isVerified: Boolean(row.is_verified),
    isApproved: Boolean(row.is_approved),
    aadhaarVerified: Boolean(row.aadhaar_verified),
    selfieVerified: Boolean(row.selfie_verified),
    city: (row.city as string) || '',
    area: (row.area as string) || '',
    createdAt: (row.created_at as string) || new Date().toISOString(),
    completedJobs: Number(row.completed_jobs) || 0,
    totalJobsPosted: Number(row.total_jobs_posted) || 0,
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    totalEarnings: Number(row.total_earnings) || 0,
    attendanceRate: Number(row.attendance_rate) || 100,
    companyName: row.company_name as string | undefined,
    isVerifiedEmployer: Boolean(row.is_verified_employer),
    bio: row.bio as string | undefined,
    skills: row.skills as string[] | undefined,
    languages: row.languages as string[] | undefined,
    categories: row.categories as string[] | undefined,
    gender: row.gender as 'male' | 'female' | 'other' | undefined,
    age: row.age as number | undefined,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null as string | null,

      sendOtp: async (phone: string) => {
        set({ isLoading: true, error: null });
        setTimeout(() => set({ isLoading: false }), 400);
      },

      /** Verify OTP — dev mode: any 10-digit number + OTP 1234 works */
      verifyOtp: async (phone: string, otp: string, role: 'worker' | 'employer' | 'admin', name?: string) => {
        set({ isLoading: true, error: null });
        const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`;

        // Dev mode: only accept OTP 1234
        if (otp !== '1234') {
          set({ isLoading: false, error: 'Invalid OTP' });
          return false;
        }

        // Each phone number maps to a deterministic fake email + password for Supabase auth
        // This lets every unique number get its own auth identity without real SMS
        const fakeEmail = `user_${normalized.replace('+', '')}@gigg.dev`;
        const fakePassword = `Gigg_${normalized.replace('+', '')}_dev`;

        let authUser;

        // Try sign-in first (returning user)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: fakePassword,
        });

        if (!signInError && signInData.user) {
          authUser = signInData.user;
        } else {
          // New user — create auth account
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: fakeEmail,
            password: fakePassword,
          });
          if (signUpError || !signUpData.user) {
            set({ isLoading: false, error: signUpError?.message || 'Auth failed' });
            return false;
          }
          authUser = signUpData.user;
        }

        // Fetch or create profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError || !profile) {
          // New profile — use the actual name passed from register form
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              phone: normalized,
              name: name || normalized,
              role,
              city: 'Mumbai',
              area: '',
              is_verified: false,
              is_approved: false,
              aadhaar_verified: false,
              selfie_verified: false,
            })
            .select()
            .single();

          if (insertError) {
            set({ isLoading: false });
            throw new Error('Failed to create profile: ' + insertError.message);
          }

          if (newProfile) {
            set({ user: mapProfile(newProfile as Record<string, unknown>), isAuthenticated: true, isLoading: false });
          }
        } else {
          // If profile exists, update role to match the selected role!
          if (role && profile.role !== role) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({ role })
              .eq('id', authUser.id)
              .select()
              .single();
            if (!updateError && updatedProfile) {
              set({ user: mapProfile(updatedProfile as Record<string, unknown>), isAuthenticated: true, isLoading: false });
              return true;
            }
          }
          profile.role = role || profile.role;
          set({ user: mapProfile(profile as Record<string, unknown>), isAuthenticated: true, isLoading: false });
        }

        return true;
      },

      /** Legacy login used by OtpVerify for mock compat — now real Supabase */
      login: async (phone: string, role: 'worker' | 'employer' | 'admin') => {
        // Called after verifyOtp already authenticated; just reload profile
        set({ isLoading: true });
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          if (profile) {
            set({ user: mapProfile(profile as Record<string, unknown>), isAuthenticated: true });
          }
        }
        set({ isLoading: false });
      },

      /** Register a new user — creates profile after OTP verification */
      register: async (data) => {
        set({ isLoading: true, error: null });
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { set({ isLoading: false, error: 'Not authenticated' }); return; }

        const normalized = data.phone?.startsWith('+')
          ? data.phone
          : `+91${(data.phone || '').replace(/\s/g, '')}`;

        const profileData = {
          id: authUser.id,
          name: data.name || normalized,
          phone: normalized,
          role: data.role,
          city: data.city || 'Mumbai',
          area: data.area || '',
          company_name: data.companyName || null,
          is_verified: false,
          is_approved: false,
          aadhaar_verified: false,
          selfie_verified: false,
          completed_jobs: 0,
          total_jobs_posted: 0,
          rating: 0,
          review_count: 0,
          total_earnings: 0,
        };

        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'id' })
          .select()
          .single();

        if (profileError) {
          set({ isLoading: false, error: profileError.message });
          throw new Error('Failed to save profile: ' + profileError.message);
        }

        if (newProfile) {
          set({ user: mapProfile(newProfile as Record<string, unknown>), isAuthenticated: true, isLoading: false });
        }
      },

      /** Sign out */
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false, error: null });
      },

      setUser: (user) => set({ user }),

      /** Update profile fields in Supabase and local state */
      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) return;
        set({ isLoading: true });

        // Map camelCase → snake_case for DB
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

        const { data: updated, error } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', user.id)
          .select()
          .single();

        if (!error && updated) {
          set({ user: mapProfile(updated as Record<string, unknown>) });
        }
        set({ isLoading: false });
      },
    }),
    {
      name: 'giggers-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
