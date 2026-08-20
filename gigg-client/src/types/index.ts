export type ThemeMode = 'light' | 'dark';
export type KycStatus = 'not_started' | 'submitted' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'worker' | 'employer' | 'client' | 'admin';
  avatar?: string;
  selfie?: string;
  isVerified: boolean;
  isApproved: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  aadhaarVerified: boolean;
  selfieVerified: boolean;
  aadhaarNumber?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  panNumber?: string;
  panFront?: string;
  panBack?: string;
  city: string;
  area: string;
  createdAt: string;
  kycStatus: KycStatus;
  kycSubmittedAt?: string;
  kycReviewedAt?: string;
  kycRejectionReason?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  languages?: string[];
  categories?: string[];
  bio?: string;
  skills?: string[];
  completedJobs: number;
  totalJobsPosted: number;
  rating: number;
  reviewCount: number;
  totalEarnings: number;
  attendanceRate: number;
  companyName?: string;
  companyLogo?: string;
  isVerifiedEmployer?: boolean;
  isOnboarded: boolean;
  creditPoint: number;
  oneLiner?: string;
  upiId?: string;
  bankAccount?: string;
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
  // New Fields from PDF
  needLocationBasedWorkers: boolean;
  natureOfWork: string;
  clientName: string;
  clientId: string;
  modeOfPayment: 'Online' | 'Cash' | 'Wallet';
  paymentDate: string;
  dosAndDonts: string;
  isGroupClosed?: boolean;
  groupClosedAt?: string;
  pipelineShareToken?: string;
}

export type JobStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type ApplicationStatus = 'applied' | 'shortlisted' | 'hired' | 'confirmed' | 'rejected' | 'completed' | 'no_show';

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
  updatedAt?: string;
  negotiatedPay?: number | null;
  paid?: boolean;
  paidAt?: string;
  // Legacy fixed-step pipeline fields — superseded by job_tasks/application_task_completions,
  // kept during the coexistence period (see PIPELINE_MIGRATION.sql) until old jobs are migrated.
  reportingCompleted?: boolean;
  selfieCompleted?: boolean;
  tshirtCompleted?: boolean;
  shoesCompleted?: boolean;
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
  isGroup?: boolean;
  isClosed?: boolean;
  employerLastReadAt?: string;
  workerLastReadAt?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  type: 'text' | 'image' | 'file' | 'voice' | 'video';
  sentAt: string;
  isRead: boolean;
  duration?: number;
  videoUrl?: string;
  jobTaskId?: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface JobRating {
  id: string;
  jobId: string;
  workerId: string;
  employerId: string;
  rating: number;
  review?: string;
  createdAt: string;
}

export interface GroupChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  type: 'text' | 'image' | 'file';
  content: string;
  createdAt: string;
  profiles?: {
    name: string;
    avatar?: string;
  };
}

export type TaskKind = 'opening' | 'task' | 'closing';
export type TaskCompletionType = 'image' | 'form' | 'tick';
export type TaskCompletionStatus = 'not_started' | 'in_progress' | 'submitted' | 'complete' | 'failed';

export interface FormField {
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export interface JobTask {
  id: string;
  jobId: string;
  kind: TaskKind;
  sortOrder: number;
  title: string;
  description: string;
  completionType: TaskCompletionType;
  formSchema?: FormField[];
  responseWindowMinutes: number;
  autoFailMinutes: number;
  /** Minutes before/after the anchor time (job reporting_time for opening,
   * job end_time for closing, or this task's own anchorTime for a middle
   * task) that the task's clock window opens/closes. Only used when the
   * task is clock-anchored — see anchorTime. */
  openMinutesBefore: number;
  openMinutesAfter: number;
  /** 'HH:MM' clock time a middle task is anchored to (employer-set,
   * optional). Opening/closing tasks ignore this — they always anchor to
   * the job's reporting_time/end_time. Undefined means the middle task
   * keeps the relative-timer behavior instead of a clock window. */
  anchorTime?: string;
  requiresReview: boolean;
}

export interface TaskCompletion {
  id: string;
  applicationId: string;
  jobTaskId: string;
  status: TaskCompletionStatus;
  imageUrl?: string;
  formData?: Record<string, string | number>;
  availableAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  /** Set only for opening/closing (clock-anchored) tasks — the job-clock-derived open/deadline instants. */
  opensAt?: string;
  deadlineAt?: string;
}

export interface JobClient {
  id: string;
  jobId: string;
  employerId: string;
  name: string;
  phone: string;
  inviteToken?: string;
  invitedAt: string;
  lastViewedAt?: string;
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
  | 'review_received'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected';

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
