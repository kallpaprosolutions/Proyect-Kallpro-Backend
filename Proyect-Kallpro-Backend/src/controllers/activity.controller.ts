import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';
import { listCompanyUsers } from '../services/auth.service';
import {
  listActivitiesForEntity, listMyActivities, createActivity,
  completeActivity, reopenActivity, deleteActivity,
} from '../services/activity.service';

/** GET /api/activities/mine — widget "Mis actividades" (A3). */
export const getMyActivities = asyncHandler(async (req: AuthRequest, res) => {
  const includeDone = req.query.includeDone === '1';
  const activities = await listMyActivities(req.user!.companyId, req.user!.userId, { includeDone });
  res.json({ activities });
});

/** GET /api/activities/assignable-users — a quién se le puede asignar una actividad. */
export const getAssignableUsers = asyncHandler(async (req: AuthRequest, res) => {
  const users = await listCompanyUsers(req.user!.companyId);
  res.json(users.filter((u) => u.isActive).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email })));
});

/** GET /api/activities/:entityType/:entityId — actividades agendadas sobre un documento. */
export const getEntityActivities = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const activities = await listActivitiesForEntity(req.user!.companyId, entityType, entityId);
  res.json({ activities });
});

/** POST /api/activities/:entityType/:entityId — agenda una actividad sobre el documento. */
export const postActivity = asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.params;
  const activity = await createActivity(req.user!.companyId, req.user!.userId, { ...req.body, entityType, entityId });
  res.status(201).json(activity);
});

/** PATCH /api/activities/:id/complete */
export const patchComplete = asyncHandler(async (req: AuthRequest, res) => {
  const activity = await completeActivity(req.params.id, req.user!.companyId, req.user!.userId);
  res.json(activity);
});

/** PATCH /api/activities/:id/reopen */
export const patchReopen = asyncHandler(async (req: AuthRequest, res) => {
  const activity = await reopenActivity(req.params.id, req.user!.companyId, req.user!.userId);
  res.json(activity);
});

/** DELETE /api/activities/:id */
export const removeActivity = asyncHandler(async (req: AuthRequest, res) => {
  await deleteActivity(req.params.id, req.user!.companyId, req.user!.userId);
  res.status(204).send();
});
