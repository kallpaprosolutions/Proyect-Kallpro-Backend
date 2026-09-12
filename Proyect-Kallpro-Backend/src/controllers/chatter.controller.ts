import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';
import { listMessages, postMessage, listFollowers, followEntity, unfollowEntity } from '../services/chatter.service';

/**
 * GET /api/chatter/:entityType/:entityId — hilo de mensajes del documento (A2).
 */
export const getMessages = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const messages = await listMessages(req.user!.companyId, entityType, entityId);
  res.json({ messages });
});

/**
 * POST /api/chatter/:entityType/:entityId — publica un mensaje (o nota interna) en el hilo (A2/A2.2).
 * Body: { body: string, kind?: 'MESSAGE' | 'NOTE' }
 */
export const createMessage = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const message = await postMessage(
    req.user!.companyId,
    req.user!.userId,
    entityType,
    entityId,
    req.body?.body,
    req.body?.kind,
  );
  res.status(201).json(message);
});

/** GET /api/chatter/:entityType/:entityId/followers — quién sigue el documento (A2.2). */
export const getFollowers = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const followers = await listFollowers(req.user!.companyId, entityType, entityId);
  res.json({ followers, followingMe: followers.some((f) => f.userId === req.user!.userId) });
});

/** POST /api/chatter/:entityType/:entityId/follow */
export const postFollow = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  await followEntity(req.user!.companyId, req.user!.userId, entityType, entityId);
  res.status(204).send();
});

/** DELETE /api/chatter/:entityType/:entityId/follow */
export const deleteFollow = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  await unfollowEntity(req.user!.companyId, req.user!.userId, entityType, entityId);
  res.status(204).send();
});
