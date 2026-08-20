import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface JwtPayload {
  id: string;
  phone: string;
  role: 'worker' | 'employer' | 'client' | 'admin';
  name: string;
}

export interface OtpSession {
  phone: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

export interface WorkerLocation {
  workerId: string;
  jobId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}
