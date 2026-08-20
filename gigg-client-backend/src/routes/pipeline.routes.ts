import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listJobTasks,
  saveJobTasks,
  updateTask,
  deleteTask,
  getCompletions,
  tickCompletion,
  submitFormCompletion,
  submitImageCompletion,
  reviewCompletion,
  employerForceComplete,
  employerReopenTask,
  getCompletionImageUrl,
  getPublicPipeline,
} from '../controllers/pipeline.controller';

const router = Router();

// ── Public (no auth) ──────────────────────────────────────────────────────
router.get('/public/:shareToken', getPublicPipeline);

// ── Authenticated ─────────────────────────────────────────────────────────
router.use(requireAuth);

router.get('/jobs/:jobId/tasks', listJobTasks);
router.post('/jobs/:jobId/tasks', saveJobTasks);
router.patch('/tasks/:taskId', updateTask);
router.delete('/tasks/:taskId', deleteTask);

router.get('/applications/:applicationId/completions', getCompletions);
router.post('/completions/:completionId/tick', tickCompletion);
router.post('/completions/:completionId/form', submitFormCompletion);
router.post('/completions/:completionId/image', submitImageCompletion);
router.post('/completions/:completionId/review', reviewCompletion);
router.post('/completions/:completionId/employer-complete', employerForceComplete);
router.post('/completions/:completionId/employer-reopen', employerReopenTask);
router.get('/completions/:completionId/image-url', getCompletionImageUrl);

export default router;

