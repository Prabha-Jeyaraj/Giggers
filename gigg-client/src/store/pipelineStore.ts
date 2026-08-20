import { create } from 'zustand';
import type { JobTask, TaskCompletion } from '../types';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

function mapTask(t: any): JobTask {
  return {
    id: t.id,
    jobId: t.jobId,
    kind: t.kind,
    sortOrder: t.sortOrder,
    title: t.title,
    description: t.description,
    completionType: t.completionType,
    formSchema: t.formSchema,
    responseWindowMinutes: t.responseWindowMinutes,
    autoFailMinutes: t.autoFailMinutes,
    openMinutesBefore: t.openMinutesBefore,
    openMinutesAfter: t.openMinutesAfter,
    anchorTime: t.anchorTime,
    requiresReview: t.requiresReview,
  };
}

function mapCompletion(c: any): TaskCompletion {
  return {
    id: c.id,
    applicationId: c.applicationId,
    jobTaskId: c.jobTaskId,
    status: c.status,
    imageUrl: c.imageUrl,
    formData: c.formData,
    availableAt: c.availableAt,
    submittedAt: c.submittedAt,
    reviewedAt: c.reviewedAt,
    rejectionReason: c.rejectionReason,
    opensAt: c.opensAt,
    deadlineAt: c.deadlineAt,
  };
}

export interface TaskDraft {
  kind: 'opening' | 'task' | 'closing';
  title: string;
  description: string;
  completionType: 'image' | 'form' | 'tick';
  responseWindowMinutes: number;
  autoFailMinutes: number;
  openMinutesBefore: number;
  openMinutesAfter: number;
  anchorTime?: string;
  requiresReview: boolean;
}

interface PipelineState {
  tasks: JobTask[];
  completions: TaskCompletion[];
  isLoading: boolean;
  fetchJobTasks: (jobId: string) => Promise<JobTask[]>;
  saveJobTasks: (jobId: string, tasks: TaskDraft[]) => Promise<void>;
  fetchCompletions: (applicationId: string) => Promise<void>;
  refetchCompletionsSilently: (applicationId: string) => Promise<void>;
  submitTick: (completionId: string) => Promise<void>;
  submitForm: (completionId: string, formData: Record<string, string | number>) => Promise<void>;
  submitImage: (completionId: string, imageDataUrl: string) => Promise<void>;
  reviewCompletion: (completionId: string, approve: boolean, rejectionReason?: string) => Promise<void>;
  employerCompleteTask: (completionId: string) => Promise<void>;
  employerReopenTask: (completionId: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  tasks: [],
  completions: [],
  isLoading: false,

  fetchJobTasks: async (jobId: string) => {
    try {
      const res = await api.get<{ tasks: any[] }>(`/api/pipeline/jobs/${jobId}/tasks`);
      if (res?.tasks) {
        const tasks = res.tasks.map(mapTask);
        set({ tasks });
        return tasks;
      }
    } catch {}

    const { data: dbTasks } = await supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true });

    const tasks = (dbTasks || []).map(mapTask);
    set({ tasks });
    return tasks;
  },

  saveJobTasks: async (jobId: string, tasks: TaskDraft[]) => {
    // 1. Try backend API
    try {
      const res = await api.post<{ tasks: any[] }>(`/api/pipeline/jobs/${jobId}/tasks`, { tasks });
      if (res?.tasks) {
        set({ tasks: res.tasks.map(mapTask) });
        return;
      }
    } catch (err: any) {
      console.warn('[pipelineStore] API saveJobTasks failed, falling back to direct Supabase:', err);
    }

    // 2. Direct Supabase Fallback
    try {
      await supabase.from('job_tasks').delete().eq('job_id', jobId);

      const rowsToInsert = tasks.map((t, idx) => ({
        job_id: jobId,
        kind: t.kind,
        sort_order: idx,
        title: t.title,
        description: t.description || '',
        completion_type: t.completionType,
        response_window_minutes: t.responseWindowMinutes || 15,
        auto_fail_minutes: t.autoFailMinutes || 30,
        open_minutes_before: t.openMinutesBefore || 15,
        open_minutes_after: t.openMinutesAfter || 30,
        anchor_time: t.anchorTime || null,
        requires_review: t.requiresReview !== false,
      }));

      const { data: inserted, error } = await supabase
        .from('job_tasks')
        .insert(rowsToInsert)
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      set({ tasks: (inserted || []).map(mapTask) });
    } catch (dbErr) {
      console.error('[pipelineStore] Direct Supabase saveJobTasks failed:', dbErr);
      throw dbErr;
    }
  },

  fetchCompletions: async (applicationId: string) => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ tasks: any[]; completions: any[] }>(`/api/pipeline/applications/${applicationId}/completions`);
      if (res && Array.isArray(res.tasks) && res.tasks.length > 0) {
        set({ tasks: res.tasks.map(mapTask), completions: (res.completions || []).map(mapCompletion), isLoading: false });
        return;
      }
    } catch (err) {
      console.warn('[pipelineStore] API completions fetch failed, attempting Supabase fallback:', err);
    }

    // Direct Supabase fallback
    try {
      const { data: app } = await supabase.from('applications').select('job_id').eq('id', applicationId).maybeSingle();
      if (app?.job_id) {
        const { data: dbTasks } = await supabase.from('job_tasks').select('*').eq('job_id', app.job_id).order('sort_order', { ascending: true });
        const { data: dbCompletions } = await supabase.from('application_task_completions').select('*').eq('application_id', applicationId);
        if (dbTasks && dbTasks.length > 0) {
          set({
            tasks: dbTasks.map(mapTask),
            completions: (dbCompletions || []).map(mapCompletion),
            isLoading: false,
          });
          return;
        }
      }
    } catch (dbErr) {
      console.error('[pipelineStore] Direct Supabase fallback failed:', dbErr);
    }
    set({ isLoading: false });
  },

  /** Re-fetch tasks/completions without toggling isLoading — used after a
   * submit/review so newly-unlocked tasks appear without flashing the
   * page's full loading state. */
  refetchCompletionsSilently: async (applicationId: string) => {
    try {
      const res = await api.get<{ tasks: any[]; completions: any[] }>(`/api/pipeline/applications/${applicationId}/completions`);
      if (res && Array.isArray(res.tasks) && res.tasks.length > 0) {
        set({ tasks: res.tasks.map(mapTask), completions: (res.completions || []).map(mapCompletion) });
        return;
      }
    } catch {
      // Ignore silent refetch errors
    }
  },

  submitTick: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/tick`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  submitForm: async (completionId: string, formData: Record<string, string | number>) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/form`, { formData });
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  submitImage: async (completionId: string, imageDataUrl: string) => {
    // 1. Try backend API
    try {
      const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/image`, { image: imageDataUrl });
      if (res?.completion) {
        await get().refetchCompletionsSilently(res.completion.applicationId);
        return;
      }
    } catch (err: any) {
      console.warn('[pipelineStore] API submitImage failed, attempting direct Supabase fallback:', err);
    }

    // 2. Direct Supabase Storage & Database Fallback
    try {
      const { data: comp } = await supabase
        .from('application_task_completions')
        .select('*')
        .eq('id', completionId)
        .maybeSingle();

      if (!comp) throw new Error('Completion not found');

      // Convert dataUrl to blob
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const filename = `${comp.application_id}/task-${comp.job_task_id}-${Date.now()}.jpg`;

      // Upload to pipeline-task-images
      let uploadedPath: string = filename;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('pipeline-task-images')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        // Fallback: store dataUrl directly
        uploadedPath = imageDataUrl;
      } else if (uploadData?.path) {
        uploadedPath = uploadData.path;
      }

      const { data: updated, error: updateErr } = await supabase
        .from('application_task_completions')
        .update({
          status: 'submitted',
          image_path: uploadedPath,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', completionId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;
      await get().refetchCompletionsSilently(comp.application_id);
    } catch (dbErr) {
      console.error('[pipelineStore] Direct submitImage failed:', dbErr);
      throw dbErr;
    }
  },

  reviewCompletion: async (completionId: string, approve: boolean, rejectionReason?: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/review`, { approve, rejectionReason });
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  employerCompleteTask: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/employer-complete`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  employerReopenTask: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/employer-reopen`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },
}));
