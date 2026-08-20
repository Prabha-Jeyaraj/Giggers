import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { supabase } from '../utils/supabase';
import { uploadTaskImage, getSignedTaskImageUrl } from '../utils/storage';

function mapTask(row: Record<string, any>) {
  return {
    id: row.id,
    jobId: row.job_id,
    kind: row.kind,
    sortOrder: row.sort_order,
    title: row.title || '',
    description: row.description || '',
    completionType: row.completion_type,
    formSchema: row.form_schema || undefined,
    responseWindowMinutes: row.response_window_minutes,
    autoFailMinutes: row.auto_fail_minutes,
    openMinutesBefore: row.open_minutes_before,
    openMinutesAfter: row.open_minutes_after,
    anchorTime: row.anchor_time || undefined,
    requiresReview: Boolean(row.requires_review),
  };
}

/** A task is clock-anchored to a specific time-of-day on the job's date
 * instead of "whenever the worker opens the task": opening tasks anchor to
 * job.reporting_time, closing tasks to job.end_time, and middle 'task' rows
 * anchor to their own task.anchor_time if the employer set one (otherwise
 * they keep the old relative-timer behavior — see the null return below).
 * Returns the open/deadline instants for that anchor, or null if the task
 * isn't clock-anchored or the anchor time is missing.
 *
 * If `completion.manually_reopened_at` is set (employer emergency reopen —
 * see employerReopenTask), the window is instead computed relative to that
 * reopen instant, so a task whose original clock deadline already passed
 * gets a genuinely fresh window instead of being auto-failed again on the
 * very next read. */
function clockWindowFor(task: Record<string, any>, job: Record<string, any>, completion?: Record<string, any>): { opensAt: Date; deadline: Date } | null {
  const time = task.kind === 'opening' ? job.reporting_time : task.kind === 'closing' ? job.end_time : task.anchor_time;
  if (!time) return null;

  if (completion?.manually_reopened_at) {
    const reopenedAt = new Date(completion.manually_reopened_at);
    return { opensAt: reopenedAt, deadline: new Date(reopenedAt.getTime() + task.open_minutes_after * 60_000) };
  }

  if (!job.date) return null;

  const anchor = new Date(`${job.date}T${time}`);
  if (Number.isNaN(anchor.getTime())) return null;

  const opensAt = new Date(anchor.getTime() - task.open_minutes_before * 60_000);
  const deadline = new Date(anchor.getTime() + task.open_minutes_after * 60_000);
  return { opensAt, deadline };
}

async function mapCompletion(row: Record<string, any>, clockWindow?: { opensAt: Date; deadline: Date } | null) {
  const imageUrl = await getSignedTaskImageUrl(row.image_path);
  return {
    id: row.id,
    applicationId: row.application_id,
    jobTaskId: row.job_task_id,
    status: row.status,
    imageUrl,
    formData: row.form_data || undefined,
    availableAt: row.available_at || undefined,
    submittedAt: row.submitted_at || undefined,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    opensAt: clockWindow?.opensAt.toISOString(),
    deadlineAt: clockWindow?.deadline.toISOString(),
  };
}

/** Applies time-based transition rules when deadlines expire:
 * 1. If deadline passes WITHOUT submission ('in_progress' or 'not_started' past deadline):
 *    automates transition to 'failed' ("Missed / Auto-Closed — No Submission").
 * 2. If deadline passes WITH submission ('submitted' past deadline):
 *    automates transition to 'complete' (Auto-Approve on timeout) because the worker
 *    submitted proof on time and shouldn't be penalized just because employer didn't review in time.
 *    Advances to the next task and checks for application completion. */
async function applyTimeBasedTransitions(completions: Record<string, any>[], tasksById: Map<string, Record<string, any>>, job: Record<string, any>) {
  const now = Date.now();
  const toFail: string[] = [];
  const toAutoApprove: Record<string, any>[] = [];

  for (const c of completions) {
    if (c.status !== 'in_progress' && c.status !== 'submitted' && c.status !== 'not_started') continue;
    const task = tasksById.get(c.job_task_id);
    if (!task) continue;

    const clockWindow = clockWindowFor(task, job, c);
    let deadline: number | null = null;
    if (clockWindow) {
      deadline = clockWindow.deadline.getTime();
    } else if (c.available_at) {
      deadline = new Date(c.available_at).getTime() + task.auto_fail_minutes * 60_000;
    }

    if (deadline !== null && now > deadline) {
      if (c.status === 'submitted') {
        // Worker submitted proof on time -> Auto-Approve on timeout!
        c.status = 'complete';
        c.reviewed_at = new Date().toISOString();
        toAutoApprove.push(c);
      } else if (c.status === 'in_progress' || c.status === 'not_started') {
        // No submission before deadline -> Missed / Expired!
        c.status = 'failed';
        toFail.push(c.id);
      }
    }
  }

  if (toFail.length > 0) {
    await supabase.from('application_task_completions').update({ status: 'failed' }).in('id', toFail);
  }

  if (toAutoApprove.length > 0) {
    for (const c of toAutoApprove) {
      await supabase
        .from('application_task_completions')
        .update({ status: 'complete', reviewed_at: c.reviewed_at })
        .eq('id', c.id);
      await advanceNextTask(c.application_id, c.job_task_id);
      await checkAndCompleteApplication(c.application_id);
    }
  }
}

/** Flips a 'not_started' completion to 'in_progress' once its task is next
 * in line (every earlier task is 'complete') and, if clock-anchored, the
 * job's window has opened. Needed because there's no cron — without this,
 * a clock-anchored task created before its window opens (e.g. the opening
 * task, seeded as soon as the worker first opens the pipeline, well before
 * the job's reporting time) would stay locked forever since nothing else
 * re-checks it later. Mutates `completions` in place to keep the caller's
 * subsequent auto-fail/response mapping consistent within this request. */
async function wakeClockAnchoredTasks(completions: Record<string, any>[], tasks: Record<string, any>[], job: Record<string, any>) {
  const completionByTaskId = new Map(completions.map((c) => [c.job_task_id, c]));
  const toWake: string[] = [];
  const now = new Date().toISOString();

  const sortedTasks = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
  for (let i = 0; i < sortedTasks.length; i++) {
    const task = sortedTasks[i];
    const completion = completionByTaskId.get(task.id);
    if (!completion || completion.status !== 'not_started') continue;

    const priorAllComplete = sortedTasks.slice(0, i).every((t) => completionByTaskId.get(t.id)?.status === 'complete');
    if (!priorAllComplete) continue;

    const clockWindow = clockWindowFor(task, job);
    if (!clockWindow || Date.now() < clockWindow.opensAt.getTime()) continue;

    completion.status = 'in_progress';
    completion.available_at = now;
    toWake.push(completion.id);
  }

  if (toWake.length > 0) {
    await supabase.from('application_task_completions').update({ status: 'in_progress', available_at: now }).in('id', toWake);
  }
}

// GET /api/pipeline/jobs/:jobId/tasks
export async function listJobTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { jobId } = req.params;
  const { data, error } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ tasks: (data || []).map(mapTask) });
}

const taskInputSchema = z.object({
  kind: z.enum(['opening', 'task', 'closing']),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  completionType: z.enum(['image', 'form', 'tick']),
  formSchema: z.array(z.object({ label: z.string(), type: z.enum(['text', 'number', 'select']), options: z.array(z.string()).optional() })).optional(),
  responseWindowMinutes: z.number().int().positive().optional().default(5),
  autoFailMinutes: z.number().int().positive().optional().default(10),
  openMinutesBefore: z.number().int().nonnegative().optional().default(10),
  openMinutesAfter: z.number().int().nonnegative().optional().default(10),
  anchorTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requiresReview: z.boolean().optional().default(true),
});

const saveTasksSchema = z.object({
  tasks: z.array(taskInputSchema).min(2), // at minimum an opening + closing task
});

// POST /api/pipeline/jobs/:jobId/tasks — replaces the full task list for a job
export async function saveJobTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { jobId } = req.params;
  const parsed = saveTasksSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data: job } = await supabase.from('jobs').select('id, employer_id').eq('id', jobId).single();
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (job.employer_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the job owner can edit its pipeline' });
    return;
  }

  const { tasks } = parsed.data;
  if (tasks[0].kind !== 'opening' || tasks[tasks.length - 1].kind !== 'closing') {
    res.status(400).json({ error: 'First task must be the opening task and the last must be the closing task' });
    return;
  }

  // Replace-all: delete existing tasks (cascades to completions) and insert the new set.
  await supabase.from('job_tasks').delete().eq('job_id', jobId);

  const rows = tasks.map((t, i) => ({
    job_id: jobId,
    kind: t.kind,
    sort_order: i,
    title: t.title,
    description: t.description,
    completion_type: t.completionType,
    form_schema: t.formSchema || null,
    response_window_minutes: t.responseWindowMinutes,
    auto_fail_minutes: t.autoFailMinutes,
    open_minutes_before: t.openMinutesBefore,
    open_minutes_after: t.openMinutesAfter,
    anchor_time: t.anchorTime || null,
    requires_review: t.requiresReview,
  }));

  const { data: inserted, error } = await supabase.from('job_tasks').insert(rows).select('*').order('sort_order', { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ tasks: (inserted || []).map(mapTask) });
}

// PATCH /api/pipeline/tasks/:taskId
export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { taskId } = req.params;
  const parsed = taskInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data: task } = await supabase.from('job_tasks').select('*, jobs!inner(employer_id)').eq('id', taskId).single();
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  if ((task as any).jobs.employer_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the job owner can edit its pipeline' });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.completionType !== undefined) updates.completion_type = d.completionType;
  if (d.formSchema !== undefined) updates.form_schema = d.formSchema;
  if (d.responseWindowMinutes !== undefined) updates.response_window_minutes = d.responseWindowMinutes;
  if (d.autoFailMinutes !== undefined) updates.auto_fail_minutes = d.autoFailMinutes;
  if (d.openMinutesBefore !== undefined) updates.open_minutes_before = d.openMinutesBefore;
  if (d.openMinutesAfter !== undefined) updates.open_minutes_after = d.openMinutesAfter;
  if (d.anchorTime !== undefined) updates.anchor_time = d.anchorTime || null;
  if (d.requiresReview !== undefined) updates.requires_review = d.requiresReview;

  const { data: updated, error } = await supabase.from('job_tasks').update(updates).eq('id', taskId).select('*').single();
  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to update task' });
    return;
  }
  res.json({ task: mapTask(updated) });
}

// DELETE /api/pipeline/tasks/:taskId
export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { taskId } = req.params;
  const { data: task } = await supabase.from('job_tasks').select('*, jobs!inner(employer_id)').eq('id', taskId).single();
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  if ((task as any).jobs.employer_id !== req.user!.id) {
    res.status(403).json({ error: 'Only the job owner can edit its pipeline' });
    return;
  }
  if (task.kind !== 'task') {
    res.status(400).json({ error: 'Cannot delete the opening or closing task' });
    return;
  }

  await supabase.from('job_tasks').delete().eq('id', taskId);
  res.json({ success: true });
}

async function authorizeCompletionAccess(req: AuthenticatedRequest, applicationId: string): Promise<{ ok: boolean; isWorker: boolean; isEmployer: boolean }> {
  if (req.user?.role === 'admin') return { ok: true, isWorker: true, isEmployer: true };

  // Step 1: fetch application with a plain select (no embedded join) so RLS
  // on the `jobs` table cannot silently null-out the whole row.
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('worker_id, job_id')
    .eq('id', applicationId)
    .single();

  if (appError || !application) {
    console.error('[pipeline] authorizeCompletionAccess – application fetch failed:', appError?.message);
    return { ok: false, isWorker: false, isEmployer: false };
  }

  const userId = req.user!.id;
  const isWorker = application.worker_id === userId;

  // Step 2: fetch the job separately so the RLS embedded-join issue never
  // affects this auth check.
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('employer_id')
    .eq('id', application.job_id)
    .single();

  if (jobError || !job) {
    console.error('[pipeline] authorizeCompletionAccess – job fetch failed:', jobError?.message);
    return { ok: false, isWorker: false, isEmployer: false };
  }

  const isEmployer = job.employer_id === userId;

  if (isWorker || isEmployer) return { ok: true, isWorker, isEmployer };

  // Read-only clients: allowed if they've been invited to this specific job.
  if (req.user!.role === 'client') {
    const { data: invite } = await supabase
      .from('job_clients')
      .select('id')
      .eq('job_id', application.job_id)
      .eq('phone', req.user!.phone)
      .maybeSingle();
    if (invite) return { ok: true, isWorker: false, isEmployer: false };
  }

  return { ok: false, isWorker: false, isEmployer: false };
}

const LEGACY_SEED_TASKS = [
  { kind: 'opening' as const, title: 'Reporting', description: 'Report at the venue on time', completion_type: 'tick' as const },
  { kind: 'task' as const, title: 'Take Selfie', description: 'Live tracking selfie at the venue', completion_type: 'image' as const },
  { kind: 'task' as const, title: 'Check T-Shirt', description: 'Confirm uniform t-shirt', completion_type: 'image' as const },
  { kind: 'closing' as const, title: 'Shoes Check', description: 'Confirm black shoes and close out', completion_type: 'image' as const },
];

/** Jobs created before the custom-pipeline feature shipped have no
 * job_tasks rows. Seed them once, lazily, with the legacy fixed 4-step
 * list so old/in-flight jobs keep working under the new pipeline UI. */
async function seedLegacyTasksIfMissing(jobId: string) {
  const { data: job } = await supabase.from('jobs').select('created_at').eq('id', jobId).single();
  if (!job) return;

  // Only seed legacy tasks for jobs created before we shipped the custom pipeline builder
  if (new Date(job.created_at) >= new Date('2026-07-21T00:00:00.000Z')) {
    return;
  }

  const { count } = await supabase.from('job_tasks').select('id', { count: 'exact', head: true }).eq('job_id', jobId);
  if (count && count > 0) return;

  const rows = LEGACY_SEED_TASKS.map((t, i) => ({
    job_id: jobId,
    kind: t.kind,
    sort_order: i,
    title: t.title,
    description: t.description,
    completion_type: t.completion_type,
    requires_review: true,
  }));
  await supabase.from('job_tasks').insert(rows);
}

// GET /api/pipeline/applications/:applicationId/completions
export async function getCompletions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { applicationId } = req.params;
  const access = await authorizeCompletionAccess(req, applicationId);
  if (!access.ok) {
    res.status(403).json({ error: 'Not authorized to view this pipeline' });
    return;
  }

  const { data: applicationRow } = await supabase.from('applications').select('job_id').eq('id', applicationId).single();
  const jobId = applicationRow?.job_id;
  if (!jobId) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const { data: job } = await supabase.from('jobs').select('date, reporting_time, end_time').eq('id', jobId).single();

  await seedLegacyTasksIfMissing(jobId);

  const { data: tasks } = await supabase.from('job_tasks').select('*').eq('job_id', jobId).order('sort_order', { ascending: true });

  if (!tasks || tasks.length === 0) {
    res.json({ tasks: [], completions: [] });
    return;
  }

  let { data: completions } = await supabase
    .from('application_task_completions')
    .select('*')
    .eq('application_id', applicationId);

  // Lazily create missing completion rows so every task always has one.
  // The very first task (lowest sort_order) starts 'in_progress' immediately
  // unless it's clock-anchored and not open yet (see clockWindowFor), in which
  // case it stays 'not_started' until the job's window opens. Every later
  // task starts 'not_started' (locked) until the task before it completes
  // (see advanceNextTask).
  const existingTaskIds = new Set((completions || []).map((c) => c.job_task_id));
  const missing = tasks.filter((t) => !existingTaskIds.has(t.id));
  const isFirstEverCreation = (completions || []).length === 0;
  if (missing.length > 0) {
    const newRows = missing.map((t) => {
      const isFirstTask = t.sort_order === tasks[0].sort_order;
      const clockWindow = job ? clockWindowFor(t, job) : null;
      const clockWindowOpen = clockWindow ? Date.now() >= clockWindow.opensAt.getTime() : true;
      const startsInProgress = isFirstEverCreation && isFirstTask && clockWindowOpen;
      return {
        application_id: applicationId,
        job_task_id: t.id,
        status: startsInProgress ? 'in_progress' : 'not_started',
        available_at: startsInProgress ? new Date().toISOString() : null,
      };
    });
    const { data: created } = await supabase.from('application_task_completions').insert(newRows).select('*');
    completions = [...(completions || []), ...(created || [])];
  }

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  if (job) {
    await wakeClockAnchoredTasks(completions || [], tasks, job);
    await applyTimeBasedTransitions(completions || [], tasksById, job);
  }

  const sorted = (completions || []).sort((a, b) => {
    const ta = tasksById.get(a.job_task_id)?.sort_order ?? 0;
    const tb = tasksById.get(b.job_task_id)?.sort_order ?? 0;
    return ta - tb;
  });

  const mappedCompletions = await Promise.all(sorted.map((c) => {
    const task = tasksById.get(c.job_task_id);
    const clockWindow = job && task ? clockWindowFor(task, job, c) : null;
    return mapCompletion(c, clockWindow);
  }));
  res.json({ tasks: tasks.map(mapTask), completions: mappedCompletions });
}

/** Guards opening/closing task submissions against the job's clock window:
 * rejects a submit attempt made before the task opens (e.g. trying to
 * confirm arrival at 3:30 for a 4:00 PM job) or after its deadline has
 * passed (applyAutoFail will have already flipped it to 'failed' by then,
 * but this covers the race where the read and the submit interleave).
 * Returns an error message to send back, or null if the submit may proceed. */
async function checkClockWindowOpen(completion: Record<string, any>): Promise<string | null> {
  const { data: task } = await supabase.from('job_tasks').select('*').eq('id', completion.job_task_id).single();
  if (!task) return null;

  const { data: application } = await supabase.from('applications').select('job_id').eq('id', completion.application_id).single();
  if (!application) return null;

  const { data: job } = await supabase.from('jobs').select('date, reporting_time, end_time').eq('id', application.job_id).single();
  if (!job) return null;

  const window = clockWindowFor(task, job, completion);
  if (!window) return null;

  const now = Date.now();
  if (now < window.opensAt.getTime()) {
    return `This task opens at ${window.opensAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (now > window.deadline.getTime()) {
    return 'The window for this task has closed';
  }
  return null;
}

/** Auto-completes a worker's application the moment every one of their
 * pipeline tasks is 'complete' — each worker finishes independently, at
 * whatever pace they go through their own tasks. Only ever moves an
 * application from 'confirmed'/'hired' to 'completed'; never touches an
 * application that's already completed or in another terminal state. */
async function checkAndCompleteApplication(applicationId: string) {
  const { data: application } = await supabase.from('applications').select('status, job_id').eq('id', applicationId).single();
  if (!application || application.status === 'completed') return;

  const { data: tasks } = await supabase.from('job_tasks').select('id').eq('job_id', application.job_id);
  if (!tasks || tasks.length === 0) return;

  const { data: completions } = await supabase
    .from('application_task_completions')
    .select('job_task_id, status')
    .eq('application_id', applicationId);
  if (!completions) return;

  const completionByTaskId = new Map(completions.map((c) => [c.job_task_id, c.status]));
  const allComplete = tasks.every((t) => completionByTaskId.get(t.id) === 'complete');
  if (!allComplete) return;

  await supabase.from('applications').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', applicationId);
}

async function advanceNextTask(applicationId: string, completedTaskId: string) {
  const { data: application } = await supabase.from('applications').select('job_id').eq('id', applicationId).single();
  if (!application) return;

  const { data: tasks } = await supabase.from('job_tasks').select('*').eq('job_id', application.job_id).order('sort_order', { ascending: true });
  if (!tasks) return;

  const idx = tasks.findIndex((t) => t.id === completedTaskId);
  const next = idx >= 0 ? tasks[idx + 1] : undefined;
  if (!next) return;

  // A clock-anchored next task (e.g. Closing Task tied to the job's end
  // time) only unlocks once its window opens, even if all prior tasks
  // finished early. wakeClockAnchoredTasks (called from getCompletions)
  // flips it to in_progress later once the window opens.
  const { data: job } = await supabase.from('jobs').select('date, reporting_time, end_time').eq('id', application.job_id).single();
  const clockWindow = job ? clockWindowFor(next, job) : null;
  if (clockWindow && Date.now() < clockWindow.opensAt.getTime()) return;

  await supabase
    .from('application_task_completions')
    .update({ status: 'in_progress', available_at: new Date().toISOString() })
    .eq('application_id', applicationId)
    .eq('job_task_id', next.id)
    .eq('status', 'not_started');
}

// POST /api/pipeline/completions/:completionId/tick
export async function tickCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.ok) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const windowError = await checkClockWindowOpen(completion);
  if (windowError) {
    res.status(400).json({ error: windowError });
    return;
  }

  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({ status: 'complete', submitted_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to update task' });
    return;
  }

  await advanceNextTask(completion.application_id, completion.job_task_id);
  await checkAndCompleteApplication(completion.application_id);
  res.json({ completion: await mapCompletion(updated) });
}

// POST /api/pipeline/completions/:completionId/form
export async function submitFormCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const parsed = z.object({ formData: z.record(z.union([z.string(), z.number()])) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.isWorker) {
    res.status(403).json({ error: 'Only the assigned worker can submit this task' });
    return;
  }

  const windowError = await checkClockWindowOpen(completion);
  if (windowError) {
    res.status(400).json({ error: windowError });
    return;
  }

  const { data: task } = await supabase.from('job_tasks').select('requires_review').eq('id', completion.job_task_id).single();
  const nextStatus = task?.requires_review ? 'submitted' : 'complete';

  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({
      status: nextStatus,
      form_data: parsed.data.formData,
      submitted_at: new Date().toISOString(),
      ...(nextStatus === 'complete' ? { reviewed_at: new Date().toISOString() } : {}),
    })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to submit task' });
    return;
  }

  if (nextStatus === 'complete') {
    await advanceNextTask(completion.application_id, completion.job_task_id);
    await checkAndCompleteApplication(completion.application_id);
  }
  res.json({ completion: await mapCompletion(updated) });
}

// POST /api/pipeline/completions/:completionId/image
export async function submitImageCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const parsed = z.object({ image: z.string().min(32) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.isWorker) {
    res.status(403).json({ error: 'Only the assigned worker can submit this task' });
    return;
  }

  const windowError = await checkClockWindowOpen(completion);
  if (windowError) {
    res.status(400).json({ error: windowError });
    return;
  }

  const { data: task } = await supabase.from('job_tasks').select('requires_review').eq('id', completion.job_task_id).single();
  const nextStatus = task?.requires_review !== false ? 'submitted' : 'complete';

  let imagePath: string;
  try {
    imagePath = await uploadTaskImage(parsed.data.image, req.user!.id, `task-${completion.job_task_id}`);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to upload image' });
    return;
  }

  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({
      status: nextStatus,
      image_path: imagePath,
      submitted_at: new Date().toISOString(),
      ...(nextStatus === 'complete' ? { reviewed_at: new Date().toISOString() } : {}),
    })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to submit task' });
    return;
  }

  if (nextStatus === 'complete') {
    await advanceNextTask(completion.application_id, completion.job_task_id);
    await checkAndCompleteApplication(completion.application_id);
  }
  res.json({ completion: await mapCompletion(updated) });
}

// POST /api/pipeline/completions/:completionId/review
export async function reviewCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const parsed = z.object({ approve: z.boolean(), rejectionReason: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.isEmployer) {
    res.status(403).json({ error: 'Only the employer can review this task' });
    return;
  }
  if (completion.status !== 'submitted') {
    res.status(400).json({ error: 'Task is not awaiting review' });
    return;
  }

  const { approve, rejectionReason } = parsed.data;
  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({
      status: approve ? 'complete' : 'failed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user!.id,
      rejection_reason: approve ? null : rejectionReason || 'Rejected by employer',
    })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to review task' });
    return;
  }

  if (approve) {
    await advanceNextTask(completion.application_id, completion.job_task_id);
    await checkAndCompleteApplication(completion.application_id);
  }
  res.json({ completion: await mapCompletion(updated) });
}

// POST /api/pipeline/completions/:completionId/employer-complete
// Emergency override: employer force-completes a single task (e.g. worker's
// phone died, missed the clock window) regardless of its current status or
// the clock window. Only advances/checks the one task — does not touch
// any other task in the pipeline.
export async function employerForceComplete(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.isEmployer) {
    res.status(403).json({ error: 'Only the employer can override this task' });
    return;
  }

  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({
      status: 'complete',
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user!.id,
      rejection_reason: null,
    })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to complete task' });
    return;
  }

  await advanceNextTask(completion.application_id, completion.job_task_id);
  await checkAndCompleteApplication(completion.application_id);
  res.json({ completion: await mapCompletion(updated) });
}

// POST /api/pipeline/completions/:completionId/employer-reopen
// Emergency override: employer reopens a failed (or otherwise stuck) task
// for one worker, giving them a fresh window to submit — used when a clock
// window closed for a reason outside the worker's control. Clock-anchored
// tasks get a fresh window starting now, sized the same as their original
// open_minutes_after; relative-timer tasks reuse their auto_fail_minutes.
export async function employerReopenTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.isEmployer) {
    res.status(403).json({ error: 'Only the employer can reopen this task' });
    return;
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('application_task_completions')
    .update({
      status: 'in_progress',
      available_at: now,
      manually_reopened_at: now,
      submitted_at: null,
      reviewed_at: null,
      rejection_reason: null,
    })
    .eq('id', completionId)
    .select('*')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: error?.message || 'Failed to reopen task' });
    return;
  }

  const { data: application } = await supabase.from('applications').select('job_id').eq('id', completion.application_id).single();
  const { data: task } = await supabase.from('job_tasks').select('*').eq('id', completion.job_task_id).single();
  const { data: job } = application ? await supabase.from('jobs').select('date, reporting_time, end_time').eq('id', application.job_id).single() : { data: null };
  const clockWindow = job && task ? clockWindowFor(task, job, updated) : null;

  res.json({ completion: await mapCompletion(updated, clockWindow) });
}

// GET /api/pipeline/completions/:completionId/image-url
export async function getCompletionImageUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { completionId } = req.params;
  const { data: completion } = await supabase.from('application_task_completions').select('*').eq('id', completionId).single();
  if (!completion) {
    res.status(404).json({ error: 'Task completion not found' });
    return;
  }
  const access = await authorizeCompletionAccess(req, completion.application_id);
  if (!access.ok) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const url = await getSignedTaskImageUrl(completion.image_path);
  res.json({ imageUrl: url });
}

// GET /api/pipeline/public/:shareToken — no auth required, read-only
export async function getPublicPipeline(req: any, res: any): Promise<void> {
  const { shareToken } = req.params;

  let isSingleWorker = false;
  let singleWorkerApp: any = null;

  // Check if shareToken matches an application ID or application share token
  const { data: matchedApp } = await supabase
    .from('applications')
    .select('id, job_id, worker_id, status')
    .or(`id.eq.${shareToken},pipeline_share_token.eq.${shareToken}`)
    .limit(1)
    .maybeSingle();

  if (matchedApp) {
    isSingleWorker = true;
    singleWorkerApp = matchedApp;
  }

  // Resolve the job by ID or share token
  const jobIdToFind = isSingleWorker ? singleWorkerApp.job_id : null;
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, location, pipeline_share_token')
    .or(jobIdToFind ? `id.eq.${jobIdToFind}` : `pipeline_share_token.eq.${shareToken},id.eq.${shareToken}`)
    .limit(1)
    .maybeSingle();

  if (!job) {
    res.status(404).json({ message: 'Pipeline not found or link is invalid' });
    return;
  }

  // Find target applications
  let applications: any[] = [];
  if (isSingleWorker) {
    applications = [singleWorkerApp];
  } else {
    const { data: appsData, error: appsError } = await supabase
      .from('applications')
      .select('id, worker_id, status')
      .eq('job_id', job.id)
      .in('status', ['hired', 'confirmed', 'completed']);

    if (appsError) {
      console.error('[pipeline] getPublicPipeline – applications fetch failed:', appsError.message);
    }
    applications = appsData || [];
  }

  if (applications.length === 0) {
    res.json({
      jobTitle: job.title,
      jobLocation: job.location || '',
      jobId: job.id,
      isSingleWorker,
      workers: [],
    });
    return;
  }

  // Fetch profiles for target workers
  const workerIds = applications.map((a: any) => a.worker_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, phone, avatar, selfie_url')
    .in('id', workerIds);

  if (profilesError) {
    console.error('[pipeline] getPublicPipeline – profiles fetch failed:', profilesError.message);
  }
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  // Also fetch KYC documents for real names if profile.name is missing/generic
  const { data: kycDocs } = await supabase
    .from('kyc_documents')
    .select('user_id, full_name')
    .in('user_id', workerIds);
  const kycMap = new Map((kycDocs || []).map((k: any) => [k.user_id, k.full_name]));

  // Fetch tasks for this job
  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('*')
    .eq('job_id', job.id)
    .order('sort_order', { ascending: true });

  const { data: jobRow } = await supabase
    .from('jobs')
    .select('date, reporting_time, end_time')
    .eq('id', job.id)
    .single();

  const tasksById = new Map((tasks || []).map((t: any) => [t.id, t]));

  // Build worker pipeline data
  const workers = await Promise.all(
    applications.map(async (app: any, idx: number) => {
      const profile = profileMap.get(app.worker_id);
      const kycFullName = kycMap.get(app.worker_id);

      let workerName = profile?.name?.trim();
      // If profile name is empty or default 'Worker', try KYC full_name
      if (!workerName || workerName === 'Worker') {
        if (kycFullName && kycFullName.trim()) {
          workerName = kycFullName.trim();
        }
      }

      // If still missing/generic, use index or phone fallback
      if (!workerName || workerName === 'Worker') {
        if (isSingleWorker) {
          workerName = profile?.phone ? `Worker (${profile.phone.slice(-4)})` : 'Worker';
        } else {
          workerName = `Worker ${idx + 1}`;
        }
      }

      const workerAvatar = profile?.avatar || profile?.selfie_url || undefined;

      let { data: completions } = await supabase
        .from('application_task_completions')
        .select('*')
        .eq('application_id', app.id);

      if (jobRow) {
        await wakeClockAnchoredTasks(completions || [], tasks || [], jobRow);
        await applyTimeBasedTransitions(completions || [], tasksById, jobRow);
      }

      const mappedCompletions = await Promise.all(
        (completions || []).map(async (c: any) => {
          const task = tasksById.get(c.job_task_id);
          const clockWindow = jobRow && task ? clockWindowFor(task, jobRow, c) : null;
          return mapCompletion(c, clockWindow);
        })
      );

      return {
        applicationId: app.id,
        workerName,
        workerAvatar,
        tasks: (tasks || []).map(mapTask),
        completions: mappedCompletions,
      };
    })
  );

  const primaryWorkerName = workers[0]?.workerName || 'Worker';
  const pageTitle = isSingleWorker ? `${primaryWorkerName}'s Pipeline — ${job.title}` : `All Workers' Pipeline — ${job.title}`;

  res.json({
    pageTitle,
    jobTitle: job.title,
    jobLocation: job.location || '',
    jobId: job.id,
    isSingleWorker,
    singleWorkerName: isSingleWorker ? primaryWorkerName : undefined,
    workers,
  });
}

