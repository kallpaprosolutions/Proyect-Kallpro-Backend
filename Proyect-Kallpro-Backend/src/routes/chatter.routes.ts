import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMessages, createMessage, getFollowers, postFollow, deleteFollow } from '../controllers/chatter.controller';

const router = Router();
router.use(authMiddleware);

router.get('/:entityType/:entityId', getMessages);
router.post('/:entityType/:entityId', createMessage);

router.get('/:entityType/:entityId/followers', getFollowers);
router.post('/:entityType/:entityId/follow', postFollow);
router.delete('/:entityType/:entityId/follow', deleteFollow);

export default router;
