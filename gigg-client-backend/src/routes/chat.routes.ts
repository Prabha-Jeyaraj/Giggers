import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  uploadChatImage,
  getOrCreateThread,
  getThreadDetails,
  listUserThreads,
  listGroupMessages,
  sendMessage,
  sendGroupMessage,
} from '../controllers/chat.controller';

const router = Router();

router.use(requireAuth);

router.post('/upload', uploadChatImage);
router.get('/threads', listUserThreads);
router.get('/threads/:threadId', getThreadDetails);
router.post('/threads', getOrCreateThread);
router.get('/group-messages/:jobId', listGroupMessages);
router.post('/messages', sendMessage);
router.post('/group-messages', sendGroupMessage);

export default router;
