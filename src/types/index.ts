// ============================================================
// GIGGERS – Centralized TypeScript Types
// ============================================================

export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'worker' | 'employer';
  avatar?: string;
  selfie?: string;
  isVerified: boolean;
  isApproved: boolean;
  aadhaarVerified: boolean;
  selfieVerified: boolean;
  aadhaarNumber?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  city: string;
  area: string;
  createdAt: string;

  // Unified properties
  age?: number;
  gender?: 'male' | 'female' | 'other';
  languages?: string[];
  categories?: string[];
  bio?: string;
  skills?: string[];
  
  // Stats
  completedJobs: number;
  totalJobsPosted: number;
  rating: number;
  reviewCount: number;
  totalEarnings: number;
  attendanceRate: number;
  
  // Employer specific
  companyName?: string;
  companyLogo?: string;
  isVerifiedEmployer?: boolean;
}

export interface JobCategory {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface Job {
  id: string;
  title: string;
  category: string;
  categoryEmoji: string;
  description: string;
  date: string;
  reportingTime: string;
  endTime: string;
  location: string;
  address: string;
  lat: number;
  lng: number;
  workersNeeded: number;
  workersHired: number;
  payPerWorker: number;
  foodProvided: boolean;
  transportProvided: boolean;
  dressCode: string;
  languagesRequired: string[];
  genderPreference: 'any' | 'male' | 'female';
  status: JobStatus;
  employerId: string;
  employerName: string;
  employerLogo?: string;
  employerRating: number;
  isVerifiedEmployer: boolean;
  isFeatured: boolean;
  isUrgent: boolean;
  createdAt: string;
  applicantsCount: number;
  distance?: number;
}

export type JobStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type ApplicationStatus = 'applied' | 'shortlisted' | 'accepted' | 'rejected' | 'completed';

export interface Application {
  id: string;
  jobId: string;
  job: Job;
  workerId: string;
  workerName: string;
  workerAvatar?: string;
  workerRating: number;
  workerProfile?: UserProfile;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  negotiatedPay?: number | null;
  paid?: boolean;
  paidAt?: string;
}

export interface Work {
  id: string;
  jobId: string;
  job: Job;
  workerId: string;
  employerId: string;
  startOtp: string;
  endOtp: string;
  otpVerified: boolean;
  status: WorkStatus;
  startTime?: string;
  endTime?: string;
  pay: number;
  rating?: number;
  review?: string;
}

export type WorkStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface ChatThread {
  id: string;
  jobId: string;
  jobTitle: string;
  employerId: string;
  workerId: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  type: 'text' | 'image' | 'file' | 'voice';
  sentAt: string;
  isRead: boolean;
  duration?: number; // for voice messages in seconds
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: 'success' | 'pending' | 'failed';
  category: 'earning' | 'withdrawal' | 'topup' | 'refund' | 'platform_fee';
}

export interface WalletData {
  currentBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  transactions: Transaction[];
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionId?: string;
  avatar?: string;
}

export type NotificationType =
  | 'job_applied'
  | 'application_accepted'
  | 'application_rejected'
  | 'new_message'
  | 'job_started'
  | 'job_completed'
  | 'payment_released'
  | 'new_applicant'
  | 'worker_hired'
  | 'review_received';

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment: string;
  jobTitle: string;
  createdAt: string;
}

// UI State Types
export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface FilterState {
  category: string;
  location: string;
  date: 'today' | 'tomorrow' | 'any';
  sort: 'nearby' | 'highest_pay' | 'latest';
  verifiedOnly: boolean;
  fullDay: boolean;
  halfDay: boolean;
  viewMode: 'list' | 'grid' | 'map';
}

export interface WorkerFilterState {
  category: string;
  location: string;
  minRating: number;
  verifiedOnly: boolean;
  availableToday: boolean;
  availableTomorrow: boolean;
  maxDistance: number;
}
