"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const pipeline_controller_1 = require("../controllers/pipeline.controller");
const router = (0, express_1.Router)();
// ── Public (no auth) ──────────────────────────────────────────────────────
router.get('/public/:shareToken', pipeline_controller_1.getPublicPipeline);
// ── Authenticated ─────────────────────────────────────────────────────────
router.use(auth_1.requireAuth);
router.get('/jobs/:jobId/tasks', pipeline_controller_1.listJobTasks);
router.post('/jobs/:jobId/tasks', pipeline_controller_1.saveJobTasks);
router.patch('/tasks/:taskId', pipeline_controller_1.updateTask);
router.delete('/tasks/:taskId', pipeline_controller_1.deleteTask);
router.get('/applications/:applicationId/completions', pipeline_controller_1.getCompletions);
router.post('/completions/:completionId/tick', pipeline_controller_1.tickCompletion);
router.post('/completions/:completionId/form', pipeline_controller_1.submitFormCompletion);
router.post('/completions/:completionId/image', pipeline_controller_1.submitImageCompletion);
router.post('/completions/:completionId/review', pipeline_controller_1.reviewCompletion);
router.post('/completions/:completionId/employer-complete', pipeline_controller_1.employerForceComplete);
router.post('/completions/:completionId/employer-reopen', pipeline_controller_1.employerReopenTask);
router.get('/completions/:completionId/image-url', pipeline_controller_1.getCompletionImageUrl);
exports.default = router;
//# sourceMappingURL=pipeline.routes.js.map