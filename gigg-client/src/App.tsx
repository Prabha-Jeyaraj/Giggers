import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';

// Landing
import Landing from './features/landing/pages/Landing';

// Auth
import Login from './features/auth/pages/Login';
import Register from './features/auth/pages/Register';
import OtpVerify from './features/auth/pages/OtpVerify';
import ForgotPassword from './features/auth/pages/ForgotPassword';

// KYC + Pending
import KycWizard from './features/kyc/pages/KycWizard';
import PendingApproval from './features/auth/pages/PendingApproval';

// Home
import Home from './features/home/pages/Home';

// Jobs
import Jobs from './features/jobs/pages/Jobs';
import JobDetails from './features/jobs/pages/JobDetails';
import PostJob from './features/jobs/pages/PostJob';
import JobEdit from './features/jobs/pages/JobEdit';
import AssignWork from './features/jobs/pages/AssignWork';
import PipelineManager from './features/jobs/pages/PipelineManager';
import WorkerPipeline from './features/jobs/pages/WorkerPipeline';
import PipelineBuilder from './features/jobs/pages/PipelineBuilder';
import ClientInviteRedeem from './features/jobs/pages/ClientInviteRedeem';
import ClientJobList from './features/jobs/pages/ClientJobList';
import ClientPipelineView from './features/jobs/pages/ClientPipelineView';
import EmployerWorkers from './features/jobs/pages/EmployerWorkers';
import PublicPipelineView from './features/jobs/pages/PublicPipelineView';

// Profile
import Profile from './features/profile/pages/Profile';

// Chat
import ChatList from './features/chat/pages/ChatList';
import ChatThread from './features/chat/pages/ChatThread';
import GroupChat from './features/chat/pages/GroupChat';

// Wallet
import Wallet from './features/wallet/pages/Wallet';

// Notifications
import Notifications from './features/notifications/pages/Notifications';

import { PageSeo } from './components/shared/PageSeo';

function App() {
  return (
    <BrowserRouter>
      <PageSeo />
      <Routes>
        {/* Public Landing */}
        <Route path="/" element={<Landing />} />

        {/* Public Pipeline Share Links — completely outside AppShell, no auth gate */}
        <Route path="/pipeline/share/:shareToken/*" element={<PublicPipelineView />} />
        <Route path="/pipeline/share/:shareToken" element={<PublicPipelineView />} />
        <Route path="/pipeline/share" element={<PublicPipelineView />} />

        <Route element={<AppShell />}>
          {/* Auth */}
          <Route path="/welcome" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/otp" element={<OtpVerify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* KYC onboarding flow */}
          <Route path="/kyc" element={<KycWizard />} />
          <Route path="/pending" element={<PendingApproval />} />

          {/* App */}
          <Route path="/home" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetails />} />
          <Route path="/post-job" element={<PostJob />} />
          <Route path="/edit-job/:jobId" element={<JobEdit />} />
          <Route path="/assign-work/:id" element={<AssignWork />} />
          <Route path="/pipeline/:jobId/:workerId" element={<PipelineManager />} />
          <Route path="/worker-pipeline/:jobId" element={<WorkerPipeline />} />
          <Route path="/pipeline-builder/:jobId" element={<PipelineBuilder />} />
          <Route path="/workers" element={<EmployerWorkers />} />
          <Route path="/profile" element={<Profile />} />

          {/* Client (read-only, magic-link) */}
          <Route path="/client/invite/:inviteToken" element={<ClientInviteRedeem />} />
          <Route path="/client/jobs" element={<ClientJobList />} />
          <Route path="/client/jobs/:jobId" element={<ClientPipelineView />} />

          {/* Chat */}
          <Route path="/chat" element={<ChatList />} />
          <Route path="/chat/:id" element={<ChatThread />} />
          <Route path="/group-chat/:jobId" element={<GroupChat />} />

          {/* Wallet */}
          <Route path="/wallet" element={<Wallet />} />

          {/* Notifications */}
          <Route path="/notifications" element={<Notifications />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
